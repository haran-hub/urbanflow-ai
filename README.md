# UrbanFlow AI

AI-powered smart city navigation — real-time data across 8 urban domains for San Francisco, New York, and Austin.

**Live:** [urbanflow-ai.onrender.com](https://urbanflow-ai.onrender.com) (API) · Vercel (frontend)

---

## Features

- **Parking** — real-time occupancy, AI predictions, smart recommendations
- **EV Charging** — live port availability via Open Charge Map, queue estimates
- **Transit** — crowd levels, delays, next arrival; SF real-time via 511.org
- **Local Services** — hospitals, banks, pharmacies, DMV with wait time predictions
- **Air Quality** — AQI, PM2.5, PM10, O3, pollen index, UV index via OpenAQ
- **Bike Share** — live dock availability, e-bikes, AI station recommendations via GBFS
- **Food Trucks** — open/closed status, wait times, crowd levels by cuisine type
- **Noise & Vibe** — neighborhood energy, crowd density, night scene activity
- **Map View** — interactive Leaflet map with color-coded status markers on all pages
- **AI Planner** — Claude-powered urban travel plan across all domains
- **Best Time** — AI recommendation for the least-busy window at any location
- **Auto city detection** — geolocation detects your nearest city on first visit
- **Timezone-aware** — all simulation uses each city's local time (PST/EST/CST)

---

## Stack

| Layer | Tech |
|-------|------|
| Backend | FastAPI · SQLAlchemy async · SQLite · APScheduler |
| AI | Claude API (JSON-enforced prompts + fallback) |
| Real data | Open Charge Map · Overpass OSM · OpenAQ · GBFS · 511.org |
| Frontend | Next.js 15 · React 19 · Tailwind CSS · react-leaflet |
| Deploy | Render (backend + persistent disk) · Vercel (frontend) |

---

## Architecture

```
urbanflow-ai/
├── backend/
│   ├── app/
│   │   ├── main.py              # FastAPI app, incremental startup seed
│   │   ├── config.py            # pydantic-settings (.env)
│   │   ├── models.py            # SQLAlchemy models (8 domains)
│   │   ├── database.py          # async engine + session
│   │   ├── scheduler.py         # APScheduler — snapshots every 2 min
│   │   ├── data_engine.py       # Time-aware simulation generators
│   │   ├── real_data_fetcher.py # OCM + Overpass + OpenAQ + GBFS seed logic
│   │   ├── ai_predictor.py      # Claude API calls
│   │   ├── websocket_manager.py # WS broadcast per city
│   │   └── routes/              # parking · ev · transit · services · dashboard
│   │                              air · bikes · foodtrucks · noise
│   └── requirements.txt
├── frontend/
│   ├── app/                     # Next.js App Router pages (8 domains)
│   ├── components/              # Header, CityMap, StatCard, modals…
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
- **Incremental seeding**: on startup, each category table is checked independently — empty tables are auto-seeded without resetting the disk. Adding new categories in future deploys seeds only the new ones.

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

## Real Data Sources

| Domain | Source |
|--------|--------|
| EV stations | [Open Charge Map](https://openchargemap.org) `/v3/poi/` — live status |
| Parking | Overpass OSM `amenity=parking` |
| Local services | Overpass OSM (hospital / bank / pharmacy / post_office) |
| Transit routes | Overpass OSM route relations; SF delays via [511.org](https://511.org) |
| Air quality | [OpenAQ](https://openaq.org) sensors per city neighborhood |
| Bike share | [GBFS](https://gbfs.mobilitydata.org) feeds (Bay Wheels, Citi Bike, MetroBike) + OSM fallback |
| Food trucks | Overpass OSM + curated city lists (Austin-first) |
| Noise zones | Overpass OSM venues (bars, clubs, parks, stadiums) |

Occupancy %, wait times, crowd levels, and vibe scores use a time-aware simulation engine that accounts for rush hours, weekday vs weekend patterns, and each city's local timezone.

---

## WebSocket

Real-time snapshot updates are broadcast to connected clients every 2 minutes:

```
ws://<host>/ws/city/{city}
```

Payload: `{ "type": "snapshot_update", "city": "Austin", "timestamp": "..." }`

The frontend reconnects automatically and refreshes all data on receipt.
