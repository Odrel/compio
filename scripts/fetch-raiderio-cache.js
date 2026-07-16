// Fetches a large snapshot of Raider.IO Mythic+ runs across every current-
// season dungeon and writes it, gzip-compressed, to raiderio-cache.json.gz
// at the repo root, where GitHub Pages serves it as a static asset for the
// Raider.IO Lookup panel (see loadRaiderIoDataset() in app.js, which
// decompresses it client-side via DecompressionStream).
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
const zlib = require("zlib");

const SEASON = "season-mn-1";
const REGION = "world";
const AFFIXES = "all";
const API_BASE = "https://raider.io/api/v1/mythic-plus/runs";
const OUTPUT_PATH = path.join(__dirname, "..", "raiderio-cache.json.gz");

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

// raider.io caps pagination at 100 pages/dungeon unauthenticated, 1000 with
// an API key — we ask for the full 1000. Early-stop-on-empty-page below
// means an unauthenticated run (or a dungeon with fewer real completions)
// simply stops short of this, so asking for the max is safe either way.
// Worst case (~160k runs across 8 dungeons) compresses to only a few MB
// (see gzip step + MAX_OUTPUT_BYTES below), so GitHub's 100MB per-file
// push limit is no longer the constraint — this is simply "get everything
// raider.io will give us."
const PAGES_PER_DUNGEON = 1000;

// Unauthenticated: raider.io allows 200 req/min. Authenticated (RAIDERIO_API_KEY
// set): 1000 req/min. Both batch settings stay well under their respective
// limit to leave margin for retries/latency.
const UNAUTH_BATCH_SIZE = 8;
const UNAUTH_BATCH_DELAY_MS = 2500; // ~160 req/min sustained
const AUTH_BATCH_SIZE = 25;
const AUTH_BATCH_DELAY_MS = 1500; // ~800-900 req/min sustained

const REQUEST_TIMEOUT_MS = 15000;
const MAX_RETRIES = 3;
const RETRY_BASE_DELAY_MS = 2000;

// If a dungeon fails entirely (its per-page retries exhausted — see
// MAX_RETRIES above, ~12s total), wait this long and retry the whole
// dungeon once more. Real-world case: raider.io returned HTTP 502 for
// about a minute across every in-flight request (not one specific
// dungeon/page), long enough to exhaust the ~12s page-level retry budget
// but short enough that a longer cooldown rides it out.
const DUNGEON_RETRY_COOLDOWN_MS = 60000;

// Sanity floor — if a full run collects fewer than this many total runs
// across all 8 dungeons (after the fallback-to-previous-data below), the
// entire run — not just one dungeon — is badly wrong (raider.io outage,
// API change, etc.). Refuse to write the file so a broken/near-empty
// dataset can never overwrite the last-known-good committed cache.
const MIN_SANE_TOTAL_RUNS = 500;

