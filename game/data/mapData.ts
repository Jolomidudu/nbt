import type { Plot } from "@/game/types";

export const MAP_SIZE = { columns: 9, rows: 8 } as const;
export const TILE_WIDTH = 92;
export const TILE_HEIGHT = 46;
export const MAP_ORIGIN = { x: 500, y: 64 } as const;

export const PLOTS: Plot[] = [
  { id: "plot-01", x: 2, y: 1 },
  { id: "plot-02", x: 5, y: 1 },
  { id: "plot-03", x: 1, y: 4 },
  { id: "plot-04", x: 4, y: 4 },
  { id: "plot-05", x: 7, y: 4 },
  { id: "plot-06", x: 3, y: 6 },
];

export const PLOT_IDS = new Set(PLOTS.map((plot) => plot.id));