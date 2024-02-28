import type { HeadlessState } from './state.js';
import { setCheck, setSelected } from './board.js';
import type { DrawShape, DrawBrushes } from './draw.js';
import { setPredropDests, readPockets } from './pocket.js';
import {
  Color,
  Dests,
  DropDests,
  Elements,
  FEN,
  Geometry,
  Key,
  MoveMetadata,
  Notation,
  Piece,
  PocketRoles,
  Role,
  SetPremoveMetadata,
  Variant,
  dimensions,
} from './types.js';

export interface Config {
  fen?: FEN; // chess position in Forsyth notation
  orientation?: Color; // board orientation. white | black
  turnColor?: Color; // turn to play. white | black
  check?: Color | boolean; // true for current color, false to unset
  lastMove?: Key[]; // squares part of the last move ["c3", "c4"]
  selected?: Key; // square currently selected "a1"
  coordinates?: boolean; // include coords attributes
  autoCastle?: boolean; // immediately complete the castle by moving the rook after king move
  viewOnly?: boolean; // don't bind events: the user will never be able to move pieces around
  disableContextMenu?: boolean; // because who needs a context menu on a chessboard
  addPieceZIndex?: boolean; // adds z-index values to pieces (for 3D)
  addDimensionsCssVars?: boolean; // add --cg-width and --cg-height CSS vars containing the board's dimensions to the document root
  blockTouchScroll?: boolean; // block scrolling via touch dragging on the board, e.g. for coordinate training
  // pieceKey: boolean; // add a data-key attribute to piece elements
  highlight?: {
    lastMove?: boolean; // add last-move class to squares
    check?: boolean; // add check class to squares
  };
  animation?: {
    enabled?: boolean;
    duration?: number;
  };
  movable?: {
    free?: boolean; // all moves are valid - board editor
    color?: Color | 'both'; // color that can move. white | black | both | undefined
    dests?: Dests; // valid moves. {"a2" ["a3" "a4"] "b1" ["a3" "c3"]}
    showDests?: boolean; // whether to add the move-dest class on squares
    events?: {
      after?: (orig: Key, dest: Key, metadata: MoveMetadata) => void; // called after the move has been played
      afterNewPiece?: (role: Role, key: Key, metadata: MoveMetadata) => void; // called after a new piece is dropped on the board
    };
    rookCastle?: boolean; // castle by moving the king to the rook
  };
  premovable?: {
    enabled?: boolean; // allow premoves for color that can not move
    showDests?: boolean; // whether to add the premove-dest class on squares
    castle?: boolean; // whether to allow king castle premoves
    dests?: Key[]; // premove destinations for the current selection
    events?: {
      set?: (orig: Key, dest: Key, metadata?: SetPremoveMetadata) => void; // called after the premove has been set
      unset?: () => void; // called after the premove has been unset
    };
  };
  predroppable?: {
    enabled?: boolean; // allow predrops for color that can not move
    showDropDests?: boolean;
    dropDests?: Key[];
    current?: {
      // See corresponding type in state.ts for more comments
      role: Role;
      key: Key;
    };
    events?: {
      set?: (role: Role, key: Key) => void; // called after the predrop has been set
      unset?: () => void; // called after the predrop has been unset
    };
  };
  draggable?: {
    enabled?: boolean; // allow moves & premoves to use drag'n drop
    distance?: number; // minimum distance to initiate a drag; in pixels
    autoDistance?: boolean; // lets chessground set distance to zero when user drags pieces
    showGhost?: boolean; // show ghost of piece being dragged
    deleteOnDropOff?: boolean; // delete a piece when it is dropped off the board
  };
  selectable?: {
    // disable to enforce dragging over click-click move
    enabled?: boolean;
  };
  events?: {
    change?: () => void; // called after the situation changes on the board
    // called after a piece has been moved.
    // capturedPiece is undefined or like {color: 'white'; 'role': 'queen'}
    move?: (orig: Key, dest: Key, capturedPiece?: Piece) => void;
    dropNewPiece?: (piece: Piece, key: Key) => void;
    select?: (key: Key) => void; // called when a square is selected
    insert?: (elements: Elements) => void; // when the board DOM has been (re)inserted
    pocketSelect: (piece: Piece) => void;
  };
  dropmode?: {
    active?: boolean;
    piece?: Piece;
    showDropDests?: boolean; // whether to add the move-dest class on squares for drops
    dropDests?: DropDests; // see corresponding state.ts type for comments
  };
  drawable?: {
    enabled?: boolean; // can draw
    visible?: boolean; // can view
    defaultSnapToValidMove?: boolean;
    // false to keep the drawing if a movable piece is clicked.
    // Clicking an empty square or immovable piece will clear the drawing regardless.
    eraseOnClick?: boolean;
    shapes?: DrawShape[];
    autoShapes?: DrawShape[];
    brushes?: DrawBrushes;
    pieces?: {
      baseUrl?: string;
    };
    onChange?: (shapes: DrawShape[]) => void; // called after drawable shapes change
  };
  geometry?: Geometry; // dim3x4 | dim5x5 | dim7x7 | dim8x8 | dim9x9 | dim10x8 | dim9x10 | dim10x10
  variant?: Variant;
  chess960?: boolean;
  notation?: Notation;
  pocketRoles?: PocketRoles; // what pieces have slots in the pocket for each color
}

