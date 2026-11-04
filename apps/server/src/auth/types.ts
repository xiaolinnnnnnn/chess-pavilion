/** 会话中的用户快照，同时作为引擎 Player 的数据来源 */
export interface SessionUser {
  id: string;
  username: string;
  nickname: string;
  role: 'user' | 'admin';
  points: number;
  avatar?: string;
  isVisitor?: boolean;
}
