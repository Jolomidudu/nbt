"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { ArrowLeft, CircleHelp, Coins, Compass, Settings2, Store, Trophy, X } from "lucide-react";
import { GameCanvas } from "@/components/game/GameCanvas";
import { HelpOverlay } from "@/components/game/HelpOverlay";
import { PlotPanel } from "@/components/game/PlotPanel";
import { formatNaira } from "@/game/data/businessTypes";
import { PLOTS } from "@/game/data/mapData";
import type { Business } from "@/game/types";
import type { PurchaseResult } from "@/lib/gameRules";
import { useGameStore } from "@/stores/useGameStore";

export function GameExperience() {
  const wallet = useGameStore((state) => state.wallet);
  const businesses = useGameStore((state) => state.businesses);
  const level = useGameStore((state) => state.level);
  const hydrated = useGameStore((state) => state.hydrated);
  const resetProgress = useGameStore((state) => state.resetProgress);
  const [selectedPlotId, setSelectedPlotId] = useState<string | null>(null);
  const [resetToken, setResetToken] = useState(0);
  const [showHelp, setShowHelp] = useState(false);
  const [showSettings, setShowSettings] = useState(false);
  const [showResetDialog, setShowResetDialog] = useState(false);
  const [feedback, setFeedback] = useState("");

  useEffect(() => {
    useGameStore.getState().hydrate();
  }, []);

  useEffect(() => {
    if (!feedback) return;
    const timeout = window.setTimeout(() => setFeedback(""), 3800);
    return () => window.clearTimeout(timeout);
  }, [feedback]);

  const selectedBusiness = businesses.find((business) => business.plotId === selectedPlotId);

  function handlePurchase(result: PurchaseResult): void {
    if (result.ok) {
      setFeedback("Business built. Hustle Street just got brighter.");
      return;
    }
    const messages = {
      occupied: "This plot already has a business.",
      "insufficient-funds": "Not enough in your wallet for that business.",
      "invalid-plot": "That plot is not available.",
    } satisfies Record<typeof result.error, string>;
    setFeedback(messages[result.error]);
  }

  function confirmReset(): void {
    resetProgress();
    setSelectedPlotId(null);
    setShowResetDialog(false);
    setShowSettings(false);
    setFeedback("Progress reset. Your ₦50,000 starting wallet is back.");
  }

  return (
    <main className="game-shell min-h-screen px-3 pb-6 pt-3 sm:px-6 sm:pt-5">
      <div className="mx-auto max-w-[1440px]">
        <header className="game-topbar">
          <Link href="/" className="brand-lockup" aria-label="Naija Business Tycoon home">
            <span className="brand-mark"><Store size={20} strokeWidth={2.4} /></span>
            <span><strong>NAIJA</strong><small>BUSINESS TYCOON</small></span>
          </Link>
          <div className="topbar-location"><span className="location-spark" /> <span>HUSTLE STREET</span><i>/</i><span>LAGOS</span></div>
          <div className="topbar-actions">
            <button type="button" onClick={() => setShowHelp(true)} className="icon-button" aria-label="How to play" title="How to play"><CircleHelp size={19} /></button>
            <button type="button" onClick={() => setResetToken((value) => value + 1)} className="icon-button" aria-label="Reset camera" title="Reset camera"><Compass size={19} /></button>
            <div className="settings-wrap">
              <button type="button" onClick={() => setShowSettings((value) => !value)} className="icon-button" aria-label="Settings" aria-expanded={showSettings}><Settings2 size={19} /></button>
              {showSettings && <div className="settings-menu">
                <button type="button" onClick={() => { setResetToken((value) => value + 1); setShowSettings(false); }}><Compass size={16} /> Reset camera</button>
                <button type="button" onClick={() => { setShowResetDialog(true); setShowSettings(false); }}><X size={16} /> Reset progress</button>
              </div>}
            </div>
          </div>
        </header>

        <section className="game-heading mt-5 flex flex-wrap items-end justify-between gap-4">
          <div>
            <p className="eyebrow">YOUR NEIGHBORHOOD, YOUR NEXT MOVE</p>
            <h1>Hustle Street <span>·</span> <em>Lagos</em></h1>
          </div>
          <div className="player-stats" aria-label="Player stats">
            <div className="stat-pill wallet-pill"><span className="stat-icon"><Coins size={17} /></span><span><small>WALLET</small><strong>{hydrated ? formatNaira(wallet) : "₦50,000"}</strong></span></div>
            <div className="stat-pill"><span className="stat-icon businesses-icon"><Store size={16} /></span><span><small>BUSINESSES</small><strong>{businesses.length} / 6</strong></span></div>
            <div className="stat-pill"><span className="stat-icon level-icon"><Trophy size={16} /></span><span><small>PLAYER LEVEL</small><strong>{level}</strong></span></div>
          </div>
        </section>

        <section className="play-area mt-4" aria-label="Hustle Street game">
          <div className="world-column">
            <GameCanvas
              businesses={businesses}
              selectedPlotId={selectedPlotId}
              resetToken={resetToken}
              onPlotSelect={setSelectedPlotId}
            />
            <div className="world-footer">
              <span><span className="legend-plot" /> Commercial plot</span>
              <span className="world-footer-hint">Drag to explore <i>·</i> Scroll or pinch to zoom</span>
              <span className="save-indicator"><span /> {hydrated ? "SAVED LOCALLY" : "LOADING SAVE"}</span>
            </div>
          </div>
          <div className="side-column">
            <div className="neighborhood-strip"><span className="strip-sun">✳</span><span><strong>THE BLOCK IS YOURS</strong><small>{businesses.length ? `${businesses.length} business${businesses.length === 1 ? "" : "es"} on the street` : "Six plots. A fresh start."}</small></span></div>
            <PlotPanel
              plotId={selectedPlotId}
              business={selectedBusiness}
              onClose={() => setSelectedPlotId(null)}
              onPurchase={handlePurchase}
            />
            <div className="street-note"><span>STREET NOTE</span><p>Good things start small. Pick a plot and put your first idea on the map.</p></div>
          </div>
        </section>
        <footer className="game-footer"><span><ArrowLeft size={14} /> <Link href="/">Back to front page</Link></span><span>Prototype 01 <i>·</i> No real money, just big plans.</span></footer>
      </div>

      {feedback && <div className="feedback-toast" role="status" aria-live="polite"><span>{feedback}</span><button type="button" onClick={() => setFeedback("")} aria-label="Dismiss message"><X size={16} /></button></div>}
      {showHelp && <HelpOverlay onClose={() => setShowHelp(false)} />}
      {showResetDialog && <div className="dialog-backdrop" role="presentation"><section className="dialog-panel max-w-sm" role="alertdialog" aria-modal="true" aria-labelledby="reset-title" aria-describedby="reset-description">
        <div className="panel-kicker">START FRESH?</div><h2 id="reset-title" className="mt-2 text-2xl font-bold">Reset your progress</h2><p id="reset-description" className="mt-3 text-sm leading-6 text-slate-600">This removes the businesses and wallet saved on this device. Your neighborhood will return to its starting state.</p>
        <div className="mt-6 flex gap-2"><button type="button" onClick={() => setShowResetDialog(false)} className="secondary-button flex-1">Keep playing</button><button type="button" onClick={confirmReset} className="danger-button flex-1">Reset progress</button></div>
      </section></div>}
    </main>
  );
}