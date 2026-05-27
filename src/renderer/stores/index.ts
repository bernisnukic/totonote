import { create } from 'zustand';
import { createDocumentSlice, type DocumentSlice } from './document-slice';
import { createTagSlice, type TagSlice } from './tag-slice';
import { createAnnotationSlice, type AnnotationSlice } from './annotation-slice';
import { createSelectionSlice, type SelectionSlice } from './selection-slice';
import { createUiSlice, type UiSlice } from './ui-slice';
import { createFilterSlice, type FilterSlice } from './filter-slice';
import { createPreferenceSlice, type PreferenceSlice } from './preference-slice';

export type AppStore = DocumentSlice &
  TagSlice &
  AnnotationSlice &
  SelectionSlice &
  UiSlice &
  FilterSlice &
  PreferenceSlice;

export const useStore = create<AppStore>()((...a) => ({
  ...createDocumentSlice(...a),
  ...createTagSlice(...a),
  ...createAnnotationSlice(...a),
  ...createSelectionSlice(...a),
  ...createUiSlice(...a),
  ...createFilterSlice(...a),
  ...createPreferenceSlice(...a),
}));
