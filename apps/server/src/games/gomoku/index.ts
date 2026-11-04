import { PlayerRole, PlayerStatus, RoomPlayer } from '@yige/engine';
import type { IRoomPlayer } from '@yige/engine';
import { GameRoom, IGameCommand } from '..';
import { BLACK, WHITE, createBoard, isPlayable, judgeMove, rebuildBoard } from './rules';
import type { Board, Coord, Stone } from './rules';
import type {
  FirstMoveWay,
  GomokuAttrs,
  GomokuHistoryEntry,
  GomokuPending,
  GomokuResult,
  GomokuSettings,
  GomokuState,
  PendingKind,
  ResultReason,
} from './state';

export const name = '五子棋';
export const minSize = 2;
export const maxSize = 2;
export const description = `15×15 标准棋盘，横、竖、斜任意方向连成五子即胜。支持悔棋、求和、重来与每步限时，所有落子与胜负由服务端权威判定。`;

export const table = 'grid';
export const ai = 'client';
export const settings = [
  {
    key: 'countDownWay',
    label: '每步限时',
    type: 'select',
    options: [
      { label: '不限时', value: 0 },
      { label: '30 秒', value: 30 },
      { label: '60 秒', value: 60 },
    ],
    default: 0,
  },
  {
    key: 'firstMoveWay',
    label: '先后手',
    type: 'select',
    options: [
      { label: '随机', value: 'random' },
      { label: '房主先手', value: 'creator' },
      { label: '加入者先手', value: 'joiner' },
    ],
    default: 'random',
  },
];

const PENDING_TIMEOUT = 30_000;
const OFFLINE_GRACE = 2_000;
const WATCHER_LIMIT = 20;
const UNDO_LIMIT = 3;
const DRAW_LIMIT = 1;

const ALLOWED_TURN_SECONDS = [0, 30, 60];
const PENDING_LABEL: Record<PendingKind, string> = {
  undo: '悔棋',
  draw: '求和',
  restart: '重来',
};

const REASON_TEXT: Record<ResultReason, string> = {
  five: '五子连珠',
  full: '棋盘已满',
  'agreed-draw': '双方同意和棋',
  resign: '认输',
  timeout: '落子超时',
  disconnect: '断线未重连',
  interrupted: '对局中断',
};

class GomokuGameRoom extends GameRoom {
  phase: GomokuState['phase'] = 'waiting';
  board: Board = createBoard();
  history: GomokuHistoryEntry[] = [];
  currentId: string | null = null;
  colors: Record<string, Stone> = {};
  undoLeft: Record<string, number> = {};
  drawLeft: Record<string, number> = {};
  result: GomokuResult | null = null;
  pending: GomokuPending | null = null;
  /** 结算幂等标记：同一局只结算一次 */
  settled = false;
  /** 上一局先手，重来时交换 */
  lastFirstId: string | null = null;

  init() {
    const room = super.init();

    room
      .on('join', (player: IRoomPlayer) => this.onJoin(player))
      .on('leave', (player: IRoomPlayer) => this.onLeave(player))
      .on('player-offline', (player: IRoomPlayer) => this.onOffline(player));

    // 服务重启后进行中的对局无法可靠恢复，按提示词作废且不结算
    if (this.phase === 'playing') {
      this.voidRound('服务重启导致对局中断');
      return room;
    }

    // 非对局中的残留计时器就地清理，避免 restoreTimer 缺少回调
    Object.keys(this.tickEndTime).forEach((key) => {
      if (key !== 'turn' && key !== 'pending') {
        delete this.tickEndTime[key];
        delete this.tickTimeout[key];
      }
    });
    this.restoreTimer({
      turn: () => this.handleTurnTimeout(),
      pending: () => this.resolvePending(false),
    });

    return room;
  }

  getStatus(sender: RoomPlayer) {
    return {
      ...super.getStatus(sender),
      gomoku: this.publicState(),
    };
  }

  getData() {
    return {
      history: this.history,
      players: this.room.validPlayers.map((player) => ({
        id: player.id,
        username: player.attributes?.username,
        name: player.name,
        color: this.colors[player.id] ?? 0,
      })),
      result: this.result,
      message: this.messageHistory,
    };
  }

  onStart() {
    const players = this.room.validPlayers;
    if (players.length < minSize) {
      this.say('玩家人数不足，无法开始对局。');
      return;
    }

    const first = this.pickFirstPlayer();
    this.resetRound(first.id);
    this.say(`对局开始，${first.name} 执黑先行。`);
  }

