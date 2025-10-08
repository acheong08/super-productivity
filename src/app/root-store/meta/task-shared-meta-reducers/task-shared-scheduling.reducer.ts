import { Action, ActionReducer, MetaReducer } from '@ngrx/store';
import { Update } from '@ngrx/entity';
import { RootState } from '../../root-state';
import { TaskSharedActions } from '../task-shared.actions';
import {
  TASK_FEATURE_NAME,
  taskAdapter,
} from '../../../features/tasks/store/task.reducer';
import { Task } from '../../../features/tasks/task.model';
import { TODAY_TAG } from '../../../features/tag/tag.const';
import { getDbDateStr } from '../../../util/get-db-date-str';
import { unique } from '../../../util/unique';
import { isToday } from '../../../util/is-today.util';
import { moveItemBeforeItem } from '../../../util/move-item-before-item';
import {
  ActionHandlerMap,
  getTag,
  removeTasksFromList,
  updateTags,
} from './task-shared-helpers';

// =============================================================================
// ACTION HANDLERS
// =============================================================================

const handleScheduleTaskWithTime = (
  state: RootState,
  task: { id: string },
  dueWithTime: number,
): RootState => {
  // Check if task already has the same dueWithTime
  const currentTask = state[TASK_FEATURE_NAME].entities[task.id] as Task;
  if (!currentTask) {
    return state;
  }

  const todayTag = getTag(state, TODAY_TAG.id);
  const isScheduledForToday = isToday(dueWithTime);
  const isCurrentlyInToday = todayTag.taskIds.includes(task.id);

  // If task is already correctly scheduled, don't change state
  if (
    currentTask.dueWithTime === dueWithTime &&
    isScheduledForToday === isCurrentlyInToday
  ) {
    return state;
  }

  // First, update the task entity with the scheduling data
  const updatedState = {
    ...state,
    [TASK_FEATURE_NAME]: taskAdapter.updateOne(
      {
        id: task.id,
        changes: {
          dueWithTime,
          dueDay: undefined,
        },
      },
      state[TASK_FEATURE_NAME],
    ),
  };

  // No tag change needed
  if (isScheduledForToday === isCurrentlyInToday) {
    return updatedState;
  }

  const newTaskIds = isScheduledForToday
    ? unique([task.id, ...todayTag.taskIds]) // Add to top, prevent duplicates
    : todayTag.taskIds.filter((id) => id !== task.id); // Remove

  return updateTags(updatedState, [
    {
      id: TODAY_TAG.id,
      changes: { taskIds: newTaskIds },
    },
  ]);
};

const handleUnScheduleTask = (state: RootState, taskId: string): RootState => {
  // First, update the task entity to clear scheduling data
  const updatedState = {
    ...state,
    [TASK_FEATURE_NAME]: taskAdapter.updateOne(
      {
        id: taskId,
        changes: {
          dueDay: undefined,
          dueWithTime: undefined,
        },
      },
      state[TASK_FEATURE_NAME],
    ),
  };

  // Then, handle today tag updates
  const todayTag = getTag(updatedState, TODAY_TAG.id);

  if (!todayTag.taskIds.includes(taskId)) {
    return updatedState;
  }

  return updateTags(updatedState, [
    {
      id: TODAY_TAG.id,
      changes: {
        taskIds: todayTag.taskIds.filter((id) => id !== taskId),
      },
    },
  ]);
};

const handleDismissReminderOnly = (state: RootState, taskId: string): RootState => {
  // Only clear the dueWithTime (reminder time) but keep dueDay and Today tag
  return {
    ...state,
    [TASK_FEATURE_NAME]: taskAdapter.updateOne(
      {
        id: taskId,
        changes: {
          dueWithTime: undefined,
        },
      },
      state[TASK_FEATURE_NAME],
    ),
  };
};

