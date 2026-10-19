# mini-games

Six little browser games in one place: Tetris, Gomoku, Chinese Chess, Ludo, Monopoly, and a tank battle game. Plain JS, no frameworks — each game is a self-contained plugin.

Play against the AI or online with real people.

## Games

- **Tetris** — you know this one
- **Gomoku** — five in a row
- **Xiangqi** — Chinese chess, with AI opponent
- **Ludo** — the board game everyone argues about
- **Monopoly** — the board game everyone *really* argues about
- **Tank battle** — real-time multiplayer

## How it's built

Plugin architecture: each game lives in its own module under `public/src/games/`, so adding a new one doesn't touch the others. Multiplayer runs over WebSocket. The game code itself has zero npm dependencies — just vanilla JS.

Trilingual UI: English / 中文 / Українська.

There's also a fairly obsessive QA contract suite under `qa/` (don't ask).

## Run it

```bash
npm install
npm start
```

Open the URL it prints. That's it.