  onCommand(message: IGameCommand) {
    super.onCommand(message);
    const sender = message.sender as RoomPlayer;
    if (!sender || sender.role !== PlayerRole.player) return;

    switch (message.type) {
      case 'place':
        this.handlePlace(sender, message.data);
        break;
      case 'undo':
        this.requestPending('undo', sender);
        break;
      case 'draw':
        this.requestPending('draw', sender);
        break;
      case 'restart':
        this.requestPending('restart', sender);
        break;
      case 'reply':
        this.handleReply(sender, message.data);
        break;
      case 'resign':
        this.handleResign(sender);
        break;
    }
  }

  // ---------------------------------------------------------------- 落子

  private handlePlace(sender: RoomPlayer, data: unknown) {
    if (this.phase !== 'playing') {
      this.notice(sender, '对局未开始或已结束，无法落子。');
      return;
    }
    if (this.pending) {
      this.notice(sender, `正在等待${PENDING_LABEL[this.pending.kind]}请求的回应。`);
      return;
    }
    if (sender.id !== this.currentId) {
      this.notice(sender, '还没轮到你落子。');
      return;
    }

    const row = Number((data as Coord)?.row);
    const col = Number((data as Coord)?.col);
    if (!isPlayable(this.board, row, col)) {
      this.notice(sender, '该位置不可落子，请重新选择。');
      return;
    }

    const color = this.colors[sender.id];
    if (!color) {
      this.notice(sender, '你尚未分配到棋子颜色。');
      return;
    }

    this.board[row][col] = color;
    this.history.push({ row, col, color, time: Date.now() - this.beginTime });
    this.stopTimer('turn');

    const outcome = judgeMove(this.board, row, col, color);
    if (outcome.type === 'win') {
      this.finish(sender.id, 'five', outcome.line, `${sender.name} 五子连珠`);
      return;
    }
    if (outcome.type === 'draw') {
      this.finish(null, 'full', null, '棋盘已满');
      return;
    }

    const opponent = this.opponentOf(sender.id);
    this.currentId = opponent?.id ?? null;
    this.startTurnTimer();
    this.sync();
    this.save();
  }

  private handleResign(sender: RoomPlayer) {
    if (this.phase !== 'playing') {
      this.notice(sender, '当前没有进行中的对局。');
      return;
    }
    const opponent = this.opponentOf(sender.id);
    this.finish(opponent?.id ?? null, 'resign', null, `${sender.name} 认输`);
  }

  // ---------------------------------------------------------------- 请求

  private requestPending(kind: PendingKind, sender: RoomPlayer) {
    if (this.pending) {
      this.notice(sender, `已有${PENDING_LABEL[this.pending.kind]}请求等待回应。`);
      return;
    }
    if (kind !== 'restart' && this.phase !== 'playing') {
      this.notice(sender, '当前没有进行中的对局。');
      return;
    }
    if (kind === 'undo') {
      if (sender.id !== this.currentId) {
        this.notice(sender, '只能在自己的回合发起悔棋。');
        return;
      }
      if ((this.undoLeft[sender.id] ?? 0) <= 0) {
        this.notice(sender, '本局悔棋次数已用完。');
        return;
      }
      if (this.history.length < 2) {
        this.notice(sender, '当前步数不足以悔棋。');
        return;
      }
    }
    if (kind === 'draw' && (this.drawLeft[sender.id] ?? 0) <= 0) {
      this.notice(sender, '本局求和次数已用完。');
      return;
    }

    const opponent = this.opponentOf(sender.id);
    if (!opponent) {
      this.notice(sender, '找不到对手，无法发起请求。');
      return;
    }

    if (kind === 'draw') this.drawLeft[sender.id] = (this.drawLeft[sender.id] ?? DRAW_LIMIT) - 1;

    this.pending = {
      kind,
      requesterId: sender.id,
      expiresAt: Date.now() + PENDING_TIMEOUT,
    };
    this.stopTimer('turn');
    this.startTimer(() => this.resolvePending(false), PENDING_TIMEOUT, 'pending');

    this.say(`${sender.name} 发起${PENDING_LABEL[kind]}请求，等待对方回应（30 秒）。`);
    this.command('gomoku:request', {
      kind,
      requester: { id: sender.id, name: sender.name },
      expiresAt: this.pending.expiresAt,
    });
    this.sync();
    this.save();
  }

