// Applies THEME (data.js) as CSS custom properties on the root element, so
// the whole palette is editable from data.js without touching any CSS.
function applyTheme() {
  const root = document.documentElement.style;
  Object.entries(THEME).forEach(([name, value]) => {
    root.setProperty(`--${name}`, value);
  });
}
applyTheme();

const SLOT_DEFS = [
  { id: "tank", label: "Tank", role: ROLES.TANK },
  { id: "healer", label: "Healer", role: ROLES.HEALER },
  { id: "dps1", label: "DPS 1", role: ROLES.DPS },
  { id: "dps2", label: "DPS 2", role: ROLES.DPS },
  { id: "dps3", label: "DPS 3", role: ROLES.DPS },
];

// slotId -> specKey ("Class:Spec") or null
const selection = {};
SLOT_DEFS.forEach((s) => (selection[s.id] = null));

function specByKey(key) {
  return SPECS.find((s) => specKey(s) === key) || null;
}

// Specs can be selected into more than one slot (e.g. 2x Fire Mage), so
// "is this spec selected" is a count, not a single slot id.
function countSelectedKey(key) {
  return SLOT_DEFS.filter((s) => selection[s.id] === key).length;
}

function isRoleFull(role) {
  return SLOT_DEFS.filter((s) => s.role === role).every((s) => selection[s.id] != null);
}

// role -> collapsed override set by clicking a group header; cleared whenever
// that role's full/not-full state flips, so filling/emptying the roster
// always drives the auto collapse/expand behavior.
const collapsedOverride = {};
const roleWasFull = {};

// Lowercased/trimmed live text from #spec-search-input — "" means no active
// search (buildSpecTable() falls back to its normal grouped/collapsed view).
let specSearchQuery = "";

function matchesSpecSearch(entry, query) {
  return (
    entry.class.toLowerCase().includes(query) ||
    entry.spec.toLowerCase().includes(query) ||
    entry.abbrev.toLowerCase().includes(query)
  );
}

function formatCooldown(seconds) {
  if (seconds == null) return "";
  if (seconds % 60 === 0) return `${seconds / 60} min`;
  return `${seconds} sec`;
}

// Same as formatCooldown, but for abilities with no real cooldown (just cast
// on demand — e.g. Polymorph, Hex).
function formatAbilityCooldown(seconds) {
  return seconds == null ? "No CD" : formatCooldown(seconds);
}

// Builds a <td> listing one or more abilities' name + cooldown (used for the
// Hard CC and AoE Disrupt table columns), or a muted dash if the spec has
// none. The <td> itself stays a plain table cell — the stacked layout lives
// on an inner wrapper so the table's column/row alignment isn't disturbed.
function buildAbilityCell(abilities) {
  const cell = document.createElement("td");
  cell.className = "ability-cell";
  if (!abilities || !abilities.length) {
    cell.textContent = "—";
    cell.classList.add("muted");
    return cell;
  }
  const inner = document.createElement("div");
  inner.className = "ability-cell-inner";
  abilities.forEach((ability) => {
    const entryEl = document.createElement("div");
    entryEl.className = "ability-entry";
    const name = document.createElement("span");
    name.className = "ability-name";
    name.textContent = ability.name;
    const duration = document.createElement("span");
    duration.className = "ability-duration";
    duration.textContent = formatAbilityCooldown(ability.cooldownSeconds);
    entryEl.appendChild(name);
    entryEl.appendChild(duration);
    inner.appendChild(entryEl);
  });
  cell.appendChild(inner);
  return cell;
}

function specInitials(specName) {
  const words = specName.split(" ");
  if (words.length > 1) {
    return words.map((w) => w[0]).join("").toUpperCase().slice(0, 3);
  }
  return specName.slice(0, 2).toUpperCase();
}

const ICON_BASE_URL = "https://wow.zamimg.com/images/wow/icons/large/";

// Builds an icon element for a spec. Tries the real WoW icon image first;
// if it fails to load (wrong/renamed slug), falls back to a class-colored
// initials badge so the UI never shows a broken image.
function createSpecIcon(entry, modifierClass) {
  const wrap = document.createElement("span");
  wrap.className = `spec-icon ${modifierClass}`;

  const img = document.createElement("img");
  img.src = `${ICON_BASE_URL}${entry.icon}.jpg`;
  img.alt = `${entry.spec} ${entry.class}`;
  img.loading = "lazy";
  img.addEventListener("error", () => {
    img.remove();
    wrap.classList.add("fallback");
    wrap.style.background = CLASS_COLORS[entry.class] || "#555";
    wrap.textContent = specInitials(entry.spec);
  });

  wrap.appendChild(img);
  return wrap;
}

// Builds an icon element for an ability (used in the Crowd Control panel,
// where the ability's own spell icon is shown instead of the caster's spec
// icon). Same fallback-safe behavior as createSpecIcon.
function createAbilityIcon(abilityName, modifierClass) {
  const wrap = document.createElement("span");
  wrap.className = `spec-icon ${modifierClass}`;

  const iconSlug = ABILITY_ICONS[abilityName];
  if (!iconSlug) {
    wrap.classList.add("fallback");
    wrap.style.background = "var(--gold)";
    wrap.textContent = specInitials(abilityName);
    return wrap;
  }

  const img = document.createElement("img");
  img.src = `${ICON_BASE_URL}${iconSlug}.jpg`;
  img.alt = abilityName;
  img.loading = "lazy";
  img.addEventListener("error", () => {
    img.remove();
    wrap.classList.add("fallback");
    wrap.style.background = "var(--gold)";
    wrap.textContent = specInitials(abilityName);
  });

  wrap.appendChild(img);
  return wrap;
}

let messageTimeout = null;
function showTableMessage(text) {
  const el = document.getElementById("table-message");
  el.textContent = text;
  clearTimeout(messageTimeout);
  messageTimeout = setTimeout(() => {
    el.textContent = "";
  }, 2500);
}

// A spec's damageProfile (data.js) is an array of one or more profiles
// (e.g. Retribution is both Cleave and Funnel) — builds one pill per entry,
// wrapped so they sit side by side and wrap onto a new line if needed.
function buildDamageProfilePills(profiles) {
  const wrap = document.createElement("span");
  wrap.className = "damage-profile-pills";
  profiles.forEach((profile) => {
    const pill = document.createElement("span");
    pill.className = `damage-profile-pill ${profile}`;
    pill.textContent = profile;
    wrap.appendChild(pill);
  });
  return wrap;
}

// Simple hand-authored glyphs for an empty slot's role — a shield, a cross,
// and a sword. Plain geometric outline icons (a handful of path points
// each), not illustration, so hand-authoring them here is fine.
const ROLE_GLYPH_PATHS = {
  [ROLES.TANK]: '<path d="M12 3l7 3v6c0 4.5-3 7.5-7 9-4-1.5-7-4.5-7-9V6z"/>',
  [ROLES.HEALER]: '<path d="M12 4v16M4 12h16"/>',
  // Sword: pointed tip + blade, then a narrower crossguard and short grip
  // (vs. the Healer cross's single centered, full-width bar) so the two
  // stay easy to tell apart at a glance despite sharing the same line-icon
  // style.
  [ROLES.DPS]: '<path d="M9 6L12 3L15 6M12 3V16"/><path d="M8 16H16M12 16V20"/>',
};

function buildRoleGlyph(role) {
  const wrap = document.createElement("span");
  wrap.className = "role-glyph";
  wrap.innerHTML = `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round">${
    ROLE_GLYPH_PATHS[role] || ""
  }</svg>`;
  return wrap;
}

