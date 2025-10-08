import { inject, Injectable } from '@angular/core';
import { select, Store } from '@ngrx/store';
import {
  addTaskRepeatCfgToTask,
  deleteTaskRepeatCfg,
  deleteTaskRepeatCfgs,
  updateTaskRepeatCfg,
  updateTaskRepeatCfgs,
  upsertTaskRepeatCfg,
  deleteTaskRepeatCfgInstance,
} from './store/task-repeat-cfg.actions';
import { Observable } from 'rxjs';
import {
  TaskRepeatCfg,
  TaskRepeatCfgCopy,
  TaskRepeatCfgState,
} from './task-repeat-cfg.model';
import { nanoid } from 'nanoid';
import { DialogConfirmComponent } from '../../ui/dialog-confirm/dialog-confirm.component';
import { MatDialog } from '@angular/material/dialog';
import { T } from '../../t.const';
import { first, take } from 'rxjs/operators';
import { TaskService } from '../tasks/task.service';
import { Task } from '../tasks/task.model';
import { TaskSharedActions } from '../../root-store/meta/task-shared.actions';
import { addSubTask } from '../tasks/store/task.actions';
import { WorkContextService } from '../work-context/work-context.service';
import { WorkContextType } from '../work-context/work-context.model';
import { isValidSplitTime } from '../../util/is-valid-split-time';
import { getDateTimeFromClockString } from '../../util/get-date-time-from-clock-string';
import { isSameDay } from '../../util/is-same-day';
import { remindOptionToMilliseconds } from '../tasks/util/remind-option-to-milliseconds';
import { getNewestPossibleDueDate } from './store/get-newest-possible-due-date.util';
import { getDbDateStr } from '../../util/get-db-date-str';
import { TODAY_TAG } from '../tag/tag.const';
import {
  selectAllTaskRepeatCfgs,
  selectTaskRepeatCfgById,
  selectTaskRepeatCfgByIdAllowUndefined,
  selectAllUnprocessedTaskRepeatCfgs,
  selectTaskRepeatCfgsForExactDay,
} from './store/task-repeat-cfg.selectors';
import { devError } from '../../util/dev-error';

@Injectable({
  providedIn: 'root',
})
export class TaskRepeatCfgService {
  private _store$ = inject<Store<TaskRepeatCfgState>>(Store);
  private _matDialog = inject(MatDialog);
  private _taskService = inject(TaskService);
  private _workContextService = inject(WorkContextService);

  taskRepeatCfgs$: Observable<TaskRepeatCfg[]> = this._store$.pipe(
    select(selectAllTaskRepeatCfgs),
  );

  getRepeatableTasksForExactDay$(dayDate: number): Observable<TaskRepeatCfg[]> {
    // ===> taskRepeatCfgs where calculated due date matches the specified day
    return this._store$.select(selectTaskRepeatCfgsForExactDay, { dayDate });
  }

  getAllUnprocessedRepeatableTasks$(dayDate: number): Observable<TaskRepeatCfg[]> {
    // ===> taskRepeatCfgs scheduled for today and not yet created already
    return this._store$
      .select(selectAllUnprocessedTaskRepeatCfgs, { dayDate })
      .pipe(first());
  }

  getTaskRepeatCfgById$(id: string): Observable<TaskRepeatCfg> {
    return this._store$.select(selectTaskRepeatCfgById, { id });
  }

  getTaskRepeatCfgByIdAllowUndefined$(id: string): Observable<TaskRepeatCfg | undefined> {
    return this._store$.select(selectTaskRepeatCfgByIdAllowUndefined, { id });
  }

  addTaskRepeatCfgToTask(
    taskId: string,
    projectId: string | null,
    taskRepeatCfg: Omit<TaskRepeatCfgCopy, 'id'>,
  ): void {
    this._store$.dispatch(
      addTaskRepeatCfgToTask({
        taskRepeatCfg: {
          ...taskRepeatCfg,
          projectId,
          id: nanoid(),
        },
        taskId,
      }),
    );
  }

  deleteTaskRepeatCfg(id: string): void {
    this._store$.dispatch(deleteTaskRepeatCfg({ id }));
  }

  deleteTaskRepeatCfgsNoTaskCleanup(ids: string[]): void {
    this._store$.dispatch(deleteTaskRepeatCfgs({ ids }));
  }

  updateTaskRepeatCfg(
    id: string,
    changes: Partial<TaskRepeatCfg>,
    isUpdateAllTaskInstances: boolean = false,
  ): void {
    this._store$.dispatch(
      updateTaskRepeatCfg({
        taskRepeatCfg: { id, changes },
        isAskToUpdateAllTaskInstances: isUpdateAllTaskInstances,
      }),
    );
  }

  updateTaskRepeatCfgs(ids: string[], changes: Partial<TaskRepeatCfg>): void {
    this._store$.dispatch(updateTaskRepeatCfgs({ ids, changes }));
  }

  upsertTaskRepeatCfg(taskRepeatCfg: TaskRepeatCfg): void {
    this._store$.dispatch(upsertTaskRepeatCfg({ taskRepeatCfg }));
  }

  deleteTaskRepeatCfgInstance(repeatCfgId: string, dateStr: string): void {
    this._store$.dispatch(deleteTaskRepeatCfgInstance({ repeatCfgId, dateStr }));
  }

  async createRepeatableTask(
    taskRepeatCfg: TaskRepeatCfg,
    targetDayDate: number,
  ): Promise<void> {
    const actionsForRepeatCfg = await this._getActionsForTaskRepeatCfg(
      taskRepeatCfg,
      targetDayDate,
    );
    actionsForRepeatCfg.forEach((act) => {
      this._store$.dispatch(act);
    });
  }

