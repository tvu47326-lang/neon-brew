# Neon Brew

Neon Brew is a self-contained, mobile-first cafe management game set in a warm Vietnamese neighborhood cafe. It uses plain HTML, CSS, and JavaScript modules, has no runtime dependencies, and stores progress in the browser.

## Run locally

JavaScript modules need an HTTP origin in most browsers. From this folder, start Python's built-in static server:

```powershell
python -m http.server 8000
```

Open `http://localhost:8000` in a browser. Stop the server with `Ctrl+C`. No build step or package installation is required.

To run the automated tests when Node.js is installed:

```powershell
npm test
```

## Play

- Start a new day or continue the valid save shown on the welcome screen.
- Customers arrive automatically. Nhân checks each order, Nam prepares it, Thúy serves it, and Ly collects payment. Tuấn introduces the team and offers stock hints.
- Watch patience and stock. Orders without all required ingredients fail without partially consuming a recipe.
- Open **Kho** to buy ingredient packs, **Menu** to review recipes, **Việc** to claim a completed daily reward, and **Nâng cấp** to improve preparation or service speed.
- Finish the 150-second shift to see completed orders, sales, expenses, mission bonuses, and guests who left. Your cash, inventory, unlocks, upgrades, and progress carry into the next day.

## Code map

```text
index.html                 Game shell, boot/title screens, dialogs, and navigation
css/style.css              Mobile-first espresso/amber/cyan theme and motion
js/main.js                 Boot handoff, one-second game clock, and autosave
js/game-state.js           Initial state, recipes, stock catalog, and staff
js/customer-system.js      Deterministic arrivals and customer patience
js/order-system.js         Order state machine and ingredient reservation
js/staff-system.js         Five role-specific staff status views
js/character-animation-controller.js  Shared character animation states
js/inventory-system.js     Atomic recipe checks and stock purchasing
js/economy-system.js       Idempotent payment, upgrades, and day rollover
js/quest-system.js         Daily goals, rewards, reputation, and unlocks
js/save-system.js          Versioned localStorage and save validation
js/ui.js                   Rendering, touch panels, dialogs, and feedback
assets/                    Logo adaptation, cafe scene, and staff portrait SVGs
tests/                     Node built-in test suite; no test dependencies
```

Each subsystem mutates the shared game state through a small API. Ingredient requirements are checked before any stock is removed; a paid order is marked before another settlement can succeed. Customer arrivals use a seeded generator so that saved sessions remain reproducible.

## Character animation

The five portraits are vector SVG symbols in `assets/staff-portraits.svg`, not PNG sprite sheets. The controller maps existing staff states to idle, working, or serving motion and uses short talking and quest-celebration beats. These are restrained CSS transforms on the portrait container; they do not move staff from their designed positions or change gameplay timing. The portraits are single expressions, so eye-blinking and realistic limb movement are intentionally omitted until separate expression or pose sprites exist. The controller pauses for hidden browser tabs, management sheets, game pause, and reduced-motion preferences, and is destroyed on page exit.

`assets/neon-brew-logo.svg` is a local vector adaptation of the supplied logo motif. A short boot screen displays it before the title/continue screen and gameplay. No remote image or font is required.

## Save data

The game uses the `neon-brew-cafe-manager` localStorage key with schema version `1`. Invalid or unsupported saves are discarded safely and the welcome screen offers a new game. Saves are local to the current browser profile and are not synced between devices.

## GitHub Pages

The folder is static and needs no build action. For a separate game repository, put these project files at the repository root, push the default branch, then select **Settings → Pages → Deploy from a branch → `main` → `/(root)`**. For this game kept as a subfolder of a larger repository, publish that repository's root and open `/CafeManagerNew/`.

## Capacitor later

The project already keeps UI, assets, and game logic in a static web root. To add Android packaging later, install `@capacitor/core` and `@capacitor/cli`, initialize Capacitor with `webDir: "."`, add the Android platform, then run `npx cap sync android`. No Capacitor code or native project is included in this browser build.