function buildSlots() {
  const container = document.getElementById("slots");
  container.innerHTML = "";

  SLOT_DEFS.forEach((slotDef) => {
    const slotEl = document.createElement("div");
    slotEl.className = "slot";
    slotEl.dataset.role = slotDef.role;

    const label = document.createElement("div");
    label.className = "slot-label";
    label.textContent = slotDef.label;

    const icon = document.createElement("div");
    icon.className = "slot-icon";

    const caption = document.createElement("div");
    caption.className = "slot-caption";

    const key = selection[slotDef.id];
    const entry = key ? specByKey(key) : null;

    if (entry) {
      icon.classList.add("filled");
      icon.appendChild(createSpecIcon(entry, "spec-icon--slot"));
      icon.title = `Remove ${entry.spec} ${entry.class}`;
      caption.textContent = `${entry.spec} ${entry.class}`;
      icon.addEventListener("click", () => {
        selection[slotDef.id] = null;
        render();
      });
    } else {
      icon.classList.add("empty");
      icon.appendChild(buildRoleGlyph(slotDef.role));
      caption.textContent = `Add a ${slotDef.role.toLowerCase()}`;
    }

    slotEl.appendChild(label);
    slotEl.appendChild(icon);
    slotEl.appendChild(caption);

    if (entry && entry.damageProfile) {
      slotEl.appendChild(buildDamageProfilePills(entry.damageProfile));
    }

    container.appendChild(slotEl);
  });
}

const ROLE_TABLE_ORDER = [ROLES.TANK, ROLES.HEALER, ROLES.DPS];

function buildSpecTable() {
  const tbody = document.getElementById("spec-table-body");
  tbody.innerHTML = "";

  const query = specSearchQuery;
  let totalMatches = 0;

  ROLE_TABLE_ORDER.forEach((role) => {
    const full = isRoleFull(role);
    if (roleWasFull[role] !== full) {
      collapsedOverride[role] = undefined;
      roleWasFull[role] = full;
    }
    const collapsed = collapsedOverride[role] !== undefined ? collapsedOverride[role] : full;

    const filledCount = SLOT_DEFS.filter((s) => s.role === role && selection[s.id] != null).length;
    const totalCount = SLOT_DEFS.filter((s) => s.role === role).length;

    let specsInRole = SPECS.filter((s) => s.role === role).sort((a, b) => a.class.localeCompare(b.class));

    // Party-aware search: a full role can never be added to, so it never
    // contributes results, regardless of whether its specs match the query.
    if (query) {
      specsInRole = full ? [] : specsInRole.filter((entry) => matchesSpecSearch(entry, query));
      if (specsInRole.length === 0) return; // no matches in this role — skip its header entirely
      totalMatches += specsInRole.length;
    }

    const groupRow = document.createElement("tr");
    groupRow.className = "role-group-row";
    const groupCell = document.createElement("td");
    groupCell.colSpan = 9;

    const chevron = document.createElement("span");
    chevron.className = "role-group-chevron";
    chevron.textContent = collapsed && !query ? "▸" : "▾";

    const groupLabel = document.createElement("span");
    groupLabel.className = `role-group-label ${role}`;
    groupLabel.textContent = `${role} (${filledCount}/${totalCount})`;

    groupCell.appendChild(chevron);
    groupCell.appendChild(groupLabel);
    groupRow.appendChild(groupCell);
    groupRow.addEventListener("click", () => {
      collapsedOverride[role] = !collapsed;
      render();
    });
    tbody.appendChild(groupRow);

    specsInRole.forEach((entry) => {
      const key = specKey(entry);
      const selectedCount = countSelectedKey(key);
      const row = document.createElement("tr");
      row.dataset.key = key;
      if (collapsed && !query) row.classList.add("row-collapsed");
      if (selectedCount > 0) row.classList.add("selected");

      const classCell = document.createElement("td");
      classCell.textContent = entry.class;
      classCell.style.color = CLASS_COLORS[entry.class] || "inherit";
      classCell.style.fontWeight = "600";

      const specCell = document.createElement("td");
      specCell.className = "spec-cell";
      const specCellInner = document.createElement("div");
      specCellInner.className = "spec-cell-inner";
      specCellInner.appendChild(createSpecIcon(entry, "spec-icon--table"));
      const specName = document.createElement("span");
      specName.textContent = entry.spec;
      specCellInner.appendChild(specName);
      if (selectedCount > 0) {
        const countBadge = document.createElement("span");
        countBadge.className = "spec-count-badge";
        countBadge.textContent = `×${selectedCount}`;
        specCellInner.appendChild(countBadge);
      }
      specCell.appendChild(specCellInner);

      const damageProfileCell = document.createElement("td");
      if (entry.damageProfile) {
        damageProfileCell.appendChild(buildDamageProfilePills(entry.damageProfile));
      } else {
        damageProfileCell.textContent = "—";
        damageProfileCell.classList.add("muted");
      }

      const durationCell = document.createElement("td");
      durationCell.textContent = entry.cooldownSeconds != null ? formatCooldown(entry.cooldownSeconds) : "—";
      if (entry.cooldownSeconds == null) durationCell.classList.add("muted");

      const lustCell = document.createElement("td");
      lustCell.className = "utility-tick-cell";
      if (LUST_SPECS.has(key)) {
        lustCell.textContent = "✓";
        lustCell.classList.add("utility-tick");
      } else {
        lustCell.textContent = "—";
        lustCell.classList.add("muted");
      }

      const rezCell = document.createElement("td");
      rezCell.className = "utility-tick-cell";
      if (BATTLE_REZ_SPECS.has(key)) {
        rezCell.textContent = "✓";
        rezCell.classList.add("utility-tick");
      } else {
        rezCell.textContent = "—";
        rezCell.classList.add("muted");
      }

      const groupBuffCell = document.createElement("td");
      const groupBuff = GROUP_BUFF_BY_CLASS[entry.class];
      groupBuffCell.textContent = groupBuff || "—";
      if (!groupBuff) groupBuffCell.classList.add("muted");

      const hardCcCell = buildAbilityCell(HARD_CC_ABILITIES[key]);
      const aoeDisruptCell = buildAbilityCell(AOE_DISRUPT_ABILITIES[key]);

      row.appendChild(classCell);
      row.appendChild(specCell);
      row.appendChild(damageProfileCell);
      row.appendChild(durationCell);
      row.appendChild(lustCell);
      row.appendChild(rezCell);
      row.appendChild(groupBuffCell);
      row.appendChild(hardCcCell);
      row.appendChild(aoeDisruptCell);

      row.addEventListener("click", () => onSpecRowClick(entry));

      tbody.appendChild(row);
    });
  });

  if (query && totalMatches === 0) {
    const emptyRow = document.createElement("tr");
    const emptyCell = document.createElement("td");
    emptyCell.colSpan = 9;
    emptyCell.className = "spec-search-empty muted";
    emptyCell.textContent = "No specs match your search.";
    emptyRow.appendChild(emptyCell);
    tbody.appendChild(emptyRow);
  }
}

function onSpecRowClick(entry) {
  const key = specKey(entry);

  // Always adds — specs (including duplicates like 2x Fire Mage) go into the
  // next open slot of that role. Remove a filled slot via its party builder
  // icon instead of clicking the table row again.
  const targetSlot = SLOT_DEFS.find((s) => s.role === entry.role && !selection[s.id]);
  if (!targetSlot) {
    showTableMessage(`All ${entry.role} slots are full — remove one first.`);
    return;
  }

  selection[targetSlot.id] = key;

  // Reset the search so the table returns to its normal grouped view, ready
  // for the next search.
  specSearchQuery = "";
  document.getElementById("spec-search-input").value = "";

  render();
}