  deleteTaskRepeatCfgWithDialog(id: string): void {
    this._matDialog
      .open(DialogConfirmComponent, {
        restoreFocus: true,
        data: {
          message: T.F.TASK_REPEAT.D_CONFIRM_REMOVE.MSG,
          okTxt: T.F.TASK_REPEAT.D_CONFIRM_REMOVE.OK,
        },
      })
      .afterClosed()
      .subscribe((isConfirm: boolean) => {
        if (isConfirm) {
          this.deleteTaskRepeatCfg(id);
        }
      });
  }

  // NOTE: this is public for testing purposes only
  async _getActionsForTaskRepeatCfg(
    taskRepeatCfg: TaskRepeatCfg,
    targetDayDate: number = Date.now(),
  ): // NOTE: updateTaskRepeatCfg missing as there is no way to declare it as action type
  Promise<
    (
      | ReturnType<typeof TaskSharedActions.addTask>
      | ReturnType<typeof updateTaskRepeatCfg>
      | ReturnType<typeof TaskSharedActions.scheduleTaskWithTime>
      | ReturnType<typeof addSubTask>
    )[]
  > {
    // NOTE: there might be multiple configs in case something went wrong
    // we want to move all of them to the archive
    const existingTaskInstances: Task[] = await this._taskService
      .getTasksWithSubTasksByRepeatCfgId$(taskRepeatCfg.id as string)
      .pipe(take(1))
      .toPromise();

    if (!taskRepeatCfg.id) {
      throw new Error('No taskRepeatCfg.id');
    }

    const isCreateNew =
      existingTaskInstances.filter((taskI) => isSameDay(targetDayDate, taskI.created))
        .length === 0;

    if (!isCreateNew) {
      return [];
    }
    // Check if this date is in the deleted instances list
    const targetDateStr = getDbDateStr(new Date(targetDayDate));
    if (taskRepeatCfg.deletedInstanceDates?.includes(targetDateStr)) {
      return [];
    }
    const targetCreated = getNewestPossibleDueDate(
      taskRepeatCfg,
      new Date(targetDayDate),
    );

    // there is no creation date in the present
    if (targetCreated === null) {
      // not sure if we should always expect one when this is called, so we throw a dev error for evaluation
      devError('No target creation date found for repeatable task');
      return [];
    } else if (!targetCreated) {
      throw new Error('Unable to getNewestPossibleDueDate()');
    }

    const { task, isAddToBottom } = this._getTaskRepeatTemplate(taskRepeatCfg);

    const createNewActions: (
      | ReturnType<typeof TaskSharedActions.addTask>
      | ReturnType<typeof updateTaskRepeatCfg>
      | ReturnType<typeof TaskSharedActions.scheduleTaskWithTime>
      | ReturnType<typeof addSubTask>
    )[] = [
      TaskSharedActions.addTask({
        task: {
          ...task,
          // NOTE if moving this to top isCreateNew check above would not work as intended
          // we use created also for the repeat day label for past tasks
          created: targetCreated.getTime(),
          dueDay: getDbDateStr(targetCreated),
        },
        workContextType: this._workContextService
          .activeWorkContextType as WorkContextType,
        workContextId: this._workContextService.activeWorkContextId as string,
        isAddToBacklog: false,
        isAddToBottom,
      }),
      updateTaskRepeatCfg({
        taskRepeatCfg: {
          id: taskRepeatCfg.id,
          changes: {
            lastTaskCreation: targetCreated.getTime(),
            lastTaskCreationDay: getDbDateStr(targetCreated),
          },
        },
      }),
    ];

    // Schedule if given
    if (isValidSplitTime(taskRepeatCfg.startTime) && taskRepeatCfg.remindAt) {
      const dateTime = getDateTimeFromClockString(
        taskRepeatCfg.startTime as string,
        targetDayDate,
      );
      createNewActions.push(
        TaskSharedActions.scheduleTaskWithTime({
          task,
          dueWithTime: dateTime,
          remindAt: remindOptionToMilliseconds(dateTime, taskRepeatCfg.remindAt),
          isMoveToBacklog: false,
          isSkipAutoRemoveFromToday: true,
        }),
      );
    }

    if (
      taskRepeatCfg.shouldInheritSubtasks &&
      taskRepeatCfg.subTaskTemplates &&
      taskRepeatCfg.subTaskTemplates.length > 0
    ) {
      for (const subTask of taskRepeatCfg.subTaskTemplates) {
        const newSubTask = this._taskService.createNewTaskWithDefaults({
          title: subTask.title,
          additional: {
            notes: subTask.notes ?? '',
            timeEstimate: subTask.timeEstimate ?? 0,
            parentId: task.id,
            projectId: taskRepeatCfg.projectId || undefined,
            isDone: false, // Always start fresh
          },
        });

        createNewActions.push(
          addSubTask({
            task: newSubTask,
            parentId: task.id,
          }),
        );
      }
    }

    return createNewActions;
  }

  private _getTaskRepeatTemplate(taskRepeatCfg: TaskRepeatCfg): {
    task: Task;
    isAddToBottom: boolean;
  } {
    return {
      task: this._taskService.createNewTaskWithDefaults({
        title: taskRepeatCfg.title,
        additional: {
          repeatCfgId: taskRepeatCfg.id,
          timeEstimate: taskRepeatCfg.defaultEstimate || 0,
          projectId: taskRepeatCfg.projectId || undefined,
          notes: taskRepeatCfg.notes || '',
          // always due for today
          dueDay: getDbDateStr(),
          tagIds: taskRepeatCfg.tagIds.filter((tagId) => tagId !== TODAY_TAG.id),
        },
      }),
      isAddToBottom: taskRepeatCfg.order > 0,
    };
  }
}
