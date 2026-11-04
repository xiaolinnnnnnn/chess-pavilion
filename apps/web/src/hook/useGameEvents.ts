import { GameCore } from "@/core/game";
import { GameHallEvents } from "@yige/engine/client";
import { onBeforeUnmount } from "vue";

export function useGameEvents(game: GameCore, onListenerMap: Partial<GameHallEvents>) {
  for (const event in onListenerMap) {
    const handle = onListenerMap[event as keyof GameHallEvents] as (...args: any[]) => void;
    game.on(event as keyof GameHallEvents, handle);
  }

  onBeforeUnmount(() => {
    for (const event in onListenerMap) {
      const handle = onListenerMap[event as keyof GameHallEvents] as (...args: any[]) => void;
      game.off(event as keyof GameHallEvents, handle);
    }
  });
}