function getSelectedEntries() {
  return SLOT_DEFS.map((s) => ({ slot: s, entry: selection[s.id] ? specByKey(selection[s.id]) : null })).filter(
    (x) => x.entry
  );
}

// A fingerprint of the current 5-slot comp, order-independent within role.
// Used to detect "the comp changed" so stale Raider.IO results get cleared.
function compFingerprint(targetEntries) {
  return targetEntries
    .map((x) => specKey(x.entry))
    .sort()
    .join("|");
}

function rosterMemberKey(member) {
  return `${member.character.class.name}:${member.character.spec.name}`;
}

// Whether a raider.io run's roster is exactly this 5-slot comp. Tank and
// healer are single direct matches; the 3 DPS are compared as a sorted
// multiset so duplicate specs (e.g. 2x Fire Mage) are handled correctly.
function rosterMatchesComp(roster, targetEntries) {
  const targetTank = targetEntries.find((x) => x.slot.role === ROLES.TANK)?.entry;
  const targetHealer = targetEntries.find((x) => x.slot.role === ROLES.HEALER)?.entry;
  const targetDpsKeys = targetEntries
    .filter((x) => x.slot.role === ROLES.DPS)
    .map((x) => specKey(x.entry))
    .sort();

  if (!roster || !targetTank || !targetHealer || targetDpsKeys.length !== 3) return false;

  const rosterTanks = roster.filter((m) => m.role?.toLowerCase() === "tank");
  const rosterHealers = roster.filter((m) => m.role?.toLowerCase() === "healer");
  const rosterDps = roster.filter((m) => m.role?.toLowerCase() === "dps");

  // A roster that isn't exactly 1 tank / 1 healer / 3 dps can never match
  // this app's fixed 5-slot shape.
  if (rosterTanks.length !== 1 || rosterHealers.length !== 1 || rosterDps.length !== 3) return false;

  if (rosterMemberKey(rosterTanks[0]) !== specKey(targetTank)) return false;
  if (rosterMemberKey(rosterHealers[0]) !== specKey(targetHealer)) return false;

  const rosterDpsKeys = rosterDps.map(rosterMemberKey).sort();
  return rosterDpsKeys.every((k, i) => k === targetDpsKeys[i]);
}

// Whether a raider.io run's roster could be reached by filling in the rest
// of the party around the given PARTIAL selection — every currently-filled
// slot's spec must be present in the roster. Tank/healer (if selected) must
// match directly; selected DPS specs are checked as a sub-multiset, so
// selecting 1x Fire Mage still matches a roster running 2x Fire Mage. Used
// by the Popular Comps view (app.js's renderPopularComps) whenever the
// party has 1-4 slots filled; rosterMatchesComp above (exact, all 5 slots)
// is unchanged and still drives the exact-match Lookup once the party is full.
function rosterContainsPartialComp(roster, targetEntries) {
  if (!roster) return false;

  const rosterTanks = roster.filter((m) => m.role?.toLowerCase() === "tank");
  const rosterHealers = roster.filter((m) => m.role?.toLowerCase() === "healer");
  const rosterDps = roster.filter((m) => m.role?.toLowerCase() === "dps");
  if (rosterTanks.length !== 1 || rosterHealers.length !== 1 || rosterDps.length !== 3) return false;

  const targetTank = targetEntries.find((x) => x.slot.role === ROLES.TANK)?.entry;
  const targetHealer = targetEntries.find((x) => x.slot.role === ROLES.HEALER)?.entry;
  const targetDpsKeys = targetEntries.filter((x) => x.slot.role === ROLES.DPS).map((x) => specKey(x.entry));

  if (targetTank && rosterMemberKey(rosterTanks[0]) !== specKey(targetTank)) return false;
  if (targetHealer && rosterMemberKey(rosterHealers[0]) !== specKey(targetHealer)) return false;

  if (targetDpsKeys.length > 0) {
    const rosterCounts = new Map();
    rosterDps.forEach((m) => {
      const k = rosterMemberKey(m);
      rosterCounts.set(k, (rosterCounts.get(k) || 0) + 1);
    });
    const neededCounts = new Map();
    targetDpsKeys.forEach((k) => neededCounts.set(k, (neededCounts.get(k) || 0) + 1));
    for (const [k, count] of neededCounts) {
      if ((rosterCounts.get(k) || 0) < count) return false;
    }
  }

  return true;
}

// Identity of the full 5-spec comp a roster represents (role-aware, so it
// doesn't collide with a same-specKey-set roster of a different shape —
// though that can't actually happen since a spec has exactly one role).
function rosterFingerprint(roster) {
  const tank = roster.find((m) => m.role?.toLowerCase() === "tank");
  const healer = roster.find((m) => m.role?.toLowerCase() === "healer");
  const dpsKeys = roster
    .filter((m) => m.role?.toLowerCase() === "dps")
    .map(rosterMemberKey)
    .sort();
  return `${rosterMemberKey(tank)}::${rosterMemberKey(healer)}::${dpsKeys.join("|")}`;
}

// Identity of the 5 actual players in a roster (not the comp) — used to
// count distinct TEAMS per comp rather than distinct RUNS, so one group
// farming the same comp across many weeks doesn't inflate its popularity
// over a comp that many different groups have each logged once.
function teamFingerprint(roster) {
  return roster
    .map((m) => m.character.path || m.character.name || rosterMemberKey(m))
    .sort()
    .join("||");
}

// [{role, entry}] for a roster's tank, healer, then 3 DPS, in that display
// order — the shape buildPopularCompRow() and buildRaiderIoResultRow() (via
// raiderIoEntryForRosterMember) both expect for icons/labels.
function orderedRosterEntries(roster) {
  return [...roster]
    .sort((a, b) => RAIDER_IO_ROLE_SORT_ORDER[a.role?.toLowerCase()] - RAIDER_IO_ROLE_SORT_ORDER[b.role?.toLowerCase()])
    .map((m) => ({ role: m.role, entry: raiderIoEntryForRosterMember(m) }));
}

// Scans the whole dataset for runs containing the partial selection, and
// groups the matches into their full 5-spec comps. Ranked by distinct team
// count (see teamFingerprint) rather than raw run count, then by best score
// as a tiebreaker.
function aggregatePopularComps(dataset, targetEntries, dungeonSlug) {
  const groups = new Map(); // rosterFingerprint -> { rosterEntries, runs, teamKeys }

  for (const ranking of dataset.runs) {
    const run = ranking.run;
    if (dungeonSlug !== "all" && run.dungeon !== dungeonSlug) continue;
    if (!rosterContainsPartialComp(run.roster, targetEntries)) continue;

    const fingerprint = rosterFingerprint(run.roster);
    let group = groups.get(fingerprint);
    if (!group) {
      group = { rosterEntries: orderedRosterEntries(run.roster), runs: [], teamKeys: new Set() };
      groups.set(fingerprint, group);
    }
    group.runs.push(ranking);
    group.teamKeys.add(teamFingerprint(run.roster));
  }

  const comps = [...groups.values()].map((g) => {
    g.runs.sort((a, b) => b.score - a.score);
    return {
      rosterEntries: g.rosterEntries,
      runs: g.runs,
      teamCount: g.teamKeys.size,
      bestLevel: g.runs[0]?.run.mythic_level ?? 0,
      bestScore: g.runs[0]?.score ?? 0,
    };
  });

  comps.sort((a, b) => b.teamCount - a.teamCount || b.bestScore - a.bestScore);
  return comps;
}

