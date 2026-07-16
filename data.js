// Spec data for the Midnight M+ Group Composer.
//
// NOTE ON ACCURACY: Updated for WoW Midnight patch 12.0.7, researched via
// Wowhead spell pages cross-checked against Icy Veins / Method / Maxroll
// class guides for 12.0.7. A handful of values are talent-variable in-game
// (Windwalker's Zenith flexes 60/70/80/90s depending on talents; Beast
// Mastery's Bestial Wrath and Arms' Colossus Smash had conflicting numbers
// across sources) — these are marked inline and worth a manual spot-check
// if you need them pixel-perfect. Everything else here reflects the current
// patch as of the last data refresh.
//
// `icon` is the Wowhead/Blizzard icon slug (served from the public
// wow.zamimg.com icon CDN — see ICON_BASE_URL in app.js). If a slug is ever
// wrong the UI falls back to a class-colored initials badge automatically,
// so a bad slug never breaks the page.

const ROLES = {
  TANK: "Tank",
  HEALER: "Healer",
  DPS: "DPS",
};

// The site's whole color palette, applied at runtime as CSS custom
// properties (see applyTheme() in app.js) — edit any value here to reskin
// the page, no CSS editing needed. Keys match the CSS variable name minus
// the leading "--" (e.g. "bg-panel" sets --bg-panel).
const THEME = {
  "bg": "#0d0f14", // page background
  "bg-panel": "#171a22", // card/section background
  "bg-panel-alt": "#1f2430", // slightly lighter panel background (hover states, alt rows)
  "border": "#363c4d", // dividers and card borders
  "text": "#f2f1ec", // primary text
  "text-dim": "#b6bccb", // secondary/muted text
  "gold": "#f0c040", // accent color — cooldown timers, highlights
  "tank": "#5b9ee0", // Tank role color
  "healer": "#4ecb82", // Healer role color
  "dps": "#e2645f", // DPS role color
  "profile-cleave": "#4ecb82", // Damage Profile: Cleave pill
  "profile-funnel": "#b285f5", // Damage Profile: Funnel pill
  "profile-aoe": "#e2645f", // Damage Profile: AoE pill
};

// Standard WoW class colors
const CLASS_COLORS = {
  "Death Knight": "#C41F3B",
  "Demon Hunter": "#A330C9",
  "Druid": "#FF7D0A",
  "Evoker": "#33937F",
  "Hunter": "#AAD372",
  "Mage": "#3FC7EB",
  "Monk": "#00FF98",
  "Paladin": "#F48CBA",
  "Priest": "#FFFFFF",
  "Rogue": "#FFF468",
  "Shaman": "#0070DD",
  "Warlock": "#8788EE",
  "Warrior": "#C69B6D",
};

