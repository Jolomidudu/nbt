# Naija Business Tycoon

A browser prototype set on Hustle Street, a fictional Lagos neighborhood. Players explore an isometric block, choose one of six commercial plots, and build their first local business. There is no backend or real-money functionality.

## Setup

Requires Node.js 20 or later and npm.

```bash
npm install
npm run dev
```

Open [http://localhost:3000](http://localhost:3000). Use `npm run build` to create a production build, `npm run lint` for ESLint, and `npm test` for the simulation, economy, purchase, and save-migration tests.

## Features

- Phaser 3.90 is loaded only in the browser and renders a deterministic isometric neighborhood with six stable commercial plots.
- Drag or touch-drag to pan, use the mouse wheel or a two-finger pinch to zoom, and reset the camera from the top bar.
- Start with ₦50,000 and choose a POS kiosk (₦20,000), provision shop (₦35,000), or food stand (₦45,000).
- Purchases update the wallet and occupied plot immediately. Tap an owned business to inspect its type, level, and purchase cost.
- Progress and the simulation clock are stored in a versioned, validated localStorage save. Reset Progress is available in Settings and requires confirmation.
- The clock starts at Day 1, 06:00. One real-time second advances 4 minutes 48 seconds in-game, so each 300 seconds of active play is one full game day.
- Use the pause control beside the clock to stop and resume time. Manual pause is remembered; switching tabs or leaving the page suspends time automatically. Reloading never grants offline time.
- Owned businesses attract scheduled customers along the street's pedestrian routes. Customers walk to the shop, wait one simulation tick, complete a sale, then leave; only completed service credits the wallet.
- Each completed POS sale earns ₦250 (up to 40 per game day), each Provision Shop sale earns ₦450 (up to 35 per game day), and each Food Stand sale earns ₦700 (up to 30 per game day). Daily limits reset with the canonical game day.
- The save is now version 3. Existing version 1 and 2 saves retain wallet, businesses, level, clock, and pause preference; economy totals start at zero for those saves. Version 3 saves atomically include revenue, per-business counters, and the bounded active-customer snapshot.
- Help, wallet, business count, player level, loading, and route-error states are included.

## Controls

- Tap/click an empty plot to open its purchase panel.
- Tap/click a business type, then select Build to confirm the purchase.
- Drag the map to pan; scroll or pinch to zoom.
- Use the compass button to reset the camera. Settings contains the progress reset.
- Use the clock control to pause or resume the simulation.

## Phase 1 limitations

This is a local single-player prototype. There are no business upgrades, operating expenses, random economic events, offline earnings, online services, accounts, leaderboards, payments, or multiplayer. The simulation uses one-second fixed steps and ignores catch-up beyond five seconds after a long visible-tab stall. At most 12 customers are active at once; visits in progress are saved with the economy and are discarded if their saved route data is invalid. Save data stays in the browser's localStorage and can be lost if browser site data is cleared.