// Raider.IO Lookup panel state — the only async feature in this app, so it
// gets its own small state machine rather than fitting the synchronous
// "derive everything from `selection`" pattern used elsewhere.
const raiderIoState = {
  status: "idle", // "idle" | "loading" | "done" | "error"
  message: "",
  results: [],
  scopeKey: null, // fingerprint of the comp + selected dungeon these results/status belong to
};
// Bumped whenever the comp or dungeon filter changes, so an in-flight
// dataset load for a stale scope can detect it's been superseded and stop
// touching shared state, without needing real fetch-cancellation.
let raiderIoScanToken = 0;

// A fingerprint of "what these Raider.IO results are for" — the comp plus
// the selected dungeon filter. Widening this (vs. comp alone) is what makes
// changing only the dungeon filter correctly invalidate stale results too.
// Works for a partial selection too (compFingerprint doesn't require 5
// entries), which is what lets the Popular Comps view reuse it as-is.
function raiderIoScopeKey(targetEntries) {
  return `${compFingerprint(targetEntries)}::${getSelectedDungeonSlug()}`;
}

// Popular Comps panel state — shown in place of the exact-match Lookup
// above while the party has 1-4 slots filled (see renderRaiderIoPanel()).
// Same async-state-machine shape as raiderIoState, plus a `view`/
// `selectedComp` pair for the list <-> drill-down toggle.
const popularCompsState = {
  status: "idle", // "idle" | "loading" | "done" | "error"
  message: "",
  comps: [], // aggregated comps for the current partial selection + dungeon
  view: "list", // "list" | "detail"
  selectedComp: null, // one entry from `comps`, set when view === "detail"
  scopeKey: null, // fingerprint (partial comp + dungeon) these results belong to
};
let popularCompsScanToken = 0;

// The pre-fetched dataset (see RAIDER_IO.datasetUrl in data.js) — a large,
// gzip-compressed snapshot of Raider.IO runs refreshed on a schedule by
// scripts/fetch-raiderio-cache.js / .github/workflows/update-raiderio-cache.yml,
// committed to the repo and served as a static file by GitHub Pages. Loaded
// once per session (lazily, on first lookup) and kept in memory — there are
// no more live per-click calls to raider.io's API at all.
let raiderIoDataset = null;
let raiderIoDatasetPromise = null;

async function loadRaiderIoDataset() {
  if (raiderIoDataset) return raiderIoDataset;
  if (raiderIoDatasetPromise) return raiderIoDatasetPromise;

  raiderIoDatasetPromise = (async () => {
    let response;
    try {
      response = await fetch(RAIDER_IO.datasetUrl);
    } catch {
      throw new Error("Could not load Raider.IO data — check your connection and try again.");
    }
    if (response.status === 404) {
      throw new Error("Raider.IO data hasn't been generated yet — check back after the next scheduled update.");
    }
    if (!response.ok) {
      throw new Error(`Raider.IO cache returned an error (HTTP ${response.status}).`);
    }
    if (typeof DecompressionStream !== "function") {
      throw new Error(
        "Your browser doesn't support decompressing the Raider.IO dataset — try a recent version of Chrome, Firefox, Safari, or Edge."
      );
    }
    let dataset;
    try {
      const decompressed = response.body.pipeThrough(new DecompressionStream("gzip"));
      dataset = JSON.parse(await new Response(decompressed).text());
    } catch {
      throw new Error("Could not read the Raider.IO dataset — check back after the next scheduled update.");
    }
    raiderIoDataset = dataset;
    return dataset;
  })();

  try {
    return await raiderIoDatasetPromise;
  } finally {
    raiderIoDatasetPromise = null;
  }
}

function formatDatasetTimestamp(iso) {
  return new Date(iso).toLocaleString();
}

function renderRaiderIoFreshness(dataset) {
  const el = document.getElementById("raiderio-freshness");
  if (!dataset) {
    el.textContent = "";
    return;
  }
  let text = `Data last updated: ${formatDatasetTimestamp(dataset.generatedAt)} (${dataset.runs.length} runs cached)`;
  if (dataset.season !== RAIDER_IO.season) {
    text += ` — cached data is for a different season (${dataset.season}); results may be stale.`;
  }
  el.textContent = text;
}

// Which dungeon the Raider.IO Lookup scan is scoped to — "all" or a dungeon
// slug. Tracked here rather than read from a native <select> (native select
// popups are OS/browser-rendered and looked broken against this page's dark
// theme) — the dungeon picker below is a set of plain buttons instead.
let raiderIoSelectedDungeon = "all";

function getSelectedDungeonSlug() {
  return raiderIoSelectedDungeon;
}

function raiderIoDungeonName(slug) {
  if (slug === "all") return null;
  return RAIDER_IO_DUNGEONS.find((d) => d.slug === slug)?.name || slug;
}

// Builds an icon element for a dungeon (same fallback-safe pattern as
// createSpecIcon/createAbilityIcon — tries the real icon, falls back to the
// dungeon's short name badge on load failure).
function createDungeonIcon(dungeon, modifierClass) {
  const wrap = document.createElement("span");
  wrap.className = `spec-icon ${modifierClass}`;

  const img = document.createElement("img");
  img.src = `${RAIDER_IO.iconCdnBase}${dungeon.icon_url}`;
  img.alt = dungeon.name;
  img.loading = "lazy";
  img.addEventListener("error", () => {
    img.remove();
    wrap.classList.add("fallback");
    wrap.style.background = "var(--gold)";
    wrap.textContent = dungeon.shortName;
  });

  wrap.appendChild(img);
  return wrap;
}

function selectRaiderIoDungeon(slug) {
  raiderIoSelectedDungeon = slug;
  document.querySelectorAll(".raiderio-dungeon-option").forEach((el) => {
    el.classList.toggle("selected", el.dataset.slug === slug);
  });
  renderRaiderIoPanel();
}

// Built once at startup (not part of render()) — the picker's own options
// never change, only which one is marked .selected, which selectRaiderIoDungeon
// handles directly without a full rebuild.
function buildRaiderIoDungeonPicker() {
  const container = document.getElementById("raiderio-dungeon-picker");

  const allOption = document.createElement("button");
  allOption.type = "button";
  allOption.className = "raiderio-dungeon-option selected";
  allOption.dataset.slug = "all";
  allOption.title = "All Dungeons";
  const allIcon = document.createElement("span");
  allIcon.className = "spec-icon raiderio-dungeon-option-icon raiderio-dungeon-option-icon--all";
  allIcon.textContent = "All";
  allOption.appendChild(allIcon);
  const allText = document.createElement("span");
  allText.textContent = "All Dungeons";
  allOption.appendChild(allText);
  allOption.addEventListener("click", () => selectRaiderIoDungeon("all"));
  container.appendChild(allOption);

  RAIDER_IO_DUNGEONS.forEach((dungeon) => {
    const option = document.createElement("button");
    option.type = "button";
    option.className = "raiderio-dungeon-option";
    option.dataset.slug = dungeon.slug;
    option.title = dungeon.name;
    option.appendChild(createDungeonIcon(dungeon, "raiderio-dungeon-option-icon"));
    const text = document.createElement("span");
    text.textContent = dungeon.shortName;
    option.appendChild(text);
    option.addEventListener("click", () => selectRaiderIoDungeon(dungeon.slug));
    container.appendChild(option);
  });
}

