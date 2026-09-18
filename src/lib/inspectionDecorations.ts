import { Decoration, EditorView, WidgetType, type DecorationSet } from '@codemirror/view';
import { StateEffect, StateField } from '@codemirror/state';
import { validRange, type SourceRange } from '../utils/resultInspection';

class PositionMarker extends WidgetType {
  constructor(
    readonly className: string,
    readonly position: number,
  ) {
    super();
  }
  eq(other: PositionMarker) {
    return other.className === this.className && other.position === this.position;
  }
  ignoreEvent() {
    return false;
  }
  toDOM() {
    const marker = document.createElement('span');
    marker.className = this.className;
    marker.dataset.position = String(this.position);
    marker.setAttribute('aria-hidden', 'true');
    return marker;
  }
}

export const setInspectionDecorations = StateEffect.define<DecorationSet>();
export const inspectionField = StateField.define<DecorationSet>({
  create: () => Decoration.none,
  update(value, transaction) {
    for (const effect of transaction.effects)
      if (effect.is(setInspectionDecorations)) return effect.value;
    // Old result coordinates must never be mapped onto edited text.
    return transaction.docChanged ? Decoration.none : value;
  },
  provide: (field) => EditorView.decorations.from(field),
});

export function rangeDecorations(
  ranges: SourceRange[],
  length: number,
  className: string,
): DecorationSet {
  return Decoration.set(
    ranges
      .filter((range) => validRange(range, length))
      .map(({ start, end }) =>
        start === end
          ? Decoration.widget({
              widget: new PositionMarker(`${className} cm-inspection-position`, start),
              side: 1,
            }).range(start)
          : Decoration.mark({
              class: className,
              attributes: { 'data-start': String(start), 'data-end': String(end) },
            }).range(start, end),
      ),
    true,
  );
}

export const inspectionTheme = EditorView.theme({
  '.cm-source-inspection': {
    backgroundColor: 'rgba(168,85,247,0.2)',
    outline: '1px solid rgba(168,85,247,0.7)',
    borderRadius: '2px',
  },
  '.cm-subject-inspection': {
    backgroundColor: 'rgba(168,85,247,0.24)',
    outline: '2px solid #a855f7',
    borderRadius: '2px',
  },
  '.cm-inspection-position': {
    display: 'inline-block',
    height: '1.15em',
    width: '2px',
    margin: '0 1px',
    verticalAlign: 'text-bottom',
    backgroundColor: '#a855f7',
  },
  '.cm-empty-match': {
    display: 'inline-block',
    height: '1em',
    width: '2px',
    verticalAlign: 'text-bottom',
    backgroundColor: '#14b8a6',
  },
});
