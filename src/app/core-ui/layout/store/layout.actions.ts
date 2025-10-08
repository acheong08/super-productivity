import { createAction } from '@ngrx/store';

export const showTaskViewCustomizerPanel = createAction(
  '[Layout] Show TaskViewCustomizerPanel',
);

export const hideTaskViewCustomizerPanel = createAction(
  '[Layout] Hide TaskViewCustomizerPanel',
);

export const toggleTaskViewCustomizerPanel = createAction(
  '[Layout] Toggle TaskViewCustomizerPanel',
);

export const showAddTaskBar = createAction('[Layout] Show AddTaskBar');

export const hideAddTaskBar = createAction('[Layout] Hide AddTaskBar');

export const toggleShowNotes = createAction('[Layout] ToggleShow Notes');

export const hideNonTaskSidePanelContent = createAction(
  '[Layout] Hide Non-Task Side Panel',
);

export const toggleIssuePanel = createAction('[Layout] Toggle IssuePanel');

export const hideIssuePanel = createAction('[Layout] Hide IssuePanel');

export const showPluginPanel = createAction(
  '[Layout] Show PluginPanel',
  (pluginId: string) => ({ pluginId }),
);

export const hidePluginPanel = createAction('[Layout] Hide PluginPanel');

export const togglePluginPanel = createAction(
  '[Layout] Toggle PluginPanel',
  (pluginId: string) => ({ pluginId }),
);