// cooldownSeconds is null for Tank/Healer specs (this tool tracks DPS burst
// cooldowns specifically), and also for Devourer's Void Metamorphosis, which
// has no fixed cooldown in 12.0.7 — it's gated by Soul Fragments instead.
//
// `damageProfile` is the spec's reputation-based M+ damage shape — Single
// Target, Cleave (strong on 2-3 targets), Funnel (hybrid: prioritizes one
// target while spreading some damage), or AoE (strong on big pulls). This is
// a general community reputation, not a hard rule — talents/gear can shift
// a spec's actual profile mid-season. null for Tank/Healer specs.
//
// `abbrev` is the short spec label shown in the Crowd Control panel's chips
// (e.g. "Blind (Sub)"). Edit these freely to whatever shorthand your group
// actually uses — nothing else in the app depends on the exact string.
const SPECS = [
  { class: "Death Knight", spec: "Blood", abbrev: "Blood", role: ROLES.TANK, cooldownName: null, cooldownSeconds: null, damageProfile: null, icon: "spell_deathknight_bloodpresence" },
  { class: "Death Knight", spec: "Frost", abbrev: "Frost", role: ROLES.DPS, cooldownName: "Pillar of Frost", cooldownSeconds: 45, damageProfile: "Cleave", icon: "spell_deathknight_frostpresence" },
  { class: "Death Knight", spec: "Unholy", abbrev: "Unholy", role: ROLES.DPS, cooldownName: "Army of the Dead", cooldownSeconds: 90, damageProfile: "AoE", icon: "spell_deathknight_unholypresence" },

  { class: "Demon Hunter", spec: "Havoc", abbrev: "Havoc", role: ROLES.DPS, cooldownName: "Metamorphosis", cooldownSeconds: 120, damageProfile: "AoE", icon: "ability_demonhunter_specdps" },
  { class: "Demon Hunter", spec: "Vengeance", abbrev: "Veng", role: ROLES.TANK, cooldownName: null, cooldownSeconds: null, damageProfile: null, icon: "ability_demonhunter_spectank" },
  { class: "Demon Hunter", spec: "Devourer", abbrev: "Devourer", role: ROLES.DPS, cooldownName: "Void Metamorphosis", cooldownSeconds: null, damageProfile: "Cleave", icon: "classicon_demonhunter_void" },

  { class: "Druid", spec: "Balance", abbrev: "Balance", role: ROLES.DPS, cooldownName: "Celestial Alignment", cooldownSeconds: 180, damageProfile: "AoE", icon: "spell_nature_starfall" },
  { class: "Druid", spec: "Feral", abbrev: "Feral", role: ROLES.DPS, cooldownName: "Berserk", cooldownSeconds: 180, damageProfile: "Funnel", icon: "ability_druid_catform" },
  { class: "Druid", spec: "Guardian", abbrev: "Guardian", role: ROLES.TANK, cooldownName: null, cooldownSeconds: null, damageProfile: null, icon: "ability_racial_bearform" },
  { class: "Druid", spec: "Restoration", abbrev: "Resto", role: ROLES.HEALER, cooldownName: null, cooldownSeconds: null, damageProfile: null, icon: "spell_nature_healingtouch" },

  { class: "Evoker", spec: "Devastation", abbrev: "Devo", role: ROLES.DPS, cooldownName: "Dragonrage", cooldownSeconds: 120, damageProfile: "AoE", icon: "classicon_evoker_devastation" },
  { class: "Evoker", spec: "Preservation", abbrev: "Pres", role: ROLES.HEALER, cooldownName: null, cooldownSeconds: null, damageProfile: null, icon: "classicon_evoker_preservation" },
  { class: "Evoker", spec: "Augmentation", abbrev: "Aug", role: ROLES.DPS, cooldownName: "Breath of Eons", cooldownSeconds: 120, damageProfile: "Funnel", icon: "classicon_evoker_augmentation" },

  // Bestial Wrath: tooltip says 90s baseline; some 12.0.7 guide summaries
  // claimed a flat 30s effective cadence via talents — worth an in-game
  // spot-check, using the tooltip value here.
  { class: "Hunter", spec: "Beast Mastery", abbrev: "BM", role: ROLES.DPS, cooldownName: "Bestial Wrath", cooldownSeconds: 90, damageProfile: "Cleave", icon: "ability_hunter_bestialdiscipline" },
  { class: "Hunter", spec: "Marksmanship", abbrev: "MM", role: ROLES.DPS, cooldownName: "Trueshot", cooldownSeconds: 120, damageProfile: "Funnel", icon: "ability_hunter_focusedaim" },
  // Coordinated Assault was replaced by Takedown in Midnight.
  { class: "Hunter", spec: "Survival", abbrev: "SV", role: ROLES.DPS, cooldownName: "Takedown", cooldownSeconds: 90, damageProfile: "Cleave", icon: "ability_hunter_camouflage" },

  { class: "Mage", spec: "Arcane", abbrev: "Arcane", role: ROLES.DPS, cooldownName: "Arcane Surge", cooldownSeconds: 90, damageProfile: "Funnel", icon: "spell_holy_magicalsentry" },
  { class: "Mage", spec: "Fire", abbrev: "Fire", role: ROLES.DPS, cooldownName: "Combustion", cooldownSeconds: 60, damageProfile: "AoE", icon: "spell_fire_firebolt02" },
  // Icy Veins was removed in Midnight and replaced by Ray of Frost as Frost's
  // signature cooldown, tied to the new Freezing mechanic.
  { class: "Mage", spec: "Frost", abbrev: "Frost", role: ROLES.DPS, cooldownName: "Ray of Frost", cooldownSeconds: 60, damageProfile: "Cleave", icon: "spell_frost_frostbolt02" },

  { class: "Monk", spec: "Brewmaster", abbrev: "Brew", role: ROLES.TANK, cooldownName: null, cooldownSeconds: null, damageProfile: null, icon: "spell_monk_brewmaster_spec" },
  // Storm, Earth, and Fire was replaced by Zenith. Base cooldown flexes
  // 60/70/80/90s by talent choice — 90s used here as the untalented default.
  { class: "Monk", spec: "Windwalker", abbrev: "WW", role: ROLES.DPS, cooldownName: "Zenith", cooldownSeconds: 90, damageProfile: "Funnel", icon: "spell_monk_windwalker_spec" },
  { class: "Monk", spec: "Mistweaver", abbrev: "MW", role: ROLES.HEALER, cooldownName: null, cooldownSeconds: null, damageProfile: null, icon: "spell_monk_mistweaver_spec" },

  { class: "Paladin", spec: "Holy", abbrev: "Holy", role: ROLES.HEALER, cooldownName: null, cooldownSeconds: null, damageProfile: null, icon: "spell_holy_holybolt" },
  { class: "Paladin", spec: "Protection", abbrev: "Prot", role: ROLES.TANK, cooldownName: null, cooldownSeconds: null, damageProfile: null, icon: "ability_paladin_shieldofthetemplar" },
  { class: "Paladin", spec: "Retribution", abbrev: "Ret", role: ROLES.DPS, cooldownName: "Avenging Wrath", cooldownSeconds: 120, damageProfile: "Cleave", icon: "spell_holy_auraoflight" },

  { class: "Priest", spec: "Discipline", abbrev: "Disc", role: ROLES.HEALER, cooldownName: null, cooldownSeconds: null, damageProfile: null, icon: "spell_holy_powerwordshield" },
  { class: "Priest", spec: "Holy", abbrev: "Holy", role: ROLES.HEALER, cooldownName: null, cooldownSeconds: null, damageProfile: null, icon: "spell_holy_guardianspirit" },
  // Dark Ascension was replaced by Voidform as Shadow's signature cooldown.
  { class: "Priest", spec: "Shadow", abbrev: "Shadow", role: ROLES.DPS, cooldownName: "Voidform", cooldownSeconds: 120, damageProfile: "AoE", icon: "spell_shadow_shadowwordpain" },

  // Vendetta was renamed Deathmark in Midnight.
  { class: "Rogue", spec: "Assassination", abbrev: "Assa", role: ROLES.DPS, cooldownName: "Deathmark", cooldownSeconds: 120, damageProfile: "Funnel", icon: "ability_rogue_deadlybrew" },
  { class: "Rogue", spec: "Outlaw", abbrev: "Outlaw", role: ROLES.DPS, cooldownName: "Adrenaline Rush", cooldownSeconds: 180, damageProfile: "Cleave", icon: "ability_rogue_waylay" },
  { class: "Rogue", spec: "Subtlety", abbrev: "Sub", role: ROLES.DPS, cooldownName: "Shadow Blades", cooldownSeconds: 90, damageProfile: "Funnel", icon: "ability_stealth" },

  // Fire Elemental was replaced by Ascendance as Elemental's cooldown.
  { class: "Shaman", spec: "Elemental", abbrev: "Ele", role: ROLES.DPS, cooldownName: "Ascendance", cooldownSeconds: 180, damageProfile: "AoE", icon: "spell_nature_lightning" },
  // Feral Spirit was replaced by Doom Winds as Enhancement's signature cooldown.
  { class: "Shaman", spec: "Enhancement", abbrev: "Enh", role: ROLES.DPS, cooldownName: "Doom Winds", cooldownSeconds: 60, damageProfile: "Cleave", icon: "spell_shaman_improvedstormstrike" },
  { class: "Shaman", spec: "Restoration", abbrev: "Resto", role: ROLES.HEALER, cooldownName: null, cooldownSeconds: null, damageProfile: null, icon: "spell_nature_magicimmunity" },

  { class: "Warlock", spec: "Affliction", abbrev: "Aff", role: ROLES.DPS, cooldownName: "Summon Darkglare", cooldownSeconds: 120, damageProfile: "Funnel", icon: "spell_shadow_deathcoil" },
  { class: "Warlock", spec: "Demonology", abbrev: "Demo", role: ROLES.DPS, cooldownName: "Summon Demonic Tyrant", cooldownSeconds: 60, damageProfile: "AoE", icon: "spell_shadow_metamorphosis" },
  { class: "Warlock", spec: "Destruction", abbrev: "Destro", role: ROLES.DPS, cooldownName: "Summon Infernal", cooldownSeconds: 120, damageProfile: "AoE", icon: "spell_shadow_rainoffire" },

  // Avatar lost its follow-on talents in Midnight and is now a minor
  // cooldown; Colossus Smash (synced with Avatar via Anger Management) is
  // Arms' real signature burst button now. Exact base CD unconfirmed across
  // sources — 45s used here, worth an in-game spot-check.
  { class: "Warrior", spec: "Arms", abbrev: "Arms", role: ROLES.DPS, cooldownName: "Colossus Smash", cooldownSeconds: 45, damageProfile: "Cleave", icon: "ability_warrior_savageblow" },
  { class: "Warrior", spec: "Fury", abbrev: "Fury", role: ROLES.DPS, cooldownName: "Recklessness", cooldownSeconds: 90, damageProfile: "AoE", icon: "ability_warrior_innerrage" },
  { class: "Warrior", spec: "Protection", abbrev: "Prot", role: ROLES.TANK, cooldownName: null, cooldownSeconds: null, damageProfile: null, icon: "ability_warrior_defensivestance" },
];

