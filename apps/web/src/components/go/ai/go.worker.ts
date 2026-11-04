import { chooseGoMove } from './mcts';

self.onmessage = (event: MessageEvent) => {
  const { id, board, color, ko, difficulty, komi } = event.data;
  const move = chooseGoMove(board, color, ko, difficulty, komi);
  (self as unknown as Worker).postMessage({ id, move });
};
