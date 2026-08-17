# Skoop's Comp Master

Mythic+ group planner for WoW: Midnight - build a 5-player comp, see how your CDs line up, check your buffs and CC coverage, and look up the highest logged keys for it.

**[Live site →](https://odrel.github.io/compio/)**

## Features

| | |
|---|---|
| **Party builder** | Click specs into Tank / Healer / DPS ×3 slots. Duplicates allowed (2× Fire Mage works). |
| **Spec table** | Damage profile, cooldown, Bloodlust, Battle Rez, group buff, hard CC, AoE disrupt - one table, sortable by role. |
| **Party-aware search** | Filters as you type. A full role never shows results, so you can't search into an invalid comp. |
| **Live coverage panels** | Cooldown Timeline / Crowd Control / Utility Check update as you fill slots. |
| **Raider.IO Lookup** | Highest keys logged with your exact comp, filterable by dungeon, linked to real player profiles. |

## How it works

Static site: HTML/CSS/JS, no build step, no framework, no dependencies. Served free by GitHub Pages.

The Raider.IO panel never calls Raider.IO from your browser. A [GitHub Action](.github/workflows/update-raiderio-cache.yml) refreshes `raiderio-cache.json.gz` every 6h; the browser fetches that one file once per session and filters it client-side - near-instant lookups, no backend to run.

## Keeping data current

- **Class/spec balance** → [`data.js`](data.js) (accuracy note at the top says what's verified against which patch)
- **Dungeon rotation / season** → `RAIDER_IO_DUNGEONS` in `data.js` + `DUNGEON_SLUGS` in `scripts/fetch-raiderio-cache.js` - update both together at every season rollover

## Built with AI

Built with [Claude Code](https://claude.com/claude-code): app, caching architecture, and this README. `data.js` is spot-checked against patch notes via AI-assisted research, not firsthand play - treat exact numbers as worth a second look.

## Running locally

```bash
python -m http.server 8000
```

Open `http://localhost:8000`. Raider.IO Lookup uses whichever `raiderio-cache.json.gz` is already in the repo - it doesn't regenerate locally.

## Structure

| Path | What |
|---|---|
| `index.html` / `app.js` / `styles.css` | The app |
| `data.js` | Game data: specs, dungeons, abilities |
| `scripts/fetch-raiderio-cache.js` | Cache builder |
| `.github/workflows/` | Scheduled refresh |
| `raiderio-cache.json.gz` | Committed, auto-refreshed dataset |

## Credits

Idea by Skoop, a guildmate - hence the name. Run data from [Raider.IO](https://raider.io).