async function runRaiderIoLookup() {
  if (raiderIoState.status === "loading") return; // overlapping-load guard

  const targetEntries = getSelectedEntries();
  if (targetEntries.length !== 5) return; // defensive; button should already be disabled

  const selectedDungeon = getSelectedDungeonSlug();
  const dungeonName = raiderIoDungeonName(selectedDungeon);
  const dungeonPhrase = dungeonName ? ` in ${dungeonName}` : "";

  raiderIoScanToken++;
  const myToken = raiderIoScanToken;

  raiderIoState.status = "loading";
  raiderIoState.results = [];
  raiderIoState.scopeKey = raiderIoScopeKey(targetEntries);
  raiderIoState.message = "Loading Raider.IO data...";
  renderRaiderIoPanel();

  let dataset;
  try {
    dataset = await loadRaiderIoDataset();
  } catch (err) {
    if (myToken !== raiderIoScanToken) return; // superseded by a newer lookup — abandon silently
    raiderIoState.status = "error";
    raiderIoState.message = err.message;
    renderRaiderIoPanel();
    return;
  }
  if (myToken !== raiderIoScanToken) return;

  const matches = dataset.runs
    .filter(
      (r) =>
        (selectedDungeon === "all" || r.run.dungeon === selectedDungeon) &&
        rosterMatchesComp(r.run.roster, targetEntries)
    )
    .sort((a, b) => b.score - a.score)
    .slice(0, RAIDER_IO.resultsWanted);

  raiderIoState.status = "done";
  raiderIoState.results = matches;
  raiderIoState.message = matches.length
    ? `Found ${matches.length} matching run(s)${dungeonPhrase} out of ${dataset.runs.length} runs cached.`
    : `No matching runs found${dungeonPhrase} out of ${dataset.runs.length} runs cached — this comp may just be rare${
        dungeonName ? ", try All Dungeons for better odds" : ""
      }.`;
  renderRaiderIoPanel();
}

// Maps a raider.io roster member back to one of our own SPECS entries (for
// its icon/colors) — string compatibility between raider.io's class/spec
// names and ours is confirmed exact, so this is just a lookup. The fallback
// (empty icon slug) reuses createSpecIcon's existing bad-icon -> initials
// badge path for free, on the practically-unreachable chance it's not found.
function raiderIoEntryForRosterMember(member) {
  const found = SPECS.find(
    (s) => s.class === member.character.class.name && s.spec === member.character.spec.name
  );
  return (
    found || {
      class: member.character.class.name,
      spec: member.character.spec.name,
      icon: "",
    }
  );
}

// Unofficial URL pattern — raider.io's API doesn't return a run URL. See the
// comment on RAIDER_IO.runUrlBase in data.js. `season` comes off the loaded
// dataset (not the run itself — every run in a given dataset shares one
// season, so it isn't duplicated per-run); buildRunUrl is only ever called
// while rendering results after a successful load, so raiderIoDataset is
// guaranteed to be populated here.
function buildRunUrl(run) {
  return `${RAIDER_IO.runUrlBase}/${raiderIoDataset.season}/${run.keystone_run_id}-${run.dungeon}`;
}

function formatClearTime(ms) {
  const totalSeconds = Math.round(ms / 1000);
  const m = Math.floor(totalSeconds / 60);
  const s = totalSeconds % 60;
  return `${m}:${String(s).padStart(2, "0")}`;
}

const RAIDER_IO_ROLE_SORT_ORDER = { tank: 0, healer: 1, dps: 2 };

function buildRaiderIoResultRow(ranking) {
  const run = ranking.run;
  const li = document.createElement("li");
  li.className = "utility-row raiderio-result-row";

  // `run.dungeon` is just a slug (see trimRanking() in
  // scripts/fetch-raiderio-cache.js) — look up its display name/icon from
  // the same table the dungeon picker uses.
  const dungeonInfo = RAIDER_IO_DUNGEONS.find((d) => d.slug === run.dungeon);

  const header = document.createElement("div");
  header.className = "raiderio-result-header";

  const dungeonIcon = document.createElement("img");
  dungeonIcon.className = "raiderio-dungeon-icon";
  dungeonIcon.src = `${RAIDER_IO.iconCdnBase}${dungeonInfo?.icon_url || ""}`;
  dungeonIcon.alt = dungeonInfo?.name || run.dungeon;
  dungeonIcon.loading = "lazy";
  dungeonIcon.addEventListener("error", () => dungeonIcon.remove());
  header.appendChild(dungeonIcon);

  const dungeonName = document.createElement("span");
  dungeonName.className = "raiderio-dungeon-name";
  dungeonName.textContent = dungeonInfo?.name || run.dungeon;
  header.appendChild(dungeonName);

  const level = document.createElement("span");
  level.className = "raiderio-key-level";
  level.textContent = `+${run.mythic_level}`;
  header.appendChild(level);

  const status = document.createElement("span");
  status.className = "raiderio-run-status";
  status.textContent =
    run.num_chests > 0
      ? `Timed (+${run.num_chests}) — ${formatClearTime(run.clear_time_ms)}`
      : `Depleted — ${formatClearTime(run.clear_time_ms)}`;
  header.appendChild(status);

  const score = document.createElement("span");
  score.className = "raiderio-score";
  score.textContent = `Score: ${Math.round(ranking.score)}`;
  header.appendChild(score);

  const date = document.createElement("span");
  date.className = "raiderio-date";
  date.textContent = new Date(run.completed_at).toLocaleDateString();
  header.appendChild(date);

  li.appendChild(header);

  const roster = document.createElement("div");
  roster.className = "utility-providers raiderio-result-roster";
  [...run.roster]
    .sort(
      (a, b) =>
        RAIDER_IO_ROLE_SORT_ORDER[a.role?.toLowerCase()] - RAIDER_IO_ROLE_SORT_ORDER[b.role?.toLowerCase()]
    )
    .forEach((member) => {
      const entry = raiderIoEntryForRosterMember(member);
      const specLabel = `${entry.spec} ${entry.class}`;
      const chip = document.createElement("span");
      chip.className = "utility-provider-chip";
      const icon = createSpecIcon(entry, "spec-icon--utility");
      icon.title = specLabel; // spec/class now only surfaces as a tooltip — see the name/link below
      chip.appendChild(icon);

      const { name, path } = member.character;
      if (name && path) {
        const nameLink = document.createElement("a");
        nameLink.className = "raiderio-player-name";
        nameLink.href = `https://raider.io${path}`;
        nameLink.target = "_blank";
        nameLink.rel = "noopener noreferrer";
        nameLink.textContent = name;
        chip.appendChild(nameLink);
      } else {
        // Falls back to the old spec/class text for roster entries from a
        // cache generated before name/path were added — see trimRanking()
        // in scripts/fetch-raiderio-cache.js.
        const text = document.createElement("span");
        text.textContent = specLabel;
        chip.appendChild(text);
      }
      roster.appendChild(chip);
    });
  li.appendChild(roster);

  const link = document.createElement("a");
  link.className = "raiderio-result-link";
  link.href = buildRunUrl(run);
  link.target = "_blank";
  link.rel = "noopener noreferrer";
  link.textContent = "View run on Raider.IO ↗";
  li.appendChild(link);

  return li;
}

