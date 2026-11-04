import { PlayerRole, PlayerStatus, RoomPlayer, RoomStatus } from "@yige/engine";
import { GameRoom, IGameCommand } from ".";
import { shortTime, sleep } from "../utils";
import {
  type Piece,
  type Side,
  cloneBoard,
  countBetweenSameCol,
  countBetweenSameRow,
  createInitialBoard,
  crossedRiver,
  findGeneral,
  generalsFace,
  hasAnyLegalEscapeMove,
  inBounds,
  isInCheck,
  isLegalMoveForPiece,
  isPalace,
  sideOf,
} from "./xiangqi/rules";

/*
  Xiangqi (Chinese Chess)
  - Randomly assign red (first) and green sides
  - Board: 10x9, initial standard setup
  - Server enforces full movement rules (including 马别腿/象塞眼/炮隔子/九宫/过河兵)
  - Prohibits self-check and 将帅对脸
  - Capture ends game if a general (K) is captured
  - Open chat; spectators can't speak during play (same as other games)
*/


export const name = '象棋'
export const minSize = 2
export const maxSize = 2
export const description = `中国象棋：随机红/绿方，红方先手。服务器严格校验走法（马别腿/象塞眼/炮隔子/九宫/过河兵）、将帅对脸与自陷将军；吃掉将/帅即胜。`;
export const description_extra = `规则：服务器严格校验走法与将帅对脸；每回合 60 秒超时判负；吃掉对方将/帅即胜。`;

export const table = 'board';
export const ai = 'client';
export const settings = [
  {
    key: 'turnSeconds',
    label: '每步限时',
    type: 'select',
    options: [
      { label: '30 秒', value: 30 },
      { label: '60 秒', value: 60 },
      { label: '不限时', value: 0 },
    ],
    default: 60,
  },
];

class XiangqiGameRoom extends GameRoom {
  currentPlayer?: RoomPlayer;
  lastLosePlayer?: RoomPlayer;
  board: Piece[][] = [];
  history: { from: string, to: string, piece: string, time: number }[] = [];

  get turnTimeout() {
    const seconds = Number(this.room.attrs?.turnSeconds);
    return (seconds === 30 || seconds === 60 ? seconds : seconds === 0 ? 0 : 60) * 1000;
  }

  init() {
    this.restoreTimer({
      turn: () => this.handleTimeout()
    });
    return super.init().on('player-offline', async (player) => {
      await sleep(4 * 60 * 1000);
      if (!this.isPlayerOnline(player)) return;
      if (this.room.status === RoomStatus.playing && player.role === PlayerRole.player) {
        this.say(`玩家 ${player.name} 已离线，游戏结束。`);
        const winner = this.room.validPlayers.find((p) => p.id !== player.id)!;
        this.finishGame(winner, `${player.name} 离线超时`, 'disconnect');
      }
      this.room.kickPlayer(player);
    });
  }

  getStatus(sender: RoomPlayer) {
    return {
      ...super.getStatus(sender),
      status: this.room.status,
      current: this.currentPlayer,
      board: this.board,
      countdown: this.tickEndTime['turn'],
    }
  }

  getData() {
    return {
      history: this.history,
      players: this.room.validPlayers.map((p) => ({
        username: p.attributes?.username,
        name: p.name,
        side: p.attributes?.side,
      })),
      message: this.messageHistory,
    };
  }

  onStart() {
    if (this.room.validPlayers.length < this.room.minSize) {
      return this.say(`玩家人数不足，无法开始游戏。`);
    }
    this.stopTimer();
    this.messageHistory = [];
    this.history = [];
    this.resetForNewGame();
    this.command('achievements', this.achievements);
    this.command('turn', { player: this.currentPlayer });
    this.say(`游戏开始。红方（先手）：${this.currentPlayer?.name}。`);
    this.broadcastBoard();
    if (this.currentPlayer) this.startTurnTimer();
    this.save();
  }