// Which specs bring a raid-wide haste/lust-type cooldown. Unchanged in 12.0.7.
const LUST_SPECS = new Set([
  "Shaman:Elemental", "Shaman:Enhancement", "Shaman:Restoration", // Bloodlust
  "Mage:Arcane", "Mage:Fire", "Mage:Frost", // Time Warp
  "Hunter:Beast Mastery", "Hunter:Marksmanship", "Hunter:Survival", // Primal Rage (via pet)
  "Evoker:Devastation", "Evoker:Preservation", "Evoker:Augmentation", // Fury of the Aspects
]);

// Which specs bring a battle resurrection. All 4 classes draw from the same
// shared combat-rez charge pool. Paladin (Intercession) and Warlock
// (Soulstone, must be pre-cast on the target before they die) were missing
// from the pre-Midnight version of this data.
const BATTLE_REZ_SPECS = new Set([
  "Death Knight:Frost", "Death Knight:Unholy", "Death Knight:Blood", // Raise Ally
  "Druid:Balance", "Druid:Feral", "Druid:Guardian", "Druid:Restoration", // Rebirth
  "Paladin:Holy", "Paladin:Protection", "Paladin:Retribution", // Intercession
  "Warlock:Affliction", "Warlock:Demonology", "Warlock:Destruction", // Soulstone
]);

