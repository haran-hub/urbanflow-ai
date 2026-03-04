"""
Seed the database with realistic city data for San Francisco, New York, and Austin.
Run once before starting the server: python seed_data.py
"""
import asyncio
import uuid
from app.database import create_tables, AsyncSessionLocal
from app.models import ParkingZone, EVStation, TransitRoute, LocalService


def uid():
    return str(uuid.uuid4())


SAN_FRANCISCO = [
    # Parking Zones
    {"_type": "parking", "name": "Union Square Garage", "lat": 37.7879, "lng": -122.4074, "total_spots": 1000, "zone_type": "garage", "hourly_rate": 4.0, "address": "333 Post St, San Francisco"},
    {"_type": "parking", "name": "Civic Center Plaza Lot", "lat": 37.7793, "lng": -122.4192, "total_spots": 350, "zone_type": "lot", "hourly_rate": 2.5, "address": "Civic Center, San Francisco"},
    {"_type": "parking", "name": "Fisherman's Wharf Street", "lat": 37.8080, "lng": -122.4177, "total_spots": 80, "zone_type": "street", "hourly_rate": 3.0, "address": "Jefferson St, San Francisco"},
    {"_type": "parking", "name": "Mission District Garage", "lat": 37.7599, "lng": -122.4148, "total_spots": 500, "zone_type": "garage", "hourly_rate": 2.0, "address": "Mission St, San Francisco"},
    {"_type": "parking", "name": "SOMA Parking Lot", "lat": 37.7749, "lng": -122.4000, "total_spots": 200, "zone_type": "lot", "hourly_rate": 3.5, "address": "Howard St, San Francisco"},
    {"_type": "parking", "name": "Castro Street Parking", "lat": 37.7609, "lng": -122.4350, "total_spots": 60, "zone_type": "street", "hourly_rate": 2.5, "address": "Castro St, San Francisco"},
    {"_type": "parking", "name": "Embarcadero Center Garage", "lat": 37.7946, "lng": -122.3970, "total_spots": 1400, "zone_type": "garage", "hourly_rate": 5.0, "address": "Embarcadero, San Francisco"},
    {"_type": "parking", "name": "Haight Street Lot", "lat": 37.7694, "lng": -122.4469, "total_spots": 100, "zone_type": "lot", "hourly_rate": 1.5, "address": "Haight St, San Francisco"},
    {"_type": "parking", "name": "North Beach Street Parking", "lat": 37.8003, "lng": -122.4099, "total_spots": 55, "zone_type": "street", "hourly_rate": 3.0, "address": "Columbus Ave, San Francisco"},
    {"_type": "parking", "name": "Richmond District Lot", "lat": 37.7786, "lng": -122.4640, "total_spots": 180, "zone_type": "lot", "hourly_rate": 1.0, "address": "Clement St, San Francisco"},
    # EV Stations
    {"_type": "ev", "name": "Tesla Supercharger Union Square", "lat": 37.7876, "lng": -122.4071, "total_ports": 12, "port_types": {"DCFast": 12}, "network": "Tesla", "address": "345 Post St, San Francisco"},
    {"_type": "ev", "name": "ChargePoint SOMA Hub", "lat": 37.7765, "lng": -122.4007, "total_ports": 8, "port_types": {"Level2": 6, "DCFast": 2}, "network": "ChargePoint", "address": "Howard St, San Francisco"},
    {"_type": "ev", "name": "EVgo Civic Center", "lat": 37.7797, "lng": -122.4186, "total_ports": 6, "port_types": {"DCFast": 6}, "network": "EVgo", "address": "Van Ness Ave, San Francisco"},
    {"_type": "ev", "name": "Blink Mission Bay", "lat": 37.7694, "lng": -122.3939, "total_ports": 10, "port_types": {"Level2": 10}, "network": "Blink", "address": "Mission Bay Blvd, San Francisco"},
    {"_type": "ev", "name": "ChargePoint Embarcadero", "lat": 37.7944, "lng": -122.3971, "total_ports": 8, "port_types": {"Level2": 4, "DCFast": 4}, "network": "ChargePoint", "address": "Embarcadero, San Francisco"},
    {"_type": "ev", "name": "Tesla Supercharger Potrero", "lat": 37.7601, "lng": -122.4058, "total_ports": 16, "port_types": {"DCFast": 16}, "network": "Tesla", "address": "Potrero Ave, San Francisco"},
    {"_type": "ev", "name": "EVgo Richmond Station", "lat": 37.7790, "lng": -122.4650, "total_ports": 4, "port_types": {"DCFast": 4}, "network": "EVgo", "address": "Geary Blvd, San Francisco"},
    {"_type": "ev", "name": "Electrify America Marina", "lat": 37.8018, "lng": -122.4364, "total_ports": 6, "port_types": {"DCFast": 6}, "network": "Electrify America", "address": "Lombard St, San Francisco"},
    # Transit Routes
    {"_type": "transit", "name": "BART Red Line", "route_type": "subway", "frequency_mins": 8, "stops": ["SFO", "Millbrae", "Daly City", "Glen Park", "Balboa Park", "24th St Mission", "16th St Mission", "Civic Center", "Powell", "Montgomery", "Embarcadero", "West Oakland"]},
    {"_type": "transit", "name": "Muni 38 Geary Bus", "route_type": "bus", "frequency_mins": 5, "stops": ["Transbay", "Market/Kearny", "Civic Center", "Divisadero", "Masonic", "Arguello", "6th Ave", "Park Presidio", "Sutro Heights"]},
    {"_type": "transit", "name": "Muni N-Judah Tram", "route_type": "tram", "frequency_mins": 10, "stops": ["Caltrain", "4th & King", "Embarcadero", "Montgomery", "Powell", "Civic Center", "Duboce", "Carl & Cole", "9th Ave", "Irving", "Ocean Beach"]},
    {"_type": "transit", "name": "Muni 14 Mission Bus", "route_type": "bus", "frequency_mins": 7, "stops": ["Daly City BART", "Geneva", "Excelsior", "Mission/30th", "Mission/24th", "Mission/16th", "Mission/Cesar Chavez", "Mission/Market"]},
    {"_type": "transit", "name": "Cable Car Powell-Mason", "route_type": "tram", "frequency_mins": 10, "stops": ["Powell & Market", "Union Square", "Nob Hill", "Russian Hill", "Fisherman's Wharf"]},
    {"_type": "transit", "name": "Golden Gate Ferry", "route_type": "ferry", "frequency_mins": 30, "stops": ["Ferry Building SF", "Larkspur", "Sausalito", "Tiburon"]},
    # Local Services
    {"_type": "service", "name": "SF DMV - Fell Street", "lat": 37.7756, "lng": -122.4338, "category": "dmv", "address": "1377 Fell St, San Francisco", "typical_hours": "8am-5pm Mon-Fri"},
    {"_type": "service", "name": "UCSF Medical Center", "lat": 37.7631, "lng": -122.4575, "category": "hospital", "address": "505 Parnassus Ave, San Francisco", "typical_hours": "24/7"},
    {"_type": "service", "name": "SF General Hospital", "lat": 37.7553, "lng": -122.4060, "category": "hospital", "address": "1001 Potrero Ave, San Francisco", "typical_hours": "24/7"},
    {"_type": "service", "name": "Wells Fargo Union Square", "lat": 37.7880, "lng": -122.4063, "category": "bank", "address": "420 Montgomery St, San Francisco", "typical_hours": "9am-5pm Mon-Fri"},
    {"_type": "service", "name": "USPS Mission Station", "lat": 37.7594, "lng": -122.4185, "category": "post_office", "address": "1198 S Van Ness Ave, San Francisco", "typical_hours": "9am-5pm Mon-Sat"},
    {"_type": "service", "name": "Walgreens Castro Pharmacy", "lat": 37.7612, "lng": -122.4348, "category": "pharmacy", "address": "498 Castro St, San Francisco", "typical_hours": "8am-10pm"},
    {"_type": "service", "name": "CVS Pharmacy SOMA", "lat": 37.7745, "lng": -122.4028, "category": "pharmacy", "address": "770 Bryant St, San Francisco", "typical_hours": "8am-9pm"},
    {"_type": "service", "name": "Chase Bank Financial District", "lat": 37.7935, "lng": -122.3998, "category": "bank", "address": "1 Market St, San Francisco", "typical_hours": "9am-5pm Mon-Fri"},
]