  private handleReply(sender: RoomPlayer, data?: { kind?: PendingKind; agree?: boolean }) {
    if (!this.pending || data?.kind !== this.pending.kind) {
      this.notice(sender, '该请求已失效。');
      return;
    }
    if (sender.id === this.pending.requesterId) {
      this.notice(sender, '不能回应自己发起的请求。');
      return;
    }
    this.resolvePending(Boolean(data.agree));
  }

  private resolvePending(agree: boolean) {
    const pending = this.pending;
    if (!pending) return;

    const requester = this.getPlayerById(pending.requesterId);
    const kind = pending.kind;
    this.pending = null;
    this.stopTimer('pending');

    if (!requester) {
      this.say('请求方已离开，请求自动取消。');
      if (this.phase === 'playing') this.startTurnTimer();
      this.sync();
      return;
    }

    if (kind === 'undo') {
      if (!agree) {
        this.say(`${requester.name} 的悔棋请求被拒绝。`);
        this.startTurnTimer();
      } else {
        this.history.splice(-2, 2);
        this.board = rebuildBoard(this.history);
        this.undoLeft[requester.id] = Math.max(0, (this.undoLeft[requester.id] ?? 0) - 1);
        this.currentId = requester.id;
        this.say(`${requester.name} 的悔棋请求已同意，撤销最近两手。`);
        this.startTurnTimer();
      }
    } else if (kind === 'draw') {
      if (agree) {
        this.finish(null, 'agreed-draw', null, `${requester.name} 与对手达成和棋`);
        return;
      }
      this.say(`${requester.name} 的求和请求被拒绝，对局继续。`);
      this.startTurnTimer();
    } else {
      if (agree) {
        const nextFirst = this.lastFirstId ? this.opponentOf(this.lastFirstId) : this.room.validPlayers[0];
        if (nextFirst) {
          this.resetRound(nextFirst.id, true);
          this.say(`${requester.name} 与对手同意重来，${nextFirst.name} 执黑先行。`);
          return;
        }
      }
      this.say(`${requester.name} 的重来请求被拒绝。`);
      if (this.phase === 'playing') this.startTurnTimer();
    }

    this.sync();
    this.save();
  }

  // ---------------------------------------------------------------- 回合与结算

  private startTurnTimer() {
    this.stopTimer('turn');
    if (this.phase !== 'playing') return;

    const seconds = this.settings().countDownWay;
    if (!seconds) return;

    this.startTimer(() => this.handleTurnTimeout(), seconds * 1000, 'turn');
  }

  private handleTurnTimeout() {
    if (this.phase !== 'playing' || !this.currentId) return;
    const loser = this.getPlayerById(this.currentId);
    const winner = loser ? this.opponentOf(loser.id) : undefined;
    this.finish(winner?.id ?? null, 'timeout', null, loser ? `${loser.name} 落子超时` : '落子超时');
  }

  private finish(winnerId: string | null, reason: ResultReason, line: Coord[] | null, detail?: string) {
    if (this.settled) return;
    this.settled = true;
    this.phase = 'finished';
    this.pending = null;
    this.currentId = null;
    this.result = { winnerId, reason, line, detail };
    this.stopTimer();

    const winner = winnerId ? (this.getPlayerById(winnerId) ?? undefined) : undefined;
    this.say(this.resultMessage(winner, reason, detail));
    this.sync();
    this.save();
    this.saveAchievements(winner ? [winner] : []);
    this.room.end();
  }

  private resultMessage(winner: RoomPlayer | undefined, reason: ResultReason, detail?: string) {
    const head = detail || REASON_TEXT[reason];
    if (!winner) return `${head}，本局平局。`;
    return `${head}，${winner.name} 获胜。`;
  }

  /** 作废：不结算、不计战绩 */
  private voidRound(detail: string) {
    if (this.settled) return;
    this.settled = true;
    this.phase = 'finished';
    this.pending = null;
    this.currentId = null;
    this.result = { winnerId: null, reason: 'interrupted', line: null, detail };
    this.stopTimer();
    this.say(`${detail}，本局作废且不结算积分。`);
    this.sync();
    this.save();
    this.room.end();
  }

  // ---------------------------------------------------------------- 断线 / 加入 / 离开

  private onOffline(player: IRoomPlayer) {
    if (this.phase !== 'playing' || player.role !== PlayerRole.player) return;
    // 引擎在断线 60 秒后才触发该事件；这里再用短暂延迟区分“单方断线”与“双方断线”
    this.startTimer(() => this.handleOfflineTimeout(player.id), OFFLINE_GRACE, `offline:${player.id}`);
  }

