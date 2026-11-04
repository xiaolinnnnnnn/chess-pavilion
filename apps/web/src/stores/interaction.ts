import { ref } from 'vue';

/** 对局互动请求类型：悔棋 / 和棋 / 重来 */
export type InteractionKind = 'undo' | 'draw' | 'restart';

export const INTERACTION_LABEL: Record<InteractionKind, string> = {
  undo: '悔棋',
  draw: '和棋',
  restart: '重来',
};

export interface IncomingInteraction {
  kind: InteractionKind;
  /** 展示用名称，如「悔棋」 */
  label: string;
  /** 发起者昵称 */
  from: string;
  /** 超时时间戳，0 表示不限时（不展示倒计时） */
  expiresAt: number;
  /** 回应回调：true = 同意，false = 拒绝 */
  reply: (agree: boolean) => void;
}

/** 待我回应的互动请求（全局单例，同一时刻只可能有一个房间在发起） */
export const incoming = ref<IncomingInteraction | null>(null);
/** 我已发出、正在等待对方回应的请求名称 */
export const outgoing = ref('');

export function setIncoming(request: IncomingInteraction) {
  incoming.value = request;
}

export function clearIncoming() {
  incoming.value = null;
}

export function setOutgoing(label: string) {
  outgoing.value = label;
}

export function clearOutgoing() {
  outgoing.value = '';
}

/** 离开房间/切换对局时清空，避免残留气泡串场 */
export function resetInteraction() {
  incoming.value = null;
  outgoing.value = '';
}