NEW_YORK = [
    # Parking
    {"_type": "parking", "name": "Icon Parking Midtown", "lat": 40.7549, "lng": -73.9840, "total_spots": 800, "zone_type": "garage", "hourly_rate": 8.0, "address": "300 W 48th St, New York"},
    {"_type": "parking", "name": "Edison Park Fast Times Square", "lat": 40.7580, "lng": -73.9855, "total_spots": 600, "zone_type": "garage", "hourly_rate": 10.0, "address": "234 W 48th St, New York"},
    {"_type": "parking", "name": "Central Park South Lot", "lat": 40.7671, "lng": -73.9822, "total_spots": 300, "zone_type": "lot", "hourly_rate": 7.0, "address": "59th St, New York"},
    {"_type": "parking", "name": "Brooklyn Bridge Garage", "lat": 40.7074, "lng": -73.9965, "total_spots": 450, "zone_type": "garage", "hourly_rate": 5.0, "address": "Brooklyn Bridge Blvd, New York"},
    {"_type": "parking", "name": "SoHo Street Parking", "lat": 40.7228, "lng": -74.0007, "total_spots": 70, "zone_type": "street", "hourly_rate": 3.0, "address": "Spring St, New York"},
    {"_type": "parking", "name": "LGA Airport Lot", "lat": 40.7769, "lng": -73.8740, "total_spots": 2000, "zone_type": "lot", "hourly_rate": 4.0, "address": "LaGuardia Airport, New York"},
    {"_type": "parking", "name": "Williamsburg Parking Lot", "lat": 40.7135, "lng": -73.9607, "total_spots": 250, "zone_type": "lot", "hourly_rate": 3.5, "address": "Bedford Ave, Brooklyn"},
    {"_type": "parking", "name": "Chelsea Street Parking", "lat": 40.7465, "lng": -74.0013, "total_spots": 90, "zone_type": "street", "hourly_rate": 4.0, "address": "W 23rd St, New York"},
    {"_type": "parking", "name": "Astoria Garage", "lat": 40.7722, "lng": -73.9301, "total_spots": 400, "zone_type": "garage", "hourly_rate": 3.0, "address": "31st Ave, Astoria"},
    {"_type": "parking", "name": "Financial District Garage", "lat": 40.7071, "lng": -74.0109, "total_spots": 700, "zone_type": "garage", "hourly_rate": 9.0, "address": "Wall St, New York"},
    # EV Stations
    {"_type": "ev", "name": "Tesla Supercharger Midtown", "lat": 40.7549, "lng": -73.9838, "total_ports": 20, "port_types": {"DCFast": 20}, "network": "Tesla", "address": "787 11th Ave, New York"},
    {"_type": "ev", "name": "ChargePoint Grand Central", "lat": 40.7527, "lng": -73.9772, "total_ports": 10, "port_types": {"Level2": 6, "DCFast": 4}, "network": "ChargePoint", "address": "Park Ave, New York"},
    {"_type": "ev", "name": "EVgo Brooklyn Navy Yard", "lat": 40.7001, "lng": -73.9742, "total_ports": 8, "port_types": {"DCFast": 8}, "network": "EVgo", "address": "Flushing Ave, Brooklyn"},
    {"_type": "ev", "name": "Blink Upper West Side", "lat": 40.7870, "lng": -73.9757, "total_ports": 6, "port_types": {"Level2": 6}, "network": "Blink", "address": "Columbus Ave, New York"},
    {"_type": "ev", "name": "Electrify America JFK Mall", "lat": 40.6501, "lng": -73.7949, "total_ports": 12, "port_types": {"DCFast": 12}, "network": "Electrify America", "address": "JFK Airport, New York"},
    {"_type": "ev", "name": "ChargePoint Downtown Brooklyn", "lat": 40.6926, "lng": -73.9903, "total_ports": 8, "port_types": {"Level2": 4, "DCFast": 4}, "network": "ChargePoint", "address": "Flatbush Ave, Brooklyn"},
    {"_type": "ev", "name": "Tesla Supercharger Long Island City", "lat": 40.7448, "lng": -73.9485, "total_ports": 16, "port_types": {"DCFast": 16}, "network": "Tesla", "address": "Jackson Ave, Long Island City"},
    {"_type": "ev", "name": "EVgo Staten Island Ferry", "lat": 40.6437, "lng": -74.0741, "total_ports": 4, "port_types": {"DCFast": 4}, "network": "EVgo", "address": "Richmond Terrace, Staten Island"},
    # Transit
    {"_type": "transit", "name": "Subway A/C/E (8th Ave)", "route_type": "subway", "frequency_mins": 4, "stops": ["Inwood-207 St", "207 St", "Dyckman St", "190 St", "168 St", "145 St", "125 St", "59 St-Columbus Circle", "42 St-Port Authority", "34 St-Penn", "14 St", "W 4 St", "Fulton St", "WTC Cortlandt"]},
    {"_type": "transit", "name": "Subway 4/5/6 (Lexington)", "route_type": "subway", "frequency_mins": 3, "stops": ["Woodlawn", "Mosholu Pkwy", "Fordham Rd", "125 St", "86 St", "59 St", "42 St-Grand Central", "33 St", "28 St", "23 St", "14 St-Union Sq", "Fulton St", "Borough Hall"]},
    {"_type": "transit", "name": "MTA Bus M15 1st/2nd Ave", "route_type": "bus", "frequency_mins": 6, "stops": ["East Harlem", "96 St", "72 St", "57 St", "42 St", "34 St", "23 St", "14 St", "Houston St", "Chatham Sq"]},
    {"_type": "transit", "name": "PATH Train NJ-Manhattan", "route_type": "subway", "frequency_mins": 8, "stops": ["Newark", "Journal Square", "Grove St", "Exchange Place", "WTC", "Fulton St", "Christopher St", "14 St", "23 St", "33 St"]},
    {"_type": "transit", "name": "Staten Island Ferry", "route_type": "ferry", "frequency_mins": 30, "stops": ["Whitehall Terminal Manhattan", "St George Staten Island"]},
    {"_type": "transit", "name": "LIRR Jamaica Line", "route_type": "subway", "frequency_mins": 15, "stops": ["Penn Station", "Jamaica", "Valley Stream", "Lynbrook", "Rockville Centre", "Baldwin", "Freeport", "Merrick", "Bellmore", "Wantagh"]},
    {"_type": "transit", "name": "MTA Bus B41 Flatbush", "route_type": "bus", "frequency_mins": 8, "stops": ["Fulton St", "Atlantic Ave", "Church Ave", "Flatbush Ave", "Newkirk Ave", "Ave H", "Kings Hwy", "Nostrand Ave", "Sheepshead Bay"]},
    {"_type": "transit", "name": "Subway L Train", "route_type": "subway", "frequency_mins": 5, "stops": ["8 Av", "6 Av", "Union Sq", "3 Av", "1 Av", "Bedford Av", "Lorimer", "Graham Av", "Grand St", "Montrose Av", "Morgan Av", "Jefferson St", "DeKalb Av", "Myrtle-Wyckoff", "Halsey", "Wilson Av", "Bushwick Av", "Atlantic Av", "Broadway Jct", "Sutter Av", "Livonia Av", "New Lots Av", "East 105 St", "Canarsie"]},
    # Services
    {"_type": "service", "name": "NYC DMV Midtown", "lat": 40.7548, "lng": -73.9890, "category": "dmv", "address": "300 W 34th St, New York", "typical_hours": "8:30am-4pm Mon-Fri"},
    {"_type": "service", "name": "NYU Langone Medical Center", "lat": 40.7420, "lng": -73.9740, "category": "hospital", "address": "550 1st Ave, New York", "typical_hours": "24/7"},
    {"_type": "service", "name": "Bellevue Hospital Center", "lat": 40.7395, "lng": -73.9759, "category": "hospital", "address": "462 1st Ave, New York", "typical_hours": "24/7"},
    {"_type": "service", "name": "JPMorgan Chase HQ Branch", "lat": 40.7527, "lng": -73.9772, "category": "bank", "address": "383 Madison Ave, New York", "typical_hours": "9am-5pm Mon-Fri"},
    {"_type": "service", "name": "USPS James A Farley Office", "lat": 40.7504, "lng": -73.9951, "category": "post_office", "address": "421 8th Ave, New York", "typical_hours": "8am-8pm Mon-Sat"},
    {"_type": "service", "name": "Duane Reade Pharmacy Times Sq", "lat": 40.7580, "lng": -73.9855, "category": "pharmacy", "address": "250 W 57th St, New York", "typical_hours": "7am-11pm"},
]