function renderRaiderIoResults() {
  const targetEntries = getSelectedEntries();
  const allFilled = targetEntries.length === 5;
  const currentScopeKey = allFilled ? raiderIoScopeKey(targetEntries) : null;

  // The comp or dungeon filter changed since these results/status were
  // produced — clear them out and invalidate any scan still running for the
  // old scope, so stale results for a different comp/dungeon can never show.
  if (raiderIoState.scopeKey !== currentScopeKey) {
    raiderIoScanToken++;
    raiderIoState.status = "idle";
    raiderIoState.message = "";
    raiderIoState.results = [];
    raiderIoState.scopeKey = currentScopeKey;
  }

  const btn = document.getElementById("raiderio-lookup-btn");
  btn.disabled = !allFilled || raiderIoState.status === "loading";
  btn.textContent = raiderIoState.status === "loading" ? "Loading..." : "Look up highest keys with this comp";

  const statusEl = document.getElementById("raiderio-status");
  statusEl.textContent = raiderIoState.message;
  statusEl.classList.toggle("raiderio-status--error", raiderIoState.status === "error");

  const list = document.getElementById("raiderio-results");
  list.innerHTML = "";
  if (raiderIoState.status === "idle") {
    if (!allFilled) {
      list.innerHTML = '<li class="empty">Fill all 5 slots to look up matching runs.</li>';
    }
    return;
  }
  if (raiderIoState.status === "done" && raiderIoState.results.length === 0) {
    list.innerHTML = '<li class="empty">No matching runs found — try again later, or this comp may just be rare.</li>';
    return;
  }
  raiderIoState.results.forEach((ranking) => list.appendChild(buildRaiderIoResultRow(ranking)));
}

// `rank` and `maxTeamCount` come from the caller so every row in the list
// can scale its bar against the same top comp — this is what turns the list
// into a scannable leaderboard instead of a set of independently-labeled rows.
function buildPopularCompRow(comp, rank, maxTeamCount) {
  const li = document.createElement("li");
  li.className = "utility-row popular-comp-row";

  const rankEl = document.createElement("div");
  rankEl.className = "popular-comp-rank";
  rankEl.textContent = String(rank);
  li.appendChild(rankEl);

  const roster = document.createElement("div");
  roster.className = "utility-providers popular-comp-roster";
  comp.rosterEntries.forEach(({ entry }) => {
    const icon = createSpecIcon(entry, "spec-icon--utility");
    icon.title = `${entry.spec} ${entry.class}`;
    roster.appendChild(icon);
  });
  li.appendChild(roster);

  const barTrack = document.createElement("div");
  barTrack.className = "popular-comp-bar-track";
  const barFill = document.createElement("div");
  barFill.className = "popular-comp-bar-fill";
  // Floor at a sliver so the lowest-ranked comp's bar is never literally
  // invisible when it's far behind the top one.
  const pct = maxTeamCount > 0 ? Math.max(4, (comp.teamCount / maxTeamCount) * 100) : 0;
  barFill.style.width = `${pct}%`;
  barTrack.appendChild(barFill);
  li.appendChild(barTrack);

  const teamStat = document.createElement("div");
  teamStat.className = "popular-comp-team-stat";
  const teamNum = document.createElement("div");
  teamNum.className = "popular-comp-team-num";
  teamNum.textContent = comp.teamCount;
  teamStat.appendChild(teamNum);
  const teamCap = document.createElement("div");
  teamCap.className = "popular-comp-team-cap";
  teamCap.textContent = comp.teamCount === 1 ? "team" : "teams";
  teamStat.appendChild(teamCap);
  li.appendChild(teamStat);

  const best = document.createElement("span");
  best.className = "raiderio-key-level popular-comp-level";
  best.textContent = `+${comp.bestLevel}`;
  li.appendChild(best);

  li.addEventListener("click", () => selectPopularComp(comp));
  return li;
}

function selectPopularComp(comp) {
  popularCompsState.view = "detail";
  popularCompsState.selectedComp = comp;
  renderRaiderIoPanel();
}

function backToPopularCompsList() {
  popularCompsState.view = "list";
  popularCompsState.selectedComp = null;
  renderRaiderIoPanel();
}

async function loadPopularComps(targetEntries) {
  const myToken = popularCompsScanToken;

  let dataset;
  try {
    dataset = await loadRaiderIoDataset();
  } catch (err) {
    if (myToken !== popularCompsScanToken) return; // superseded by a newer selection — abandon silently
    popularCompsState.status = "error";
    popularCompsState.message = err.message;
    renderRaiderIoPanel();
    return;
  }
  if (myToken !== popularCompsScanToken) return;

  const dungeonSlug = getSelectedDungeonSlug();
  const comps = aggregatePopularComps(dataset, targetEntries, dungeonSlug).slice(0, RAIDER_IO.popularCompsWanted);

  popularCompsState.status = "done";
  popularCompsState.comps = comps;
  renderRaiderIoPanel();
}

// Renders the Popular Comps view — shown instead of renderRaiderIoResults()
// while the party has 0-4 slots filled. Mirrors runRaiderIoLookup's
// load-once-then-filter pattern, but triggers itself on any scope change
// instead of waiting for a button click (there's nothing to click here —
// the whole point is that it appears as soon as you've picked a spec).
function renderPopularComps(targetEntries) {
  const backRow = document.getElementById("popular-comps-back-row");
  const statusEl = document.getElementById("popular-comps-status");
  const listEl = document.getElementById("popular-comps-list");

  if (targetEntries.length === 0) {
    popularCompsScanToken++; // invalidate any load still in flight for a prior selection
    popularCompsState.status = "idle";
    popularCompsState.message = "";
    popularCompsState.comps = [];
    popularCompsState.view = "list";
    popularCompsState.selectedComp = null;
    popularCompsState.scopeKey = null;
    backRow.hidden = true;
    statusEl.textContent = "";
    statusEl.classList.remove("raiderio-status--error");
    listEl.innerHTML = '<li class="empty">Add a spec to see the most popular comps built around it.</li>';
    return;
  }

  // The selection or dungeon filter changed since these comps were computed
  // — clear them out and invalidate any load still running for the old
  // scope, same reasoning as renderRaiderIoResults' scope-change guard.
  const currentScopeKey = raiderIoScopeKey(targetEntries);
  if (popularCompsState.scopeKey !== currentScopeKey) {
    popularCompsScanToken++;
    popularCompsState.status = "idle";
    popularCompsState.message = "";
    popularCompsState.comps = [];
    popularCompsState.view = "list";
    popularCompsState.selectedComp = null;
    popularCompsState.scopeKey = currentScopeKey;
  }

  if (popularCompsState.status === "idle") {
    popularCompsState.status = "loading";
    popularCompsState.message = "Loading Raider.IO data...";
    loadPopularComps(targetEntries);
  }

  backRow.hidden = popularCompsState.view !== "detail";

  if (popularCompsState.status === "loading") {
    statusEl.textContent = popularCompsState.message;
    statusEl.classList.remove("raiderio-status--error");
    listEl.innerHTML = "";
    return;
  }
  if (popularCompsState.status === "error") {
    statusEl.textContent = popularCompsState.message;
    statusEl.classList.add("raiderio-status--error");
    listEl.innerHTML = "";
    return;
  }

  statusEl.classList.remove("raiderio-status--error");
  listEl.innerHTML = "";

  if (popularCompsState.view === "detail") {
    const comp = popularCompsState.selectedComp;
    const shown = Math.min(RAIDER_IO.resultsWanted, comp.runs.length);
    statusEl.textContent = `Showing top ${shown} of ${comp.runs.length} run(s) from ${comp.teamCount} team${
      comp.teamCount === 1 ? "" : "s"
    }.`;
    comp.runs.slice(0, RAIDER_IO.resultsWanted).forEach((ranking) => listEl.appendChild(buildRaiderIoResultRow(ranking)));
    return;
  }

  // list view
  if (popularCompsState.comps.length === 0) {
    const dungeonName = raiderIoDungeonName(getSelectedDungeonSlug());
    statusEl.textContent = `No comps found with this selection${
      dungeonName ? ` in ${dungeonName}` : ""
    } — try All Dungeons or fewer specs.`;
    listEl.innerHTML = '<li class="empty">No matching comps found.</li>';
    return;
  }
  statusEl.textContent = `${popularCompsState.comps.length} popular comp${
    popularCompsState.comps.length === 1 ? "" : "s"
  } found — click one to see its runs.`;
  const maxTeamCount = Math.max(...popularCompsState.comps.map((c) => c.teamCount));
  popularCompsState.comps.forEach((comp, i) => listEl.appendChild(buildPopularCompRow(comp, i + 1, maxTeamCount)));
}