// Class-wide raid utility buff/debuff effect, keyed by class name — shown as
// the effect (e.g. "+3% Vers") rather than the ability name, per current
// Wowhead tooltips for 12.0.7. A few of these (Chaos Brand, Mystic Touch)
// are damage-taken debuffs on enemies rather than ally buffs, but are
// tracked here the same way since they fill the same "bring one of these"
// raid-utility slot.
const GROUP_BUFF_BY_CLASS = {
  "Death Knight": null,
  "Demon Hunter": "+3% Magic Dmg Taken", // Chaos Brand
  "Druid": "+3% Vers", // Mark of the Wild
  "Evoker": "-15% Movement CD", // Blessing of the Bronze
  "Hunter": null,
  "Mage": "+3% Int", // Arcane Intellect
  "Monk": "+5% Phys Dmg Taken", // Mystic Touch
  "Paladin": null,
  "Priest": "+5% Stam", // Power Word: Fortitude
  "Rogue": null,
  "Shaman": "+2% Mastery", // Skyfury
  "Warlock": null,
  "Warrior": "+5% AP", // Battle Shout
};

// Specs that bring a strong single-target hard CC (stun, incapacitate), with
// each ability's name and cooldown. A spec can list more than one ability.
// cooldownSeconds is null for abilities that are cast on demand with no real
// cooldown (just the GCD / a resource cost). Researched for 12.0.7 — Paladin
// notably lost Repentance in the Midnight pre-patch, leaving Hammer of
// Justice as its only hard CC.
const HARD_CC_ABILITIES = {
  "Death Knight:Blood": [{ name: "Asphyxiate", cooldownSeconds: 45 }],
  "Death Knight:Frost": [{ name: "Asphyxiate", cooldownSeconds: 45 }],
  "Death Knight:Unholy": [{ name: "Asphyxiate", cooldownSeconds: 45 }],
  "Demon Hunter:Havoc": [{ name: "Imprison", cooldownSeconds: 45 }],
  "Demon Hunter:Vengeance": [{ name: "Imprison", cooldownSeconds: 45 }],
  "Demon Hunter:Devourer": [{ name: "Imprison", cooldownSeconds: 45 }],
  "Druid:Balance": [{ name: "Cyclone", cooldownSeconds: null }],
  "Druid:Feral": [
    { name: "Cyclone", cooldownSeconds: null },
    { name: "Maim", cooldownSeconds: null },
  ],
  "Druid:Guardian": [{ name: "Cyclone", cooldownSeconds: null }],
  "Druid:Restoration": [{ name: "Cyclone", cooldownSeconds: null }],
  "Evoker:Devastation": [{ name: "Sleep Walk", cooldownSeconds: null }],
  "Evoker:Preservation": [{ name: "Sleep Walk", cooldownSeconds: null }],
  "Evoker:Augmentation": [{ name: "Sleep Walk", cooldownSeconds: null }],
  "Hunter:Beast Mastery": [
    { name: "Freezing Trap", cooldownSeconds: null },
    { name: "Intimidation", cooldownSeconds: 60 },
  ],
  "Hunter:Marksmanship": [
    { name: "Freezing Trap", cooldownSeconds: null },
    { name: "Intimidation", cooldownSeconds: 60 },
  ],
  "Hunter:Survival": [
    { name: "Freezing Trap", cooldownSeconds: null },
    { name: "Intimidation", cooldownSeconds: 60 },
  ],
  "Mage:Arcane": [{ name: "Polymorph", cooldownSeconds: null }],
  "Mage:Fire": [{ name: "Polymorph", cooldownSeconds: null }],
  "Mage:Frost": [{ name: "Polymorph", cooldownSeconds: null }],
  "Monk:Brewmaster": [{ name: "Paralysis", cooldownSeconds: 45 }],
  "Monk:Windwalker": [{ name: "Paralysis", cooldownSeconds: 45 }],
  "Monk:Mistweaver": [{ name: "Paralysis", cooldownSeconds: 45 }],
  // Repentance was removed class-wide in the Midnight pre-patch.
  "Paladin:Holy": [{ name: "Hammer of Justice", cooldownSeconds: 45 }],
  "Paladin:Protection": [{ name: "Hammer of Justice", cooldownSeconds: 45 }],
  "Paladin:Retribution": [{ name: "Hammer of Justice", cooldownSeconds: 45 }],
  "Priest:Discipline": [{ name: "Holy Word: Chastise", cooldownSeconds: 60 }],
  "Priest:Holy": [{ name: "Holy Word: Chastise", cooldownSeconds: 60 }],
  "Priest:Shadow": [
    { name: "Holy Word: Chastise", cooldownSeconds: 60 },
    { name: "Mind Control", cooldownSeconds: null },
  ],
  "Rogue:Assassination": [
    { name: "Blind", cooldownSeconds: 120 },
    { name: "Sap", cooldownSeconds: null },
  ],
  "Rogue:Outlaw": [
    { name: "Blind", cooldownSeconds: 120 },
    { name: "Sap", cooldownSeconds: null },
  ],
  "Rogue:Subtlety": [
    { name: "Blind", cooldownSeconds: 120 },
    { name: "Sap", cooldownSeconds: null },
  ],
  "Shaman:Elemental": [{ name: "Hex", cooldownSeconds: 30 }],
  "Shaman:Enhancement": [{ name: "Hex", cooldownSeconds: 30 }],
  "Shaman:Restoration": [{ name: "Hex", cooldownSeconds: 30 }],
  "Warlock:Affliction": [
    { name: "Fear", cooldownSeconds: null },
    { name: "Mortal Coil", cooldownSeconds: 45 },
  ],
  "Warlock:Demonology": [
    { name: "Fear", cooldownSeconds: null },
    { name: "Mortal Coil", cooldownSeconds: 45 },
  ],
  "Warlock:Destruction": [
    { name: "Fear", cooldownSeconds: null },
    { name: "Mortal Coil", cooldownSeconds: 45 },
  ],
  "Warrior:Arms": [{ name: "Storm Bolt", cooldownSeconds: 30 }],
  "Warrior:Fury": [{ name: "Storm Bolt", cooldownSeconds: 30 }],
  "Warrior:Protection": [{ name: "Storm Bolt", cooldownSeconds: 30 }],
};