AUSTIN = [
    # Parking
    {"_type": "parking", "name": "6th Street Garage", "lat": 30.2670, "lng": -97.7414, "total_spots": 600, "zone_type": "garage", "hourly_rate": 3.0, "address": "6th St & Congress, Austin"},
    {"_type": "parking", "name": "Congress Avenue Lot", "lat": 30.2652, "lng": -97.7431, "total_spots": 200, "zone_type": "lot", "hourly_rate": 2.0, "address": "Congress Ave, Austin"},
    {"_type": "parking", "name": "Rainey Street Street Parking", "lat": 30.2584, "lng": -97.7388, "total_spots": 75, "zone_type": "street", "hourly_rate": 2.5, "address": "Rainey St, Austin"},
    {"_type": "parking", "name": "Domain Retail Garage", "lat": 30.4005, "lng": -97.7224, "total_spots": 3000, "zone_type": "garage", "hourly_rate": 0.0, "address": "Domain Dr, Austin"},
    {"_type": "parking", "name": "UT Campus Garage", "lat": 30.2849, "lng": -97.7341, "total_spots": 1200, "zone_type": "garage", "hourly_rate": 1.5, "address": "San Jacinto Blvd, Austin"},
    {"_type": "parking", "name": "East Austin Lot", "lat": 30.2614, "lng": -97.7264, "total_spots": 150, "zone_type": "lot", "hourly_rate": 1.0, "address": "E 6th St, Austin"},
    {"_type": "parking", "name": "SoCo Street Parking", "lat": 30.2485, "lng": -97.7486, "total_spots": 60, "zone_type": "street", "hourly_rate": 2.0, "address": "S Congress Ave, Austin"},
    {"_type": "parking", "name": "Austin-Bergstrom Airport Lot", "lat": 30.1975, "lng": -97.6664, "total_spots": 4000, "zone_type": "lot", "hourly_rate": 3.0, "address": "ABIA, Austin"},
    # EV Stations
    {"_type": "ev", "name": "Tesla Supercharger Domain", "lat": 30.4010, "lng": -97.7220, "total_ports": 24, "port_types": {"DCFast": 24}, "network": "Tesla", "address": "Domain Pkwy, Austin"},
    {"_type": "ev", "name": "ChargePoint Downtown Austin", "lat": 30.2672, "lng": -97.7431, "total_ports": 8, "port_types": {"Level2": 6, "DCFast": 2}, "network": "ChargePoint", "address": "Congress Ave, Austin"},
    {"_type": "ev", "name": "Tesla Supercharger Slaughter Lane", "lat": 30.1839, "lng": -97.8004, "total_ports": 20, "port_types": {"DCFast": 20}, "network": "Tesla", "address": "Slaughter Ln, Austin"},
    {"_type": "ev", "name": "EVgo South Austin", "lat": 30.2264, "lng": -97.7866, "total_ports": 6, "port_types": {"DCFast": 6}, "network": "EVgo", "address": "Brodie Ln, Austin"},
    {"_type": "ev", "name": "Electrify America Airport", "lat": 30.1980, "lng": -97.6670, "total_ports": 10, "port_types": {"DCFast": 10}, "network": "Electrify America", "address": "Presidential Blvd, Austin"},
    {"_type": "ev", "name": "Blink UT Campus", "lat": 30.2847, "lng": -97.7350, "total_ports": 6, "port_types": {"Level2": 6}, "network": "Blink", "address": "Dean Keeton St, Austin"},
    # Transit
    {"_type": "transit", "name": "Capital Metro 1 Rapid", "route_type": "bus", "frequency_mins": 10, "stops": ["Tech Ridge P&R", "Rundberg", "North Lamar", "UT Campus", "Capitol", "6th & Congress", "Convention Center", "Riverside", "Oltorf", "Stassney", "Slaughter Ln"]},
    {"_type": "transit", "name": "Capital Metro 3 Congress", "route_type": "bus", "frequency_mins": 15, "stops": ["Domain", "Anderson Ln", "Airport Blvd", "51st St", "38th St", "MLK Jr", "6th St", "Congress & Riverside", "Ben White", "William Cannon"]},
    {"_type": "transit", "name": "MetroRail Red Line", "route_type": "subway", "frequency_mins": 30, "stops": ["Leander", "Howard", "Lakeline", "Domain/Gateway", "Kramer", "Crestview", "Highland", "MLK Jr", "Plaza Saltillo", "Downtown"]},
    {"_type": "transit", "name": "Capital Metro 801 Rapid Blue", "route_type": "bus", "frequency_mins": 10, "stops": ["Rundberg", "Airport Blvd", "Koenig", "Hancock Center", "UT", "Capitol", "Congress", "Riverside", "Ben White", "Slaughter", "Westgate"]},
    # Services
    {"_type": "service", "name": "Austin TX DMV - N Lamar", "lat": 30.3350, "lng": -97.7397, "category": "dmv", "address": "4120 N Lamar Blvd, Austin", "typical_hours": "8am-5pm Tue-Sat"},
    {"_type": "service", "name": "Dell Seton Medical Center", "lat": 30.2849, "lng": -97.7302, "category": "hospital", "address": "1500 Red River St, Austin", "typical_hours": "24/7"},
    {"_type": "service", "name": "St David's Medical Center", "lat": 30.2889, "lng": -97.7225, "category": "hospital", "address": "919 E 32nd St, Austin", "typical_hours": "24/7"},
    {"_type": "service", "name": "Chase Bank 6th Street", "lat": 30.2671, "lng": -97.7432, "category": "bank", "address": "600 Congress Ave, Austin", "typical_hours": "9am-5pm Mon-Fri"},
    {"_type": "service", "name": "USPS Downtown Austin", "lat": 30.2658, "lng": -97.7399, "category": "post_office", "address": "510 Guadalupe St, Austin", "typical_hours": "8am-6pm Mon-Fri"},
]


