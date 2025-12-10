# resources/build_metadata.py
# -*- coding: utf-8 -*-

import json
import os
import urllib.request
import urllib.parse
import time

# --- KONFIGURACE ---
TMDB_API_KEY = "cc58aa7b24e4b6e297f8ec4b5ee0931c"
TMDB_BASE_URL = "https://api.themoviedb.org/3"
SHOW_NAME = "Gilmore Girls" # TMDB najde spolehlivě
SEASONS_COUNT = 7           # Tento seriál má 7 sérií
# -------------------

def tmdb_get(endpoint, params=None):
    if params is None: params = {}
    params["api_key"] = TMDB_API_KEY
    url = f"{TMDB_BASE_URL}{endpoint}?{urllib.parse.urlencode(params)}"
    try:
        req = urllib.request.Request(url)
        with urllib.request.urlopen(req) as response:
            return json.loads(response.read().decode('utf-8'))
    except Exception as e:
        print(f"Chyba {url}: {e}")
        return None

def get_show_id(show_name):
    data = tmdb_get("/search/tv", {"query": show_name, "language": "cs-CZ"})
    if data and data.get("results"):
        return data["results"][0]["id"]
    return None

def build_metadata():
    script_dir = os.path.dirname(os.path.abspath(__file__))
    output_file = os.path.join(script_dir, "metadata.json")

    print(f"Hledám ID pro: {SHOW_NAME}...")
    show_id = get_show_id(SHOW_NAME)
    if not show_id: return

    print(f"ID seriálu: {show_id}")
    metadata = {} 

    for season_num in range(1, SEASONS_COUNT + 1):
        print(f"Stahuji sérii {season_num}...")
        s_cs = tmdb_get(f"/tv/{show_id}/season/{season_num}", {"language": "cs-CZ"})
        s_en = tmdb_get(f"/tv/{show_id}/season/{season_num}", {"language": "en-US"})
        
        if not s_cs: continue

        en_map = {ep["episode_number"]: ep for ep in s_en.get("episodes", [])} if s_en else {}

        for ep_cs in s_cs.get("episodes", []):
            ep_num = ep_cs.get("episode_number")
            key = f"S{season_num:02d}E{ep_num:02d}"
            ep_en = en_map.get(ep_num, {})
            
            title = ep_cs.get("name") or ep_en.get("name", f"Epizoda {ep_num}")
            plot = ep_cs.get("overview") or ep_en.get("overview", "Popis není k dispozici.")
            path = ep_cs.get("still_path") or ep_en.get("still_path")
            thumb = f"https://image.tmdb.org/t/p/w500{path}" if path else ""

            metadata[key] = {"title": title, "plot": plot, "thumb": thumb}
        time.sleep(0.2)

    with open(output_file, "w", encoding="utf-8") as f:
        json.dump(metadata, f, ensure_ascii=False, indent=2)
    print("Hotovo.")

if __name__ == "__main__":
    build_metadata()