// Specs that bring an AoE disrupt (stun/fear/knockback hitting a group —
// useful on trash pulls), with each ability's name and cooldown. A spec can
// list more than one ability. Researched for 12.0.7 — Rogue and Death Knight
// have no baseline AoE disrupt option (Death Knight's Blinding Sleet below
// is the one exception, added baseline across all 3 specs).
const AOE_DISRUPT_ABILITIES = {
  "Death Knight:Blood": [{ name: "Blinding Sleet", cooldownSeconds: 60 }],
  "Death Knight:Frost": [{ name: "Blinding Sleet", cooldownSeconds: 60 }],
  "Death Knight:Unholy": [{ name: "Blinding Sleet", cooldownSeconds: 60 }],
  "Demon Hunter:Havoc": [
    { name: "Chaos Nova", cooldownSeconds: 45 },
    { name: "Sigil of Misery", cooldownSeconds: 120 },
  ],
  "Demon Hunter:Vengeance": [
    { name: "Chaos Nova", cooldownSeconds: 45 },
    { name: "Sigil of Misery", cooldownSeconds: 120 },
  ],
  "Demon Hunter:Devourer": [
    { name: "Void Nova", cooldownSeconds: 45 },
    { name: "Sigil of Misery", cooldownSeconds: 120 },
  ],
  "Druid:Balance": [
    { name: "Typhoon", cooldownSeconds: 30 },
    { name: "Incapacitating Roar", cooldownSeconds: 30 },
  ],
  "Druid:Feral": [
    { name: "Typhoon", cooldownSeconds: 30 },
    { name: "Incapacitating Roar", cooldownSeconds: 30 },
  ],
  "Druid:Guardian": [
    { name: "Typhoon", cooldownSeconds: 30 },
    { name: "Incapacitating Roar", cooldownSeconds: 30 },
  ],
  "Druid:Restoration": [
    { name: "Typhoon", cooldownSeconds: 30 },
    { name: "Incapacitating Roar", cooldownSeconds: 30 },
  ],
  "Evoker:Devastation": [
    { name: "Deep Breath", cooldownSeconds: 120 },
    { name: "Tail Swipe", cooldownSeconds: 180 },
  ],
  "Evoker:Preservation": [{ name: "Deep Breath", cooldownSeconds: 120 }],
  "Evoker:Augmentation": [{ name: "Deep Breath", cooldownSeconds: 120 }],
  "Hunter:Beast Mastery": [{ name: "Binding Shot", cooldownSeconds: 45 }],
  "Hunter:Marksmanship": [{ name: "Binding Shot", cooldownSeconds: 45 }],
  "Hunter:Survival": [{ name: "Binding Shot", cooldownSeconds: 45 }],
  "Mage:Arcane": [
    { name: "Ring of Frost", cooldownSeconds: 45 },
    { name: "Dragon's Breath", cooldownSeconds: 45 },
  ],
  "Mage:Fire": [
    { name: "Ring of Frost", cooldownSeconds: 45 },
    { name: "Dragon's Breath", cooldownSeconds: 45 },
  ],
  "Mage:Frost": [
    { name: "Ring of Frost", cooldownSeconds: 45 },
    { name: "Dragon's Breath", cooldownSeconds: 45 },
  ],
  "Monk:Brewmaster": [
    { name: "Leg Sweep", cooldownSeconds: 60 },
    { name: "Ring of Peace", cooldownSeconds: 45 },
  ],
  "Monk:Windwalker": [
    { name: "Leg Sweep", cooldownSeconds: 60 },
    { name: "Ring of Peace", cooldownSeconds: 45 },
  ],
  "Monk:Mistweaver": [
    { name: "Leg Sweep", cooldownSeconds: 60 },
    { name: "Ring of Peace", cooldownSeconds: 45 },
  ],
  "Paladin:Holy": [{ name: "Blinding Light", cooldownSeconds: 90 }],
  "Paladin:Protection": [{ name: "Blinding Light", cooldownSeconds: 90 }],
  "Paladin:Retribution": [{ name: "Blinding Light", cooldownSeconds: 90 }],
  "Priest:Discipline": [{ name: "Psychic Scream", cooldownSeconds: 40 }],
  "Priest:Holy": [{ name: "Psychic Scream", cooldownSeconds: 40 }],
  "Priest:Shadow": [{ name: "Psychic Scream", cooldownSeconds: 40 }],
  "Shaman:Elemental": [{ name: "Capacitor Totem", cooldownSeconds: 60 }],
  "Shaman:Enhancement": [{ name: "Capacitor Totem", cooldownSeconds: 60 }],
  // Thunderstorm is Elemental/Enhancement only in Midnight — Restoration no
  // longer has access to it, so Capacitor Totem is its only AoE disrupt.
  "Shaman:Restoration": [{ name: "Capacitor Totem", cooldownSeconds: 60 }],
  "Warlock:Affliction": [{ name: "Shadowfury", cooldownSeconds: 60 }],
  "Warlock:Demonology": [{ name: "Shadowfury", cooldownSeconds: 60 }],
  "Warlock:Destruction": [{ name: "Shadowfury", cooldownSeconds: 60 }],
  "Warrior:Arms": [
    { name: "Shockwave", cooldownSeconds: 40 },
    { name: "Intimidating Shout", cooldownSeconds: 90 },
  ],
  "Warrior:Fury": [
    { name: "Shockwave", cooldownSeconds: 40 },
    { name: "Intimidating Shout", cooldownSeconds: 90 },
  ],
  "Warrior:Protection": [
    { name: "Shockwave", cooldownSeconds: 40 },
    { name: "Intimidating Shout", cooldownSeconds: 90 },
  ],
};

