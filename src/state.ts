import type { AnimCurrent } from './anim.js';
import type { DragCurrent } from './drag.js';
import type { Drawable } from './draw.js';
import {
  BoardDimensions,
  Color,
  Dests,
  Dom,
  DropDests,
  Elements,
  Exploding,
  Geometry,
  Key,
  KeyPair,
  MoveMetadata,
  Notation,
  Piece,
  Pieces,
  Plinths,
  PocketRoles,
  Pockets,
  Role,
  SetPremoveMetadata,
  Timer,
  Variant,
  dimensions,
} from './types.js';
import { timer } from './util.js';

export interface HeadlessState {
  pieces: Pieces;
  plinths: Plinths;
  plinthsPlaced: boolean;
  orientation: Color; // board orientation. white | black
  turnColor: Color; // turn to play. white | black
  check?: Key; // square currently in check "a2"
  lastMove?: Key[]; // squares part of the last move ["c3"; "c4"]
  selected?: Key; // square currently selected "a1"
  coordinates: boolean; // include coords attributes
  autoCastle: boolean; // immediately complete the castle by moving the rook after king move
  viewOnly: boolean; // don't bind events: the user will never be able to move pieces around
  disableContextMenu: boolean; // because who needs a context menu on a chessboard
  addPieceZIndex: boolean; // adds z-index values to pieces (for 3D)
  addDimensionsCssVars: boolean; // add --cg-width and --cg-height CSS vars containing the board's dimensions to the document root
  blockTouchScroll: boolean; // block scrolling via touch dragging on the board, e.g. for coordinate training
  pieceKey: boolean; // add a data-key attribute to piece elements
  highlight: {
    lastMove: boolean; // add last-move class to squares
    check: boolean; // add check class to squares
  };
  animation: {
    enabled: boolean;
    duration: number;
    current?: AnimCurrent;
  };
  movable: {
    free: boolean; // all moves are valid - board editor
    color?: Color | 'both'; // color that can move. white | black | both
    dests?: Dests; // valid moves. {"a2" ["a3" "a4"] "b1" ["a3" "c3"]}
    showDests: boolean; // whether to add the move-dest class on squares
    events: {
      after?: (orig: Key, dest: Key, metadata: MoveMetadata) => void; // called after the move has been played
      afterNewPiece?: (role: Role, key: Key, metadata: MoveMetadata) => void; // called after a new piece is dropped on the board
    };
    rookCastle: boolean; // castle by moving the king to the rook
  };
  premovable: {
    enabled: boolean; // allow premoves for color that can not move
    showDests: boolean; // whether to add the premove-dest class on squares
    castle: boolean; // whether to allow king castle premoves
    dests?: Key[]; // premove destinations for the current selection
    current?: KeyPair; // keys of the current saved premove ["e2" "e4"]
    events: {
      set?: (orig: Key, dest: Key, metadata?: SetPremoveMetadata) => void; // called after the premove has been set
      unset?: () => void; // called after the premove has been unset
    };
  };
  predroppable: {
    enabled: boolean; // allow predrops for color that can not move
    showDropDests: boolean; // whether to add the premove-dest css class on dest squares. Maybe an overkill to have this showDest and showDrop dests in each and every place, but could make sense one day
    dropDests?: Key[]; // premove destinations for the currently "selected" piece for pre-dropping. Both in case of drag-drop or click-drop
    current?: {
      // current saved predrop {role: 'knight'; key: 'e4'}.
      role: Role;
      key: Key;
    };
    events: {
      set?: (role: Role, key: Key) => void; // called after the predrop has been set
      unset?: () => void; // called after the predrop has been unset
    };
  };
  draggable: {
    enabled: boolean; // allow moves & premoves to use drag'n drop
    distance: number; // minimum distance to initiate a drag; in pixels
    autoDistance: boolean; // lets chessground set distance to zero when user drags pieces
    showGhost: boolean; // show ghost of piece being dragged
    deleteOnDropOff: boolean; // delete a piece when it is dropped off the board
    current?: DragCurrent;
  };
  dropmode: {
    // used for pocket pieces drops.
    active: boolean;
    showDropDests: boolean;
    piece?: Piece;
    dropDests?: DropDests; // Both in case of click-drop and drag-drop from pocket it stores the possible dests from highlighting (TODO:which is not great to use this for both cases imho)
  };
  selectable: {
    // disable to enforce dragging over click-click move
    enabled: boolean;
  };
  stats: {
    // was last piece dragged or clicked?
    // needs default to false for touch
    dragged: boolean;
    ctrlKey?: boolean;
  };
  events: {
    change?: () => void; // called after the situation changes on the board
    // called after a piece has been moved.
    // capturedPiece is undefined or like {color: 'white'; 'role': 'queen'}
    move?: (orig: Key, dest: Key, capturedPiece?: Piece) => void;
    dropNewPiece?: (piece: Piece, key: Key) => void;
    select?: (key: Key) => void; // called when a square is selected
    insert?: (elements: Elements) => void; // when the board DOM has been (re)inserted
    pocketSelect?: (piece: Piece) => void;
  };
  drawable: Drawable;
  exploding?: Exploding;
  hold: Timer;
  dimensions: BoardDimensions; // number of lines and ranks of the board {width: 10, height: 8}
  geometry: Geometry; // dim8x8 | dim9x9 | dim10x8 | dim9x10
  variant: Variant;
  chess960: boolean;
  notation: Notation;
  pockets?: Pockets; // undefinied for non-pocket variants. State of pockets for each color
  pocketRoles?: PocketRoles; // undefinied for non-pocket variants. Possible pieces that a pocket can hold for each color
}

