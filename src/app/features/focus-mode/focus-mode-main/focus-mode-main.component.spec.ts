import { ComponentFixture, TestBed } from '@angular/core/testing';
import { Store } from '@ngrx/store';
import { BehaviorSubject } from 'rxjs';
import { NoopAnimationsModule } from '@angular/platform-browser/animations';
import { TranslateModule } from '@ngx-translate/core';
import { FocusModeMainComponent } from './focus-mode-main.component';
import { GlobalConfigService } from '../../config/global-config.service';
import { TaskService } from '../../tasks/task.service';
import { TaskAttachmentService } from '../../tasks/task-attachment/task-attachment.service';
import { IssueService } from '../../issue/issue.service';
import { SimpleCounterService } from '../../simple-counter/simple-counter.service';
import { FocusModeService } from '../focus-mode.service';
import { TaskCopy } from '../../tasks/task.model';
import { SimpleCounter } from '../../simple-counter/simple-counter.model';
import * as actions from '../store/focus-mode.actions';
import { TaskSharedActions } from '../../../root-store/meta/task-shared.actions';

describe('FocusModeMainComponent', () => {
  let component: FocusModeMainComponent;
  let fixture: ComponentFixture<FocusModeMainComponent>;
  let mockStore: jasmine.SpyObj<Store>;
  let mockTaskService: jasmine.SpyObj<TaskService>;
  let mockTaskAttachmentService: jasmine.SpyObj<TaskAttachmentService>;
  let mockIssueService: jasmine.SpyObj<IssueService>;
  let currentTaskSubject: BehaviorSubject<TaskCopy | null>;

  const mockTask: TaskCopy = {
    id: 'task-1',
    title: 'Test Task',
    notes: 'Test notes',
    timeSpent: 0,
    timeEstimate: 0,
    created: Date.now(),
    isDone: false,
    subTaskIds: [],
    projectId: 'project-1',
    timeSpentOnDay: {},
    attachments: [],
    tagIds: [],
    issueType: 'GITHUB',
    issueId: '123',
    issueProviderId: 'provider-1',
  } as TaskCopy;

  beforeEach(async () => {
    const storeSpy = jasmine.createSpyObj('Store', ['dispatch']);

    const globalConfigServiceSpy = jasmine.createSpyObj('GlobalConfigService', [], {
      misc: jasmine.createSpy().and.returnValue({
        taskNotesTpl: 'Default task notes template',
      }),
    });

    currentTaskSubject = new BehaviorSubject<TaskCopy | null>(mockTask);
    const taskServiceSpy = jasmine.createSpyObj('TaskService', ['update'], {
      currentTask$: currentTaskSubject.asObservable(),
    });

    const taskAttachmentServiceSpy = jasmine.createSpyObj('TaskAttachmentService', [
      'createFromDrop',
    ]);

    const issueServiceSpy = jasmine.createSpyObj('IssueService', ['issueLink']);
    issueServiceSpy.issueLink.and.returnValue(
      Promise.resolve('https://github.com/test/repo/issues/123'),
    );

    const simpleCounterServiceSpy = jasmine.createSpyObj('SimpleCounterService', ['']);

    const focusModeServiceSpy = jasmine.createSpyObj('FocusModeService', [], {
      timeElapsed: jasmine.createSpy().and.returnValue(60000),
      isCountTimeDown: jasmine.createSpy().and.returnValue(true),
      progress: jasmine.createSpy().and.returnValue(0),
      timeRemaining: jasmine.createSpy().and.returnValue(1500000),
      isSessionRunning: jasmine.createSpy().and.returnValue(false),
      isBreakActive: jasmine.createSpy().and.returnValue(false),
      currentCycle: jasmine.createSpy().and.returnValue(1),
      mode: jasmine.createSpy().and.returnValue('Pomodoro'),
    });

    await TestBed.configureTestingModule({
      imports: [FocusModeMainComponent, NoopAnimationsModule, TranslateModule.forRoot()],
      providers: [
        { provide: Store, useValue: storeSpy },
        { provide: GlobalConfigService, useValue: globalConfigServiceSpy },
        { provide: TaskService, useValue: taskServiceSpy },
        { provide: TaskAttachmentService, useValue: taskAttachmentServiceSpy },
        { provide: IssueService, useValue: issueServiceSpy },
        { provide: SimpleCounterService, useValue: simpleCounterServiceSpy },
        { provide: FocusModeService, useValue: focusModeServiceSpy },
      ],
    }).compileComponents();

    fixture = TestBed.createComponent(FocusModeMainComponent);
    component = fixture.componentInstance;
    mockStore = TestBed.inject(Store) as jasmine.SpyObj<Store>;
    mockTaskService = TestBed.inject(TaskService) as jasmine.SpyObj<TaskService>;
    mockTaskAttachmentService = TestBed.inject(
      TaskAttachmentService,
    ) as jasmine.SpyObj<TaskAttachmentService>;
    mockIssueService = TestBed.inject(IssueService) as jasmine.SpyObj<IssueService>;

    fixture.detectChanges();
  });

  afterEach(() => {
    component.ngOnDestroy();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });

  describe('initialization', () => {
    it('should initialize with current task', () => {
      expect(component.task).toBe(mockTask);
    });

    it('should set default task notes from config', () => {
      expect(component.defaultTaskNotes).toBe('Default task notes template');
    });

    it('should initialize focus mode service properties', () => {
      expect(component.timeElapsed()).toBe(60000);
      expect(component.isCountTimeDown()).toBe(true);
    });

    it('should initialize isShowNotes to false', () => {
      expect(component.isShowNotes).toBe(false);
    });

    it('should initialize isFocusNotes to false', () => {
      expect(component.isFocusNotes).toBe(false);
    });

    it('should initialize isDragOver to false', () => {
      expect(component.isDragOver).toBe(false);
    });
  });

  describe('issue URL observable', () => {
    it('should create issue URL for task with issue data', (done) => {
      component.issueUrl$.subscribe((url) => {
        expect(url).toBe('https://github.com/test/repo/issues/123');
        expect(mockIssueService.issueLink).toHaveBeenCalledWith(
          'GITHUB',
          '123',
          'provider-1',
        );
        done();
      });
    });

    it('should return null for task without issue data', (done) => {
      const taskWithoutIssue = {
        ...mockTask,
        issueType: undefined,
        issueId: undefined,
        issueProviderId: undefined,
      };
      currentTaskSubject.next(taskWithoutIssue);

      component.issueUrl$.subscribe((url) => {
        expect(url).toBeNull();
        done();
      });
    });

    it('should return null when no current task', (done) => {
      currentTaskSubject.next(null);

      component.issueUrl$.subscribe((url) => {
        expect(url).toBeNull();
        done();
      });
    });
  });

  describe('drag and drop', () => {
    let mockDragEvent: jasmine.SpyObj<DragEvent>;
    let mockTarget: HTMLElement;

    beforeEach(() => {
      mockTarget = document.createElement('div');
      mockDragEvent = jasmine.createSpyObj('DragEvent', [
        'preventDefault',
        'stopPropagation',
      ]);
      Object.defineProperty(mockDragEvent, 'target', {
        value: mockTarget,
        writable: true,
      });
    });

    describe('onDragEnter', () => {
      it('should set drag state and prevent default', () => {
        component.onDragEnter(mockDragEvent);

        expect(component.isDragOver).toBe(true);
        expect(mockDragEvent.preventDefault).toHaveBeenCalled();
        expect(mockDragEvent.stopPropagation).toHaveBeenCalled();
      });

      it('should track drag enter target', () => {
        component.onDragEnter(mockDragEvent);

        expect(component['_dragEnterTarget']).toBe(mockTarget);
      });
    });

    describe('onDragLeave', () => {
      it('should reset drag state when leaving the same target', () => {
        component['_dragEnterTarget'] = mockTarget;
        component.isDragOver = true;

        component.onDragLeave(mockDragEvent);

        expect(component.isDragOver).toBe(false);
        expect(mockDragEvent.preventDefault).toHaveBeenCalled();
        expect(mockDragEvent.stopPropagation).toHaveBeenCalled();
      });

      it('should not reset drag state when leaving different target', () => {
        const differentTarget = document.createElement('span');
        component['_dragEnterTarget'] = differentTarget;
        component.isDragOver = true;

        component.onDragLeave(mockDragEvent);

        expect(component.isDragOver).toBe(true);
      });
    });

    describe('onDrop', () => {
      it('should create attachment from drop when task exists', () => {
        component.onDrop(mockDragEvent);

        expect(mockTaskAttachmentService.createFromDrop).toHaveBeenCalledWith(
          mockDragEvent,
          mockTask.id,
        );
        expect(mockDragEvent.stopPropagation).toHaveBeenCalled();
        expect(component.isDragOver).toBe(false);
      });

      it('should not create attachment when no task', () => {
        component.task = null;

        component.onDrop(mockDragEvent);

        expect(mockTaskAttachmentService.createFromDrop).not.toHaveBeenCalled();
      });
    });
  });

  describe('changeTaskNotes', () => {
    it('should update task notes when changed from default', () => {
      component.defaultTaskNotes = 'Default template';

      component.changeTaskNotes('New notes');

      expect(mockTaskService.update).toHaveBeenCalledWith(mockTask.id, {
        notes: 'New notes',
      });
    });

    it('should not update when notes match default template', () => {
      component.defaultTaskNotes = 'Default template';

      component.changeTaskNotes('Default template');

      expect(mockTaskService.update).not.toHaveBeenCalled();
    });

    it('should update when notes are empty', () => {
      component.changeTaskNotes('');

      expect(mockTaskService.update).toHaveBeenCalledWith(mockTask.id, {
        notes: '',
      });
    });

    it('should throw error when no task loaded', () => {
      component.task = null;

      expect(() => component.changeTaskNotes('New notes')).toThrowError(
        'Task is not loaded',
      );
    });

    it('should handle whitespace differences in comparison', () => {
      component.defaultTaskNotes = '  Default template  ';

      component.changeTaskNotes('Default template');

      expect(mockTaskService.update).not.toHaveBeenCalled();
    });
  });

  describe('finishCurrentTask', () => {
    it('should dispatch all required actions', () => {
      component.finishCurrentTask();

      expect(mockStore.dispatch).toHaveBeenCalledWith(actions.completeTask());
      expect(mockStore.dispatch).toHaveBeenCalledWith(actions.selectFocusTask());
      expect(mockStore.dispatch).toHaveBeenCalledWith(
        TaskSharedActions.updateTask({
          task: {
            id: mockTask.id,
            changes: {
              isDone: true,
              doneOn: jasmine.any(Number) as any,
            },
          },
        }),
      );
    });

    it('should set doneOn to current timestamp', () => {
      component.finishCurrentTask();

      // Simply verify that all the required actions were dispatched
      expect(mockStore.dispatch).toHaveBeenCalledTimes(3);

      // Get all calls and verify the UpdateTask action
      const calls = mockStore.dispatch.calls.all();
      const hasUpdateTaskAction = calls.some((call: any) => {
        const action = call.args[0];
        return (
          action.task &&
          action.task.id === mockTask.id &&
          action.task.changes.isDone === true &&
          typeof action.task.changes.doneOn === 'number'
        );
      });

      expect(hasUpdateTaskAction).toBe(true);
    });
  });

  describe('trackById', () => {
    it('should return item id', () => {
      const mockCounter: SimpleCounter = { id: 'counter-1' } as SimpleCounter;

      const result = component.trackById(0, mockCounter);

      expect(result).toBe('counter-1');
    });
  });

  describe('updateTaskTitleIfChanged', () => {
    it('should update task title when changed', () => {
      component.updateTaskTitleIfChanged(true, 'New Title');

      expect(mockTaskService.update).toHaveBeenCalledWith(mockTask.id, {
        title: 'New Title',
      });
    });

    it('should not update when not changed', () => {
      component.updateTaskTitleIfChanged(false, 'New Title');

      expect(mockTaskService.update).not.toHaveBeenCalled();
    });

    it('should throw error when no task loaded', () => {
      component.task = null;

      expect(() => component.updateTaskTitleIfChanged(true, 'New Title')).toThrowError(
        'No task data',
      );
    });
  });

  describe('ngOnDestroy', () => {
    it('should complete destroy subject', () => {
      const destroySubject = component['_onDestroy$'];
      spyOn(destroySubject, 'next');
      spyOn(destroySubject, 'complete');

      component.ngOnDestroy();

      expect(destroySubject.next).toHaveBeenCalled();
      expect(destroySubject.complete).toHaveBeenCalled();
    });
  });
});