async def seed():
    await create_tables()
    async with AsyncSessionLocal() as db:
        for city_name, data in [("San Francisco", SAN_FRANCISCO), ("New York", NEW_YORK), ("Austin", AUSTIN)]:
            for item in data:
                t = item["_type"]

                if t == "parking":
                    db.add(ParkingZone(
                        id=uid(), name=item["name"], city=city_name,
                        lat=item["lat"], lng=item["lng"],
                        total_spots=item["total_spots"], zone_type=item["zone_type"],
                        hourly_rate=item["hourly_rate"], address=item["address"],
                    ))

                elif t == "ev":
                    db.add(EVStation(
                        id=uid(), name=item["name"], city=city_name,
                        lat=item["lat"], lng=item["lng"],
                        total_ports=item["total_ports"], port_types=item["port_types"],
                        network=item["network"], address=item["address"],
                    ))

                elif t == "transit":
                    db.add(TransitRoute(
                        id=uid(), name=item["name"], city=city_name,
                        route_type=item["route_type"], stops=item["stops"],
                        frequency_mins=item["frequency_mins"],
                    ))

                elif t == "service":
                    db.add(LocalService(
                        id=uid(), name=item["name"], city=city_name,
                        lat=item["lat"], lng=item["lng"],
                        category=item["category"], address=item["address"],
                        typical_hours=item["typical_hours"],
                    ))

        await db.commit()
        print("✓ Seed data inserted for San Francisco, New York, Austin")


if __name__ == "__main__":
    asyncio.run(seed())
