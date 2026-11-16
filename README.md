# Oche.Live

Live darts scoring for the whole group. One phone hosts, everyone else joins with a 4-letter code and enters their own throws, or one phone is passed around.

Games: X01 (301/501/701, straight/double in, double/straight/master out), Cricket (standard and cut-throat), Around the Clock, Shanghai, Count-Up and Killer.

## Development

Requires Node 22.12 or later (Vitest needs 22.12+, 24 or 26+).

```bash
npm install
npm run dev        # http://localhost:5173
npm run check      # typecheck + tests
npm run build      # production build in dist/
npm run preview    # serve the production build
```

## Project layout

```
index.html            Page shell; loads src/main.ts
src/
  main.ts             Boot: wires the UI to the app layer and connects to the sync backend
  styles.css          All styles
  engine/             Pure darts logic, no DOM or storage (fully unit-tested)
    types.ts          Darts, turns, game config and state types
    compute.ts        Replays a game from its turn list into a scoreboard
    checkout.ts       Double-out checkout suggestions
    validate.ts       Cleans turns that arrive from other phones
    config.ts         New game choices → game config
    darts.ts          Game list, dart scoring/labels, constants
  app/                App state and behaviour
    state.ts          The single app state object and render/toast hooks
    actions.ts        Turn entry, submit, undo, rematch
    session.ts        Starting, hosting, joining and syncing games
    runtime.ts        The live-sync backend (see below)
    util.ts, wake.ts  Storage, escaping, screen wake lock
  ui/                 Everything that touches the DOM
    render.ts         Region-based renderer (only changed parts redraw)
    views.ts          HTML for each screen
    input.ts          Touch, click and keyboard handling
    fx.ts             Toasts, celebrations, haptics
tests/                Vitest unit tests for the engine
```

## How a game works

A game is stored as its config plus a list of turns. Every phone recomputes the scoreboard from that list with `compute()`, so the turn list is the only thing that has to be shared. The host phone is the only writer: guests post their turns through room presence, and the host validates them (`cleanTurn`) and appends them.

## Sync backend

Multi-phone games currently use the claude.ai Artifact runtime (`window.claude` db and room), isolated in `src/app/runtime.ts` and `src/app/session.ts`. Opened anywhere else (including `npm run dev`), the app runs in "This phone only" mode. This backend is due to be replaced by Firebase.

## Keyboard scoring

On a tablet or laptop with a keyboard:

| Key | Dart by dart | Turn total |
| --- | --- | --- |
| Numbers | Type the number: `7`, `19`, `25` | Type the score |
| `S` `D` `T` | Single, double, treble for the next dart | |
| `B` | Bull (outer; `D` then `B` for the bull) | |
| `M` or `0` | Miss | |
| `Enter` | Enter the turn | Enter the turn |
| `Backspace` | Remove last dart, or offer to undo the last turn | Delete a digit, or offer undo |
| `Esc` | Close the menu or undo prompt | |