// GitHub hard-blocks pushing any single file over 100MB. The committed file
// is gzip-compressed (see gzipPayload below), and this repetitive JSON
// compresses ~28x in practice, so even raider.io's absolute max output
// (~160k runs) lands around ~5MB compressed — this budget is a generous
// safety net that should never actually trigger, not a real constraint.
// If it ever does, trim down to the highest-scoring runs rather than let
// the whole workflow fail on push — dropping low-score runs is also
// exactly right for this feature, since it only ever surfaces the
// *highest* keys for a given comp.
const MAX_OUTPUT_BYTES = 50 * 1024 * 1024;

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
// further client-side trimming. `dungeon` is just the slug (not the full
// {name,slug,icon_url} object) and `season` is omitted entirely — both are
// redundant per-run since the frontend already has a slug->name/icon_url
// lookup (RAIDER_IO_DUNGEONS in data.js) and a single dataset-level season
// covers every run in the file. Dropping them saves ~18% of bytes/run.
// `character.name`/`path` are kept so the frontend can show/link the actual
// player instead of just their spec — `path` is raider.io's own ready-made
// relative profile URL (e.g. "/characters/us/frostmourne/Bearbee"), so it
// doesn't need to be reconstructed from region/realm/name separately.
function trimRanking(ranking) {
  return {
    rank: ranking.rank,
    score: ranking.score,
    run: {
      keystone_run_id: ranking.run.keystone_run_id,
      mythic_level: ranking.run.mythic_level,
      clear_time_ms: ranking.run.clear_time_ms,
      num_chests: ranking.run.num_chests,
      completed_at: ranking.run.completed_at,
      dungeon: ranking.run.dungeon.slug,
      roster: ranking.run.roster.map((m) => ({
        role: m.role,
        character: {
          name: m.character.name,
          path: m.character.path,
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

async function fetchDungeon(dungeonSlug, apiKey, batchSize, batchDelayMs) {
  const allRankings = [];
  for (let batchStart = 0; batchStart < PAGES_PER_DUNGEON; batchStart += batchSize) {
    const batchEnd = Math.min(batchStart + batchSize, PAGES_PER_DUNGEON);
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
    if (batchEnd < PAGES_PER_DUNGEON) await sleep(batchDelayMs);
  }
  return allRankings;
}

// Retries an entire dungeon fetch once more, after a long cooldown, if the
// first attempt fails outright — rides out a transient raider.io-side blip
// (e.g. HTTP 502s) that outlasts fetchPageWithRetry's shorter per-page
// retry budget. If this second attempt also fails, the error propagates to
// the caller, which falls back to that dungeon's previously cached runs.
async function fetchDungeonResilient(dungeonSlug, apiKey, batchSize, batchDelayMs) {
  try {
    return await fetchDungeon(dungeonSlug, apiKey, batchSize, batchDelayMs);
  } catch (err) {
    console.warn(
      `${dungeonSlug}: first attempt failed (${err.message}) — retrying the whole dungeon after a ${DUNGEON_RETRY_COOLDOWN_MS / 1000}s cooldown.`
    );
    await sleep(DUNGEON_RETRY_COOLDOWN_MS);
    return fetchDungeon(dungeonSlug, apiKey, batchSize, batchDelayMs);
  }
}

function gzipPayload(generatedAt, season, runs) {
  return zlib.gzipSync(JSON.stringify({ generatedAt, season, runs }));
}

// Reads the previously committed cache (already on disk from actions/checkout
// before this script runs) and groups its runs by dungeon slug, so a dungeon
// that fails entirely this run (even after fetchDungeonResilient's retry) can
// fall back to its last-known-good data instead of contributing zero runs —
// a transient raider.io outage should never erase a dungeon's coverage from
// the live site. Returns an empty map if there's no previous file yet (first
// run ever) or it can't be read.
function loadPreviousDungeonRuns() {
  const bySlug = new Map();
  if (!fs.existsSync(OUTPUT_PATH)) return bySlug;
  try {
    const previous = JSON.parse(zlib.gunzipSync(fs.readFileSync(OUTPUT_PATH)));
    for (const ranking of previous.runs || []) {
      const slug = ranking?.run?.dungeon;
      if (!slug) continue;
      if (!bySlug.has(slug)) bySlug.set(slug, []);
      bySlug.get(slug).push(ranking);
    }
  } catch (err) {
    console.warn(`Could not read previous cache for fallback data: ${err.message}`);
  }
  return bySlug;
}

// Binary-searches the largest score-sorted prefix of `runs` whose gzip-
// compressed JSON fits within maxBytes (the actual committed size), so a
// too-large payload keeps its highest-value (highest-scoring) runs rather
// than being truncated arbitrarily. Only invoked in the rare case the
// compressed payload exceeds the safety budget (see MAX_OUTPUT_BYTES).
function trimToByteBudget(runs, generatedAt, season, maxBytes) {
  const sorted = [...runs].sort((a, b) => b.score - a.score);
  const sizeOf = (count) => gzipPayload(generatedAt, season, sorted.slice(0, count)).length;

  let lo = 0;
  let hi = sorted.length;
  while (lo < hi) {
    const mid = Math.ceil((lo + hi) / 2);
    if (sizeOf(mid) <= maxBytes) lo = mid;
    else hi = mid - 1;
  }
  return sorted.slice(0, lo);
}

async function main() {
  const apiKey = process.env.RAIDERIO_API_KEY || null;
  const batchSize = apiKey ? AUTH_BATCH_SIZE : UNAUTH_BATCH_SIZE;
  const batchDelayMs = apiKey ? AUTH_BATCH_DELAY_MS : UNAUTH_BATCH_DELAY_MS;
  const previousRunsBySlug = loadPreviousDungeonRuns();
  const results = [];

  for (const slug of DUNGEON_SLUGS) {
    try {
      const rankings = await fetchDungeonResilient(slug, apiKey, batchSize, batchDelayMs);
      console.log(`${slug}: collected ${rankings.length} runs`);
      results.push(...rankings);
    } catch (err) {
      // One dungeon failing entirely (even after fetchDungeonResilient's
      // retry) must not abort the other 7, and must not erase this
      // dungeon's coverage — fall back to its last committed runs.
      const fallback = previousRunsBySlug.get(slug) || [];
      console.error(
        `${slug}: failed entirely even after retry — ${err.message}. Falling back to ${fallback.length} runs from the last committed cache.`
      );
      results.push(...fallback);
    }
  }

  if (results.length < MIN_SANE_TOTAL_RUNS) {
    console.error(
      `Only ${results.length} total runs collected (floor: ${MIN_SANE_TOTAL_RUNS}) — likely a Raider.IO outage or systemic failure. Refusing to overwrite the last-known-good cache.`
    );
    process.exit(1);
  }

  const generatedAt = new Date().toISOString();
  let finalResults = results;
  let compressed = gzipPayload(generatedAt, SEASON, results);

  if (compressed.length > MAX_OUTPUT_BYTES) {
    console.warn(
      `Compressed payload is ${(compressed.length / 1e6).toFixed(1)}MB, over the ${(MAX_OUTPUT_BYTES / 1e6).toFixed(0)}MB safety budget — trimming to the highest-scoring runs.`
    );
    finalResults = trimToByteBudget(results, generatedAt, SEASON, MAX_OUTPUT_BYTES);
    compressed = gzipPayload(generatedAt, SEASON, finalResults);
    console.log(`Trimmed ${results.length} -> ${finalResults.length} runs to fit the compressed size budget.`);
  }

  fs.writeFileSync(OUTPUT_PATH, compressed);
  console.log(`Wrote ${finalResults.length} runs (${(compressed.length / 1e6).toFixed(1)}MB compressed) to ${OUTPUT_PATH}`);
}

main().catch((err) => {
  console.error("Fatal error:", err);
  process.exit(1);
});
