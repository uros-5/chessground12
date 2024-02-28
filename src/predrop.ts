import { Geometry, Key, Piece, Pieces, Variant } from './types.js';
import { allPos, pos2key } from './util.js';

type DropMobility = (x: number, y: number) => boolean;

const wholeBoard = () => true;

export function predrop(pieces: Pieces, piece: Piece, geom: Geometry, variant: Variant): Key[] {
  const color = piece.color;

  // Pieces can be dropped anywhere on the board by default.
  // Mobility will be modified based on variant and piece to match the game rule.
  const mobility: DropMobility = wholeBoard;

  switch (variant) {
    default:
      console.warn('Unknown drop variant', variant);
  }

  let keys = allPos(geom)
    .filter(pos => pieces.get(pos2key(pos))?.color !== color && mobility(pos[0], pos[1]))
    .map(pos2key) as Key[];
  return keys;
}