export function applyAnimation(state: HeadlessState, config: Config): void {
  if (config.animation) {
    deepMerge(state.animation, config.animation);
    // no need for such short animations
    if ((state.animation.duration || 0) < 70) state.animation.enabled = false;
  }
}

export function configure(state: HeadlessState, config: Config): void {
  // don't merge destinations and autoShapes. Just override.
  if (config.movable?.dests) state.movable.dests = undefined;
  if (config.dropmode?.dropDests) state.dropmode.dropDests = undefined;
  if (config.drawable?.autoShapes) state.drawable.autoShapes = [];

  deepMerge(state, config);

  if (config.geometry) state.dimensions = dimensions[config.geometry];

  // if a fen was provided, replace the pieces
  if (config.fen) {
    const pieces = new Map();
    // prevent calling cancel() if piece drag is already started from pocket!
    const draggedPiece = state.pieces.get('a0');
    if (draggedPiece !== undefined) pieces.set('a0', draggedPiece);
    state.pieces = pieces;
    state.drawable.shapes = [];

    if (state.pocketRoles) {
      state.pockets = readPockets(config.fen, state.pocketRoles);
    }
  }

  // apply config values that could be undefined yet meaningful
  if ('check' in config) setCheck(state, config.check || false);
  if ('lastMove' in config && !config.lastMove) state.lastMove = undefined;
  // in case of ZH drop last move, there's a single square.
  // if the previous last move had two squares,
  // the merge algorithm will incorrectly keep the second square.
  else if (config.lastMove) state.lastMove = config.lastMove;

  // fix move/premove dests
  if (state.selected) setSelected(state, state.selected);
  setPredropDests(state); // TODO: integrate pocket with the "selected" infrastructure and move this in setSelected()

  applyAnimation(state, config);

  if (!state.movable.rookCastle && state.movable.dests) {
    const rank = state.movable.color === 'white' ? '1' : '8',
      kingStartPos = ('e' + rank) as Key,
      dests = state.movable.dests.get(kingStartPos),
      king = state.pieces.get(kingStartPos);
    if (!dests || !king || king.role !== 'k-piece') return;
    state.movable.dests.set(
      kingStartPos,
      dests.filter(
        d =>
          !(d === 'a' + rank && dests.includes(('c' + rank) as Key)) &&
          !(d === 'h' + rank && dests.includes(('g' + rank) as Key)),
      ),
    );
  }
}

// eslint-disable-next-line
function deepMerge(base: any, extend: any): void {
  for (const key in extend) {
    if (isObject(base[key]) && isObject(extend[key])) deepMerge(base[key], extend[key]);
    else base[key] = extend[key];
  }
}

function isObject(o: unknown): boolean {
  return typeof o === 'object';
}
