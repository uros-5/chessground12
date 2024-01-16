import type { State } from './state';
import { clear as drawClear } from './draw';
import { anim } from './anim';
import { predrop } from './predrop';
import {
  whitePov,
  canMove,
  selectSquare,
  isDraggable,
  unsetPremove,
  unsetPredrop,
  isPredroppable,
  getKeyAtDomPos,
  dropNewPiece,
  userMove,
  callUserFunction,
  unselect,
} from './board';
import { Key, Piece, NumberPair, PieceNode, MouchEvent, KeyedNode } from './types';
import {
  eventPosition,
  pieceClasses,
  translate,
  posToTranslate,
  key2pos,
  setVisible,
  computeSquareCenter,
  distanceSq,
  samePiece,
} from './util';

export interface DragCurrent {
  orig: Key; // orig key of dragging piece
  piece: Piece;
  origPos: NumberPair; // first event position
  pos: NumberPair; // latest event position
  started: boolean; // whether the drag has started; as per the distance setting
  element: PieceNode | (() => PieceNode | undefined);
  newPiece?: boolean; // it it a new piece from outside the board
  force?: boolean; // can the new piece replace an existing one (editor)
  previouslySelected?: Key;
  originTarget: EventTarget | null;
  keyHasChanged: boolean; // whether the drag has left the orig key
}

export function start(s: State, e: MouchEvent): void {
  if (!e.isTrusted || (e.button !== undefined && e.button !== 0)) return; // only touch or left click
  if (e.touches && e.touches.length > 1) return; // support one finger touch only
  const bounds = s.dom.bounds(),
    position = eventPosition(e)!,
    orig = getKeyAtDomPos(position, whitePov(s), bounds, s.geometry);
  if (!orig) return;
  const piece = s.pieces.get(orig);
  const previouslySelected = s.selected;
  if (
    !previouslySelected &&
    s.drawable.enabled &&
    (s.drawable.eraseOnClick || !piece || piece.color !== s.turnColor)
  )
    drawClear(s);
  // Prevent touch scroll and create no corresponding mouse event, if there
  // is an intent to interact with the board.
  if (
    e.cancelable !== false &&
    (!e.touches || s.blockTouchScroll || piece || previouslySelected || pieceCloseTo(s, position))
  )
    e.preventDefault();
  const hadPremove = !!s.premovable.current;
  const hadPredrop = !!s.predroppable.current;
  s.stats.ctrlKey = e.ctrlKey;
  if (s.selected && canMove(s, s.selected, orig)) {
    anim(state => selectSquare(state, orig), s);
  } else {
    selectSquare(s, orig);
  }
  const stillSelected = s.selected === orig;
  const element = pieceElementByKey(s, orig);
  if (piece && element && stillSelected && isDraggable(s, orig)) {
    s.draggable.current = {
      orig,
      piece,
      origPos: position,
      pos: position,
      started: s.draggable.autoDistance && s.stats.dragged,
      element,
      previouslySelected,
      originTarget: e.target,
      keyHasChanged: false,
    };
    element.cgDragging = true;
    element.classList.add('dragging');
    // place ghost
    const ghost = s.dom.elements.ghost;
    if (ghost) {
      ghost.className = 'ghost ' + pieceClasses(piece, s.orientation);
      translate(ghost, posToTranslate(bounds, s.dimensions)(key2pos(orig), whitePov(s)));
      setVisible(ghost, true);
    }
    processDrag(s);
  } else {
    if (hadPremove) unsetPremove(s);
    if (hadPredrop) unsetPredrop(s);
  }
  s.dom.redraw();
}

function pieceCloseTo(s: State, pos: NumberPair): boolean {
  const asWhite = whitePov(s),
    bounds = s.dom.bounds(),
    radiusSq = Math.pow(bounds.width / s.dimensions.width, 2);
  for (const key of s.pieces.keys()) {
    const center = computeSquareCenter(key, asWhite, bounds, s.dimensions);
    if (distanceSq(center, pos) <= radiusSq) return true;
  }
  return false;
}

