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
      icon.textContent = slotDef.label[0];
      caption.textContent = "Empty";
    }

    slotEl.appendChild(label);
    slotEl.appendChild(icon);
    slotEl.appendChild(caption);

    if (entry && entry.damageProfile) {
      const pill = document.createElement("span");
      pill.className = `damage-profile-pill ${entry.damageProfile}`;
      pill.textContent = entry.damageProfile;
      slotEl.appendChild(pill);
    }

    container.appendChild(slotEl);
  });
}

const ROLE_TABLE_ORDER = [ROLES.TANK, ROLES.HEALER, ROLES.DPS];

function buildSpecTable() {
  const tbody = document.getElementById("spec-table-body");
  tbody.innerHTML = "";

  ROLE_TABLE_ORDER.forEach((role) => {
    const full = isRoleFull(role);
    if (roleWasFull[role] !== full) {
      collapsedOverride[role] = undefined;
      roleWasFull[role] = full;
    }
    const collapsed = collapsedOverride[role] !== undefined ? collapsedOverride[role] : full;

    const filledCount = SLOT_DEFS.filter((s) => s.role === role && selection[s.id] != null).length;
    const totalCount = SLOT_DEFS.filter((s) => s.role === role).length;

    const groupRow = document.createElement("tr");
    groupRow.className = "role-group-row";
    const groupCell = document.createElement("td");
    groupCell.colSpan = 9;

    const chevron = document.createElement("span");
    chevron.className = "role-group-chevron";
    chevron.textContent = collapsed ? "▸" : "▾";

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

    const specsInRole = SPECS.filter((s) => s.role === role).sort((a, b) => a.class.localeCompare(b.class));

    specsInRole.forEach((entry) => {
      const key = specKey(entry);
      const selectedCount = countSelectedKey(key);
      const row = document.createElement("tr");
      row.dataset.key = key;
      if (collapsed) row.classList.add("row-collapsed");
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
        const pill = document.createElement("span");
        pill.className = `damage-profile-pill ${entry.damageProfile}`;
        pill.textContent = entry.damageProfile;
        damageProfileCell.appendChild(pill);
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

// Raider.IO Lookup panel state — the only async/network feature in this
// app, so it gets its own small state machine rather than fitting the
// synchronous "derive everything from `selection`" pattern used elsewhere.
const raiderIoState = {
  status: "idle", // "idle" | "scanning" | "done" | "error"
  message: "",
  results: [],
  scopeKey: null, // fingerprint of the comp + selected dungeon these results/status belong to
};
// Bumped whenever the comp or dungeon filter changes, so an in-flight scan
// for a stale scope can detect it's been superseded and stop touching
// shared state, without needing real fetch-cancellation.
let raiderIoScanToken = 0;

// A fingerprint of "what these Raider.IO results are for" — the comp plus
// the selected dungeon filter. Widening this (vs. comp alone) is what makes
// changing only the dungeon filter correctly invalidate stale results too.
function raiderIoScopeKey(targetEntries) {
  return `${compFingerprint(targetEntries)}::${getSelectedDungeonSlug()}`;
}

function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function getSelectedDungeonSlug() {
  return document.getElementById("raiderio-dungeon-select").value;
}

function raiderIoDungeonName(slug) {
  if (slug === "all") return null;
  return RAIDER_IO_DUNGEONS.find((d) => d.slug === slug)?.name || slug;
}

function populateRaiderIoDungeonSelect() {
  const select = document.getElementById("raiderio-dungeon-select");
  const allOption = document.createElement("option");
  allOption.value = "all";
  allOption.textContent = "All Dungeons";
  select.appendChild(allOption);

  RAIDER_IO_DUNGEONS.forEach((dungeon) => {
    const option = document.createElement("option");
    option.value = dungeon.slug;
    option.textContent = dungeon.name;
    select.appendChild(option);
  });
}

function buildRaiderIoQueryUrl(page, dungeonSlug) {
  const params = new URLSearchParams({
    season: RAIDER_IO.season,
    region: RAIDER_IO.region,
    dungeon: dungeonSlug,
    affixes: RAIDER_IO.affixes,
    page: String(page),
  });
  return `${RAIDER_IO.apiBase}?${params}`;
}

async function fetchRaiderIoPageWithRetry(page, myToken, dungeonSlug) {
  const url = buildRaiderIoQueryUrl(page, dungeonSlug);
  for (let attempt = 0; attempt <= RAIDER_IO.maxRetries; attempt++) {
    let response;
    try {
      response = await fetch(url);
    } catch (networkErr) {
      if (attempt === RAIDER_IO.maxRetries) {
        throw new Error("Could not reach Raider.IO — check your connection and try again.");
      }
      await sleep(RAIDER_IO.retryBaseDelayMs * (attempt + 1));
      continue;
    }

    if (response.status === 429) {
      if (attempt === RAIDER_IO.maxRetries) {
        throw new Error("Raider.IO rate limit hit — try again in a minute.");
      }
      if (myToken === raiderIoScanToken) {
        raiderIoState.message = `Rate limited by Raider.IO, retrying (${attempt + 1}/${RAIDER_IO.maxRetries})...`;
        renderRaiderIoResults();
      }
      await sleep(RAIDER_IO.retryBaseDelayMs * (attempt + 1));
      continue;
    }

    if (!response.ok) {
      throw new Error(`Raider.IO returned an error (HTTP ${response.status}).`);
    }

    const data = await response.json();
    return Array.isArray(data.rankings) ? data.rankings : [];
  }
  return [];
}

async function runRaiderIoLookup() {
  if (raiderIoState.status === "scanning") return; // overlapping-scan guard

  const targetEntries = getSelectedEntries();
  if (targetEntries.length !== 5) return; // defensive; button should already be disabled

  const selectedDungeon = getSelectedDungeonSlug();
  const dungeonName = raiderIoDungeonName(selectedDungeon);
  const dungeonPhrase = dungeonName ? ` in ${dungeonName}` : "";

  raiderIoScanToken++;
  const myToken = raiderIoScanToken;

  raiderIoState.status = "scanning";
  raiderIoState.results = [];
  raiderIoState.scopeKey = raiderIoScopeKey(targetEntries);
  raiderIoState.message = "Starting scan...";
  renderRaiderIoResults();

  let runsChecked = 0;
  try {
    for (let page = 0; page < RAIDER_IO.maxPagesToScan; page++) {
      const rankings = await fetchRaiderIoPageWithRetry(page, myToken, selectedDungeon);
      if (myToken !== raiderIoScanToken) return; // superseded by a newer scan — abandon silently

      if (rankings.length === 0) break; // ran out of data before hitting the page cap

      runsChecked += rankings.length;
      rankings.forEach((ranking) => {
        if (raiderIoState.results.length >= RAIDER_IO.resultsWanted) return;
        if (rosterMatchesComp(ranking.run.roster, targetEntries)) {
          raiderIoState.results.push(ranking);
        }
      });

      raiderIoState.message = `Checked ${runsChecked} runs${dungeonPhrase} across ${page + 1} page(s)... ${raiderIoState.results.length} match(es) found.`;
      renderRaiderIoResults();

      if (raiderIoState.results.length >= RAIDER_IO.resultsWanted) break;

      await sleep(RAIDER_IO.requestDelayMs);
      if (myToken !== raiderIoScanToken) return;
    }
  } catch (err) {
    if (myToken !== raiderIoScanToken) return;
    raiderIoState.status = "error";
    raiderIoState.message = err.message;
    renderRaiderIoResults();
    return;
  }

  if (myToken !== raiderIoScanToken) return;
  raiderIoState.status = "done";
  raiderIoState.message = raiderIoState.results.length
    ? `Found ${raiderIoState.results.length} matching run(s)${dungeonPhrase} out of ${runsChecked} scanned.`
    : `No matching runs found${dungeonPhrase} in ${runsChecked} runs scanned — this comp may just be rare${
        dungeonName ? " in this dungeon, try All Dungeons for better odds" : ""
      }, or try again later.`;
  renderRaiderIoResults();
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
// comment on RAIDER_IO.runUrlBase in data.js.
function buildRunUrl(run) {
  return `${RAIDER_IO.runUrlBase}/${run.season}/${run.keystone_run_id}-${run.dungeon.slug}`;
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

  const header = document.createElement("div");
  header.className = "raiderio-result-header";

  const dungeonIcon = document.createElement("img");
  dungeonIcon.className = "raiderio-dungeon-icon";
  dungeonIcon.src = `${RAIDER_IO.iconCdnBase}${run.dungeon.icon_url}`;
  dungeonIcon.alt = run.dungeon.name;
  dungeonIcon.loading = "lazy";
  dungeonIcon.addEventListener("error", () => dungeonIcon.remove());
  header.appendChild(dungeonIcon);

  const dungeonName = document.createElement("span");
  dungeonName.className = "raiderio-dungeon-name";
  dungeonName.textContent = run.dungeon.name;
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
      const chip = document.createElement("span");
      chip.className = "utility-provider-chip";
      chip.appendChild(createSpecIcon(entry, "spec-icon--utility"));
      const text = document.createElement("span");
      text.textContent = `${entry.spec} ${entry.class}`;
      chip.appendChild(text);
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
  btn.disabled = !allFilled || raiderIoState.status === "scanning";
  btn.textContent = raiderIoState.status === "scanning" ? "Scanning..." : "Look up highest keys with this comp";

  const dungeonSelect = document.getElementById("raiderio-dungeon-select");
  dungeonSelect.disabled = raiderIoState.status === "scanning";

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

  const sortedKeys = [...groups.keys()].sort((a, b) => a - b);
  sortedKeys.forEach((seconds) => {
    const entries = groups.get(seconds);

    const group = document.createElement("li");
    group.className = "cc-duration-group";

    const duration = document.createElement("div");
    duration.className = "cc-duration";
    duration.textContent = formatCooldown(seconds);
    group.appendChild(duration);

    const chips = document.createElement("div");
    chips.className = "cc-chips";
    entries.forEach((entry) => {
      const chip = document.createElement("span");
      chip.className = "timeline-chip";
      chip.appendChild(createSpecIcon(entry, "spec-icon--timeline"));
      const label = document.createElement("span");
      label.textContent = `${entry.spec} ${entry.class} (${entry.cooldownName})`;
      chip.appendChild(label);
      chips.appendChild(chip);
    });
    group.appendChild(chips);

    container.appendChild(group);
  });
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
  renderRaiderIoResults();
}

// Attached once here rather than inside render() — unlike slot icons or
// table rows, this button and select are static HTML that's never rebuilt,
// so they never need their listeners re-attached.
document.getElementById("raiderio-lookup-btn").addEventListener("click", runRaiderIoLookup);
document.getElementById("raiderio-dungeon-select").addEventListener("change", renderRaiderIoResults);
populateRaiderIoDungeonSelect();

render();
