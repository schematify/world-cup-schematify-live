#!/usr/bin/env tsx
/**
 * Single-file World Cup Schematify runner.
 *
 * 1) Writes the embedded Schematify graph script to a temporary .generated file.
 * 2) Runs `schematify run` to generate/publish the diagram.
 * 3) Polls FIFA's public API and publishes score updates via `schematify publish`.
 *
 * Run:
 *   npx tsx world-cup-unified.ts --once --dry-run
 *   npx tsx world-cup-unified.ts --interval 60
 *   npx tsx world-cup-unified.ts --skip-generate --interval 60
 */

import { spawnSync } from "node:child_process";
import { writeFileSync } from "node:fs";

const EMBEDDED_GRAPH_SCRIPT = '// Schematify graph script: FIFA World Cup 2026 knockout bracket\n// Run safely in capture mode first: schematify run world-cup-2026-knockout.ts\n// Scores are channel-backed so they can be updated without republishing structure.\n\nconst DOC_ID = "7f7d7d7a-5a57-4f62-92e6-3dbbe1e7f326";\n\nconst rounds = [\n  { id: "round-of-32", label: "Round of 32", matches: 16 },\n  { id: "round-of-16", label: "Round of 16", matches: 8 },\n  { id: "quarter-finals", label: "Quarter-finals", matches: 4 },\n  { id: "semi-finals", label: "Semi-finals", matches: 2 },\n  { id: "final", label: "Final", matches: 1 },\n];\n\n// Round of 32 fixtures from FIFA scores/fixtures page.\n// Use lowercase ISO 3166-1 alpha-2 codes for flags, e.g. "ar", "br", "fr", "us".\n// England is mapped to "gb" because the available country-flags pack is ISO-based.\n// Later rounds remain TBD until winners are known.\nconst teams = {\n  "round-of-32-m01-home": { label: "South Africa", flag: "za" },\n  "round-of-32-m01-away": { label: "Canada", flag: "ca" },\n  "round-of-32-m02-home": { label: "Brazil", flag: "br" },\n  "round-of-32-m02-away": { label: "Japan", flag: "jp" },\n  "round-of-32-m03-home": { label: "Germany", flag: "de" },\n  "round-of-32-m03-away": { label: "Paraguay", flag: "py" },\n  "round-of-32-m04-home": { label: "Netherlands", flag: "nl" },\n  "round-of-32-m04-away": { label: "Morocco", flag: "ma" },\n  "round-of-32-m05-home": { label: "Côte d\'Ivoire", flag: "ci" },\n  "round-of-32-m05-away": { label: "Norway", flag: "no" },\n  "round-of-32-m06-home": { label: "France", flag: "fr" },\n  "round-of-32-m06-away": { label: "Sweden", flag: "se" },\n  "round-of-32-m07-home": { label: "Mexico", flag: "mx" },\n  "round-of-32-m07-away": { label: "Ecuador", flag: "ec" },\n  "round-of-32-m08-home": { label: "England", flag: "gb" },\n  "round-of-32-m08-away": { label: "Congo DR", flag: "cd" },\n  "round-of-32-m09-home": { label: "Belgium", flag: "be" },\n  "round-of-32-m09-away": { label: "Senegal", flag: "sn" },\n  "round-of-32-m10-home": { label: "USA", flag: "us" },\n  "round-of-32-m10-away": { label: "Bosnia and Herzegovina", flag: "ba" },\n  "round-of-32-m11-home": { label: "Spain", flag: "es" },\n  "round-of-32-m11-away": { label: "Austria", flag: "at" },\n  "round-of-32-m12-home": { label: "Portugal", flag: "pt" },\n  "round-of-32-m12-away": { label: "Croatia", flag: "hr" },\n  "round-of-32-m13-home": { label: "Switzerland", flag: "ch" },\n  "round-of-32-m13-away": { label: "Algeria", flag: "dz" },\n  "round-of-32-m14-home": { label: "Australia", flag: "au" },\n  "round-of-32-m14-away": { label: "Egypt", flag: "eg" },\n  "round-of-32-m15-home": { label: "Argentina", flag: "ar" },\n  "round-of-32-m15-away": { label: "Cabo Verde", flag: "cv" },\n  "round-of-32-m16-home": { label: "Colombia", flag: "co" },\n  "round-of-32-m16-away": { label: "Ghana", flag: "gh" },\n};\n\nfunction teamNode(id) {\n  const t = teams[id] || { label: "TBD" };\n  const n = node(id).label(t.label);\n  return t.flag ? n.type(`country-flags/${t.flag}`) : n.type("base/default");\n}\n\nfunction scoreNode(id) {\n  return node(id)\n    .label("Score")\n    .type("base/default")\n    .channels([\n      channel("score").label("Score").default("- / -"),\n      channel("status").label("Status").default("base/unknown"),\n    ])\n    .status({ type: from.channel("status") })\n    .render({\n      style: "property",\n      params: {\n        header: from.value("Score"),\n        "display-value": from.channel("score"),\n      },\n    });\n}\n\nfunction matchLabel(index, homeId, awayId) {\n  const home = teams[homeId]?.label || "TBD";\n  const away = teams[awayId]?.label || "TBD";\n  if (home === "TBD" && away === "TBD") return `Match ${index}`;\n  return `${home} / ${away}`;\n}\n\nfunction nextMatchPath(roundId, index) {\n  // FIFA bracket progression, not chronological order.\n  // Round of 16:\n  // 1: South Africa/Canada vs Netherlands/Morocco\n  // 2: Germany/Paraguay vs France/Sweden\n  // 3: Brazil/Japan vs Côte d\'Ivoire/Norway\n  // 4: Mexico/Ecuador vs England/Congo DR\n  // 5: Spain/Austria vs Portugal/Croatia\n  // 6: Belgium/Senegal vs USA/Bosnia and Herzegovina\n  // 7: Australia/Egypt vs Argentina/Cabo Verde\n  // 8: Switzerland/Algeria vs Colombia/Ghana\n  const progression = {\n    "round-of-32": {\n      1: 1, 4: 1,\n      3: 2, 6: 2,\n      2: 3, 5: 3,\n      7: 4, 8: 4,\n      11: 5, 12: 5,\n      9: 6, 10: 6,\n      14: 7, 15: 7,\n      13: 8, 16: 8,\n    },\n    "round-of-16": {\n      1: 1, 2: 1,\n      5: 2, 6: 2,\n      3: 3, 4: 3,\n      7: 4, 8: 4,\n    },\n    "quarter-finals": {\n      1: 1, 2: 1,\n      3: 2, 4: 2,\n    },\n    "semi-finals": {\n      1: 1, 2: 1,\n    },\n  };\n  const nextRoundByRound = {\n    "round-of-32": "round-of-16",\n    "round-of-16": "quarter-finals",\n    "quarter-finals": "semi-finals",\n    "semi-finals": "final",\n  };\n  const nextRound = nextRoundByRound[roundId];\n  const nextIndex = progression[roundId]?.[index];\n  if (!nextRound || !nextIndex) return [];\n  const nextNum = String(nextIndex).padStart(2, "0");\n  return [`${nextRound}/m${nextNum}`];\n}\n\nfunction matchNode(roundId, index) {\n  const num = String(index).padStart(2, "0");\n  const id = `m${num}`;\n  const homeId = `${roundId}-${id}-home`;\n  const awayId = `${roundId}-${id}-away`;\n  const scoreId = "score";\n  const matchPath = `${roundId}/${id}`;\n\n  return node(id)\n    .label(matchLabel(index, homeId, awayId))\n    .type("base/collection")\n    .links(nextMatchPath(roundId, index))\n    .children([\n      teamNode(homeId).links([`${matchPath}/${scoreId}`]),\n      scoreNode(scoreId).links([`${matchPath}/${awayId}`]),\n      teamNode(awayId),\n    ]);\n}\n\nfunction roundNode(r) {\n  const children = [];\n  for (let i = 1; i <= r.matches; i++) children.push(matchNode(r.id, i));\n  return node(r.id)\n    .label(r.label)\n    .type("base/collection")\n    .children(children);\n}\n\nasync function main() {\n  const doc = graph(DOC_ID)\n    .label("FIFA World Cup 2026 Knockout Bracket")\n    .description("Refreshable knockout bracket. Country nodes use flag node types when teams are known; TBD nodes have no flag. Score nodes are channel-backed and can be updated live.")\n    .staleAfter(1000 * 60 * 60 * 24)\n    .children(rounds.map(roundNode));\n\n  await doc.publish();\n\n  // Initial score channel values. Update these values and re-run, or use this same\n  // channelPublisher pattern from a polling script when live match data is available.\n  const pub = channelPublisher(doc.id);\n  for (const r of rounds) {\n    for (let i = 1; i <= r.matches; i++) {\n      const num = String(i).padStart(2, "0");\n      pub.set(`${r.id}/m${num}/score`, {\n        score: "- / -",\n        status: "base/unknown",\n      });\n    }\n  }\n  await pub.send();\n}\n\nmain();\n';