// Dispatches the Raider.IO panel between its two mutually-exclusive modes:
// the exact-match Lookup (renderRaiderIoResults) once all 5 slots are
// filled, or the Popular Comps browser (renderPopularComps) otherwise.
// Centralizes the bits both modes share (hint text, dungeon-picker
// disabling while a load is in flight, the freshness line) so neither
// mode's renderer has to know about the other.
function renderRaiderIoPanel() {
  const targetEntries = getSelectedEntries();
  const exactMode = targetEntries.length === 5;

  document.getElementById("raiderio-exact-mode").hidden = !exactMode;
  document.getElementById("popular-comps-mode").hidden = exactMode;

  document.getElementById("raiderio-hint").textContent = exactMode
    ? "Find the highest-key logged runs that used this exact 5-player comp (roles and duplicate DPS specs must match)."
    : "See the most popular full comps built around your current picks, or fill all 5 slots to search for an exact comp.";

  if (exactMode) {
    renderRaiderIoResults();
  } else {
    renderPopularComps(targetEntries);
  }

  const loading = exactMode ? raiderIoState.status === "loading" : popularCompsState.status === "loading";
  document.querySelectorAll(".raiderio-dungeon-option").forEach((el) => {
    el.disabled = loading;
  });

  renderRaiderIoFreshness(raiderIoDataset);
}

function renderGroupBuffs() {
  const container = document.getElementById("group-buffs");
  container.innerHTML = "";

  const selected = getSelectedEntries().map((x) => x.entry);
  if (selected.length === 0) {
    container.innerHTML = '<p class="empty">Select party members to see their group buffs.</p>';
    return;
  }

  // One entry per class that brings a buff — a buff doesn't stack just
  // because two members of the same class are selected.
  const seenClasses = new Set();
  const buffs = [];
  selected.forEach((entry) => {
    if (seenClasses.has(entry.class)) return;
    seenClasses.add(entry.class);
    const buff = GROUP_BUFF_BY_CLASS[entry.class];
    if (buff) buffs.push({ entry, buff });
  });

  if (buffs.length === 0) {
    container.innerHTML = '<p class="empty">No unique group buffs in this comp yet.</p>';
    return;
  }

  const chips = document.createElement("div");
  chips.className = "cc-chips";
  buffs.forEach(({ entry, buff }) => {
    const chip = document.createElement("span");
    chip.className = "timeline-chip";
    chip.appendChild(createSpecIcon(entry, "spec-icon--timeline"));
    const label = document.createElement("span");
    label.textContent = `${buff} (${entry.class})`;
    chip.appendChild(label);
    chips.appendChild(chip);
  });
  container.appendChild(chips);
}

// Compact axis-label format for the timeline's tick marks (e.g. "1m30",
// "3m") — distinct from formatCooldown's "1 min"/"45 sec" (used for each
// mark's own duration label, matching the rest of the app's convention).
function formatTimelineTick(seconds) {
  if (seconds === 0) return "0";
  const m = Math.floor(seconds / 60);
  const s = seconds % 60;
  if (s === 0) return `${m}m`;
  return m > 0 ? `${m}m${s}` : `${s}s`;
}

// Renders DPS cooldowns as markers on an actual 0-3min (or further, if a
// selected cooldown exceeds that) track, instead of a plain grouped list —
// so overlapping/clustered burst windows are visible at a glance instead of
// requiring reading every duration. At most 3 marks ever (one per DPS slot,
// fewer if specs share a cooldown), each grouping every spec at that exact
// duration.
function renderCooldownTimeline() {
  const container = document.getElementById("cooldown-timeline");
  container.innerHTML = "";

  const dpsWithCooldowns = getSelectedEntries()
    .map((x) => x.entry)
    .filter((e) => e.role === ROLES.DPS && e.cooldownSeconds != null);

  if (dpsWithCooldowns.length === 0) {
    container.innerHTML = '<li class="empty">Select DPS specs to see their cooldown cadence.</li>';
    return;
  }

  const groups = new Map();
  dpsWithCooldowns.forEach((entry) => {
    const key = entry.cooldownSeconds;
    if (!groups.has(key)) groups.set(key, []);
    groups.get(key).push(entry);
  });

  // 180s (3min) covers every cooldown currently in data.js; stretch the
  // scale further only if a future value ever exceeds it, so a mark is
  // never plotted past the end of its own track.
  const trackMax = Math.max(180, ...groups.keys());

  const wrapper = document.createElement("li");
  wrapper.className = "timeline-visual";

  const track = document.createElement("div");
  track.className = "timeline-track";

  for (let i = 0; i <= 4; i++) {
    const seconds = Math.round((trackMax / 4) * i);
    const pct = (i / 4) * 100;
    const tick = document.createElement("div");
    tick.className = "tick";
    tick.style.left = `${pct}%`;
    track.appendChild(tick);
    const tickLabel = document.createElement("div");
    tickLabel.className = "tick-label";
    tickLabel.style.left = `${pct}%`;
    tickLabel.textContent = formatTimelineTick(seconds);
    track.appendChild(tickLabel);
  }

  [...groups.keys()]
    .sort((a, b) => a - b)
    .forEach((seconds) => {
      const entries = groups.get(seconds);
      const pct = (seconds / trackMax) * 100;

      const mark = document.createElement("div");
      mark.className = "timeline-mark";
      mark.style.left = `${pct}%`;

      const pins = document.createElement("div");
      pins.className = "timeline-pins";
      entries.forEach((entry) => {
        const pin = document.createElement("span");
        pin.className = "timeline-pin";
        pin.appendChild(createSpecIcon(entry, "spec-icon--timeline-pin"));
        pin.title = `${entry.spec} ${entry.class} (${entry.cooldownName})`;
        pins.appendChild(pin);
      });
      mark.appendChild(pins);

      const stem = document.createElement("div");
      stem.className = "timeline-stem";
      mark.appendChild(stem);

      const markLabel = document.createElement("div");
      markLabel.className = "timeline-mark-label";
      const durationEl = document.createElement("b");
      durationEl.textContent = formatCooldown(seconds);
      markLabel.appendChild(durationEl);
      entries.forEach((entry) => {
        // Full "Spec Class" text is too wide when two marks sit close
        // together on the scale (real overlap with e.g. "Augmentation
        // Evoker") — the icon + its title tooltip already carry the full
        // name, so the persistent label only needs the short tag, same as
        // the Crowd Control chips' convention.
        const nameEl = document.createElement("div");
        nameEl.textContent = entry.abbrev || specInitials(entry.spec);
        markLabel.appendChild(nameEl);
      });
      mark.appendChild(markLabel);

      track.appendChild(mark);
    });

  wrapper.appendChild(track);
  container.appendChild(wrapper);
}

