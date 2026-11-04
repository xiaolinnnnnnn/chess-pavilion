import { PlayerRole, RoomPlayer } from '@yige/engine';
import { GameRoom, type IGameCommand } from '..';
import { BLACK, WHITE, areaScore, createBoard, playMove, type Board, type Point, type Stone } from './rules';

export const name = '围棋';
export const minSize = 2;
export const maxSize = 2;
export const table = 'grid';
export const ai = 'client';
export const description = '9/13/19 路可选，中国规则数子，白方贴目。双方连续停一手即终局，提子、禁着点与打劫由服务端判定。';

export const settings = [
  {
    key: 'boardSize',
    label: '棋盘',
    type: 'select',
    options: [
      { label: '9 路', value: 9 },
      { label: '13 路', value: 13 },
      { label: '19 路', value: 19 },
    ],
    default: 9,
  },
  {
    key: 'komi',
    label: '贴目',
    type: 'select',
    options: [
      { label: '7.5 目', value: 7.5 },
      { label: '5.5 目', value: 5.5 },
      { label: '0.5 目', value: 0.5 },
    ],
    default: 7.5,
  },
  {
    key: 'turnSeconds',
    label: '每手限时',
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
      { label: '房主执黑', value: 'creator' },
      { label: '加入者执黑', value: 'joiner' },
    ],
    default: 'random',
  },
];

interface GoResult {
  winnerId: string | null;
  reason: 'score' | 'resign' | 'timeout' | 'disconnect' | 'interrupted';
  detail: string;
  score?: { black: number; white: number };
}

interface HistoryEntry extends Point {
  color: Stone;
  pass?: boolean;
  captured?: number;
}

class GoGameRoom extends GameRoom {
  phase: 'waiting' | 'playing' | 'finished' = 'waiting';
  size = 9;
  komi = 7.5;
  board: Board = createBoard(9);
  currentId: string | null = null;
  colors: Record<string, Stone> = {};
  captures = { 1: 0, 2: 0 } as Record<number, number>;
  passes = 0;
  koPoint: Point | null = null;
  history: HistoryEntry[] = [];
  result: GoResult | null = null;
  settled = false;
  lastFirstId: string | null = null;

  init() {
    const room = super.init();

    room
      .on('player-offline', (player: any) => {
        if (this.phase !== 'playing' || player.role !== PlayerRole.player) return;
        const opponent = this.opponentOf(player.id);
        this.finish(opponent?.id ?? null, 'disconnect', `${player.name} 断线超时`);
      })
      .on('leave', (player: any) => {
        if (this.phase !== 'playing' || player.role !== PlayerRole.player) return;
        const opponent = this.opponentOf(player.id);
        this.finish(opponent?.id ?? null, 'disconnect', `${player.name} 离开对局`);
      });

    if (this.phase === 'playing') {
      this.voidRound();
      return room;
    }
    this.restoreTimer({ turn: () => this.handleTimeout() });
    return room;
  }

  getStatus(sender: RoomPlayer) {
    return { ...super.getStatus(sender), go: this.publicState() };
  }

  getData() {
    return {
      size: this.size,
      komi: this.komi,
      history: this.history,
      players: this.room.validPlayers.map((player) => ({
        id: player.id,
        name: player.name,
        color: this.colors[player.id] ?? 0,
      })),
      result: this.result,
      message: this.messageHistory,
    };
  }

  onStart() {
    if (this.room.validPlayers.length < 2) return this.say('玩家人数不足。');

    const attrs = this.room.attrs ?? {};
    this.size = [9, 13, 19].includes(Number(attrs.boardSize)) ? Number(attrs.boardSize) : 9;
    this.komi = Number(attrs.komi) >= 0 ? Number(attrs.komi) : 7.5;
    this.reset(this.pickFirst().id);
    this.say('对局开始，' + this.playerName(this.currentId) + ' 执黑先行。');
  }

  onCommand(message: IGameCommand) {
    super.onCommand(message);
    const sender = message.sender as RoomPlayer;
    if (!sender || sender.role !== PlayerRole.player) return;

    switch (message.type) {
      case 'place':
        this.handlePlace(sender, message.data);
        break;
      case 'pass':
        this.handlePass(sender);
        break;
      case 'resign':
        if (this.phase !== 'playing') return;
        this.finish(this.opponentOf(sender.id)?.id ?? null, 'resign', sender.name + ' 认输');
        break;
    }
  }

  private handlePlace(sender: RoomPlayer, data: any) {
    if (this.phase !== 'playing') return this.notice(sender, '对局未开始。');
    if (sender.id !== this.currentId) return this.notice(sender, '还没轮到你落子。');

    const row = Number(data?.row);
    const col = Number(data?.col);
    const played = playMove(this.board, row, col, this.colors[sender.id], this.koPoint);
    if (!played.ok) {
      const text = played.reason === 'ko' ? '打劫，不能立即回提。' : played.reason === 'suicide' ? '禁着点，不能自杀。' : '这里已经有棋子了。';
      return this.notice(sender, text);
    }

    this.board = played.board;
    this.koPoint = played.ko;
    this.captures[this.colors[sender.id]] += played.captured.length;
    this.passes = 0;
    this.history.push({ row, col, color: this.colors[sender.id], captured: played.captured.length });

    this.stopTimer('turn');
    this.currentId = this.opponentOf(sender.id)?.id ?? null;
    this.startTurnTimer();
    this.sync();
    this.save();
  }