const SCHEMA_ID = "7f7d7d7a-5a57-4f62-92e6-3dbbe1e7f326";
const GENERATED_GRAPH_SCRIPT = ".world-cup-2026-knockout.generated.ts";
const FIFA_API_URL =
  "https://api.fifa.com/api/v3/calendar/matches?language=en&count=500&idCompetition=17&idSeason=285023";

const MATCH_PATHS: Record<string, string> = {
  "400021518": "round-of-32/m01/score",
  "400021516": "round-of-32/m02/score",
  "400021513": "round-of-32/m03/score",
  "400021522": "round-of-32/m04/score",
  "400021514": "round-of-32/m05/score",
  "400021523": "round-of-32/m06/score",
  "400021520": "round-of-32/m07/score",
  "400021512": "round-of-32/m08/score",
  "400021525": "round-of-32/m09/score",
  "400021524": "round-of-32/m10/score",
  "400021519": "round-of-32/m11/score",
  "400021526": "round-of-32/m12/score",
  "400021527": "round-of-32/m13/score",
  "400021515": "round-of-32/m14/score",
  "400021521": "round-of-32/m15/score",
  "400021517": "round-of-32/m16/score",
};

type FifaTeam = { IdCountry?: string; ShortClubName?: string };
type FifaMatch = {
  IdMatch: string | number;
  Home?: FifaTeam;
  Away?: FifaTeam;
  HomeTeamScore?: number | null;
  AwayTeamScore?: number | null;
  MatchStatus?: number | null;
};
type FifaResponse = { Results?: FifaMatch[] };
type ScoreUpdate = { score: string; status: string };

