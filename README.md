# World Cup Schematify Live

Single TypeScript script that:

1. Generates/publishes a Schematify FIFA World Cup 2026 knockout diagram.
2. Polls FIFA's public match API.
3. Buffers score changes and publishes one Schematify channel update batch per polling cycle.

## Requirements

- Node.js 18+
- `schematify` CLI installed and logged in

## Usage

Install dependencies:

```bash
npm install
```

Run once:

```bash
npm run once
```

Run continuously, polling every 60 seconds:

```bash
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
