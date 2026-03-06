# UrbanFlow AI

AI-powered smart city navigation — real-time data across 8 urban domains for San Francisco, New York, and Austin.

**Live:** [urbanflow-ai.onrender.com](https://urbanflow-ai.onrender.com) (API) · Vercel (frontend)

---

## Features

### 8 Urban Domains
- **Parking** — real-time occupancy, AI predictions, smart recommendations
- **EV Charging** — live port availability via Open Charge Map, queue estimates
- **Transit** — crowd levels, delays, next arrival; SF real-time via 511.org
- **Local Services** — hospitals, banks, pharmacies, DMV with wait time predictions
- **Air Quality** — AQI, PM2.5, PM10, O3, pollen index, UV index
- **Bike Share** — live dock availability, e-bikes, AI station recommendations via GBFS
- **Food Trucks** — open/closed status, wait times, crowd levels by cuisine type
- **Noise & Vibe** — neighborhood energy, crowd density, night scene activity

### 8 AI Features
- **◎ City Pulse Score** — composite 0–100 livability index from all 8 domains, weighted by impact
- **💬 AI City Concierge** — multi-turn Claude chat with live entity-level data (real names, addresses, numbers)
- **🤔 Go Out Tonight?** — AI reads live parking, transit, air, and vibe then gives a yes/no verdict with score and best time window
- **⚡ Surge Predictor** — AI early warnings for emerging congestion with cross-domain causality chains
- **✦ AI Urban Planner** — Claude-powered multi-modal urban travel plan across all domains
- **☀ Daily City Briefing** — AI-generated city status summary refreshed throughout the day
- **⏱ Moment Planner** — finds the optimal time window for any activity based on live city conditions
- **◎ City Narrative** — 3-sentence AI mood story for the city's current state, updated every 5 min

### 6 Smart Tools
- **⚖ City Compare** — SF vs New York vs Austin head-to-head across 9 live metrics + Relocate Score by persona
- **🗺 Heat Map** — multi-layer live map showing parking, EV, transit, air, and noise overlaid on the city
- **🔔 Personal Watchlist** — set custom thresholds on any metric; get instant browser push notifications
- **⬡ Neighborhood Report Cards** — live A–F grades for every district across parking, EV, transit, air, and vibe
- **📊 What Changed Today** — track how city metrics shifted since earlier today; see improved vs worsened at a glance
- **💸 Trip Cost Estimator** — pick activities and duration, get a cost breakdown with AI savings tips

### Platform
- **Weather-aware theme** — fetches real-world weather every 30 min; entire UI palette, gradients, and ambient animations (rain, snow, stars, fog, wind) change based on live conditions
- **Landing page** — full marketing page at `/` with hero, 8-domain showcase, AI features grid, tools grid, weather theme section, 3-city cards, CTA
- **Grouped sidebar nav** — 3 sections (Explore, AI Features, Tools) with active state indicators; hamburger on mobile
- **Auto-refresh** — every page polls fresh data every 30 seconds and immediately on tab focus; no stale data
- **City-local time** — all timestamps and datetime inputs use the selected city's timezone (CST/PST/EST) — not UTC or browser time
- **Smart geolocation** — browser GPS → IP fallback (ipapi.co); manual picks persist, auto-detection stays fresh
- **WebSocket live updates** — dashboard receives broadcast on every server snapshot cycle
- **Consistent design** — shared dark theme, CSS design tokens, gradient accents, weather particle overlay across all 22 pages

---

## Stack

| Layer | Tech |
|-------|------|
| Backend | FastAPI · SQLAlchemy async · SQLite · APScheduler |
| AI | Claude API — concierge, briefing, narrative, moment planner, surge, predictions, planning, go-out, trip cost |
| Real data | Open Charge Map · Overpass OSM · OpenAQ · GBFS · 511.org · ipapi.co · Open-Meteo (weather) |
| Frontend | Next.js 15 · React 19 · Tailwind CSS · react-leaflet |
| Deploy | Render (backend + persistent disk) · Vercel (frontend) |

---

## Architecture

```
urbanflow-ai/
├── backend/
│   ├── app/
│   │   ├── main.py              # FastAPI app, middleware, routers
│   │   ├── config.py            # pydantic-settings (.env)
│   │   ├── models.py            # SQLAlchemy models (8 domains)
│   │   ├── database.py          # async engine + session
│   │   ├── scheduler.py         # APScheduler + city-timezone-aware simulation
│   │   ├── data_engine.py       # time-aware simulation generators
│   │   ├── real_data_fetcher.py # OCM + Overpass + OpenAQ + GBFS seed
│   │   ├── ai_predictor.py      # Claude API — predictions, planning, best time
│   │   ├── websocket_manager.py # WS broadcast per city
│   │   └── routes/
│   │       ├── parking · ev · transit · services   # core domains
│   │       ├── air · bikes · foodtrucks · noise     # additional domains
│   │       ├── dashboard    # overview, compare, ai-plan, best-time
│   │       ├── pulse        # City Pulse Score
│   │       ├── concierge    # AI Concierge chat
│   │       ├── surge        # Surge Predictor + causality chains
│   │       ├── briefing     # Daily City Briefing (AI, 5-min cache)
│   │       ├── narrative    # City Right Now Narrative (AI, 5-min cache)
│   │       ├── moment       # Micro-moment Planner (AI)
│   │       ├── goout        # Go Out Tonight? (AI verdict)
│   │       ├── delta        # What Changed Today
│   │       ├── neighborhoods # Neighborhood Report Cards
│   │       ├── tripcost     # Trip Cost Estimator (AI tips)
│   │       └── ws           # WebSocket
│   └── requirements.txt
├── frontend/
│   ├── app/
│   │   ├── page.tsx             # Landing page
│   │   ├── layout.tsx           # Root layout — injects global Footer
│   │   ├── dashboard/           # Main dashboard — pulse, surge, narrative, explore
│   │   ├── parking · ev · transit · services · air · bikes · food-trucks · noise
│   │   ├── plan/                # AI Urban Planner
│   │   ├── pulse/               # City Pulse Score
│   │   ├── concierge/           # AI Concierge chat
│   │   ├── compare/             # City Compare + Relocate Score
│   │   ├── briefing/            # Daily City Briefing
│   │   ├── moment/              # Moment Planner
│   │   ├── goout/               # Go Out Tonight?
│   │   ├── delta/               # What Changed Today
│   │   ├── neighborhoods/       # Neighborhood Report Cards
│   │   ├── trip/                # Trip Cost Estimator
│   │   ├── heatmap/             # Multi-layer Heat Map (react-leaflet)
│   │   └── watchlist/           # Personal Watchlist + push notifications
│   ├── components/
│   │   ├── Header.tsx           # Grouped sidebar nav + mobile hamburger + weather badge
│   │   ├── Footer.tsx           # Global footer — copyright, developer, quick links
│   │   ├── WeatherBackground.tsx # Fixed weather particle overlay (rain/snow/stars/fog/wind)
│   │   ├── NarrativeCard.tsx    # City mood narrative card
│   │   ├── SurgeWidget.tsx      # Surge alerts + causality chains
│   │   ├── StatCard · OccupancyBar · BestTimeModal · Toast · CityMap
│   ├── hooks/
│   │   ├── useDetectedCity.ts   # GPS → IP fallback geolocation + manual preference
│   │   ├── usePolling.ts        # 30-second auto-refresh + tab-focus refetch
│   │   ├── useWebSocket.ts      # WebSocket auto-reconnect
│   │   └── useWeatherTheme.ts   # Open-Meteo fetch, 30-min cache, CSS var injection
│   └── lib/
│       ├── api.ts               # All API calls, uses NEXT_PUBLIC_API_URL
│       ├── types.ts             # Shared TypeScript types
│       ├── city-time.ts         # City-local time helpers (nowInCityIso, formatCityTime)
│       └── weather-themes.ts    # 11 weather conditions → CSS palette + particle config
├── render.yaml                  # Render Blueprint
└── vercel.json                  # Vercel config
```

---

## Local Development

### Backend

```bash
cd backend
python -m venv .venv && source .venv/bin/activate
pip install -r requirements.txt

# create .env
echo "ANTHROPIC_API_KEY=sk-..." > .env
echo "OCM_API_KEY=..."          >> .env   # optional — Open Charge Map
echo "API_511_KEY=..."          >> .env   # optional — SF real-time transit

uvicorn app.main:app --reload
# → http://localhost:8000
```

### Frontend

```bash
cd frontend
npm install
echo "NEXT_PUBLIC_API_URL=http://localhost:8000" > .env.local
npm run dev
# → http://localhost:3000
```

---

## Deployment

### Render (backend)

- Connected to GitHub via **Blueprint** (`render.yaml`)
- Auto-deploys on push when `backend/**` or `render.yaml` changes
- Persistent disk at `/opt/render/project/src` stores `urbanflow.db`
- **Incremental seeding**: on startup, empty tables are auto-seeded without wiping existing data

**Required env vars on Render:**
```
ANTHROPIC_API_KEY
FRONTEND_URL        # your Vercel URL
OCM_API_KEY         # Open Charge Map (optional but recommended)
API_511_KEY         # 511.org SF transit (optional)
```

### Vercel (frontend)

- Connected to GitHub, root directory = `frontend`
- Auto-deploys on every push to `main`

**Required env var on Vercel:**
```
NEXT_PUBLIC_API_URL=https://urbanflow-ai.onrender.com
```

---

## Routes

| Route | Description |
|-------|-------------|
| `/` | Landing page — hero, 8 domains, 8 AI features, 6 tools, weather theme, city cards, CTA |
| `/dashboard` | Main dashboard — live stats, pulse ring, surge widget, narrative card |
| `/parking` | Parking zones — occupancy, predictions, list/map toggle |
| `/ev` | EV stations — port availability, queue estimates, list/map toggle |
| `/transit` | Transit routes — crowd levels, delays, predictions |
| `/services` | Local services — open/closed, wait times, list/map toggle |
| `/air` | Air quality — AQI, PM2.5, pollen, UV |
| `/bikes` | Bike share — dock availability, e-bikes, recommendations |
| `/food-trucks` | Food trucks — open status, wait, cuisine filter |
| `/noise` | Noise & vibe — neighborhood energy, vibe score |
| `/pulse` | City Pulse Score — 0–100 composite with domain breakdown |
| `/concierge` | AI Concierge — multi-turn Claude chat with live city data |
| `/compare` | City Compare — SF vs NY vs Austin, 9 metrics + Relocate Score |
| `/plan` | AI Urban Planner — multi-step trip plan across all domains |
| `/briefing` | Daily City Briefing — AI-generated live summary + highlights |
| `/moment` | Moment Planner — best time window for any activity right now |
| `/goout` | Go Out Tonight? — AI verdict with score, best time, domain breakdown |
| `/delta` | What Changed Today — metric shifts since session start |
| `/neighborhoods` | Neighborhood Report Cards — A–F grades per district |
| `/trip` | Trip Cost Estimator — cost breakdown + AI savings tips |
| `/heatmap` | Multi-layer Heat Map — parking, EV, transit, air, noise on map |
| `/watchlist` | Personal Watchlist — custom metric threshold alerts + push notifications |

---

## API Endpoints

| Method | Path | Description |
|--------|------|-------------|
| GET | `/api/dashboard/overview?city=` | All-domain summary for a city |
| GET | `/api/dashboard/compare` | SF vs NY vs Austin head-to-head |
| POST | `/api/dashboard/ai-plan` | Generate multi-modal urban plan |
| GET | `/api/dashboard/best-time` | Best/worst visit windows for any entity |
| GET | `/api/pulse/score?city=` | City Pulse Score (0–100) + domain breakdown |
| POST | `/api/concierge/ask` | AI Concierge chat (supports message history) |
| GET | `/api/surge/alerts?city=` | Surge warnings + causality chains |
| GET | `/api/briefing/today?city=` | AI daily city briefing (5-min server cache) |
| GET | `/api/narrative?city=` | AI city mood narrative (5-min server cache) |
| POST | `/api/moment/plan` | Best time window for a city activity |
| GET | `/api/goout?city=` | Go Out Tonight? verdict + score + domain breakdown |
| GET | `/api/delta?city=` | Metric changes since baseline |
| GET | `/api/neighborhoods?city=` | Neighborhood report cards with A–F grades |
| POST | `/api/tripcost/estimate` | Trip cost breakdown + AI savings tips |
| GET | `/api/parking/zones?city=` | Live parking availability |
| GET | `/api/ev/stations?city=` | EV port status |
| GET | `/api/transit/routes?city=` | Transit crowd + delay data |
| GET | `/api/services/?city=` | Local service open/wait status |
| GET | `/api/air/stations?city=` | Air quality readings |
| GET | `/api/bikes/stations?city=` | Bike share availability |
| GET | `/api/foodtrucks/?city=` | Food truck open/wait status |
| GET | `/api/noise/zones?city=` | Neighborhood vibe scores |
| WS | `/ws/city/{city}` | Real-time snapshot broadcast |

Each `GET /api/*?city=X` request triggers an on-demand snapshot refresh for that city (5-second cooldown) before returning data.

---

## Data Refresh Strategy

| Trigger | Behavior |
|---------|----------|
| Page navigation | Immediate fetch on every mount |
| 30-second poll | All live-data pages auto-refetch in background |
| Tab focus | Refetches immediately when you switch back to the tab |
| On-demand (backend) | Every API request triggers `update_city_snapshots(city)` — ~200ms |
| Cooldown | 5-second per-city debounce prevents backend hammering |
| WebSocket | Dashboard auto-refreshes on every broadcast from the server |
| Background scheduler | APScheduler periodically pulls live OCM/511 data for idle cities |
| Weather | Open-Meteo polled every 30 min; module-level cache prevents excess requests |

---

## Real Data Sources

| Domain | Source |
|--------|--------|
| EV stations | [Open Charge Map](https://openchargemap.org) `/v3/poi/` — live status |
| Parking | Overpass OSM `amenity=parking` |
| Local services | Overpass OSM (hospital / bank / pharmacy / post_office) |
| Transit routes | Overpass OSM route relations; SF delays via [511.org](https://511.org) |
| Air quality | OpenAQ sensors per city neighborhood |
| Bike share | GBFS feeds (Bay Wheels, Citi Bike, MetroBike) + OSM fallback |
| Food trucks | Overpass OSM + curated city lists |
| Noise zones | Overpass OSM venues (bars, clubs, parks, stadiums) |
| Weather | [Open-Meteo](https://open-meteo.com) — free, no key required |
| Geolocation | Browser GPS → [ipapi.co](https://ipapi.co) IP fallback |

Occupancy %, wait times, crowd levels, and vibe scores use a timezone-aware simulation engine that accounts for rush hours, weekday vs weekend patterns, and each city's local time (CST/PST/EST).

---

## WebSocket

```
ws://<host>/ws/city/{city}
```

Payload: `{ "type": "snapshot_update", "city": "Austin", "timestamp": "..." }`

The dashboard auto-reconnects and refreshes all data on receipt.

---

## Developed by Haran