function argValue(name: string, fallback?: string): string | undefined {
  const index = process.argv.indexOf(name);
  return index >= 0 ? process.argv[index + 1] : fallback;
}

const dryRun = process.argv.includes("--dry-run");
const once = process.argv.includes("--once");
const skipGenerate = process.argv.includes("--skip-generate");
const randomScoresArg = argValue("--random-scores");
const randomScoresCount = process.argv.includes("--random-scores")
  ? Math.max(1, Math.min(Number(randomScoresArg ?? "3") || 3, Object.keys(MATCH_PATHS).length))
  : 0;
const intervalSeconds = Number(argValue("--interval", "60"));

function run(command: string, args: string[], dryRunPublishOnly = true): void {
  if (dryRun && dryRunPublishOnly && command === "schematify" && args[0] === "publish") {
    console.log("DRY RUN:", [command, ...args].join(" "));
    return;
  }
  const result = spawnSync(command, args, { stdio: "inherit" });
  if (result.status !== 0) throw new Error(`${command} ${args.join(" ")} failed with exit code ${result.status}`);
}

function generateDiagram(): void {
  writeFileSync(GENERATED_GRAPH_SCRIPT, EMBEDDED_GRAPH_SCRIPT);
  console.log(`Generating/publishing diagram with embedded script via ${GENERATED_GRAPH_SCRIPT}...`);
  run("schematify", ["run", GENERATED_GRAPH_SCRIPT], false);
}

async function fetchMatches(): Promise<FifaMatch[]> {
  const response = await fetch(FIFA_API_URL, { headers: { "User-Agent": "Mozilla/5.0 score-poller/1.0" } });
  if (!response.ok) throw new Error(`FIFA API returned ${response.status}`);
  const payload = (await response.json()) as FifaResponse;
  return payload.Results ?? [];
}

function updateFromMatch(match: FifaMatch): ScoreUpdate {
  const homeScore = match.HomeTeamScore;
  const awayScore = match.AwayTeamScore;
  if (homeScore == null || awayScore == null) return { score: "- / -", status: "base/unknown" };
  return {
    score: `${homeScore} / ${awayScore}`,
    status: match.MatchStatus === 0 ? "base/healthy" : "base/alert",
  };
}

function publishBatch(updates: Map<string, ScoreUpdate>): void {
  if (updates.size === 0) {
    console.log("No score changes to publish.");
    return;
  }

  const payload = {
    schemaId: SCHEMA_ID,
    patches: [...updates.entries()].map(([path, update]) => ({
      path,
      channels: {
        score: update.score,
        status: update.status,
      },
    })),
  };

  const file = ".world-cup-score-updates.json";
  writeFileSync(file, JSON.stringify(payload, null, 2));

  if (dryRun) {
    console.log("DRY RUN batch payload:", JSON.stringify(payload, null, 2));
    return;
  }

  console.log(`Publishing ${updates.size} score update(s) in one batch...`);
  run("schematify", ["publish", file], false);
}

