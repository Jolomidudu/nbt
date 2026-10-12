"use client";

import { useEffect, useRef, useState } from "react";
import type Phaser from "phaser";
import { GAME_EVENTS } from "@/game/bridge/gameEvents";
import type { Business } from "@/game/types";
import { useGameStore } from "@/stores/useGameStore";

interface GameCanvasProps {
  businesses: Business[];
  selectedPlotId: string | null;
  resetToken: number;
  onPlotSelect: (plotId: string) => void;
}

export function GameCanvas({ businesses, selectedPlotId, resetToken, onPlotSelect }: GameCanvasProps) {
  const parentRef = useRef<HTMLDivElement>(null);
  const gameRef = useRef<Phaser.Game | null>(null);
  const plotSelectRef = useRef(onPlotSelect);
  const [ready, setReady] = useState(false);
  const [loadError, setLoadError] = useState(false);

  plotSelectRef.current = onPlotSelect;

  useEffect(() => {
    let cancelled = false;
    let game: Phaser.Game | null = null;
    let unsubscribe: (() => void) | undefined;
    let sceneReadyListener: (() => void) | undefined;
    let plotListener: ((plotId: string) => void) | undefined;

    async function startGame(): Promise<void> {
      try {
        const { default: PhaserRuntime } = await import("phaser");
        const { default: WorldScene } = await import("@/game/scenes/WorldScene");
        if (cancelled || !parentRef.current) return;

        game = new PhaserRuntime.Game({
          type: PhaserRuntime.AUTO,
          parent: parentRef.current,
          backgroundColor: "#9ed8c3",
          resolution: Math.min(window.devicePixelRatio || 1, 2),
          scale: {
            mode: PhaserRuntime.Scale.RESIZE,
            width: parentRef.current.clientWidth,
            height: parentRef.current.clientHeight,
          },
          input: { activePointers: 2 },
          render: { antialias: true, roundPixels: false },
          scene: [WorldScene],
        });
        gameRef.current = game;
        sceneReadyListener = () => {
          game?.events.emit(GAME_EVENTS.businessesChanged, useGameStore.getState().businesses);
        };
        plotListener = (plotId) => plotSelectRef.current(plotId);
        game.events.on(GAME_EVENTS.worldReady, sceneReadyListener);
        game.events.on(GAME_EVENTS.plotSelected, plotListener);
        unsubscribe = useGameStore.subscribe((state, previous) => {
          if (state.businesses !== previous.businesses) {
            game?.events.emit(GAME_EVENTS.businessesChanged, state.businesses);
          }
        });
        setReady(true);
      } catch {
        if (!cancelled) setLoadError(true);
      }
    }

    void startGame();
    return () => {
      cancelled = true;
      unsubscribe?.();
      if (game && sceneReadyListener) game.events.off(GAME_EVENTS.worldReady, sceneReadyListener);
      if (game && plotListener) game.events.off(GAME_EVENTS.plotSelected, plotListener);
      game?.destroy(true);
      if (gameRef.current === game) gameRef.current = null;
    };
  }, []);

  useEffect(() => {
    gameRef.current?.events.emit(GAME_EVENTS.plotSelectionChanged, selectedPlotId);
  }, [selectedPlotId]);

  useEffect(() => {
    gameRef.current?.events.emit(GAME_EVENTS.businessesChanged, businesses);
  }, [businesses]);

  useEffect(() => {
    if (resetToken > 0) gameRef.current?.events.emit(GAME_EVENTS.cameraReset);
  }, [resetToken]);

  return (
    <div className="world-frame relative h-[380px] overflow-hidden sm:h-[480px] lg:h-[min(68vh,620px)]" aria-label="Interactive isometric map of Hustle Street">
      <div ref={parentRef} className="absolute inset-0 touch-none" />
      {!ready && !loadError && <div className="world-loading">Opening Hustle Street...</div>}
      {loadError && <div className="world-loading">The neighborhood could not load. Refresh to try again.</div>}
      <div className="map-compass" aria-hidden="true"><span>N</span><i /></div>
      <div className="map-caption">HUSTLE STREET <span>•</span> LAGOS STATE</div>
    </div>
  );
}