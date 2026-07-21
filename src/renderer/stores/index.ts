import { create } from 'zustand';
import { createDocumentSlice, type DocumentSlice } from './document-slice';
import { createTagSlice, type TagSlice } from './tag-slice';
import { createAnnotationSlice, type AnnotationSlice } from './annotation-slice';
import { createSelectionSlice, type SelectionSlice } from './selection-slice';
import { createUiSlice, type UiSlice } from './ui-slice';
import { createFilterSlice, type FilterSlice } from './filter-slice';
import { createPreferenceSlice, type PreferenceSlice } from './preference-slice';
import { createUndoSlice, type UndoSlice } from './undo-slice';
import { createWorkspaceSlice, type WorkspaceSlice } from './workspace-slice';

export type AppStore = DocumentSlice &
  TagSlice &
  AnnotationSlice &
  SelectionSlice &
  UiSlice &
  FilterSlice &
  PreferenceSlice &
  UndoSlice &
  WorkspaceSlice;

export const useStore = create<AppStore>()((...a) => ({
  ...createDocumentSlice(...a),
  ...createTagSlice(...a),
  ...createAnnotationSlice(...a),
  ...createSelectionSlice(...a),
  ...createUiSlice(...a),
  ...createFilterSlice(...a),
  ...createPreferenceSlice(...a),
  ...createUndoSlice(...a),
  ...createWorkspaceSlice(...a),
}));
