import type { State } from './state.js';
import { type Config, configure, applyAnimation } from './config.js';
import { anim, render } from './anim.js';
import { cancel as dragCancel, dragNewPiece } from './drag.js';
import type { DrawShape } from './draw.js';
import {
  baseMove,
  baseNewPiece,
  cancelMove,
  getKeyAtDomPos,
  playPredrop,
  playPremove,
  selectSquare,
  setLastMove,
  setPieces,
  setPlinths,
  unselect,
  unsetPredrop,
  unsetPremove,
  whitePov,
} from './board.js';
import { toggleOrientation as toggleOrientation2, stop as stop2 } from './board.js';
import { Key, MouchEvent, NumberPair, Piece, PiecesDiff, Redraw, Unbind } from './types.js';

export interface Api {
  // reconfigure the instance. Accepts all config options, except for viewOnly & drawable.visible.
  // board will be animated accordingly, if animations are enabled.
  set(config: Config): void;

  // read chessground state; write at your own risks.
  state: State;

  // get the position as a FEN string (only contains pieces, no flags)
  // e.g. rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR

  // change the view angle
  toggleOrientation(): void;

  // perform a move programmatically
  move(orig: Key, dest: Key): void;

  // add and/or remove arbitrary pieces on the board
  setPieces(pieces: PiecesDiff): void;

  setPlinths(pieces: PiecesDiff): void;

  setLastMove(from: string, to: string): void;

  // click a square programmatically
  selectSquare(key: Key | null, force?: boolean): void;

  // put a new piece on the board
  newPiece(piece: Piece, key: Key): void;

  // play the current premove, if any; returns true if premove was played
  playPremove(): boolean;

  // cancel the current premove, if any
  cancelPremove(): void;

  // play the current predrop, if any; returns true if premove was played
  playPredrop(): boolean;

  // cancel the current predrop, if any
  cancelPredrop(): void;

  // cancel the current move being made
  cancelMove(): void;

  // cancel current move and prevent further ones
  stop(): void;

  // programmatically draw user shapes
  setShapes(shapes: DrawShape[]): void;

  // programmatically draw auto shapes
  setAutoShapes(shapes: DrawShape[]): void;

  // square name at this DOM position (like "e4")
  getKeyAtDomPos(pos: NumberPair): Key | undefined;

  // only useful when CSS changes the board width/height ratio (for 3D)
  redrawAll: Redraw;

  // for crazyhouse and board editors
  dragNewPiece(piece: Piece, event: MouchEvent, force?: boolean): void;

  // unbinds all events
  // (important for document-wide events like scroll and mousemove)
  destroy: Unbind;
}

// see API types and documentations in dts/api.d.ts
export function start(state: State, redrawAll: Redraw): Api {
  function toggleOrientation(): void {
    state.plinthsPlaced = false;
    toggleOrientation2(state);
    redrawAll();
  }

  return {
    set(config): void {
      if (config.orientation && config.orientation !== state.orientation) toggleOrientation();
      applyAnimation(state, config);
      (config.fen ? anim : render)(state => configure(state, config), state);
    },

    state,

    toggleOrientation,

    setPieces(pieces): void {
      anim(state => setPieces(state, pieces), state);
    },

    setPlinths(pieces): void {
      anim(state => setPlinths(state, pieces), state);
    },

    setLastMove(from, to): void {
      anim(state => setLastMove(state, from, to), state);
    },

    selectSquare(key, force): void {
      if (key) anim(state => selectSquare(state, key, force), state);
      else if (state.selected) {
        unselect(state);
        state.dom.redraw();
      }
    },

    move(orig, dest): void {
      anim(state => baseMove(state, orig, dest), state);
    },

    newPiece(piece, key): void {
      anim(state => baseNewPiece(state, piece, key), state);
    },

    playPremove(): boolean {
      if (state.premovable.current) {
        if (anim(playPremove, state)) return true;
        // if the premove couldn't be played, redraw to clear it up
        state.dom.redraw();
      }
      return false;
    },

    playPredrop(): boolean {
      if (state.predroppable.current) {
        const result = playPredrop(state);
        state.dom.redraw();
        return result;
      }
      return false;
    },

    cancelPremove(): void {
      render(unsetPremove, state);
    },

    cancelPredrop(): void {
      render(unsetPredrop, state);
    },

    cancelMove(): void {
      render(state => {
        cancelMove(state);
        dragCancel(state);
      }, state);
    },

    stop(): void {
      render(state => {
        stop2(state);
        dragCancel(state);
      }, state);
    },

    setAutoShapes(shapes: DrawShape[]): void {
      render(state => (state.drawable.autoShapes = shapes), state);
    },

    setShapes(shapes: DrawShape[]): void {
      render(state => (state.drawable.shapes = shapes), state);
    },

    getKeyAtDomPos(pos): Key | undefined {
      return getKeyAtDomPos(pos, whitePov(state), state.dom.bounds(), state.geometry);
    },

    redrawAll,

    dragNewPiece(piece, event, force): void {
      dragNewPiece(state, piece, event, force);
    },

    destroy(): void {
      stop2(state);
      state.dom.unbind && state.dom.unbind();
      state.dom.destroyed = true;
    },
  };
}
