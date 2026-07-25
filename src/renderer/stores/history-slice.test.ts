import { describe, it, expect } from 'vitest';
import { shareUnchangedStrokes, type SnapshotDrawing } from './history-slice';

const d = (id: string, strokes: string): SnapshotDrawing => ({ id, strokes });

describe('not storing the same drawing sixty times', () => {
  it('hands back the previous object when the strokes are unchanged', () => {
    // Reference identity is the whole point: the string is then stored once, not per
    // checkpoint. A fresh but equal string would look identical and cost 60x.
    const before = [d('one', '[[1,2],[3,4]]')];
    const after = shareUnchangedStrokes(before, [d('one', '[[1,2],[3,4]]')]);
    expect(after[0]).toBe(before[0]);
  });

  it('keeps the new strokes when the drawing actually changed', () => {
    const before = [d('one', '[[1,2]]')];
    const next = [d('one', '[[1,2],[9,9]]')];
    const after = shareUnchangedStrokes(before, next);
    expect(after[0]).toBe(next[0]);
    expect(after[0].strokes).toBe('[[1,2],[9,9]]');
  });

  it('shares only the drawings that did not change', () => {
    const before = [d('a', '[[1,1]]'), d('b', '[[2,2]]')];
    const next = [d('a', '[[1,1]]'), d('b', '[[2,2],[3,3]]')];
    const after = shareUnchangedStrokes(before, next);
    expect(after[0]).toBe(before[0]);
    expect(after[1]).toBe(next[1]);
  });

  it('passes a brand-new drawing straight through', () => {
    const next = [d('new', '[[5,5]]')];
    expect(shareUnchangedStrokes([], next)).toBe(next);
    expect(shareUnchangedStrokes([d('other', '[[1,1]]')], next)[0]).toBe(next[0]);
  });

  it('copes with a drawing that was removed from the section', () => {
    const after = shareUnchangedStrokes([d('gone', '[[1,1]]'), d('kept', '[[2,2]]')], [d('kept', '[[2,2]]')]);
    expect(after).toHaveLength(1);
    expect(after[0].id).toBe('kept');
  });

  it('does nothing when there are no drawings at all', () => {
    expect(shareUnchangedStrokes([], [])).toEqual([]);
  });
});
