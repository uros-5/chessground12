import type { State } from './state.js';
import { cancelDropMode, drop } from './drop.js';
import { eventPosition, isRightButton } from './util.js';
import { getKeyAtDomPos, whitePov } from './board.js';
import { cancel, end, move, start } from './drag.js';
import { cancel as cancel2, end as end2, move as move2, start as start2 } from './draw.js';
import { MouchEvent, Piece, Unbind } from './types.js';

type MouchBind = (e: MouchEvent) => void;
type StateMouchBind = (d: State, e: MouchEvent) => void;

export function bindBoard(s: State, onResize: () => void): void {
  const boardEl = s.dom.elements.board;

  if ('ResizeObserver' in window) new ResizeObserver(onResize).observe(s.dom.elements.wrap);

  if (s.viewOnly) return;

  // Cannot be passive, because we prevent touch scrolling and dragging of
  // selected elements.
  const onStart = startDragOrDraw(s);
  boardEl.addEventListener('touchstart', onStart as EventListener, {
    passive: false,
  });
  boardEl.addEventListener('mousedown', onStart as EventListener, {
    passive: false,
  });

  if (s.disableContextMenu || s.drawable.enabled) {
    boardEl.addEventListener('contextmenu', e => e.preventDefault());
  }
}

// returns the unbind function
export function bindDocument(s: State, onResize: () => void): Unbind {
  const unbinds: Unbind[] = [];

  // Old versions of Edge and Safari do not support ResizeObserver. Send
  // chessground.resize if a user action has changed the bounds of the board.
  if (!('ResizeObserver' in window)) unbinds.push(unbindable(document.body, 'chessground.resize', onResize));

  if (!s.viewOnly) {
    const onmove = dragOrDraw(s, move, move2);
    const onend = dragOrDraw(s, end, end2);

    for (const ev of ['touchmove', 'mousemove'])
      unbinds.push(unbindable(document, ev, onmove as EventListener));
    for (const ev of ['touchend', 'mouseup']) unbinds.push(unbindable(document, ev, onend as EventListener));

    const onScroll = () => s.dom.bounds.clear();
    unbinds.push(unbindable(document, 'scroll', onScroll, { capture: true, passive: true }));
    unbinds.push(unbindable(window, 'resize', onScroll, { passive: true }));
  }

  return () => unbinds.forEach(f => f());
}

function unbindable(
  el: EventTarget,
  eventName: string,
  callback: EventListener,
  options?: AddEventListenerOptions,
): Unbind {
  el.addEventListener(eventName, callback, options);
  return () => el.removeEventListener(eventName, callback, options);
}

function startDragOrDraw(s: State): MouchBind {
  return e => {
    if (s.draggable.current) cancel(s);
    else if (s.drawable.current) cancel2(s);
    else if (e.shiftKey || isRightButton(e)) {
      if (s.drawable.enabled) start2(s, e);
    } else if (!s.viewOnly) {
      if (
        s.dropmode.active &&
        (squareOccupied(s, e) === undefined ||
          (s.movable.color !== s.turnColor && squareOccupied(s, e)?.color === s.turnColor))
      ) {
        // only apply drop if the dest square is empty or predropping on an opponent's piece
        drop(s, e);
      } else {
        cancelDropMode(s);
        start(s, e);
      }
    }
  };
}

function dragOrDraw(s: State, withDrag: StateMouchBind, withDraw: StateMouchBind): MouchBind {
  return e => {
    if (s.drawable.current) {
      if (s.drawable.enabled) withDraw(s, e);
    } else if (!s.viewOnly) withDrag(s, e);
  };
}

function squareOccupied(s: State, e: MouchEvent): Piece | undefined {
  const position = eventPosition(e);
  const dest = position && getKeyAtDomPos(position, whitePov(s), s.dom.bounds(), s.geometry);
  if (dest && s.pieces.get(dest)) return s.pieces.get(dest);
  else return undefined;
}
