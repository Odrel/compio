// Fetches a large snapshot of Raider.IO Mythic+ runs across every current-
// season dungeon and writes it to raiderio-cache.json at the repo root,
// where GitHub Pages serves it as a static asset for the Raider.IO Lookup
// panel (see loadRaiderIoDataset() in app.js).
//
// Run by .github/workflows/update-raiderio-cache.yml on a schedule. Plain
// Node 20 script, no npm dependencies (uses Node's built-in fetch) — no
// package.json/build step, consistent with the rest of this project.
//
// NOTE ON DUPLICATION: the dungeon slug list and the trimmed run shape below
// are deliberately duplicated from data.js/app.js rather than shared via a
// module system, since data.js/app.js are loaded as global-scope <script>
// tags in the browser and can't be require()'d from Node. Keep this list in
// sync with RAIDER_IO_DUNGEONS in data.js at season rollover (same
// staleness caveat already documented there).

const fs = require("fs");
const path = require("path");

const SEASON = "season-mn-1";
const REGION = "world";
const AFFIXES = "all";
const API_BASE = "https://raider.io/api/v1/mythic-plus/runs";
const OUTPUT_PATH = path.join(__dirname, "..", "raiderio-cache.json");

const DUNGEON_SLUGS = [
  "algethar-academy",
  "magisters-terrace",
  "maisara-caverns",
  "nexuspoint-xenas",
  "pit-of-saron",
  "seat-of-the-triumvirate",
  "skyreach",
  "windrunner-spire",
];

// raider.io caps unauthenticated pagination at 100 pages/dungeon (1000 with
// a free API key from raider.io/settings/apps). Deliberately NOT raising
// this even if RAIDERIO_API_KEY is set — the key's value here is rate-limit
// headroom, not 10x more data (100 pages x 8 dungeons is already ~16,000
// runs, plenty for this feature; 1000 pages would be ~120MB, not worth it).
const PAGES_PER_DUNGEON = 100;

const BATCH_SIZE = 8;
const BATCH_DELAY_MS = 2500; // ~160 req/min sustained, safe margin under raider.io's 200/min limit
const REQUEST_TIMEOUT_MS = 15000;
const MAX_RETRIES = 3;
const RETRY_BASE_DELAY_MS = 2000;

// Sanity floor — if a full run collects fewer than this many total runs
// across all 8 dungeons, something is badly wrong (raider.io outage, API
// change, etc.). Refuse to write the file so a broken/near-empty dataset
// can never overwrite the last-known-good committed cache.
const MIN_SANE_TOTAL_RUNS = 500;

function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function buildQueryUrl(dungeonSlug, page, apiKey) {
  const params = new URLSearchParams({
    season: SEASON,
    region: REGION,
    dungeon: dungeonSlug,
    affixes: AFFIXES,
    page: String(page),
  });
  // raider.io takes the API key as an `access_key` query param, not an
  // Authorization header (confirmed against their published API schema).
  if (apiKey) params.set("access_key", apiKey);
  return `${API_BASE}?${params}`;
}

// Same trimmed shape the frontend's rosterMatchesComp/buildRaiderIoResultRow
// expect (see app.js) — this script's output is consumed directly, with no
// further client-side trimming.
function trimRanking(ranking) {
  return {
    rank: ranking.rank,
    score: ranking.score,
    run: {
      keystone_run_id: ranking.run.keystone_run_id,
      season: ranking.run.season,
      mythic_level: ranking.run.mythic_level,
      clear_time_ms: ranking.run.clear_time_ms,
      num_chests: ranking.run.num_chests,
      completed_at: ranking.run.completed_at,
      dungeon: {
        name: ranking.run.dungeon.name,
        slug: ranking.run.dungeon.slug,
        icon_url: ranking.run.dungeon.icon_url,
      },
      roster: ranking.run.roster.map((m) => ({
        role: m.role,
        character: {
          class: { name: m.character.class.name },
          spec: { name: m.character.spec.name },
        },
      })),
    },
  };
}

async function fetchPageWithRetry(dungeonSlug, page, apiKey) {
  const url = buildQueryUrl(dungeonSlug, page, apiKey);
  for (let attempt = 0; attempt <= MAX_RETRIES; attempt++) {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), REQUEST_TIMEOUT_MS);
    let response;
    try {
      response = await fetch(url, {
        signal: controller.signal,
        headers: {
          "User-Agent": "compio-raiderio-cache-bot (https://github.com/Odrel/compio)",
          "Accept": "application/json",
        },
      });
    } catch (err) {
      if (attempt === MAX_RETRIES) {
        throw new Error(`${dungeonSlug} page ${page}: request failed after ${MAX_RETRIES} retries (${err.message})`);
      }
      await sleep(RETRY_BASE_DELAY_MS * (attempt + 1));
      continue;
    } finally {
      clearTimeout(timeoutId);
    }

    if (response.status === 429) {
      if (attempt === MAX_RETRIES) {
        throw new Error(`${dungeonSlug} page ${page}: rate limited after ${MAX_RETRIES} retries`);
      }
      await sleep(RETRY_BASE_DELAY_MS * (attempt + 1));
      continue;
    }

    if (!response.ok) {
      throw new Error(`${dungeonSlug} page ${page}: HTTP ${response.status}`);
    }

    const data = await response.json();
    return Array.isArray(data.rankings) ? data.rankings.map(trimRanking) : [];
  }
  return [];
}

async function fetchDungeon(dungeonSlug, apiKey) {
  const allRankings = [];
  for (let batchStart = 0; batchStart < PAGES_PER_DUNGEON; batchStart += BATCH_SIZE) {
    const batchEnd = Math.min(batchStart + BATCH_SIZE, PAGES_PER_DUNGEON);
    const batchPages = [];
    for (let page = batchStart; page < batchEnd; page++) batchPages.push(page);

    const batchResults = await Promise.all(batchPages.map((page) => fetchPageWithRetry(dungeonSlug, page, apiKey)));

    let ranOutOfData = false;
    for (const rankings of batchResults) {
      if (rankings.length === 0) {
        ranOutOfData = true;
        break;
      }
      allRankings.push(...rankings);
    }

    if (ranOutOfData) break;
    if (batchEnd < PAGES_PER_DUNGEON) await sleep(BATCH_DELAY_MS);
  }
  return allRankings;
}

async function main() {
  const apiKey = process.env.RAIDERIO_API_KEY || null;
  const results = [];

  for (const slug of DUNGEON_SLUGS) {
    try {
      const rankings = await fetchDungeon(slug, apiKey);
      console.log(`${slug}: collected ${rankings.length} runs`);
      results.push(...rankings);
    } catch (err) {
      // One dungeon failing entirely must not abort the other 7.
      console.error(`${slug}: failed entirely — ${err.message}`);
    }
  }

  if (results.length < MIN_SANE_TOTAL_RUNS) {
    console.error(
      `Only ${results.length} total runs collected (floor: ${MIN_SANE_TOTAL_RUNS}) — likely a Raider.IO outage or systemic failure. Refusing to overwrite the last-known-good cache.`
    );
    process.exit(1);
  }

  const payload = {
    generatedAt: new Date().toISOString(),
    season: SEASON,
    runs: results,
  };

  fs.writeFileSync(OUTPUT_PATH, JSON.stringify(payload));
  console.log(`Wrote ${results.length} runs to ${OUTPUT_PATH}`);
}

main().catch((err) => {
  console.error("Fatal error:", err);
  process.exit(1);
});