// Wowhead icon slug for every ability referenced in HARD_CC_ABILITIES /
// AOE_DISRUPT_ABILITIES, keyed by ability name — used to show the actual
// spell icon (rather than the caster's spec icon) in the Crowd Control
// panel. Same fallback-safe CDN as the spec icons (see ICON_BASE_URL in
// app.js): a wrong/renamed slug just falls back to an initials badge.
const ABILITY_ICONS = {
  "Asphyxiate": "ability_deathknight_asphixiate",
  "Imprison": "ability_demonhunter_imprison",
  "Cyclone": "spell_nature_earthbind",
  "Maim": "ability_druid_mangle-tga",
  "Sleep Walk": "ability_xavius_dreamsimulacrum",
  "Freezing Trap": "spell_frost_chainsofice",
  "Intimidation": "ability_devour",
  "Polymorph": "spell_nature_polymorph",
  "Paralysis": "ability_monk_paralysis",
  "Hammer of Justice": "spell_holy_sealofmight",
  "Holy Word: Chastise": "spell_holy_chastise",
  "Mind Control": "spell_shadow_shadowworddominate",
  "Blind": "spell_shadow_mindsteal",
  "Sap": "ability_sap",
  "Hex": "spell_shaman_hex",
  "Fear": "spell_shadow_possession",
  "Mortal Coil": "ability_warlock_mortalcoil",
  "Storm Bolt": "warrior_talent_icon_stormbolt",
  "Blinding Sleet": "spell_frost_chillingblast",
  "Chaos Nova": "spell_fire_felfirenova",
  "Void Nova": "inv_12_voiddh_ability_voidnova",
  "Sigil of Misery": "ability_demonhunter_sigilofmisery",
  "Typhoon": "ability_druid_typhoon",
  "Incapacitating Roar": "ability_druid_demoralizingroar",
  "Deep Breath": "ability_evoker_deepbreath",
  "Tail Swipe": "ability_racial_tailswipe",
  "Binding Shot": "spell_shaman_bindelemental",
  "Ring of Frost": "spell_frost_ring-of-frost",
  "Dragon's Breath": "inv_misc_head_dragon_01",
  "Leg Sweep": "ability_monk_legsweep",
  "Ring of Peace": "spell_monk_ringofpeace",
  "Blinding Light": "ability_paladin_blindinglight",
  "Psychic Scream": "spell_shadow_psychicscream",
  "Capacitor Totem": "spell_nature_brilliance",
  "Shadowfury": "ability_warlock_shadowfurytga",
  "Shockwave": "ability_warrior_shockwave",
  "Intimidating Shout": "ability_golemthunderclap",
};

