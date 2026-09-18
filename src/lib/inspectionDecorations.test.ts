import { describe, expect, it } from 'vitest';
import { EditorState } from '@codemirror/state';
import {
  inspectionField,
  rangeDecorations,
  setInspectionDecorations,
} from './inspectionDecorations';

describe('editor inspection decorations', () => {
  it('places zero-width markers at the beginning and end, including an empty document', () => {
    expect(rangeDecorations([{ start: 0, end: 0 }], 0, 'marker').size).toBe(1);
    expect(
      rangeDecorations(
        [
          { start: 0, end: 0 },
          { start: 3, end: 3 },
        ],
        3,
        'marker',
      ).size,
    ).toBe(2);
    expect(
      rangeDecorations(
        [
          { start: -1, end: -1 },
          { start: 4, end: 4 },
        ],
        3,
        'marker',
      ).size,
    ).toBe(0);
  });
  it('clears rather than remaps a capture location after the user edits the text', () => {
    let state = EditorState.create({ doc: 'aabb', extensions: [inspectionField] });
    state = state.update({
      effects: setInspectionDecorations.of(rangeDecorations([{ start: 2, end: 4 }], 4, 'selected')),
    }).state;
    expect(state.field(inspectionField).size).toBe(1);
    state = state.update({ changes: { from: 0, to: 1, insert: 'xyz' } }).state;
    expect(state.field(inspectionField).size).toBe(0);
  });
});
