import { TestBed } from '@angular/core/testing';
import { AddTaskBarStateService } from './add-task-bar-state.service';
import { Project } from '../../project/project.model';
import { Tag } from '../../tag/tag.model';
import { INITIAL_ADD_TASK_BAR_STATE } from './add-task-bar.const';
import { SS } from '../../../core/persistence/storage-keys.const';
import { getDbDateStr } from '../../../util/get-db-date-str';

describe('AddTaskBarStateService', () => {
  let service: AddTaskBarStateService;

  beforeEach(() => {
    // Clear sessionStorage before each test to ensure clean state
    sessionStorage.removeItem(SS.ADD_TASK_BAR_TXT);

    TestBed.configureTestingModule({
      providers: [AddTaskBarStateService],
    });
    service = TestBed.inject(AddTaskBarStateService);
  });

  describe('Service Creation', () => {
    it('should be created', () => {
      expect(service).toBeTruthy();
    });

    it('should initialize with default state', () => {
      const state = service.state();
      expect(state).toEqual(INITIAL_ADD_TASK_BAR_STATE);
    });

    it('should initialize with empty input text', () => {
      expect(service.inputTxt()).toBe('');
    });

    it('should initialize with auto-detected as false', () => {
      expect(service.isAutoDetected()).toBe(false);
    });
  });

  describe('updateProjectId', () => {
    it('should update project in state', () => {
      const mockProject: Project = { id: '1', title: 'Test Project' } as Project;

      service.updateProjectId(mockProject.id);

      expect(service.state().projectId).toEqual(mockProject.id);
    });

    it('should clear auto-detected flag when manually changing project', () => {
      service.isAutoDetected.set(true);
      const mockProject: Project = { id: '1', title: 'Test Project' } as Project;

      service.updateProjectId(mockProject.id);

      expect(service.isAutoDetected()).toBe(false);
    });
  });

  describe('updateDate', () => {
    it('should update date in state', () => {
      const testDate = new Date('2024-01-15');

      service.updateDate(getDbDateStr(testDate));

      expect(service.state().date).toEqual(getDbDateStr(testDate));
    });

    it('should update date and time when both provided', () => {
      const testDate = new Date('2024-01-15');
      const testTime = '10:30';

      service.updateDate(getDbDateStr(testDate), testTime);

      expect(service.state().date).toEqual(getDbDateStr(testDate));
      expect(service.state().time).toBe(testTime);
    });

    it('should preserve existing time when time parameter is undefined', () => {
      const testDate = new Date('2024-01-15');
      service.updateTime('09:00');

      service.updateDate(getDbDateStr(testDate));

      expect(service.state().date).toEqual(getDbDateStr(testDate));
      expect(service.state().time).toBe('09:00');
    });

    it('should clear time when explicitly set to null', () => {
      service.updateTime('09:00');
      const testDate = new Date('2024-01-15');

      service.updateDate(getDbDateStr(testDate), null);

      expect(service.state().date).toEqual(getDbDateStr(testDate));
      expect(service.state().time).toBe(null);
    });

    it('should clear date when null passed', () => {
      const testDate = new Date('2024-01-15');
      service.updateDate(getDbDateStr(testDate));

      service.updateDate(null);

      expect(service.state().date).toBe(null);
    });
  });

  describe('updateTime', () => {
    it('should update time in state', () => {
      const testTime = '14:30';

      service.updateTime(testTime);

      expect(service.state().time).toBe(testTime);
    });

    it('should clear time when null passed', () => {
      service.updateTime('10:30');

      service.updateTime(null);

      expect(service.state().time).toBe(null);
    });
  });

  describe('updateEstimate', () => {
    it('should update estimate in state', () => {
      const testEstimate = 1800000; // 30 minutes in ms

      service.updateEstimate(testEstimate);

      expect(service.state().estimate).toBe(testEstimate);
    });

    it('should clear estimate when null passed', () => {
      service.updateEstimate(1800000);

      service.updateEstimate(null);

      expect(service.state().estimate).toBe(null);
    });
  });

  describe('toggleTag', () => {
    const mockTag1: Tag = { id: '1', title: 'urgent' } as Tag;
    const mockTag2: Tag = { id: '2', title: 'important' } as Tag;

    it('should add tag when not present', () => {
      service.toggleTag(mockTag1);

      expect(service.state().tagIds).toContain(mockTag1.id);
      expect(service.state().tagIds).toHaveSize(1);
    });

    it('should remove tag when already present', () => {
      service.updateTagIds([mockTag1.id, mockTag2.id]);

      service.toggleTag(mockTag1);

      expect(service.state().tagIds).not.toContain(mockTag1.id);
      expect(service.state().tagIds).toContain(mockTag2.id);
      expect(service.state().tagIds).toHaveSize(1);
    });

    it('should update input text when cleanedInputTxt provided', () => {
      const cleanedText = 'Task content';

      service.toggleTag(mockTag1, cleanedText);

      expect(service.inputTxt()).toBe(cleanedText);
    });

    it('should not update input text when cleanedInputTxt not provided', () => {
      service.updateInputTxt('Original text');

      service.toggleTag(mockTag1);

      expect(service.inputTxt()).toBe('Original text');
    });

    it('should maintain order when adding tags', () => {
      service.toggleTag(mockTag1);
      service.toggleTag(mockTag2);

      expect(service.state().tagIds[0]).toEqual(mockTag1.id);
      expect(service.state().tagIds[1]).toEqual(mockTag2.id);
    });

    it('should preserve other tags when removing one', () => {
      const mockTag3: Tag = { id: '3', title: 'work' } as Tag;
      service.updateTagIds([mockTag1.id, mockTag2.id, mockTag3.id]);

      service.toggleTag(mockTag2);

      expect(service.state().tagIds).toEqual([mockTag1.id, mockTag3.id]);
    });
  });

  describe('updateTags', () => {
    it('should replace all tags', () => {
      const mockTags: Tag[] = [
        { id: '1', title: 'urgent' } as Tag,
        { id: '2', title: 'important' } as Tag,
      ];

      service.updateTagIds(mockTags.map((t) => t.id));

      expect(service.state().tagIds).toEqual(mockTags.map((t) => t.id));
    });

    it('should clear tags when empty array passed', () => {
      const mockTags: Tag[] = [{ id: '1', title: 'urgent' } as Tag];
      service.updateTagIds(mockTags.map((t) => t.id));

      service.updateTagIds([]);

      expect(service.state().tagIds).toEqual([]);
    });
  });

  describe('updateNewTagTitles', () => {
    it('should update new tag titles', () => {
      const newTagTitles = ['new-tag', 'another-new'];

      service.updateNewTagTitles(newTagTitles);

      expect(service.state().newTagTitles).toEqual(newTagTitles);
    });

    it('should clear new tag titles when empty array passed', () => {
      service.updateNewTagTitles(['tag1', 'tag2']);

      service.updateNewTagTitles([]);

      expect(service.state().newTagTitles).toEqual([]);
    });
  });

  describe('updateCleanText', () => {
    it('should update clean text', () => {
      const cleanText = 'Task without syntax';

      service.updateCleanText(cleanText);

      expect(service.state().cleanText).toBe(cleanText);
    });

    it('should clear clean text when null passed', () => {
      service.updateCleanText('Some text');

      service.updateCleanText(null);

      expect(service.state().cleanText).toBe(null);
    });
  });

  describe('updateInputTxt', () => {
    it('should update input text', () => {
      const inputText = 'New task #urgent @today';

      service.updateInputTxt(inputText);

      expect(service.inputTxt()).toBe(inputText);
    });
  });

  describe('clearTags', () => {
    it('should clear tags and new tag titles', () => {
      const mockTags: Tag[] = [{ id: '1', title: 'urgent' } as Tag];
      service.updateTagIds(mockTags.map((t) => t.id));
      service.updateNewTagTitles(['new-tag']);

      service.clearTags();

      expect(service.state().tagIds).toEqual([]);
      expect(service.state().newTagTitles).toEqual([]);
    });

    it('should update input text when cleanedInputTxt provided', () => {
      const cleanedText = 'Task without tags';

      service.clearTags(cleanedText);

      expect(service.inputTxt()).toBe(cleanedText);
    });
  });

  describe('clearDate', () => {
    it('should clear date and time', () => {
      service.updateDate(getDbDateStr(new Date()), '10:30');

      service.clearDate();

      expect(service.state().date).toBe(null);
      expect(service.state().time).toBe(null);
    });

    it('should update input text when cleanedInputTxt provided', () => {
      const cleanedText = 'Task without date';

      service.clearDate(cleanedText);

      expect(service.inputTxt()).toBe(cleanedText);
    });
  });

  describe('clearEstimate', () => {
    it('should clear estimate', () => {
      service.updateEstimate(1800000);

      service.clearEstimate();

      expect(service.state().estimate).toBe(null);
    });

    it('should update input text when cleanedInputTxt provided', () => {
      const cleanedText = 'Task without estimate';

      service.clearEstimate(cleanedText);

      expect(service.inputTxt()).toBe(cleanedText);
    });
  });

  describe('resetAfterAdd', () => {
    it('should reset specific fields while preserving others', () => {
      const mockProject: Project = { id: '1', title: 'Test Project' } as Project;
      const testDate = new Date();
      const testEstimate = 1800000;
      const mockTags: Tag[] = [{ id: '1', title: 'urgent' } as Tag];

      // Set up initial state
      service.updateProjectId(mockProject.id);
      service.updateDate(getDbDateStr(testDate), '10:30');
      service.updateEstimate(testEstimate);
      service.updateTagIds(mockTags.map((t) => t.id));
      service.updateNewTagTitles(['new-tag']);
      service.updateCleanText('Clean text');
      service.updateInputTxt('Input text');

      service.resetAfterAdd();

      // These should be cleared
      expect(service.state().tagIds).toEqual([]);
      expect(service.state().newTagTitles).toEqual([]);
      expect(service.state().cleanText).toBe(null);
      expect(service.inputTxt()).toBe('');

      // These should be preserved
      expect(service.state().projectId).toEqual(mockProject.id);
      expect(service.state().date).toEqual(getDbDateStr(testDate));
      expect(service.state().time).toBe('10:30');
      expect(service.state().estimate).toBe(testEstimate);
    });
  });

  describe('setAutoDetectedProjectId', () => {
    it('should update projectId and set auto-detected flag', () => {
      const mockProject: Project = { id: '1', title: 'Auto Project' } as Project;

      service.setAutoDetectedProjectId(mockProject.id);

      expect(service.state().projectId).toEqual(mockProject.id);
      expect(service.isAutoDetected()).toBe(true);
    });
  });

  describe('reactive behavior', () => {
    it('should emit changes through inputTxt observable', (done) => {
      const testText = 'Test observable';

      service.inputTxt$.subscribe((text) => {
        if (text === testText) {
          done();
        }
      });

      service.updateInputTxt(testText);
    });

    it('should update signal values reactively', () => {
      const mockProject: Project = { id: '1', title: 'Reactive Project' } as Project;

      service.updateProjectId(mockProject.id);

      // The signal should immediately reflect the change
      expect(service.state().projectId).toEqual(mockProject.id);
    });
  });
});