  private handleOfflineTimeout(playerId: string) {
    if (this.phase !== 'playing') return;
    const player = this.getPlayerById(playerId);
    if (!player || player.status !== PlayerStatus.offline) return;

    const others = this.room.validPlayers.filter((p) => p.id !== playerId);
    if (others.length > 0 && others.every((p) => p.status === PlayerStatus.offline)) {
      this.voidRound('双方均已断线');
      return;
    }

    this.finish(others[0]?.id ?? null, 'disconnect', null, `${player.name} 断线超时`);
  }

  private onLeave(player: IRoomPlayer) {
    if (this.phase !== 'playing' || player.role !== PlayerRole.player) return;
    const opponent = this.opponentOf(player.id);
    this.finish(opponent?.id ?? null, 'disconnect', null, `${player.name} 离开对局`);
  }

  private onJoin(player: IRoomPlayer) {
    if (player.role !== PlayerRole.watcher) return;
    if (this.room.watchers.length <= WATCHER_LIMIT) return;

    const roomPlayer = this.room.players.find((p) => p.id === player.id);
    if (roomPlayer) this.sayTo('观战人数已满（上限 20 人），请稍后再来。', roomPlayer);
    this.room.kickPlayer(player.id);
  }

  // ---------------------------------------------------------------- 工具

  private sync() {
    this.command('gomoku:state', this.publicState());
  }

  private notice(sender: RoomPlayer, message: string) {
    this.commandTo('gomoku:notice', { message }, sender);
  }

  private publicState(): GomokuState {
    return {
      phase: this.phase,
      board: this.board,
      history: this.history,
      currentId: this.currentId,
      colors: this.colors,
      players: this.room.validPlayers.map((player) => ({
        id: player.id,
        name: player.name,
        color: this.colors[player.id] ?? 0,
      })),
      settings: this.settings(),
      result: this.result,
      pending: this.pending,
      undoLeft: this.undoLeft,
      drawLeft: this.drawLeft,
      deadline: this.tickEndTime['turn'] ?? null,
      watchers: this.room.watchers.length,
    };
  }

  private settings(): GomokuSettings {
    const attrs = (this.room.attrs ?? {}) as GomokuAttrs;
    const seconds = Number(attrs.countDownWay);
    return {
      countDownWay: ALLOWED_TURN_SECONDS.includes(seconds) ? seconds : 0,
      firstMoveWay: (['random', 'creator', 'joiner'] as FirstMoveWay[]).includes(attrs.firstMoveWay as FirstMoveWay)
        ? (attrs.firstMoveWay as FirstMoveWay)
        : 'random',
    };
  }

  private pickFirstPlayer(): RoomPlayer {
    const players = this.room.validPlayers;
    const mode = this.settings().firstMoveWay;
    if (mode === 'creator') {
      return players.find((p) => p.isCreator) ?? players[0];
    }
    if (mode === 'joiner') {
      return players.find((p) => !p.isCreator) ?? players[players.length - 1];
    }
    return players[Math.floor(Math.random() * players.length)];
  }

  private opponentOf(playerId: string): RoomPlayer | undefined {
    return this.room.validPlayers.find((p) => p.id !== playerId);
  }

  private resetRound(firstId: string, isRestart = false) {
    if (!this.room.validPlayers.some((p) => p.id === firstId)) {
      firstId = this.room.validPlayers[0]?.id ?? '';
    }

    this.board = createBoard();
    this.history = [];
    this.result = null;
    this.pending = null;
    this.settled = false;
    this.undoLeft = {};
    this.drawLeft = {};
    this.colors = {};
    this.lastFirstId = firstId;
    this.phase = 'playing';
    this.beginTime = Date.now();

    this.room.validPlayers.forEach((player) => {
      this.undoLeft[player.id] = UNDO_LIMIT;
      this.drawLeft[player.id] = DRAW_LIMIT;
      this.colors[player.id] = player.id === firstId ? BLACK : WHITE;
    });
    this.currentId = firstId || null;

    if (isRestart) this.enterPlaying();

    this.stopTimer();
    this.startTurnTimer();
    this.sync();
    this.save();
    if (isRestart) this.say('新的一局开始，悔棋与求和次数已重置。');
  }

  /** 重来需要在房间已结束后重新进入对局状态（不触发 engine 的 start 事件，避免重复扣分） */
  private enterPlaying() {
    this.room._isPlaying = true;
    this.room.validPlayers.forEach((player) => {
      player.isReady = true;
      player.status = PlayerStatus.playing;
      player.emit('status', PlayerStatus.playing);
    });
    this.room.emit('update', this.room);
  }
}

export default GomokuGameRoom;