export function dragNewPiece(s: State, piece: Piece, e: MouchEvent, force?: boolean): void {
  const key: Key = 'a0';
  s.pieces.set(key, piece);
  s.dom.redraw();

  const position = eventPosition(e)!;

  s.draggable.current = {
    orig: key,
    piece,
    origPos: position,
    pos: position,
    started: true,
    element: () => pieceElementByKey(s, key),
    originTarget: e.target,
    newPiece: true,
    force: !!force,
    keyHasChanged: false,
  };

  if (isPredroppable(s)) {
    s.predroppable.dropDests = predrop(s.pieces, piece, s.geometry, s.variant);
  }

  processDrag(s);
}

function processDrag(s: State): void {
  requestAnimationFrame(() => {
    const cur = s.draggable.current;
    if (!cur) return;
    // cancel animations while dragging
    if (s.animation.current?.plan.anims.has(cur.orig)) s.animation.current = undefined;
    // if moving piece is gone, cancel
    const origPiece = s.pieces.get(cur.orig);
    if (!origPiece || !samePiece(origPiece, cur.piece)) cancel(s);
    else {
      if (!cur.started && distanceSq(cur.pos, cur.origPos) >= Math.pow(s.draggable.distance, 2))
        cur.started = true;
      if (cur.started) {
        // support lazy elements
        if (typeof cur.element === 'function') {
          const found = cur.element();
          if (!found) return;
          found.cgDragging = true;
          found.classList.add('dragging');
          cur.element = found;
        }

        const bounds = s.dom.bounds();
        translate(cur.element, [
          cur.pos[0] - bounds.left - bounds.width / (2 * s.dimensions.width),
          cur.pos[1] - bounds.top - bounds.height / (2 * s.dimensions.height),
        ]);

        cur.keyHasChanged ||= cur.orig !== getKeyAtDomPos(cur.pos, whitePov(s), bounds, s.geometry);
      }
    }
    processDrag(s);
  });
}

export function move(s: State, e: MouchEvent): void {
  // support one finger touch only
  if (s.draggable.current && (!e.touches || e.touches.length < 2)) {
    s.draggable.current.pos = eventPosition(e)!;
  }
}

export function end(s: State, e: MouchEvent): void {
  const cur = s.draggable.current;
  if (!cur) return;
  // create no corresponding mouse event
  if (e.type === 'touchend' && e.cancelable !== false) e.preventDefault();
  // comparing with the origin target is an easy way to test that the end event
  // has the same touch origin
  if (e.type === 'touchend' && cur.originTarget !== e.target && !cur.newPiece) {
    s.draggable.current = undefined;
    return;
  }
  unsetPremove(s);
  unsetPredrop(s);
  // touchend has no position; so use the last touchmove position instead
  const eventPos = eventPosition(e) || cur.pos;
  const dest = getKeyAtDomPos(eventPos, whitePov(s), s.dom.bounds(), s.geometry);
  if (dest && cur.started && cur.orig !== dest) {
    if (cur.newPiece) dropNewPiece(s, cur.orig, dest, cur.force);
    else {
      s.stats.ctrlKey = e.ctrlKey;
      if (userMove(s, cur.orig, dest)) {
        s.stats.dragged = true;
      }
    }
  } else if (cur.newPiece) {
    s.pieces.delete(cur.orig);
  } else if (s.draggable.deleteOnDropOff && !dest) {
    s.pieces.delete(cur.orig);
    callUserFunction(s.events.change);
  }
  if ((cur.orig === cur.previouslySelected || cur.keyHasChanged) && (cur.orig === dest || !dest)) unselect(s);
  else if (!s.selectable.enabled) unselect(s);

  removeDragElements(s);

  s.draggable.current = undefined;
  s.dom.redraw();
}

export function cancel(s: State): void {
  const cur = s.draggable.current;
  if (cur) {
    if (cur.newPiece) s.pieces.delete(cur.orig);
    s.draggable.current = undefined;
    unselect(s);
    removeDragElements(s);
    s.dom.redraw();
  }
}

function removeDragElements(s: State): void {
  const e = s.dom.elements;
  if (e.ghost) setVisible(e.ghost, false);
}

function pieceElementByKey(s: State, key: Key): PieceNode | undefined {
  let el = s.dom.elements.board.firstChild;
  while (el) {
    if ((el as KeyedNode).cgKey === key && (el as KeyedNode).tagName === 'PIECE') return el as PieceNode;
    el = el.nextSibling;
  }
  return;
}
