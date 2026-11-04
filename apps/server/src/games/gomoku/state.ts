import type { Board, Coord, Move, Stone } from './rules';

/** 房间配置（由前端 GomokuAttrs 写入 room.attrs） */
export interface GomokuAttrs {
  /** 每步限时秒数：0 不限时，30 / 60 秒 */
  countDownWay?: number;
  /** 先后手：随机 / 房主先手 / 加入者先手 */
  firstMoveWay?: FirstMoveWay;
  [key: string]: unknown;
}

export type FirstMoveWay = 'random' | 'creator' | 'joiner';
export type GomokuPhase = 'waiting' | 'playing' | 'finished';
export type PendingKind = 'undo' | 'draw' | 'restart';

export type ResultReason =
  | 'five'
  | 'full'
  | 'agreed-draw'
  | 'resign'
  | 'timeout'
  | 'disconnect'
  | 'interrupted';

export interface GomokuResult {
  winnerId: string | null;
  reason: ResultReason;
  line: Coord[] | null;
  detail?: string;
}

export interface GomokuPending {
  kind: PendingKind;
  requesterId: string;
  expiresAt: number;
}

export interface GomokuPlayerInfo {
  id: string;
  name: string;
  color: Stone;
}

export interface GomokuSettings {
  countDownWay: number;
  firstMoveWay: FirstMoveWay;
}

export interface GomokuHistoryEntry extends Move {
  /** 相对开局时间的毫秒偏移，用于回放 */
  time: number;
}

/** 服务端广播给客户端的完整公开状态 */
export interface GomokuState {
  phase: GomokuPhase;
  board: Board;
  history: GomokuHistoryEntry[];
  currentId: string | null;
  colors: Record<string, Stone>;
  players: GomokuPlayerInfo[];
  settings: GomokuSettings;
  result: GomokuResult | null;
  pending: GomokuPending | null;
  undoLeft: Record<string, number>;
  drawLeft: Record<string, number>;
  /** 当前回合计时截止时间戳，null 表示不计时 */
  deadline: number | null;
  watchers: number;
}

export type { Board, Coord, Move, Stone };
