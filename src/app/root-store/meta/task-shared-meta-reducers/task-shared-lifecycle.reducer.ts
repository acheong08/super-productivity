import { Action, ActionReducer, MetaReducer } from '@ngrx/store';
import { Update } from '@ngrx/entity';
import { RootState } from '../../root-state';
import { TaskSharedActions } from '../task-shared.actions';
import {
  PROJECT_FEATURE_NAME,
  projectAdapter,
} from '../../../features/project/store/project.reducer';
import { TAG_FEATURE_NAME } from '../../../features/tag/store/tag.reducer';
import {
  TASK_FEATURE_NAME,
  taskAdapter,
} from '../../../features/tasks/store/task.reducer';
import { Tag } from '../../../features/tag/tag.model';
import { Project } from '../../../features/project/project.model';
import { Task, TaskWithSubTasks } from '../../../features/tasks/task.model';
import { TODAY_TAG } from '../../../features/tag/tag.const';
import { unique } from '../../../util/unique';
import {
  ActionHandlerMap,
  getProject,
  getTag,
  removeTasksFromList,
  TaskEntity,
  updateTags,
} from './task-shared-helpers';

// =============================================================================
// ACTION HANDLERS
// =============================================================================

const handleMoveToArchive = (state: RootState, tasks: TaskWithSubTasks[]): RootState => {
  const taskIdsToArchive = tasks.flatMap((t) => [t.id, ...t.subTasks.map((st) => st.id)]);

  // Update projects
  const projectIds = unique(
    tasks.map((t) => t.projectId).filter((pid): pid is string => !!pid),
  );

  let updatedState = state;

  if (projectIds.length > 0) {
    const projectUpdates = projectIds.map((pid): Update<Project> => {
      const project = getProject(state, pid);
      return {
        id: pid,
        changes: {
          taskIds: removeTasksFromList(project.taskIds, taskIdsToArchive),
          backlogTaskIds: removeTasksFromList(project.backlogTaskIds, taskIdsToArchive),
        },
      };
    });

    updatedState = {
      ...updatedState,
      [PROJECT_FEATURE_NAME]: projectAdapter.updateMany(
        projectUpdates,
        updatedState[PROJECT_FEATURE_NAME],
      ),
    };
  }

  // Update tags
  const affectedTagIds = unique([
    TODAY_TAG.id, // always cleanup today tag
    ...tasks.flatMap((t) => [...t.tagIds, ...t.subTasks.flatMap((st) => st.tagIds)]),
  ]);

  const tagUpdates = affectedTagIds.map(
    (tagId): Update<Tag> => ({
      id: tagId,
      changes: {
        taskIds: removeTasksFromList(getTag(state, tagId).taskIds, taskIdsToArchive),
      },
    }),
  );

  return updateTags(updatedState, tagUpdates);
};

const handleRestoreTask = (
  state: RootState,
  task: TaskEntity,
  subTasks: Task[],
): RootState => {
  // First, restore the task entities with proper state
  const restoredTask = {
    ...task,
    isDone: false,
    doneOn: undefined,
  };

  const updatedTaskState = taskAdapter.addMany(
    [restoredTask as Task, ...subTasks],
    state[TASK_FEATURE_NAME],
  );

  let updatedState = {
    ...state,
    [TASK_FEATURE_NAME]: updatedTaskState,
  };

  // Update project if task has projectId
  if (task.projectId) {
    const project = getProject(state, task.projectId);
    updatedState = {
      ...updatedState,
      [PROJECT_FEATURE_NAME]: projectAdapter.updateOne(
        {
          id: task.projectId,
          changes: {
            taskIds: unique([...project.taskIds, task.id]),
          },
        },
        updatedState[PROJECT_FEATURE_NAME],
      ),
    };
  }

  // Update tags - group tasks by tagId
  const allTasks = [task, ...subTasks];
  const tagTaskMap = allTasks.reduce(
    (map, t) => {
      (t.tagIds || []).forEach((tagId) => {
        if (!map[tagId]) map[tagId] = [];
        map[tagId].push(t.id);
      });
      return map;
    },
    {} as Record<string, string[]>,
  );

  const tagUpdates = Object.entries(tagTaskMap)
    .filter(([tagId]) => state[TAG_FEATURE_NAME].entities[tagId]) // Only update existing tags
    .map(
      ([tagId, taskIds]): Update<Tag> => ({
        id: tagId,
        changes: {
          taskIds: unique([...getTag(updatedState, tagId).taskIds, ...taskIds]),
        },
      }),
    );

  return updateTags(updatedState, tagUpdates);
};

// =============================================================================
// META REDUCER
// =============================================================================

const createActionHandlers = (state: RootState, action: Action): ActionHandlerMap => ({
  [TaskSharedActions.moveToArchive.type]: () => {
    const { tasks } = action as ReturnType<typeof TaskSharedActions.moveToArchive>;
    return handleMoveToArchive(state, tasks);
  },
  [TaskSharedActions.restoreTask.type]: () => {
    const { task, subTasks } = action as ReturnType<typeof TaskSharedActions.restoreTask>;
    return handleRestoreTask(state, task, subTasks);
  },
});

export const taskSharedLifecycleMetaReducer: MetaReducer = (
  reducer: ActionReducer<any, Action>,
) => {
  return (state: unknown, action: Action) => {
    if (!state) return reducer(state, action);

    const rootState = state as RootState;
    const actionHandlers = createActionHandlers(rootState, action);
    const handler = actionHandlers[action.type];
    const updatedState = handler ? handler(rootState) : rootState;

    return reducer(updatedState, action);
  };
};
