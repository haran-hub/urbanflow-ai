# UrbanFlow AI

AI-powered smart city navigation — real-time data across 8 urban domains for San Francisco, New York, and Austin.

**Live:** [urbanflow-ai.onrender.com](https://urbanflow-ai.onrender.com) (API) · Vercel (frontend)

---

## Features

### 8 Urban Domains
- **Parking** — real-time occupancy, AI predictions, smart recommendations, map view
- **EV Charging** — live port availability via Open Charge Map, queue estimates, map view
- **Transit** — crowd levels, delays, next arrival; SF real-time via 511.org
- **Local Services** — hospitals, banks, pharmacies, DMV with wait time predictions, map view
- **Air Quality** — AQI, PM2.5, PM10, O3, pollen index, UV index via OpenAQ
- **Bike Share** — live dock availability, e-bikes, AI station recommendations via GBFS
- **Food Trucks** — open/closed status, wait times, crowd levels by cuisine type
- **Noise & Vibe** — neighborhood energy, crowd density, night scene activity

### Unique AI Features
- **◎ City Pulse Score** — composite 0–100 livability index computed from all 8 domains in real time, weighted by impact (air 20%, parking/EV/transit 15% each, bikes/vibe/services 10%, food 5%)
- **💬 AI City Concierge** — multi-turn chat powered by Claude; answers questions using live entity-level data (actual zone names, addresses, real numbers) — not generic summaries
- **⚖ Live City Compare** — SF vs New York vs Austin head-to-head across 9 metrics with per-metric winner crowns and overall champion
- **Surge Predictor** — AI-powered early warnings for emerging congestion in parking, transit, and EV with severity levels and actionable tips
- **✦ AI Planner** — Claude-powered multi-modal urban travel plan across all domains
- **Best Time** — AI recommendation for the least-busy window at any location
- **Future AI Predict** — predict occupancy/wait at any future time for any entity

### Platform
- **On-demand data refresh** — every page load and city switch triggers a fresh simulation snapshot; data is never stale from a fixed timer
- **Map View** — interactive Leaflet map with color-coded status markers on parking, EV, and services pages
- **Auto city detection** — geolocation detects your nearest city on first visit; preference saved to localStorage
- **Timezone-aware** — all simulation uses each city's local time (PST/EST/CST)
- **Left sidebar nav** — fixed 220px sidebar on desktop, hamburger menu on mobile
- **WebSocket live updates** — dashboard refreshes automatically when new snapshots are broadcast

---

## Stack

| Layer | Tech |
|-------|------|
| Backend | FastAPI · SQLAlchemy async · SQLite · APScheduler |
| AI | Claude API — concierge chat, predictions, planning, surge alerts |
| Real data | Open Charge Map · Overpass OSM · OpenAQ · GBFS · 511.org |
| Frontend | Next.js 15 · React 19 · Tailwind CSS · react-leaflet |
| Deploy | Render (backend + persistent disk) · Vercel (frontend) |

---

## Architecture

```
urbanflow-ai/
├── backend/
│   ├── app/
│   │   ├── main.py              # FastAPI app, on-demand refresh middleware, incremental seed
│   │   ├── config.py            # pydantic-settings (.env)
│   │   ├── models.py            # SQLAlchemy models (8 domains)
│   │   ├── database.py          # async engine + session
│   │   ├── scheduler.py         # APScheduler fallback + update_city_snapshots()
│   │   ├── data_engine.py       # time-aware simulation generators
│   │   ├── real_data_fetcher.py # OCM + Overpass + OpenAQ + GBFS seed logic
│   │   ├── ai_predictor.py      # Claude API — predictions, planning, best time
│   │   ├── websocket_manager.py # WS broadcast per city
│   │   └── routes/
│   │       ├── parking · ev · transit · services   # core domains
│   │       ├── air · bikes · foodtrucks · noise     # additional domains
│   │       ├── dashboard    # overview, compare, ai-plan, best-time
│   │       ├── pulse        # City Pulse Score endpoint
│   │       ├── concierge    # AI City Concierge chat endpoint
│   │       ├── surge        # Surge Predictor alerts endpoint
│   │       └── ws           # WebSocket
│   └── requirements.txt
├── frontend/
│   ├── app/
│   │   ├── page.tsx             # Dashboard — pulse ring, surge widget, explore cards
│   │   ├── parking · ev · transit · services · air · bikes · food-trucks · noise
│   │   ├── plan/                # AI urban planner
│   │   ├── pulse/               # City Pulse Score page
│   │   ├── concierge/           # AI Concierge chat page
│   │   └── compare/             # Live City Compare page
│   ├── components/
│   │   ├── Header.tsx           # Sidebar nav + mobile hamburger
│   │   ├── CityMap.tsx          # react-leaflet map with color-coded markers
│   │   ├── SurgeWidget.tsx      # Surge alerts widget
│   │   ├── StatCard · OccupancyBar · BestTimeModal · Toast
│   ├── hooks/                   # useDetectedCity, useWebSocket
│   └── lib/                     # api.ts, types.ts
├── render.yaml                  # Render Blueprint (auto-deploy on backend changes)
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

- Connected to this GitHub repo via **Blueprint** (`render.yaml`)
- Auto-deploys on push when `backend/**` or `render.yaml` changes
- Persistent disk at `/opt/render/project/src` stores `urbanflow.db`
- **Incremental seeding**: on startup, each category table is checked independently — empty tables are auto-seeded without resetting the disk

**Required env vars on Render:**
```
ANTHROPIC_API_KEY
FRONTEND_URL        # your Vercel URL
OCM_API_KEY         # Open Charge Map (optional but recommended)
API_511_KEY         # 511.org SF transit (optional)
```

### Vercel (frontend)

- Connected to this GitHub repo, root directory = `frontend`
- Auto-deploys on every push to `main`

**Required env var on Vercel:**
```
NEXT_PUBLIC_API_URL=https://urbanflow-ai.onrender.com
```

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
| GET | `/api/surge/alerts?city=` | AI surge warnings with severity + tips |
| GET | `/api/parking/zones?city=` | Live parking availability |
| GET | `/api/ev/stations?city=` | EV port status |
| GET | `/api/transit/routes?city=` | Transit crowd + delay data |
| GET | `/api/services/?city=` | Local service open/wait status |
| GET | `/api/air/stations?city=` | Air quality readings |
| GET | `/api/bikes/stations?city=` | Bike share availability |
| GET | `/api/foodtrucks/?city=` | Food truck open/wait status |
| GET | `/api/noise/zones?city=` | Neighborhood vibe scores |
| WS | `/ws/city/{city}` | Real-time snapshot broadcast |

Each `GET /api/*?city=X` request automatically triggers an on-demand snapshot refresh for that city (5-second cooldown per city) before returning data.

---

## Real Data Sources

| Domain | Source |
|--------|--------|
| EV stations | [Open Charge Map](https://openchargemap.org) `/v3/poi/` — live status |
| Parking | Overpass OSM `amenity=parking` |
| Local services | Overpass OSM (hospital / bank / pharmacy / post_office) |
| Transit routes | Overpass OSM route relations; SF delays via [511.org](https://511.org) |
| Air quality | [OpenAQ](https://openaq.org) sensors per city neighborhood |
| Bike share | [GBFS](https://gbfs.mobilitydata.org) feeds (Bay Wheels, Citi Bike, MetroBike) + OSM fallback |
| Food trucks | Overpass OSM + curated city lists |
| Noise zones | Overpass OSM venues (bars, clubs, parks, stadiums) |

Occupancy %, wait times, crowd levels, and vibe scores use a time-aware simulation engine that accounts for rush hours, weekday vs weekend patterns, and each city's local timezone.

---

## Data Refresh

- **On-demand**: every `GET /api/*?city=X` triggers `update_city_snapshots(city)` — regenerates all 8 domain snapshots for that city using the simulation engine (bulk DB queries, ~200ms)
- **Per-city cooldown**: 5-second debounce prevents hammering on rapid navigation
- **Background fallback**: APScheduler runs periodically to keep idle-tab data fresh and pull live OCM/511 data that requires external network calls
- **WebSocket**: broadcasts snapshot updates; dashboard auto-refreshes on receipt

---

## WebSocket

```
ws://<host>/ws/city/{city}
```

Payload: `{ "type": "snapshot_update", "city": "Austin", "timestamp": "..." }`

The frontend dashboard reconnects automatically and refreshes all data on receipt.
