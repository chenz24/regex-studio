import { useEffect, useRef, type RefObject } from 'react';
import { EditorView } from '@codemirror/view';
import { validRange, type SourceRange } from '../utils/resultInspection';

/** Scroll only on an explicit navigation request, without moving the caret or focus. */
export function useRevealRange(
  view: RefObject<EditorView | null>,
  range: SourceRange | null | undefined,
  request: object | undefined,
) {
  const rangeRef = useRef(range);
  rangeRef.current = range;
  useEffect(() => {
    const editor = view.current;
    const target = rangeRef.current;
    if (!request || !editor || !target || !validRange(target, editor.state.doc.length)) return;
    editor.dispatch({ effects: EditorView.scrollIntoView(target.start, { y: 'center' }) });
  }, [request, view]);
}
