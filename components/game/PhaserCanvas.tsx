"use client";

import { useEffect, useRef } from "react";
import * as Phaser from "phaser";
import { GAME_EVENTS } from "@/game/bridge/gameEvents";
import type { Business } from "@/game/types";
import { useGameStore } from "@/stores/useGameStore";
import WorldScene from "@/game/scenes/WorldScene";

interface PhaserCanvasProps {
  businesses: Business[];
  selectedPlotId: string | null;
  resetToken: number;
  onPlotSelect: (plotId: string) => void;
  onWorldReady: () => void;
  onWorldError: () => void;
}

export function PhaserCanvas({ businesses, selectedPlotId, resetToken, onPlotSelect, onWorldReady, onWorldError }: PhaserCanvasProps) {
  const parentRef = useRef<HTMLDivElement>(null);
  const gameRef = useRef<Phaser.Game | null>(null);
  const plotSelectRef = useRef(onPlotSelect);

  useEffect(() => {
    plotSelectRef.current = onPlotSelect;
  }, [onPlotSelect]);

  useEffect(() => {
    const parent = parentRef.current;
    if (!parent) return;

    let cancelled = false;
    let game: Phaser.Game | null = null;
    let unsubscribe: (() => void) | undefined;
    let sceneReadyListener: (() => void) | undefined;
    let plotListener: ((plotId: string) => void) | undefined;

    const startFrame = window.requestAnimationFrame(() => {
      if (cancelled || !parentRef.current) return;
      try {
        game = new Phaser.Game({
          type: Phaser.AUTO,
          parent,
          backgroundColor: "#9ed8c3",
          scale: {
            mode: Phaser.Scale.RESIZE,
            width: parent.clientWidth,
            height: parent.clientHeight,
          },
          input: { activePointers: 2 },
          render: { antialias: true, roundPixels: false },
          scene: [WorldScene],
        });
        gameRef.current = game;
        const currentGame = game;
        sceneReadyListener = () => {
          currentGame.events.emit(GAME_EVENTS.businessesChanged, useGameStore.getState().businesses);
          if (!cancelled) onWorldReady();
        };
        plotListener = (plotId: string) => plotSelectRef.current(plotId);
        currentGame.events.on(GAME_EVENTS.worldReady, sceneReadyListener);
        currentGame.events.on(GAME_EVENTS.plotSelected, plotListener);
        unsubscribe = useGameStore.subscribe((state, previous) => {
          if (state.businesses !== previous.businesses) {
            currentGame.events.emit(GAME_EVENTS.businessesChanged, state.businesses);
          }
        });
      } catch {
        if (!cancelled) onWorldError();
      }
    });

    return () => {
      cancelled = true;
      window.cancelAnimationFrame(startFrame);
      unsubscribe?.();
      if (!game) return;
      if (sceneReadyListener) game.events.off(GAME_EVENTS.worldReady, sceneReadyListener);
      if (plotListener) game.events.off(GAME_EVENTS.plotSelected, plotListener);
      const canvas = game.canvas;
      game.destroy(true);
      canvas?.remove();
      parent.querySelectorAll("canvas").forEach((element) => element.remove());
      if (gameRef.current === game) gameRef.current = null;
    };
  }, [onWorldError, onWorldReady]);

  useEffect(() => {
    gameRef.current?.events.emit(GAME_EVENTS.plotSelectionChanged, selectedPlotId);
  }, [selectedPlotId]);

  useEffect(() => {
    gameRef.current?.events.emit(GAME_EVENTS.businessesChanged, businesses);
  }, [businesses]);

  useEffect(() => {
    if (resetToken > 0) gameRef.current?.events.emit(GAME_EVENTS.cameraReset);
  }, [resetToken]);

  return <div ref={parentRef} className="absolute inset-0 touch-none" />;
}