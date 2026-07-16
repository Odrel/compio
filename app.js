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
  } else {
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
      chipLabel.textContent = `${ability.name} (${specInitials(entry.spec)})`;
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
      notCoveredText: "Not covered — consider a Death Knight or Druid.",
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
}

render();
