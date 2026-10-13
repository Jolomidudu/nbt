"use client";

import dynamic from "next/dynamic";
import { useCallback, useState } from "react";
import type { Business } from "@/game/types";
import type { SimulatedCustomer } from "@/game/types";

interface GameCanvasProps {
  businesses: Business[];
  customers: SimulatedCustomer[];
  simulationPaused: boolean;
  selectedPlotId: string | null;
  resetToken: number;
  onPlotSelect: (plotId: string) => void;
}

const PhaserCanvas = dynamic(
  () => import("@/components/game/PhaserCanvas").then((module) => module.PhaserCanvas),
  { ssr: false },
);

export function GameCanvas({ businesses, customers, simulationPaused, selectedPlotId, resetToken, onPlotSelect }: GameCanvasProps) {
  const [ready, setReady] = useState(false);
  const [loadError, setLoadError] = useState(false);
  const onWorldReady = useCallback(() => setReady(true), []);
  const onWorldError = useCallback(() => setLoadError(true), []);

  return (
    <div className="world-frame relative h-[380px] overflow-hidden sm:h-[480px] lg:h-[min(68vh,620px)]" aria-label="Interactive isometric map of Hustle Street">
      <PhaserCanvas
        businesses={businesses}
        customers={customers}
        simulationPaused={simulationPaused}
        selectedPlotId={selectedPlotId}
        resetToken={resetToken}
        onPlotSelect={onPlotSelect}
        onWorldReady={onWorldReady}
        onWorldError={onWorldError}
      />
      {!ready && !loadError && <div className="world-loading">Opening Hustle Street...</div>}
      {loadError && <div className="world-loading">The neighborhood could not load. Refresh to try again.</div>}
      <div className="map-compass" aria-hidden="true"><span>N</span><i /></div>
      <div className="map-caption">HUSTLE STREET <span>•</span> LAGOS STATE</div>
    </div>
  );
}