function randomInt(maxInclusive: number): number {
  return Math.floor(Math.random() * (maxInclusive + 1));
}

function randomScoreUpdate(): ScoreUpdate {
  return {
    score: `${randomInt(4)} / ${randomInt(4)}`,
    status: "base/alert",
  };
}

function pickRandomPaths(count: number): string[] {
  const paths = Object.values(MATCH_PATHS);
  for (let i = paths.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [paths[i], paths[j]] = [paths[j], paths[i]];
  }
  return paths.slice(0, count);
}

const ALERT_DECAY_MS = 60_000;

function rememberUpdate(
  path: string,
  update: ScoreUpdate,
  last: Map<string, ScoreUpdate>,
  pending: Map<string, ScoreUpdate>,
  alertUntil: Map<string, number>,
): void {
  const previous = last.get(path);
  if (previous?.score === update.score && previous?.status === update.status) return;
  pending.set(path, update);
  last.set(path, update);
  if (update.status === "base/alert") alertUntil.set(path, Date.now() + ALERT_DECAY_MS);
  else alertUntil.delete(path);
}

function decayAlerts(
  last: Map<string, ScoreUpdate>,
  pending: Map<string, ScoreUpdate>,
  alertUntil: Map<string, number>,
): void {
  const now = Date.now();
  for (const [path, update] of last.entries()) {
    if (update.status !== "base/alert") continue;
    if ((alertUntil.get(path) ?? 0) > now) continue;
    const decayed = { score: update.score, status: "base/info" };
    console.log(`${path}: alert decayed -> ${decayed.score} (${decayed.status})`);
    rememberUpdate(path, decayed, last, pending, alertUntil);
  }
}

async function randomScoresOnce(
  last: Map<string, ScoreUpdate>,
  alertUntil: Map<string, number>,
  count: number,
): Promise<void> {
  const pending = new Map<string, ScoreUpdate>();
  decayAlerts(last, pending, alertUntil);

  for (const path of pickRandomPaths(count)) {
    const update = randomScoreUpdate();
    console.log(`${path}: random simulation -> ${update.score} (${update.status})`);
    rememberUpdate(path, update, last, pending, alertUntil);
  }
  publishBatch(pending);
}

async function pollOnce(last: Map<string, ScoreUpdate>, alertUntil: Map<string, number>): Promise<void> {
  const byId = new Map((await fetchMatches()).map((match) => [String(match.IdMatch), match]));
  const pending = new Map<string, ScoreUpdate>();
  decayAlerts(last, pending, alertUntil);

  for (const [matchId, path] of Object.entries(MATCH_PATHS)) {
    const match = byId.get(matchId);
    if (!match) {
      console.warn(`WARN: FIFA match ${matchId} not found for ${path}`);
      continue;
    }
    const rawUpdate = updateFromMatch(match);
    const previous = last.get(path);
    const update = rawUpdate.status === "base/alert" && previous?.score === rawUpdate.score
      ? { score: rawUpdate.score, status: previous.status === "base/alert" ? "base/alert" : "base/info" }
      : rawUpdate;
    const home = match.Home?.ShortClubName ?? match.Home?.IdCountry ?? "Home";
    const away = match.Away?.ShortClubName ?? match.Away?.IdCountry ?? "Away";
    if (previous?.score !== update.score || previous?.status !== update.status) {
      console.log(`${path}: ${home} / ${away} -> ${update.score} (${update.status})`);
    }
    rememberUpdate(path, update, last, pending, alertUntil);
  }

  // One API publish per poll interval to avoid rate limits.
  publishBatch(pending);
}

async function main(): Promise<void> {
  if (!skipGenerate) generateDiagram();
  const last = new Map<string, ScoreUpdate>();
  const alertUntil = new Map<string, number>();
  while (true) {
    try {
      if (randomScoresCount > 0) await randomScoresOnce(last, alertUntil, randomScoresCount);
      else await pollOnce(last, alertUntil);
    } catch (error) {
      console.error("ERROR:", error instanceof Error ? error.message : error);
    }
    if (once) break;
    await new Promise((resolve) => setTimeout(resolve, intervalSeconds * 1000));
  }
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