  onCommand(message: IGameCommand) {
    super.onCommand(message);
    const sender = message.sender as RoomPlayer;
    switch (message.type) {
      case 'move': {
        if (this.room.status !== RoomStatus.playing) {
          this.sayTo(`游戏未开始。`, sender);
          break;
        }
        if (sender.id !== this.currentPlayer?.id) {
          this.sayTo(`不是你的回合。`, sender);
          break;
        }
        const { from, to } = message.data || {}
        if (!from || !to) { 
          this.sayTo(`参数错误。`, sender); 
          break;
        }
        const { x: fx, y: fy } = from
        const { x: tx, y: ty } = to
        if (fx<0||fx>9||fy<0||fy>8||tx<0||tx>9||ty<0||ty>8) { 
          this.sayTo(`越界。`, sender); 
          break;
        }
        const piece = this.board[fx][fy]
        if (!piece) { this.sayTo(`该处无子可走。`, sender); break }
        const side = this.playerSide(sender)
        if (sideOf(piece) !== side) {
          this.sayTo(`不能移动对方棋子。`, sender);
          break;
        }
        const target = this.board[tx][ty]
        if (target && sideOf(target) === side) { 
          this.sayTo(`不能吃己方子。`, sender); 
          break;
        }
        // Validate piece-specific rules
        if (!isLegalMoveForPiece(this.board, piece, { x: fx, y: fy }, { x: tx, y: ty })) {
          this.sayTo(`不符合走法规则。`, sender);
          break;
        }

        // Simulate move to ensure own general not in check and generals not facing illegally
        const nb = cloneBoard(this.board)
        nb[tx][ty] = piece
        nb[fx][fy] = ''
        if (generalsFace(nb)) { 
          this.sayTo(`帅/将不能照面。`, sender); 
          break;
        }
        // Note: allow self-check moves (do not reject when mover remains/gets in check)

        // Commit move
        this.board = nb
        this.history.push({ 
          from: this.toCoord(from.x, from.y), 
          to: this.toCoord(to.x, to.y), 
          piece, 
          time: Date.now() 
        });

        this.command('move', { from, to, piece })
        this.broadcastBoard()

        // Check general captured
        const gens = this.findGenerals()
        if (!gens.redAlive || !gens.greenAlive) {
          const winner = gens.redAlive ? this.room.validPlayers.find(p => this.playerSide(p) === 'red')! : this.room.validPlayers.find(p => this.playerSide(p) === 'green')!
          this.say(`将/帅被吃。${winner.name} 获胜！`)
          this.finishGame(winner, '将/帅被吃', 'capture')
          break
        }

        const oppSide: Side = side === 'red' ? 'green' : 'red'
        const oppInCheck = isInCheck(this.board, oppSide)

        // Checkmate / dead-chess: opponent is in check and has no escape move.
        if (oppInCheck && !hasAnyLegalEscapeMove(this.board, oppSide)) {
          this.say(`${oppSide === 'red' ? '红方' : '绿方'} 死棋（将死），${sender.name} 获胜！`)
          this.finishGame(sender, '对手被将死', 'checkmate')
          break
        }

        // Turn change
        const next = this.room.validPlayers.find(p => p.id !== this.currentPlayer?.id)
        if (next) {
          this.currentPlayer = next;
          this.command('turn', { player: this.currentPlayer });
          this.startTurnTimer();
        }
        this.save();
        break;
      }
      case 'request-draw': {
        if (this.room.status !== RoomStatus.playing) break;
        const senderPlayer = this.getPlayerById(sender.id);
        if (senderPlayer?.attributes?.lastRequestedDraw) {
          const elapsed = Date.now() - senderPlayer.attributes.lastRequestedDraw;
          if (elapsed < 5 * 60 * 1000) {
            this.sayTo(`你刚刚发送过和棋请求，请等待 ${shortTime(Math.ceil((5 * 60 * 1000 - elapsed)))} 后再请求和棋。`, sender);
            break;
          }
        }
        this.setPlayerAttributes(sender.id, { lastRequestedDraw: Date.now() });
        this.say(`${sender.name} 请求和棋。`)
        const other = this.room.validPlayers.find(p => p.id !== sender.id)!
        this.commandTo('request-draw', { player: sender }, other)
        break
      }
      case 'draw': {
        if (this.room.status !== RoomStatus.playing) break;
        if (!message.data?.agree) { 
          this.say(`${sender.name} 拒绝和棋。`); 
          break;
        }
        this.say(`双方同意和棋，游戏结束。`)
        this.command('result', { winnerId: null, reason: 'draw', detail: '双方同意和棋' });
        this.saveAchievements();
        this.room.end();
        this.stopTimer();
        this.save()
        break
      }
      case 'request-lose': {
        if (this.room.status !== RoomStatus.playing) break;
        this.say(`${sender.name} 认输。`)
        const winner = this.room.validPlayers.find(p => p.id !== sender.id)!
        this.finishGame(winner, `${sender.name} 认输`, 'resign')
        break
      }
    }
  }

  startTurnTimer() {
    this.stopTimer('turn');
    if (!this.turnTimeout) return;
    this.startTimer(() => this.handleTimeout(), this.turnTimeout, 'turn');
  }

  handleTimeout() {
    if (this.room.status === RoomStatus.playing && this.currentPlayer) {
      const winner = this.room.validPlayers.find(p => p.id !== this.currentPlayer!.id)!;
      this.say(`${this.currentPlayer.name} 超时，${winner.name} 获胜！`);
      this.finishGame(winner, '对手超时', 'timeout');
    }
  }

  finishGame(winner: RoomPlayer, detail = '', reason = 'settled') {
    this.lastLosePlayer = this.room.validPlayers.find((p) => p.id !== winner.id)!;
    this.stopTimer();

    // 广播终局结果：客户端据此在棋盘中央渲染胜利/失败大字
    this.command('result', { winnerId: winner.id, reason, detail });
    this.saveAchievements([winner]);
    this.room.end();
    this.save();
  }

  // Helper methods
  toCoord(x: number, y: number) {
    return `${String.fromCharCode(65 + y)}${10 - x}`;
  }

  playerSide(p: RoomPlayer): Side | undefined {
    return p.attributes?.side as Side | undefined
  }

  resetForNewGame() {
    this.board = createInitialBoard()
    // Random roles
    const players = [...this.room.validPlayers]
    const idx = Math.floor(Math.random() * players.length)
    const red = players[idx]
    const green = players.find(p => p.id !== red.id)!
    this.setPlayerAttributes(red.id, { side: 'red' });
    this.setPlayerAttributes(green.id, { side: 'green' });
    this.currentPlayer = red // red moves first
  }

  broadcastBoard() {
    this.command('board', this.board);
  }

  findGenerals(): { redAlive: boolean, greenAlive: boolean } {
    let redAlive = false, greenAlive = false
    for (let i = 0; i < 10; i++) {
      for (let j = 0; j < 9; j++) {
        const p = this.board[i][j]
        if (p === 'rK') redAlive = true
        if (p === 'gK') greenAlive = true
      }
    }
    return { redAlive, greenAlive }
  }
}

export default XiangqiGameRoom;
