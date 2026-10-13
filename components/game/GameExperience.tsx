"use client";

import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import { ArrowLeft, CircleHelp, Clock, Coins, Compass, Pause, Play, Settings2, Store, Trophy, X } from "lucide-react";
import { GameCanvas } from "@/components/game/GameCanvas";
import { HelpOverlay } from "@/components/game/HelpOverlay";
import { PlotPanel } from "@/components/game/PlotPanel";
import { formatNaira } from "@/game/data/businessTypes";
import { formatGameClock, getGameClock } from "@/game/simulation/clock";
import { SimulationEngine, SimulationRunner, type SimulationScheduler } from "@/game/simulation/engine";
import type { PurchaseResult } from "@/lib/gameRules";
import { useGameStore } from "@/stores/useGameStore";

export function GameExperience() {
  const wallet = useGameStore((state) => state.wallet);
  const businesses = useGameStore((state) => state.businesses);
  const level = useGameStore((state) => state.level);
  const hydrated = useGameStore((state) => state.hydrated);
  const elapsedActiveMs = useGameStore((state) => state.elapsedActiveMs);
  const manuallyPaused = useGameStore((state) => state.manuallyPaused);
  const setManuallyPaused = useGameStore((state) => state.setManuallyPaused);
  const resetProgress = useGameStore((state) => state.resetProgress);
  const simulationRunnerRef = useRef<SimulationRunner | null>(null);
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
    if (!hydrated) return;

    const saved = useGameStore.getState();
    let lastPersistedMs = saved.elapsedActiveMs;
    const scheduler: SimulationScheduler = {
      now: () => performance.now(),
      setInterval: (callback, delayMs) => window.setInterval(callback, delayMs),
      clearInterval: (handle) => window.clearInterval(handle as number),
    };
    const runner = new SimulationRunner(
      new SimulationEngine(saved.elapsedActiveMs),
      scheduler,
      (snapshot) => {
        const store = useGameStore.getState();
        store.setElapsedActiveMs(snapshot.elapsedActiveMs);
        if (snapshot.elapsedActiveMs - lastPersistedMs >= 5000) {
          store.persistSimulation();
          lastPersistedMs = snapshot.elapsedActiveMs;
        }
      },
      saved.manuallyPaused,
    );
    simulationRunnerRef.current = runner;

    const persistOnTransition = () => {
      runner.setVisibilityHidden(document.visibilityState === "hidden");
      useGameStore.getState().persistSimulation();
      lastPersistedMs = useGameStore.getState().elapsedActiveMs;
    };
    const suspendForPageHide = () => {
      runner.setVisibilityHidden(true);
      useGameStore.getState().persistSimulation();
      lastPersistedMs = useGameStore.getState().elapsedActiveMs;
    };
    const resumeFromPageShow = () => {
      runner.setVisibilityHidden(document.visibilityState === "hidden");
    };

    runner.start();
    runner.setVisibilityHidden(document.visibilityState === "hidden");
    document.addEventListener("visibilitychange", persistOnTransition);
    window.addEventListener("pagehide", suspendForPageHide);
    window.addEventListener("pageshow", resumeFromPageShow);

    return () => {
      document.removeEventListener("visibilitychange", persistOnTransition);
      window.removeEventListener("pagehide", suspendForPageHide);
      window.removeEventListener("pageshow", resumeFromPageShow);
      runner.stop();
      useGameStore.getState().persistSimulation();
      if (simulationRunnerRef.current === runner) simulationRunnerRef.current = null;
    };
  }, [hydrated]);

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
    simulationRunnerRef.current?.reset(0, false);
    setSelectedPlotId(null);
    setShowResetDialog(false);
    setShowSettings(false);
    setFeedback("Progress reset. Your ₦50,000 starting wallet is back.");
  }

  function togglePause(): void {
    const nextPaused = !manuallyPaused;
    simulationRunnerRef.current?.setManuallyPaused(nextPaused);
    setManuallyPaused(nextPaused);
  }

  const gameClock = getGameClock(elapsedActiveMs);

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
          <div className="heading-controls">
            <div className={`game-clock${manuallyPaused ? " is-paused" : ""}`} aria-label={`Day ${gameClock.day}, ${formatGameClock(gameClock)}${manuallyPaused ? ", paused" : ""}`}>
              <span className="clock-face" aria-hidden="true"><Clock size={18} /></span>
              <span className="clock-readout"><small>DAY {gameClock.day}</small><strong>{formatGameClock(gameClock)}</strong></span>
              {manuallyPaused && <span className="paused-indicator">PAUSED</span>}
              <button
                type="button"
                className="clock-toggle"
                onClick={togglePause}
                aria-label={manuallyPaused ? "Resume game" : "Pause game"}
                aria-pressed={manuallyPaused}
                title={manuallyPaused ? "Resume game" : "Pause game"}
              >
                {manuallyPaused ? <Play size={16} fill="currentColor" /> : <Pause size={16} fill="currentColor" />}
              </button>
            </div>
            <div className="player-stats" aria-label="Player stats">
              <div className="stat-pill wallet-pill"><span className="stat-icon"><Coins size={17} /></span><span><small>WALLET</small><strong>{hydrated ? formatNaira(wallet) : "₦50,000"}</strong></span></div>
              <div className="stat-pill"><span className="stat-icon businesses-icon"><Store size={16} /></span><span><small>BUSINESSES</small><strong>{businesses.length} / 6</strong></span></div>
              <div className="stat-pill"><span className="stat-icon level-icon"><Trophy size={16} /></span><span><small>PLAYER LEVEL</small><strong>{level}</strong></span></div>
            </div>
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
        <div className="panel-kicker">START FRESH?</div><h2 id="reset-title" className="mt-2 text-2xl font-bold">Reset your progress</h2><p id="reset-description" className="mt-3 text-sm leading-6 text-slate-600">This removes the businesses and wallet saved on this device and resets the game clock. Your neighborhood will return to its starting state.</p>
        <div className="mt-6 flex gap-2"><button type="button" onClick={() => setShowResetDialog(false)} className="secondary-button flex-1">Keep playing</button><button type="button" onClick={confirmReset} className="danger-button flex-1">Reset progress</button></div>
      </section></div>}
    </main>
  );
}