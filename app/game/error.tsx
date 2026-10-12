"use client";

import Link from "next/link";
import { RotateCw } from "lucide-react";

export default function GameError({ reset }: { error: Error & { digest?: string }; reset: () => void }) {
  return <main className="route-loading"><span className="loading-mark">!</span><h1>We lost the street for a moment.</h1><p>Try opening the neighborhood again.</p><button type="button" onClick={reset} className="action-button"><RotateCw size={16} /> Try again</button><Link href="/" className="route-back">Back to the front page</Link></main>;
}