const handlePlanTasksForToday = (
  state: RootState,
  taskIds: string[],
  parentTaskMap: Record<string, string | undefined>,
): RootState => {
  const todayTag = getTag(state, TODAY_TAG.id);
  const today = getDbDateStr();

  // Filter out tasks that are already in today or whose parent is in today
  const newTasksForToday = taskIds.filter((taskId) => {
    if (todayTag.taskIds.includes(taskId)) return false;
    const parentId = parentTaskMap[taskId];
    return !parentId || !todayTag.taskIds.includes(parentId);
  });

  // First, update the task entities with dueDay
  const taskUpdates: Update<Task>[] = taskIds.map((taskId) => ({
    id: taskId,
    changes: {
      dueDay: today,
      // Ensure we never keep both a day and a time
      dueWithTime: undefined,
    },
  }));

  const updatedState = {
    ...state,
    [TASK_FEATURE_NAME]: taskAdapter.updateMany(taskUpdates, state[TASK_FEATURE_NAME]),
  };

  // Update the today tag
  const stateWithTodayTag = updateTags(updatedState, [
    {
      id: TODAY_TAG.id,
      changes: {
        taskIds: unique([...newTasksForToday, ...todayTag.taskIds]),
      },
    },
  ]);

  // Remove taskIds from planner days if planner state exists
  if (stateWithTodayTag.planner?.days) {
    const plannerDaysCopy = { ...stateWithTodayTag.planner.days };
    Object.keys(plannerDaysCopy).forEach((day) => {
      const filtered = plannerDaysCopy[day].filter((id) => !taskIds.includes(id));
      if (filtered.length !== plannerDaysCopy[day].length) {
        plannerDaysCopy[day] = filtered;
      }
    });

    return {
      ...stateWithTodayTag,
      planner: {
        ...stateWithTodayTag.planner,
        days: plannerDaysCopy,
      },
    };
  }

  return stateWithTodayTag;
};

const handleRemoveTasksFromTodayTag = (
  state: RootState,
  taskIds: string[],
): RootState => {
  const todayTag = getTag(state, TODAY_TAG.id);

  return updateTags(state, [
    {
      id: TODAY_TAG.id,
      changes: {
        taskIds: removeTasksFromList(todayTag.taskIds, taskIds),
      },
    },
  ]);
};

const handleMoveTaskInTodayTagList = (
  state: RootState,
  toTaskId: string,
  fromTaskId: string,
): RootState => {
  const todayTag = getTag(state, TODAY_TAG.id);

  // If either task is not in the Today list, don't perform the move
  if (!todayTag.taskIds.includes(fromTaskId) || !todayTag.taskIds.includes(toTaskId)) {
    return state;
  }

  return updateTags(state, [
    {
      id: todayTag.id,
      changes: {
        taskIds: moveItemBeforeItem(todayTag.taskIds, fromTaskId, toTaskId),
      },
    },
  ]);
};

// =============================================================================
// META REDUCER
// =============================================================================

const createActionHandlers = (state: RootState, action: Action): ActionHandlerMap => ({
  [TaskSharedActions.scheduleTaskWithTime.type]: () => {
    const { task, dueWithTime } = action as ReturnType<
      typeof TaskSharedActions.scheduleTaskWithTime
    >;
    return handleScheduleTaskWithTime(state, task, dueWithTime);
  },
  [TaskSharedActions.reScheduleTaskWithTime.type]: () => {
    const { task, dueWithTime } = action as ReturnType<
      typeof TaskSharedActions.reScheduleTaskWithTime
    >;
    return handleScheduleTaskWithTime(state, task, dueWithTime);
  },
  [TaskSharedActions.unscheduleTask.type]: () => {
    const { id } = action as ReturnType<typeof TaskSharedActions.unscheduleTask>;
    return handleUnScheduleTask(state, id);
  },
  [TaskSharedActions.dismissReminderOnly.type]: () => {
    const { id } = action as ReturnType<typeof TaskSharedActions.dismissReminderOnly>;
    return handleDismissReminderOnly(state, id);
  },
  [TaskSharedActions.planTasksForToday.type]: () => {
    const { taskIds, parentTaskMap = {} } = action as ReturnType<
      typeof TaskSharedActions.planTasksForToday
    >;
    return handlePlanTasksForToday(state, taskIds, parentTaskMap);
  },
  [TaskSharedActions.removeTasksFromTodayTag.type]: () => {
    const { taskIds } = action as ReturnType<
      typeof TaskSharedActions.removeTasksFromTodayTag
    >;
    return handleRemoveTasksFromTodayTag(state, taskIds);
  },
  [TaskSharedActions.moveTaskInTodayTagList.type]: () => {
    const { toTaskId, fromTaskId } = action as ReturnType<
      typeof TaskSharedActions.moveTaskInTodayTagList
    >;
    return handleMoveTaskInTodayTagList(state, toTaskId, fromTaskId);
  },
});

export const taskSharedSchedulingMetaReducer: MetaReducer = (
  reducer: ActionReducer<RootState, Action>,
) => {
  return (state: unknown, action: Action) => {
    if (!state) return reducer(state as RootState | undefined, action);

    const rootState = state as RootState;
    const actionHandlers = createActionHandlers(rootState, action);
    const handler = actionHandlers[action.type];
    const updatedState = handler ? handler(rootState) : rootState;

    return reducer(updatedState, action);
  };
};
