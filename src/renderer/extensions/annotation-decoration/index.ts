import { Extension } from '@tiptap/core';
import { createAnnotationPlugin, annotationPluginKey } from './annotation-decoration-plugin';

export { annotationPluginKey };

export const AnnotationDecoration = Extension.create({
  name: 'annotationDecoration',

  addProseMirrorPlugins() {
    return [createAnnotationPlugin()];
  },
});
