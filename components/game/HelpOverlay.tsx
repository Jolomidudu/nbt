"use client";

import { X } from "lucide-react";

interface HelpOverlayProps {
  onClose: () => void;
}

export function HelpOverlay({ onClose }: HelpOverlayProps) {
  return (
    <div className="dialog-backdrop" role="presentation" onMouseDown={(event) => {
      if (event.target === event.currentTarget) onClose();
    }}>
      <section className="dialog-panel" role="dialog" aria-modal="true" aria-labelledby="help-title">
        <div className="flex items-start justify-between">
          <div><div className="panel-kicker">HUSTLE STREET FIELD NOTES</div><h2 id="help-title" className="mt-2 text-2xl font-bold">Make your first move</h2></div>
          <button type="button" onClick={onClose} className="icon-button" aria-label="Close help"><X size={18} /></button>
        </div>
        <ol className="help-steps mt-6">
          <li><span>01</span><p><strong>Find a sandy plot</strong>Tap any empty lot in the neighborhood.</p></li>
          <li><span>02</span><p><strong>Choose your business</strong>Compare the costs against your ₦50,000 wallet.</p></li>
          <li><span>03</span><p><strong>Build your corner</strong>Confirm once and your new shop appears on the map.</p></li>
        </ol>
        <div className="mt-5 rounded-md bg-emerald-50 px-4 py-3 text-xs leading-5 text-emerald-900">Drag to look around. Scroll or pinch to zoom. Progress is saved on this device.</div>
      </section>
    </div>
  );
}