function dedupeEntries(entries) {
  const seen = new Set();
  return entries.filter((e) => {
    const k = specKey(e);
    if (seen.has(k)) return false;
    seen.add(k);
    return true;
  });
}

function buildUtilityRow({ ok, label, providers, notCoveredText }) {
  const li = document.createElement("li");
  li.className = `utility-row ${ok ? "ok" : "warn"}`;

  const status = document.createElement("span");
  status.className = "status";
  status.textContent = ok ? "OK" : "!";
  li.appendChild(status);

  const labelSpan = document.createElement("span");
  labelSpan.className = "utility-label";
  labelSpan.textContent = label;
  li.appendChild(labelSpan);

  if (ok && providers && providers.length) {
    const providersWrap = document.createElement("span");
    providersWrap.className = "utility-providers";
    dedupeEntries(providers).forEach((entry) => {
      const chip = document.createElement("span");
      chip.className = "utility-provider-chip";
      chip.appendChild(createSpecIcon(entry, "spec-icon--utility"));
      const text = document.createElement("span");
      text.textContent = `${entry.spec} ${entry.class}`;
      chip.appendChild(text);
      providersWrap.appendChild(chip);
    });
    li.appendChild(providersWrap);
  } else if (notCoveredText) {
    const detail = document.createElement("span");
    detail.className = "detail";
    detail.textContent = notCoveredText;
    li.appendChild(detail);
  }

  return li;
}

// Flattens {entry, abilityMap} into one {entry, ability} pair per ability
// instance, deduping identical spec+ability pairs (e.g. 2x Fire Mage both
// having Polymorph only needs to show once).
function collectAbilityInstances(entries, abilityMap) {
  const seen = new Set();
  const instances = [];
  entries.forEach((entry) => {
    const abilities = abilityMap[specKey(entry)];
    if (!abilities) return;
    abilities.forEach((ability) => {
      const dedupeKey = `${specKey(entry)}:${ability.name}`;
      if (seen.has(dedupeKey)) return;
      seen.add(dedupeKey);
      instances.push({ entry, ability });
    });
  });
  return instances;
}

// Builds one Crowd Control section (Hard CC or AoE Disrupt): a status/label
// header, then its abilities grouped by cooldown duration — duration is the
// most prominent element of each group, with spec chips underneath it.
function buildCrowdControlSection({ label, instances, notCoveredText }) {
  const section = document.createElement("li");
  section.className = `utility-row cc-section ${instances.length > 0 ? "ok" : "warn"}`;

  const header = document.createElement("div");
  header.className = "cc-section-header";
  if (instances.length === 0) {
    const status = document.createElement("span");
    status.className = "status";
    status.textContent = "!";
    header.appendChild(status);
  }
  const labelSpan = document.createElement("span");
  labelSpan.className = "utility-label";
  labelSpan.textContent = label;
  header.appendChild(labelSpan);
  section.appendChild(header);

  if (instances.length === 0) {
    const detail = document.createElement("span");
    detail.className = "detail";
    detail.textContent = notCoveredText;
    section.appendChild(detail);
    return section;
  }

  const groups = new Map();
  instances.forEach((instance) => {
    const key = instance.ability.cooldownSeconds;
    if (!groups.has(key)) groups.set(key, []);
    groups.get(key).push(instance);
  });

  // Numeric durations ascending, "no cooldown" abilities last.
  const sortedKeys = [...groups.keys()].sort((a, b) => {
    if (a == null) return 1;
    if (b == null) return -1;
    return a - b;
  });

  const groupsWrap = document.createElement("div");
  groupsWrap.className = "cc-groups";
  sortedKeys.forEach((seconds) => {
    const group = document.createElement("div");
    group.className = "cc-duration-group";

    const duration = document.createElement("div");
    duration.className = "cc-duration";
    duration.textContent = formatAbilityCooldown(seconds);
    group.appendChild(duration);

    const chips = document.createElement("div");
    chips.className = "cc-chips";
    groups.get(seconds).forEach(({ entry, ability }) => {
      const chip = document.createElement("span");
      chip.className = "timeline-chip";
      chip.appendChild(createAbilityIcon(ability.name, "spec-icon--timeline"));
      const chipLabel = document.createElement("span");
      chipLabel.textContent = `${ability.name} (${entry.abbrev || specInitials(entry.spec)})`;
      chip.appendChild(chipLabel);
      chips.appendChild(chip);
    });
    group.appendChild(chips);

    groupsWrap.appendChild(group);
  });
  section.appendChild(groupsWrap);

  return section;
}

function renderCrowdControl() {
  const list = document.getElementById("crowd-control-check");
  list.innerHTML = "";

  const selected = getSelectedEntries().map((x) => x.entry);

  if (selected.length === 0) {
    list.innerHTML = '<li class="empty">Select specs to see crowd control coverage.</li>';
    return;
  }

  list.appendChild(
    buildCrowdControlSection({
      label: "Hard CC",
      instances: collectAbilityInstances(selected, HARD_CC_ABILITIES),
      notCoveredText: "Not covered — no strong single-target stun/incapacitate in the group.",
    })
  );

  list.appendChild(
    buildCrowdControlSection({
      label: "AoE Disrupt",
      instances: collectAbilityInstances(selected, AOE_DISRUPT_ABILITIES),
      notCoveredText: "Not covered — no group-wide stun/fear/knockback for trash pulls.",
    })
  );
}

function renderUtilityCheck() {
  const list = document.getElementById("utility-check");
  list.innerHTML = "";

  const selected = getSelectedEntries().map((x) => x.entry);

  if (selected.length === 0) {
    list.innerHTML = '<li class="empty">Select specs to see utility coverage.</li>';
    return;
  }

  const lustProviders = selected.filter((e) => LUST_SPECS.has(specKey(e)));
  const rezProviders = selected.filter((e) => BATTLE_REZ_SPECS.has(specKey(e)));

  list.appendChild(
    buildUtilityRow({
      ok: lustProviders.length > 0,
      label: "Bloodlust / Heroism-type buff",
      providers: lustProviders,
      notCoveredText: "Not covered — consider a Shaman, Mage, Hunter, or Evoker.",
    })
  );

  list.appendChild(
    buildUtilityRow({
      ok: rezProviders.length > 0,
      label: "Battle Resurrection",
      providers: rezProviders,
    })
  );

}

function render() {
  buildSlots();
  renderGroupBuffs();
  buildSpecTable();
  renderCooldownTimeline();
  renderCrowdControl();
  renderUtilityCheck();
  renderRaiderIoPanel();
}

// Attached once here rather than inside render() — unlike slot icons or
// table rows, this button is static HTML that's never rebuilt, so it never
// needs its listener re-attached.
document.getElementById("raiderio-lookup-btn").addEventListener("click", runRaiderIoLookup);
document.getElementById("popular-comps-back-btn").addEventListener("click", backToPopularCompsList);
buildRaiderIoDungeonPicker();

// Same "attached once" reasoning — the search input is static HTML. Typing
// only ever needs to rebuild the spec table, not the whole page.
document.getElementById("spec-search-input").addEventListener("input", (e) => {
  specSearchQuery = e.target.value.trim().toLowerCase();
  buildSpecTable();
});

render();
