import { createAction, props } from '@ngrx/store';
import { FocusModeMode } from '../focus-mode.model';

// Core actions
export const tick = createAction('[FocusMode] Timer Tick');

// Primary actions (using Focus prefix for consistency)
export const setFocusModeMode = createAction(
  '[FocusMode] Set Mode',
  props<{ mode: FocusModeMode }>(),
);

// Phase transitions
export const showFocusOverlay = createAction('[FocusMode] Show Overlay');
export const hideFocusOverlay = createAction('[FocusMode] Hide Overlay');

export const selectFocusTask = createAction('[FocusMode] Select Task');
export const selectFocusDuration = createAction('[FocusMode] Select Duration');
export const startFocusPreparation = createAction('[FocusMode] Start Preparation');

export const startFocusSession = createAction(
  '[FocusMode] Start Session',
  props<{ duration?: number }>(),
);

export const navigateToMainScreen = createAction('[FocusMode] Navigate To Main Screen');

export const pauseFocusSession = createAction('[FocusMode] Pause Session');
export const unPauseFocusSession = createAction('[FocusMode] Resume Session');

export const completeFocusSession = createAction(
  '[FocusMode] Complete Session',
  props<{ isManual?: boolean }>(),
);
export const cancelFocusSession = createAction('[FocusMode] Cancel Session');

export const startBreak = createAction(
  '[FocusMode] Start Break',
  props<{ duration?: number; isLongBreak?: boolean }>(),
);
export const skipBreak = createAction('[FocusMode] Skip Break');
export const completeBreak = createAction('[FocusMode] Complete Break');

export const incrementCycle = createAction('[FocusMode] Next Cycle');
export const resetCycles = createAction('[FocusMode] Reset Cycles');

// Additional compatibility actions
export const setFocusSessionDuration = createAction(
  '[FocusMode] Set Focus Session Duration',
  props<{ focusSessionDuration: number }>(),
);

export const completeTask = createAction('[FocusMode] Complete Task');
