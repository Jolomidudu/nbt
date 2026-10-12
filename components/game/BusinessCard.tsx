import { Check } from "lucide-react";
import { BUSINESS_TYPES, formatNaira } from "@/game/data/businessTypes";
import type { BusinessType } from "@/game/types";

interface BusinessCardProps {
  type: BusinessType;
  selected: boolean;
  affordable: boolean;
  onSelect: (type: BusinessType) => void;
}

export function BusinessCard({ type, selected, affordable, onSelect }: BusinessCardProps) {
  const business = BUSINESS_TYPES[type];
  return (
    <button
      type="button"
      onClick={() => onSelect(type)}
      aria-pressed={selected}
      className={`business-option ${selected ? "is-selected" : ""}`}
    >
      <span className="business-option-icon" style={{ backgroundColor: `#${business.color.toString(16)}` }}>
        {business.icon}
      </span>
      <span className="min-w-0 flex-1 text-left">
        <span className="block text-[13px] font-bold leading-tight">{business.name}</span>
        <span className="mt-1 block text-[11px] text-slate-500">{formatNaira(business.cost)}</span>
      </span>
      {!affordable && <span className="text-[10px] font-semibold text-rose-700">SHORT</span>}
      {selected && <Check size={16} className="text-emerald-700" aria-hidden="true" />}
    </button>
  );
}