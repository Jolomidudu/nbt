# Naija Business Tycoon

A Phase 1 browser prototype set on Hustle Street, a fictional Lagos neighborhood. Players explore an isometric block, choose one of six commercial plots, and build their first local business. There is no backend or real-money functionality.

## Setup

Requires Node.js 20 or later and npm.

```bash
npm install
npm run dev
```

Open [http://localhost:3000](http://localhost:3000). Use `npm run build` to create a production build, `npm run lint` for ESLint, and `npm test` for the purchase and save-validation tests.

## Features

- Phaser 3.90 is loaded only in the browser and renders a deterministic isometric neighborhood with six stable commercial plots.
- Drag or touch-drag to pan, use the mouse wheel or a two-finger pinch to zoom, and reset the camera from the top bar.
- Start with ₦50,000 and choose a POS kiosk (₦20,000), provision shop (₦35,000), or food stand (₦45,000).
- Purchases update the wallet and occupied plot immediately. Tap an owned business to inspect its type, level, and purchase cost.
- Progress is stored in a versioned, validated localStorage save. Reset Progress is available in Settings and requires confirmation.
- Help, wallet, business count, player level, loading, and route-error states are included.

## Controls

- Tap/click an empty plot to open its purchase panel.
- Tap/click a business type, then select Build to confirm the purchase.
- Drag the map to pan; scroll or pinch to zoom.
- Use the compass button to reset the camera. Settings contains the progress reset.

## Phase 1 limitations

This is a local single-player prototype. Businesses do not generate income and cannot be upgraded. There are no customers, simulation timers, online services, accounts, leaderboards, payments, or multiplayer. Save data stays in the browser's localStorage and can be lost if browser site data is cleared.