function specKey(entry) {
  return `${entry.class}:${entry.spec}`;
}

// Config for the Raider.IO Lookup panel (see runRaiderIoLookup() etc. in
// app.js). Calls raider.io's public Mythic+ Runs API directly from the
// browser — confirmed CORS is open and no API key is needed at this volume.
//
// `season` is raider.io's slug for the CURRENT season and WILL GO STALE —
// raider.io does not auto-roll this. Next expected rollover: season-mn-2
// around 2026-12-16. If lookups start returning 0 results across many
// different comps, check this value first.
//
// `dungeon.icon_url` values returned by the API are relative paths (e.g.
// "/images/wow/icons/large/xyz.jpg") — they must be prefixed with
// `iconCdnBase`, not `apiBase`'s host (verified: raider.io's own host 404s
// on that path, cdn.raiderio.net serves it).
//
// `runUrlBase` builds an unofficial, undocumented run-page URL pattern
// (`{runUrlBase}/{season}/{keystone_run_id}-{dungeon.slug}`) — raider.io's
// API doesn't return a run URL directly. Verified working against a real
// run, but could break if raider.io changes their routing.
const RAIDER_IO = {
  apiBase: "https://raider.io/api/v1/mythic-plus/runs",
  iconCdnBase: "https://cdn.raiderio.net",
  runUrlBase: "https://raider.io/mythic-plus-runs",
  season: "season-mn-1",
  region: "world", // combines all regions, maximizes match chances
  affixes: "all", // whole season, not just the current week
  resultsWanted: 5,
  // 40 pages x 20 runs/page = 800 runs scanned max. Raider.io itself caps
  // unauthenticated pagination at 100 pages — never raise this above that.
  maxPagesToScan: 40,
  requestDelayMs: 150, // spacing between sequential page requests, stays well under 200 req/min
  maxRetries: 2,
  retryBaseDelayMs: 1000,
};
