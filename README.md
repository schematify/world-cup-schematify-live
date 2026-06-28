# World Cup Schematify Live

Single TypeScript script that:

1. Generates/publishes a Schematify FIFA World Cup 2026 knockout diagram.
2. Polls FIFA's public match API.
3. Buffers score changes and publishes one Schematify channel update batch per polling cycle.

## Requirements

- Node.js 18+
- `schematify` CLI installed and logged in

## Usage

Run directly with `npx`. With no flags, it generates the diagram and then polls every 60 seconds:

```bash
npx github:schematify/world-cup-schematify-live
```

Run once:

```bash
npx github:schematify/world-cup-schematify-live --once
```

Simulate random live scores on 3 matches by default. The matches are selected once at startup and the same score nodes are updated every tick. Changed scores use `base/alert` for 30 seconds, then decay to `base/info` while the match remains running:

```bash
npx github:schematify/world-cup-schematify-live --random-scores
```

Simulate random live scores on `n` matches:

```bash
npx github:schematify/world-cup-schematify-live --random-scores 5
```

Or clone and run locally:

```bash
npm install
npm start
```

Dry-run polling without publishing score updates:

```bash
npm run dry-run
```

Skip diagram generation and only update scores:

```bash
npx tsx index.ts --skip-generate --interval 60
```

## Document UUID

The diagram uses a fixed Schematify document UUID so repeated runs update the same diagram instead of creating duplicates.
