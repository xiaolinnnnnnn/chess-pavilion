/** 中国象棋规则（前后端共用，纯函数） */
export type Side = 'red' | 'green';
export type Piece = string | '';

export interface Pos {
  x: number;
  y: number;
}

export function sideOf(piece: Piece): Side | null {
  if (!piece) return null;
  return piece[0] === 'r' ? 'red' : 'green';
}

export function createInitialBoard(): Piece[][] {
  const emptyRow = () => Array(9).fill('') as Piece[];
  const board: Piece[][] = Array(10).fill(0).map(() => emptyRow());
  board[0] = ['gR', 'gN', 'gB', 'gA', 'gK', 'gA', 'gB', 'gN', 'gR'];
  board[2][1] = 'gC';
  board[2][7] = 'gC';
  board[3][0] = 'gP';
  board[3][2] = 'gP';
  board[3][4] = 'gP';
  board[3][6] = 'gP';
  board[3][8] = 'gP';
  board[6][0] = 'rP';
  board[6][2] = 'rP';
  board[6][4] = 'rP';
  board[6][6] = 'rP';
  board[6][8] = 'rP';
  board[7][1] = 'rC';
  board[7][7] = 'rC';
  board[9] = ['rR', 'rN', 'rB', 'rA', 'rK', 'rA', 'rB', 'rN', 'rR'];
  return board;
}

export function inBounds(x: number, y: number) {
  return x >= 0 && x < 10 && y >= 0 && y < 9;
}

export function cloneBoard(src: Piece[][]): Piece[][] {
  return src.map((row) => row.slice()) as Piece[][];
}

export function countBetweenSameCol(board: Piece[][], fromRow: number, toRow: number, col: number) {
  let count = 0;
  const [start, end] = fromRow < toRow ? [fromRow + 1, toRow - 1] : [toRow + 1, fromRow - 1];
  for (let row = start; row <= end; row++) if (board[row][col]) count++;
  return count;
}

export function countBetweenSameRow(board: Piece[][], row: number, fromCol: number, toCol: number) {
  let count = 0;
  const [start, end] = fromCol < toCol ? [fromCol + 1, toCol - 1] : [toCol + 1, fromCol - 1];
  for (let col = start; col <= end; col++) if (board[row][col]) count++;
  return count;
}

export function isPalace(x: number, y: number, side: Side) {
  if (y < 3 || y > 5) return false;
  return side === 'red' ? x >= 7 && x <= 9 : x >= 0 && x <= 2;
}

export function crossedRiver(x: number, side: Side) {
  return side === 'red' ? x <= 4 : x >= 5;
}

export function findGeneral(board: Piece[][], side: Side): Pos | null {
  const target = side === 'red' ? 'rK' : 'gK';
  for (let x = 0; x < 10; x++) for (let y = 0; y < 9; y++) if (board[x][y] === target) return { x, y };
  return null;
}

export function generalsFace(board: Piece[][]) {
  const red = findGeneral(board, 'red');
  const green = findGeneral(board, 'green');
  if (!red || !green) return false;
  if (red.y !== green.y) return false;
  return countBetweenSameCol(board, red.x, green.x, red.y) === 0;
}

export function isLegalMoveForPiece(board: Piece[][], piece: Piece, from: Pos, to: Pos): boolean {
  if (!piece) return false;
  const { x: fx, y: fy } = from;
  const { x: tx, y: ty } = to;
  if (!inBounds(tx, ty) || (fx === tx && fy === ty)) return false;

  const side = sideOf(piece)!;
  const type = piece[1];
  const dx = tx - fx;
  const dy = ty - fy;
  const adx = Math.abs(dx);
  const ady = Math.abs(dy);
  const target = board[tx][ty];
  if (target && sideOf(target) === side) return false;

  switch (type) {
    case 'R':
      if (dx !== 0 && dy !== 0) return false;
      return dx === 0
        ? countBetweenSameRow(board, fx, fy, ty) === 0
        : countBetweenSameCol(board, fx, tx, fy) === 0;
    case 'N': {
      if (!((adx === 2 && ady === 1) || (adx === 1 && ady === 2))) return false;
      if (adx === 2) return !board[fx + (dx > 0 ? 1 : -1)][fy];
      return !board[fx][fy + (dy > 0 ? 1 : -1)];
    }
    case 'B': {
      if (!(adx === 2 && ady === 2)) return false;
      if (board[fx + dx / 2][fy + dy / 2]) return false;
      if (side === 'red' && tx <= 4) return false;
      if (side === 'green' && tx >= 5) return false;
      return true;
    }
    case 'A':
      return adx === 1 && ady === 1 && isPalace(tx, ty, side);
    case 'K': {
      if (dy === 0 && target && target === (side === 'red' ? 'gK' : 'rK')) {
        return countBetweenSameCol(board, fx, tx, fy) === 0;
      }
      if (!((adx === 1 && ady === 0) || (adx === 0 && ady === 1))) return false;
      return isPalace(tx, ty, side);
    }
    case 'C': {
      if (dx !== 0 && dy !== 0) return false;
      const count = dx === 0 ? countBetweenSameRow(board, fx, fy, ty) : countBetweenSameCol(board, fx, tx, fy);
      return target ? count === 1 : count === 0;
    }
    case 'P': {
      const dir = side === 'red' ? -1 : 1;
      if (dy === 0 && dx === dir) return true;
      return crossedRiver(fx, side) && adx === 0 && ady === 1;
    }
  }
  return false;
}

export function isInCheck(board: Piece[][], side: Side) {
  const general = findGeneral(board, side);
  if (!general) return false;
  const enemy: Side = side === 'red' ? 'green' : 'red';
  const enemyGeneral = findGeneral(board, enemy);
  if (enemyGeneral && enemyGeneral.y === general.y && countBetweenSameCol(board, general.x, enemyGeneral.x, general.y) === 0) {
    return true;
  }
  for (let x = 0; x < 10; x++) {
    for (let y = 0; y < 9; y++) {
      const piece = board[x][y];
      if (!piece || sideOf(piece) !== enemy) continue;
      if (isLegalMoveForPiece(board, piece, { x, y }, general)) return true;
    }
  }
  return false;
}

export function hasAnyLegalEscapeMove(board: Piece[][], side: Side) {
  for (let fx = 0; fx < 10; fx++) {
    for (let fy = 0; fy < 9; fy++) {
      const piece = board[fx][fy];
      if (!piece || sideOf(piece) !== side) continue;
      for (let tx = 0; tx < 10; tx++) {
        for (let ty = 0; ty < 9; ty++) {
          if (fx === tx && fy === ty) continue;
          if (!isLegalMoveForPiece(board, piece, { x: fx, y: fy }, { x: tx, y: ty })) continue;
          const next = cloneBoard(board);
          next[tx][ty] = piece;
          next[fx][fy] = '';
          if (generalsFace(next) || isInCheck(next, side)) continue;
          return true;
        }
      }
    }
  }
  return false;
}

export function applyMove(board: Piece[][], from: Pos, to: Pos): Piece[][] {
  const next = cloneBoard(board);
  next[to.x][to.y] = next[from.x][from.y];
  next[from.x][from.y] = '';
  return next;
}
