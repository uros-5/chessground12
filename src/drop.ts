import type { HeadlessState, State } from './state.js';
import { cancel as dragCancel } from './drag.js';
import { predrop } from './predrop.js';
import {
  unselect,
  isPredroppable,
  unsetPremove,
  unsetPredrop,
  getKeyAtDomPos,
  whitePov,
  dropNewPiece,
} from './board.js';
import { dropOrigOf, eventPosition } from './util.js';
import { MouchEvent, Piece } from './types.js';

export function setDropMode(s: State, piece?: Piece): void {
  s.dropmode.active = true;
  s.dropmode.piece = piece;

  dragCancel(s);
  unselect(s);
  if (piece) {
    if (isPredroppable(s)) {
      s.predroppable.dropDests = predrop(s.pieces, piece, s.geometry, s.variant);
    } else {
      if (s.movable.dests) {
        const dropDests = new Map([[piece.role, s.movable.dests.get(dropOrigOf(piece.role))!]]);
        s.dropmode.active = true;
        s.dropmode.dropDests = dropDests;
      }
    }
  }
}

export function cancelDropMode(s: HeadlessState): void {
  s.dropmode.active = false;
}

export function drop(s: State, e: MouchEvent): void {
  if (!s.dropmode.active) return;

  unsetPremove(s);
  unsetPredrop(s);

  const piece = s.dropmode.piece;

  if (piece) {
    s.pieces.set('a0', piece);
    const position = eventPosition(e);
    const dest = position && getKeyAtDomPos(position, whitePov(s), s.dom.bounds(), s.geometry);
    if (dest) dropNewPiece(s, 'a0', dest);
  }
  s.dom.redraw();
}
