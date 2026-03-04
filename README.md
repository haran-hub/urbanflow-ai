# UrbanFlow AI

AI-powered smart city navigation — real-time parking, EV charging, transit, and local services across San Francisco, New York, and Austin.

**Live:** [urbanflow-ai.onrender.com](https://urbanflow-ai.onrender.com) (API) · Vercel (frontend)

---

## Features

- **Parking** — real-time occupancy, AI predictions, smart recommendations
- **EV Charging** — live port availability via Open Charge Map, queue estimates
- **Transit** — crowd levels, delays, next arrival; SF real-time via 511.org
- **Local Services** — hospitals, banks, pharmacies, DMV, post offices with wait times
- **Map View** — interactive Leaflet map with color-coded status markers on all pages
- **AI Planner** — Claude-powered urban travel plan across all four domains
- **Best Time** — AI recommendation for the least-busy window at any location
- **Timezone-aware** — all simulation uses each city's local time (PST/EST/CST)

---

## Stack

| Layer | Tech |
|-------|------|
| Backend | FastAPI · SQLAlchemy async · SQLite · APScheduler |
| AI | Claude API (JSON-enforced prompts + fallback) |
| Real data | Open Charge Map API · Overpass OSM · 511.org (SF transit) |
| Frontend | Next.js 15 · React 19 · Tailwind CSS · react-leaflet |
| Deploy | Render (backend + persistent disk) · Vercel (frontend) |

---

## Architecture

```
urbanflow-ai/
├── backend/
│   ├── app/
│   │   ├── main.py              # FastAPI app, startup seed
│   │   ├── config.py            # pydantic-settings (.env)
│   │   ├── models.py            # SQLAlchemy models
│   │   ├── database.py          # async engine + session
│   │   ├── scheduler.py         # APScheduler — snapshots every 2 min
│   │   ├── data_engine.py       # Time-aware simulation generators
│   │   ├── real_data_fetcher.py # OCM + Overpass seed logic
│   │   ├── ai_predictor.py      # Claude API calls
│   │   ├── websocket_manager.py # WS broadcast per city
│   │   └── routes/              # parking · ev · transit · services · dashboard
│   └── requirements.txt
├── frontend/
│   ├── app/                     # Next.js App Router pages
│   ├── components/              # Header, CityMap, OccupancyBar, modals…
│   └── lib/                     # api.ts, types.ts
├── render.yaml                  # Render Blueprint (auto-deploy on backend changes)
└── vercel.json                  # Vercel config (skip deploy on backend-only changes)
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
- On first deploy (empty DB), `seed_all_real()` fetches real OSM + OCM data

**Required env vars on Render:**
```
ANTHROPIC_API_KEY
FRONTEND_URL        # your Vercel URL
OCM_API_KEY         # Open Charge Map (optional but recommended)
API_511_KEY         # 511.org SF transit (optional)
```

### Vercel (frontend)

- Connected to this GitHub repo, root directory = `frontend`
- Auto-deploys on push when `frontend/**` or `vercel.json` changes
- Skips deploy on backend-only commits (via `ignoreCommand`)

**Required env var on Vercel:**
```
NEXT_PUBLIC_API_URL=https://urbanflow-ai.onrender.com
```

---

## Real Data Sources

| Domain | Source |
|--------|--------|
| EV stations | [Open Charge Map](https://openchargemap.org) `/v3/poi/` |
| Parking locations | Overpass OSM `amenity=parking` |
| Local services | Overpass OSM (hospital / bank / pharmacy / post_office) |
| Transit routes | Overpass OSM route relations |
| SF transit delays | [511.org](https://511.org) VehicleMonitoring API |

Everything else (occupancy %, wait times, crowd levels) uses a time-aware simulation engine that accounts for rush hours, weekday vs weekend patterns, and each city's local timezone.

---

## WebSocket

Real-time snapshot updates broadcast to connected clients:

```
ws://<host>/ws/city/{city}
```

Payload: `{ "type": "snapshot_update", "city": "Austin", "timestamp": "..." }`
