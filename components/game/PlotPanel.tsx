"use client";

import { useState } from "react";
import { ArrowUpRight, Building2, CircleDollarSign, LockKeyhole, X } from "lucide-react";
import { BUSINESS_TYPES, formatNaira } from "@/game/data/businessTypes";
import type { Business, BusinessType } from "@/game/types";
import type { PurchaseResult } from "@/lib/gameRules";
import { useGameStore } from "@/stores/useGameStore";
import { BusinessCard } from "@/components/game/BusinessCard";

interface PlotPanelProps {
  plotId: string | null;
  business: Business | undefined;
  onClose: () => void;
  onPurchase: (result: PurchaseResult) => void;
}

const OPTIONS: BusinessType[] = ["pos", "provisions", "food"];

export function PlotPanel({ plotId, business, onClose, onPurchase }: PlotPanelProps) {
  const [selectedType, setSelectedType] = useState<BusinessType>("pos");
  const wallet = useGameStore((state) => state.wallet);
  const purchase = useGameStore((state) => state.purchase);
  const selectedBusiness = BUSINESS_TYPES[selectedType];

  if (!plotId) {
    return (
      <aside className="plot-panel flex min-h-[280px] flex-col justify-between p-5 sm:p-6">
        <div>
          <div className="panel-kicker">YOUR NEXT MOVE</div>
          <h2 className="mt-2 text-xl font-bold text-slate-900">Pick a plot</h2>
          <p className="mt-2 text-sm leading-6 text-slate-600">Tap one of the six sandy plots on the map to see what you can build there.</p>
        </div>
        <div className="plot-panel-tip"><span className="tip-dot" /> Your first business is one smart move away.</div>
      </aside>
    );
  }

  if (business) {
    const definition = BUSINESS_TYPES[business.type];
    return (
      <aside className="plot-panel p-5 sm:p-6" aria-live="polite">
        <div className="flex items-start justify-between">
          <div>
            <div className="panel-kicker">PLOT {plotId.slice(-2)}</div>
            <h2 className="mt-2 text-xl font-bold text-slate-900">{definition.name}</h2>
          </div>
          <button type="button" onClick={onClose} className="icon-button" aria-label="Close plot details"><X size={18} /></button>
        </div>
        <div className="owned-building-art" style={{ "--business-color": `#${definition.color.toString(16)}` } as React.CSSProperties}>
          <Building2 size={27} />
          <span>OPEN FOR BUSINESS</span>
        </div>
        <div className="mt-5 space-y-3">
          <div className="detail-row"><span>Business level</span><strong>Level {business.level}</strong></div>
          <div className="detail-row"><span>Purchase cost</span><strong>{formatNaira(business.purchaseCost)}</strong></div>
          <div className="detail-row"><span>Plot status</span><strong className="text-emerald-700">Owned</strong></div>
        </div>
      </aside>
    );
  }

  const canAfford = wallet >= selectedBusiness.cost;
  return (
    <aside className="plot-panel p-5 sm:p-6" aria-label={`Purchase a business for plot ${plotId}`}>
      <div className="flex items-start justify-between">
        <div>
          <div className="panel-kicker">AVAILABLE PLOT {plotId.slice(-2)}</div>
          <h2 className="mt-2 text-xl font-bold text-slate-900">Start something here</h2>
        </div>
        <button type="button" onClick={onClose} className="icon-button" aria-label="Close plot details"><X size={18} /></button>
      </div>
      <p className="mt-2 text-sm leading-5 text-slate-600">Choose a neighborhood business to build on this plot.</p>
      <div className="mt-4 space-y-2">
        {OPTIONS.map((type) => (
          <BusinessCard
            key={type}
            type={type}
            selected={selectedType === type}
            affordable={wallet >= BUSINESS_TYPES[type].cost}
            onSelect={setSelectedType}
          />
        ))}
      </div>
      {!canAfford && (
        <p className="mt-3 flex items-center gap-2 text-xs font-medium text-rose-700" role="status">
          <LockKeyhole size={14} /> You need {formatNaira(selectedBusiness.cost - wallet)} more for this business.
        </p>
      )}
      <div className="mt-4 flex items-center justify-between rounded-md bg-[#f7f4e9] px-3 py-2.5">
        <span className="flex items-center gap-2 text-xs font-semibold text-slate-600"><CircleDollarSign size={16} /> Total cost</span>
        <strong className="text-sm text-slate-900">{formatNaira(selectedBusiness.cost)}</strong>
      </div>
      <button
        type="button"
        onClick={() => onPurchase(purchase(plotId, selectedType))}
        className="action-button mt-3 w-full"
      >
        Build {selectedBusiness.name} <ArrowUpRight size={17} />
      </button>
    </aside>
  );
}