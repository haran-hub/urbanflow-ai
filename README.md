# UrbanFlow AI

AI-powered smart city navigation — real-time data across 8 urban domains for San Francisco, New York, and Austin.

**Live:** [urbanflow-ai.onrender.com](https://urbanflow-ai.onrender.com) (API) · Vercel (frontend)

---

## Features

### 8 Urban Domains
- **Parking** — real-time occupancy, AI predictions, smart recommendations, popular-times hourly forecast
- **EV Charging** — live port availability via Open Charge Map, queue estimates, hourly demand forecast
- **Transit** — crowd levels, delays, next arrival, hourly crowd forecast; SF real-time via 511.org
- **Local Services** — hospitals, banks, pharmacies, DMV with wait time predictions
- **Air Quality** — AQI, PM2.5, PM10, O3, pollen index, UV index; weather impact card
- **Bike Share** — live dock availability, e-bikes, AI station recommendations via GBFS
- **Food Trucks** — open/closed status, wait times, crowd levels by cuisine; weather impact card
- **Noise & Vibe** — neighborhood energy, crowd density, night scene activity; weather impact card

### 9 AI Features
- **◎ City Pulse Score** — composite 0–100 livability index from all 8 domains, weighted by impact; animated SVG ring with count-up on the dashboard
- **💬 AI City Concierge** — multi-turn Claude chat with live entity-level data; **voice input** (Web Speech API) + **text-to-speech** responses
- **🤔 Go Out Tonight?** — AI reads live parking, transit, air, and vibe then gives a yes/no verdict with score and best time window
- **⚡ Surge Predictor** — AI early warnings for emerging congestion with cross-domain causality chains
- **✦ AI Urban Planner** — Claude-powered multi-modal urban travel plan across all domains
- **☀ Daily City Briefing** — AI-generated city status summary refreshed throughout the day + optional morning email subscription via Resend
- **⏱ Moment Planner** — finds the optimal time window for any activity based on live city conditions
- **◎ City Narrative** — bullet-point AI mood story for the city's current state, updated every 5 min
- **🎟 Event Surge Prediction** — upcoming concerts, sports games, and festivals via Ticketmaster Discovery API with HIGH/MED/LOW crowd impact badges

### 8 Smart Tools
- **⚖ City Compare** — SF vs New York vs Austin head-to-head across 9 live metrics + Relocate Score by persona
- **🗺 3D Heat Map** — deck.gl `HexagonLayer` showing parking/EV/bike density as extruded 3D hexagonal columns; toggle between 2D and 3D views
- **🔔 Personal Watchlist** — set custom thresholds on any metric; get instant browser push notifications
- **⬡ Neighborhood Report Cards** — live A–F grades for every district + **Find My Scene** quiz
- **📊 What Changed Today** — track how city metrics shifted since earlier today; improved vs worsened at a glance
- **💸 Trip Cost Estimator** — pick activities and duration, get a cost breakdown with AI savings tips
- **📍 Community Reports** — crowdsourced city pins (broken EV chargers, lot closures, road incidents); click map to pin, upvote reports
- **⬡ Embeddable Widget** — clean iframe-able live stats page at `/embed?city=&type=`; embed code generator at `/embed/code`

### 7 Engagement Features
- **📡 Live Activity Ticker** — scrolling real-time banner on the dashboard broadcasting city metric changes in color-coded text (green = improving, red = worsening)
- **📊 Popular Times Hourly Bars** — Google Maps-style predicted busyness chart for each hour of today on parking, EV, and transit pages; highlights the current hour in city-local time
- **📈 Sparklines on Stat Cards** — tiny SVG trend line with gradient fill on every dashboard stat card, powered by the last 2 hours of live snapshot data from the database
- **⚠️ Anomaly Alerts** — auto-detects when any city metric is ≥15% off its baseline and surfaces a dismissible alert
- **🔮 Find My Scene** — 3-question vibe quiz on the Neighborhoods page (mood / transport / setting) that scores all districts and recommends the best one with reasons
- **⚙ Personalized Dashboard** — gear icon opens a settings drawer; toggle which of the 8 category sections to show; saved to localStorage
- **🔔 Browser Push Alerts** — "Enable Alerts" button on dashboard; anomaly notifications for parking >90%, EV wait >30min

### Platform
- **Weather-aware theme** — fetches real-world weather every 30 min via Open-Meteo; entire UI palette, gradients, and ambient animations (rain, snow, stars, fog, wind, overcast bands, cloud wisps) change based on 11 live weather conditions
- **Weather impact cards** — inline weather strip on Air Quality, Bikes, Food Trucks, Noise & Vibe, and Dashboard pages showing feels-like, humidity, wind, gusts, rain, and a context-aware insight sentence
- **City introductions** — Narrative card includes city tagline and characteristic tags (Golden Gate · Dense transit etc.) above the live bullet-point snapshot
- **Landing page** — full marketing page at `/` with hero, 8-domain showcase, AI features grid, tools grid, weather theme section, 3-city cards, CTA
- **Grouped sidebar nav** — 3 sections (Explore, AI Features, Tools) with active state indicators; hamburger on mobile
- **Auto-refresh** — every page polls fresh data every 30 seconds and immediately on tab focus; no stale data
- **City-local time** — all timestamps and datetime inputs use the selected city's timezone (CST/PST/EST), not UTC or browser time
- **Smart geolocation** — browser GPS → IP fallback (ipapi.co); manual picks persist, auto-detection stays fresh
- **WebSocket live updates** — dashboard receives broadcast on every server snapshot cycle
- **Consistent design** — shared dark theme, CSS design tokens, gradient accents, weather particle overlay across all 25 pages

---

## Stack

| Layer | Tech |
|-------|------|
| Backend | FastAPI · SQLAlchemy async · SQLite · APScheduler · Resend (email) |
| AI | Claude API — concierge, briefing, narrative, moment planner, surge, predictions, planning, go-out, trip cost |
| Real data | Open Charge Map · Overpass OSM · GBFS · 511.org · Ticketmaster Discovery API · ipapi.co · Open-Meteo (weather) |
| Frontend | Next.js 15 · React 19 · Tailwind CSS · react-leaflet · deck.gl v9 · react-map-gl · MapLibre GL |
| Deploy | Render (backend + persistent disk) · Vercel (frontend) |

---

## Architecture

```
urbanflow-ai/
├── backend/
│   ├── app/
│   │   ├── main.py              # FastAPI app, middleware, routers
│   │   ├── config.py            # pydantic-settings (.env)
│   │   ├── models.py            # SQLAlchemy models (8 domains, all with timestamped snapshots)
│   │   ├── database.py          # async engine + session
│   │   ├── scheduler.py         # APScheduler + city-timezone-aware simulation
│   │   ├── data_engine.py       # time-aware simulation generators
│   │   ├── real_data_fetcher.py # OCM + Overpass + GBFS seed (real coordinates)
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
│   │       ├── trends       # Mini sparkline data — 2h city-wide snapshot history
│   │       ├── events       # Ticketmaster event surge predictions
│   │       ├── reports      # Community reports CRUD + upvotes
│   │       ├── subscribe    # Email subscribe / unsubscribe
│   │       └── ws           # WebSocket
│   └── requirements.txt
├── frontend/
│   ├── app/
│   │   ├── page.tsx             # Landing page
│   │   ├── layout.tsx           # Root layout — injects global Footer
│   │   ├── dashboard/           # Main dashboard — live stats, sparklines, ticker, anomaly alert
│   │   ├── parking · ev · transit · services · air · bikes · food-trucks · noise
│   │   ├── plan/                # AI Urban Planner
│   │   ├── pulse/               # City Pulse Score
│   │   ├── concierge/           # AI Concierge chat + voice input/TTS
│   │   ├── compare/             # City Compare + Relocate Score
│   │   ├── briefing/            # Daily City Briefing
│   │   ├── moment/              # Moment Planner
│   │   ├── goout/               # Go Out Tonight?
│   │   ├── delta/               # What Changed Today
│   │   ├── neighborhoods/       # Neighborhood Report Cards + Find My Scene quiz
│   │   ├── trip/                # Trip Cost Estimator
│   │   ├── heatmap/             # 3D Heat Map (deck.gl HexagonLayer + react-leaflet 2D)
│   │   ├── reports/             # Community Reports map + submit + upvote
│   │   ├── embed/               # Embeddable live stats widget (iframe-safe)
│   │   ├── embed/code/          # Embed code generator with copy button
│   │   └── watchlist/           # Personal Watchlist + push notifications
│   ├── components/
│   │   ├── Header.tsx           # Grouped sidebar nav + mobile hamburger + weather badge
│   │   ├── Footer.tsx           # Global footer
│   │   ├── WeatherBackground.tsx # Fixed weather particle overlay (rain/snow/stars/fog/wind/overcast)
│   │   ├── WeatherMetricsCard.tsx # Inline weather strip with context-aware insight
│   │   ├── LiveTicker.tsx       # Scrolling real-time city changes ticker
│   │   ├── HourlyForecast.tsx   # Popular-times bar chart (parking / EV / transit)
│   │   ├── AnomalyAlert.tsx     # Dismissible anomaly detection alert card
│   │   ├── NarrativeCard.tsx    # City mood card — intro + parsed bullet points
│   │   ├── ShareCard.tsx        # City snapshot share card
│   │   ├── SurgeWidget.tsx      # Surge alerts + causality chains
│   │   ├── StatCard.tsx         # Stat card with sparkline SVG trend line
│   │   ├── CityScoreRing.tsx    # Animated SVG progress ring (hero dashboard)
│   │   ├── DashboardPrefs.tsx   # Section toggle drawer + useDashboardPrefs hook
│   │   ├── EventsSurgePanel.tsx # Ticketmaster event cards with impact badges
│   │   ├── EmailSubscribeWidget.tsx # Morning brief email subscribe form
│   │   └── OccupancyBar · BestTimeModal · Toast · CityMap
│   ├── hooks/
│   │   ├── useDetectedCity.ts   # GPS → IP fallback geolocation + manual preference
│   │   ├── usePolling.ts        # 30-second auto-refresh + tab-focus refetch
│   │   ├── useWebSocket.ts      # WebSocket auto-reconnect
│   │   └── useWeatherTheme.ts   # Open-Meteo fetch, 30-min cache, CSS var injection
│   └── lib/
│       ├── api.ts               # All API calls, uses NEXT_PUBLIC_API_URL
│       ├── types.ts             # Shared TypeScript types
│       ├── city-time.ts         # City-local time helpers (nowInCityIso, formatCityTime)
│       ├── hourly-patterns.ts   # Hourly busyness curves for parking / EV / transit
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
FRONTEND_URL          # your Vercel URL
OCM_API_KEY           # Open Charge Map (optional but recommended)
API_511_KEY           # 511.org SF transit (optional)
TICKETMASTER_API_KEY  # Ticketmaster Discovery API — free at developer.ticketmaster.com (optional)
RESEND_API_KEY        # Resend email — free 100/day at resend.com (optional, for morning briefs)
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
| `/dashboard` | Main dashboard — live stats + sparklines, live ticker, anomaly alert, narrative, surge |
| `/parking` | Parking zones — occupancy, predictions, popular-times forecast, list/map toggle |
| `/ev` | EV stations — port availability, queue estimates, popular-times forecast, list/map toggle |
| `/transit` | Transit routes — crowd levels, delays, popular-times forecast, predictions |
| `/services` | Local services — open/closed, wait times, list/map toggle |
| `/air` | Air quality — AQI, PM2.5, pollen, UV, weather impact card |
| `/bikes` | Bike share — dock availability, e-bikes, recommendations, weather impact card |
| `/food-trucks` | Food trucks — open status, wait, cuisine filter, weather impact card |
| `/noise` | Noise & vibe — neighborhood energy, vibe score, weather impact card |
| `/pulse` | City Pulse Score — 0–100 composite with domain breakdown |
| `/concierge` | AI Concierge — multi-turn Claude chat with live city data |
| `/compare` | City Compare — SF vs NY vs Austin, 9 metrics + Relocate Score |
| `/plan` | AI Urban Planner — multi-step trip plan across all domains |
| `/briefing` | Daily City Briefing — AI-generated live summary + highlights |
| `/moment` | Moment Planner — best time window for any activity right now |
| `/goout` | Go Out Tonight? — AI verdict with score, best time, domain breakdown |
| `/delta` | What Changed Today — metric shifts since session start |
| `/neighborhoods` | Neighborhood Report Cards — A–F grades per district + Find My Scene quiz |
| `/trip` | Trip Cost Estimator — cost breakdown + AI savings tips |
| `/heatmap` | 3D Heat Map — deck.gl HexagonLayer (parking/EV/bikes) + 2D react-leaflet toggle |
| `/watchlist` | Personal Watchlist — custom metric threshold alerts + push notifications |
| `/reports` | Community Reports — Leaflet map, click to pin report, upvote list |
| `/embed` | Embeddable widget — clean iframe-safe live stats for any website |
| `/embed/code` | Embed code generator — pick city + type, copy `<iframe>` snippet |

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
| GET | `/api/goout/tonight?city=` | Go Out Tonight? verdict + score + domain breakdown |
| GET | `/api/delta/today?city=` | Metric changes vs today's baseline |
| GET | `/api/neighborhoods/report?city=` | Neighborhood report cards with A–F grades |
| POST | `/api/tripcost/estimate` | Trip cost breakdown + AI savings tips |
| GET | `/api/trends/mini?city=` | Sparkline data — last 2h city-wide snapshot averages |
| GET | `/api/events?city=` | Upcoming events + crowd surge impact (Ticketmaster, 15-min cache) |
| GET | `/api/reports?city=` | Community reports for city (last 24h) |
| POST | `/api/reports` | Submit a community report `{city, lat, lng, type, description}` |
| POST | `/api/reports/{id}/upvote` | Upvote a community report |
| POST | `/api/subscribe` | Subscribe email to daily briefing `{email, city}` |
| GET | `/api/subscribe/unsubscribe?token=` | Unsubscribe via token (HTML response) |
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
| Sparklines | `/api/trends/mini` reads last 2h of DB snapshots, bucketed into 10-min averages |

---

## Real Data Sources

| Domain | Source |
|--------|--------|
| EV stations | [Open Charge Map](https://openchargemap.org) `/v3/poi/` — live status |
| Parking | Overpass OSM `amenity=parking` |
| Local services | Overpass OSM (hospital / bank / pharmacy / post_office) |
| Transit routes | Overpass OSM route relations; SF delays via [511.org](https://511.org) |
| Air quality | Hardcoded real-world monitor coordinates per city (OSM/gov sources) |
| Bike share | GBFS feeds (Bay Wheels SF, Citi Bike NYC) + OSM fallback |
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
