import { Color, Geometry, Key, Pieces, Variant } from './types';
import { allPos, key2pos, pos2key } from './util';

type Mobility = (x1: number, y1: number, x2: number, y2: number) => boolean;

function diff(a: number, b: number): number {
  return Math.abs(a - b);
}

function pawn(color: Color): Mobility {
  return (x1, y1, x2, y2) =>
    diff(x1, x2) < 2 &&
    (color === 'white'
      ? // allow 2 squares from first two ranks, for horde
        y2 === y1 + 1 || (y1 <= 1 && y2 === y1 + 2 && x1 === x2)
      : y2 === y1 - 1 || (y1 >= 6 && y2 === y1 - 2 && x1 === x2));
}

export const knight: Mobility = (x1, y1, x2, y2) => {
  const xd = diff(x1, x2);
  const yd = diff(y1, y2);
  return (xd === 1 && yd === 2) || (xd === 2 && yd === 1);
};

export const giraffe: Mobility = (x1, y1, x2, y2) => {
  const xd = diff(x1, x2);
  const yd = diff(y1, y2);
  return (xd === 1 && yd === 4) || (xd === 4 && yd === 1);
};

const bishop: Mobility = (x1, y1, x2, y2) => {
  return diff(x1, x2) === diff(y1, y2);
};

const rook: Mobility = (x1, y1, x2, y2) => {
  return x1 === x2 || y1 === y2;
};

export const queen: Mobility = (x1, y1, x2, y2) => {
  return bishop(x1, y1, x2, y2) || rook(x1, y1, x2, y2);
};

function king(color: Color, rookFiles: number[], canCastle: boolean): Mobility {
  return (x1, y1, x2, y2) =>
    (diff(x1, x2) < 2 && diff(y1, y2) < 2) ||
    (canCastle &&
      y1 === y2 &&
      y1 === (color === 'white' ? 0 : 7) &&
      ((x1 === 4 && ((x2 === 2 && rookFiles.includes(0)) || (x2 === 6 && rookFiles.includes(7)))) ||
        rookFiles.includes(x2)));
}
function rookFilesOf(pieces: Pieces, color: Color) {
  const backrank = color === 'white' ? '1' : '8';
  const files = [];
  for (const [key, piece] of pieces) {
    if (key[1] === backrank && piece.color === color && piece.role === 'r-piece') {
      files.push(key2pos(key)[0]);
    }
  }
  return files;
}

// capablanca king (different castling files from standard chess king)

// archbishop (knight + bishop)
const archbishop: Mobility = (x1, y1, x2, y2) => {
  return bishop(x1, y1, x2, y2) || knight(x1, y1, x2, y2);
};

// chancellor (knight + rook)
const chancellor: Mobility = (x1, y1, x2, y2) => {
  return rook(x1, y1, x2, y2) || knight(x1, y1, x2, y2);
};

export function premove(
  pieces: Pieces,
  key: Key,
  canCastle: boolean,
  geom: Geometry,
  variant: Variant,
): Key[] {
  const piece = pieces.get(key)!;
  const role = piece.role;
  const color = piece.color;
  const pos = key2pos(key);
  let mobility: Mobility = () => false;

  switch (variant) {
    default:
      switch (role) {
        case 'p-piece':
          mobility = pawn(color);
          break; // pawn
        case 'r-piece':
          mobility = rook;
          break; // rook
        case 'n-piece':
          mobility = knight;
          break; // knight
        case 'b-piece':
          mobility = bishop;
          break; // bishop
        case 'q-piece':
          mobility = queen;
          break; // queen
        case 'e-piece': // S-chess elephant
        case 'c-piece':
          mobility = chancellor;
          break; // chancellor
        case 'h-piece': // S-chess hawk
        case 'a-piece':
          mobility = archbishop;
          break; // archbishop
        case 'g-piece':
          mobility = giraffe;
          break;
        case 'k-piece':
          mobility = king(color, rookFilesOf(pieces, color), canCastle);
          break; // king
      }
  }

  let keys = allPos(geom)
    .filter(pos2 => (pos[0] !== pos2[0] || pos[1] !== pos2[1]) && mobility(pos[0], pos[1], pos2[0], pos2[1]))
    .map(pos2key);

  return keys;
}