export interface State extends HeadlessState {
  dom: Dom;
}

export function defaults(): HeadlessState {
  return {
    pieces: new Map(),
    plinths: new Map(),
    plinthsPlaced: false,
    orientation: 'white',
    turnColor: 'white',
    coordinates: true,
    autoCastle: true,
    viewOnly: false,
    disableContextMenu: false,
    addPieceZIndex: false,
    addDimensionsCssVars: false,
    blockTouchScroll: false,
    pieceKey: false,
    highlight: {
      lastMove: true,
      check: true,
    },
    animation: {
      enabled: true,
      duration: 200,
    },
    movable: {
      free: true,
      color: 'both',
      showDests: true,
      events: {},
      rookCastle: true,
    },
    premovable: {
      enabled: true,
      showDests: true,
      castle: true,
      events: {},
    },
    predroppable: {
      enabled: false,
      showDropDests: true,
      events: {},
    },
    draggable: {
      enabled: true,
      distance: 3,
      autoDistance: true,
      showGhost: true,
      deleteOnDropOff: false,
    },
    dropmode: {
      active: false,
      showDropDests: true,
    },
    selectable: {
      enabled: true,
    },
    stats: {
      // on touchscreen, default to "tap-tap" moves
      // instead of drag
      dragged: !('ontouchstart' in window),
    },
    events: {},
    drawable: {
      enabled: true, // can draw
      visible: true, // can view
      defaultSnapToValidMove: true,
      eraseOnClick: true,
      shapes: [],
      autoShapes: [],
      brushes: {
        green: { key: 'g', color: '#15781B', opacity: 1, lineWidth: 10 },
        red: { key: 'r', color: '#882020', opacity: 1, lineWidth: 10 },
        blue: { key: 'b', color: '#003088', opacity: 1, lineWidth: 10 },
        yellow: { key: 'y', color: '#e68f00', opacity: 1, lineWidth: 10 },
        paleBlue: { key: 'pb', color: '#003088', opacity: 0.4, lineWidth: 15 },
        paleGreen: { key: 'pg', color: '#15781B', opacity: 0.4, lineWidth: 15 },
        paleRed: { key: 'pr', color: '#882020', opacity: 0.4, lineWidth: 15 },
        paleGrey: {
          key: 'pgr',
          color: '#4a4a4a',
          opacity: 0.35,
          lineWidth: 15,
        },
      },
      pieces: {
        baseUrl: 'https://lichess1.org/assets/piece/cburnett/',
      },
      prevSvgHash: '',
    },
    hold: timer(),
    dimensions: dimensions[0],
    geometry: Geometry.dim12x12,
    variant: 'shuuro',
    chess960: false,
    notation: Notation.ALGEBRAIC,
  };
}