  private handlePass(sender: RoomPlayer) {
    if (this.phase !== 'playing') return this.notice(sender, '对局未开始。');
    if (sender.id !== this.currentId) return this.notice(sender, '还没轮到你。');

    this.passes += 1;
    this.history.push({ row: -1, col: -1, color: this.colors[sender.id], pass: true });
    this.koPoint = null;
    this.say(sender.name + ' 停一手。');

    if (this.passes >= 2) {
      this.scoreGame();
      return;
    }

    this.stopTimer('turn');
    this.currentId = this.opponentOf(sender.id)?.id ?? null;
    this.startTurnTimer();
    this.sync();
    this.save();
  }

  private scoreGame() {
    const score = areaScore(this.board, this.komi);
    const winnerId =
      score.winner === 0
        ? null
        : this.room.validPlayers.find((player) => this.colors[player.id] === score.winner)?.id ?? null;
    const detail = '黑 ' + score.black + ' 目 · 白 ' + score.white + ' 目（含贴目）';
    this.finish(winnerId, 'score', detail, { black: score.black, white: score.white });
  }

  private startTurnTimer() {
    this.stopTimer('turn');
    const seconds = Number(this.room.attrs?.turnSeconds);
    if (!seconds || this.phase !== 'playing') return;
    this.startTimer(() => this.handleTimeout(), Math.min(seconds, 60) * 1000, 'turn');
  }

  private handleTimeout() {
    if (this.phase !== 'playing' || !this.currentId) return;
    const loser = this.getPlayerById(this.currentId);
    this.finish(this.opponentOf(this.currentId)?.id ?? null, 'timeout', (loser?.name ?? '玩家') + ' 超时');
  }

  private finish(winnerId: string | null, reason: GoResult['reason'], detail: string, score?: GoResult['score']) {
    if (this.settled) return;
    this.settled = true;
    this.phase = 'finished';
    this.currentId = null;
    this.result = { winnerId, reason, detail, score };
    this.stopTimer();

    const winner = winnerId ? this.getPlayerById(winnerId) : undefined;
    this.say(detail + (winner ? '，' + winner.name + ' 获胜。' : '，本局平局。'));
    this.sync();
    this.save();
    this.saveAchievements(winner ? [winner] : []);
    this.room.end();
  }

  private voidRound() {
    if (this.settled) return;
    this.settled = true;
    this.phase = 'finished';
    this.result = { winnerId: null, reason: 'interrupted', detail: '对局中断' };
    this.stopTimer();
    this.sync();
    this.save();
    this.room.end();
  }

  private reset(firstId: string) {
    this.phase = 'playing';
    this.board = createBoard(this.size);
    this.history = [];
    this.captures = { 1: 0, 2: 0 };
    this.passes = 0;
    this.koPoint = null;
    this.result = null;
    this.settled = false;
    this.colors = {};
    this.lastFirstId = firstId;
    this.beginTime = Date.now();
    this.room.validPlayers.forEach((player) => {
      this.colors[player.id] = player.id === firstId ? BLACK : WHITE;
    });
    this.currentId = firstId;
    this.startTurnTimer();
    this.sync();
    this.save();
  }

  private publicState() {
    return {
      phase: this.phase,
      size: this.size,
      komi: this.komi,
      board: this.board,
      history: this.history,
      currentId: this.currentId,
      colors: this.colors,
      players: this.room.validPlayers.map((player) => ({ id: player.id, name: player.name, color: this.colors[player.id] ?? 0 })),
      captures: this.captures,
      passes: this.passes,
      koPoint: this.koPoint,
      result: this.result,
      deadline: this.tickEndTime.turn ?? null,
      watchers: this.room.watchers.length,
    };
  }

  private sync() {
    this.command('go:state', this.publicState());
  }

  private notice(sender: RoomPlayer, message: string) {
    this.commandTo('go:notice', { message }, sender);
  }

  private opponentOf(playerId: string) {
    return this.room.validPlayers.find((player) => player.id !== playerId);
  }

  private playerName(id: string | null) {
    return this.room.validPlayers.find((player) => player.id === id)?.name ?? '玩家';
  }

  private pickFirst() {
    const players = this.room.validPlayers;
    const mode = this.room.attrs?.firstMoveWay;
    if (mode === 'creator') return players.find((player) => player.isCreator) ?? players[0];
    if (mode === 'joiner') return players.find((player) => !player.isCreator) ?? players[players.length - 1];
    return players[Math.floor(Math.random() * players.length)];
  }
}

export default GoGameRoom;
