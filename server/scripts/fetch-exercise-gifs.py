#!/usr/bin/env python3
"""
One-time script to fetch ExerciseDB animated GIF IDs and update seed files.

Run this ONCE when your RapidAPI quota resets (next day).
It maps your 80 exercise names to ExerciseDB IDs, then updates the seed files
with animated GIF URLs.

Usage:
  python3 server/scripts/fetch-exercise-gifs.py

The GIF URL format is:
  https://exercisedb.p.rapidapi.com/image?exerciseId={ID}&resolution=180&rapidapi-key={KEY}

This URL works directly in <Image> tags — no headers needed.
"""

import urllib.request
import json
import time
import os

# Your RapidAPI key (free tier)
API_KEY = "7859782f03mshb9c5410c0487ebdp1160e4jsn8e78dbf5eeb7"
BASE_URL = "https://exercisedb.p.rapidapi.com"

def fetch(endpoint):
    """Fetch from ExerciseDB API with rate limiting."""
    url = f"{BASE_URL}{endpoint}"
    req = urllib.request.Request(url, headers={
        "X-RapidAPI-Key": API_KEY,
        "X-RapidAPI-Host": "exercisedb.p.rapidapi.com"
    })
    resp = urllib.request.urlopen(req)
    return json.loads(resp.read())

def search_exercise(name):
    """Search for an exercise by name. Returns the best match ID or None."""
    # Simplify the name for search
    search_term = name.lower().replace("(", "").replace(")", "").replace("-", " ").strip()
    # Take first 2 words for broader matches
    words = search_term.split()
    search_term = "%20".join(words[:3])
    
    try:
        results = fetch(f"/exercises/name/{search_term}?limit=5")
        if results:
            # Return first match
            return results[0]["id"]
    except Exception as e:
        print(f"  ERROR searching '{name}': {e}")
    return None

def build_gif_url(exercise_id):
    """Build the animated GIF URL for an exercise."""
    return f"https://exercisedb.p.rapidapi.com/image?exerciseId={exercise_id}&resolution=180&rapidapi-key={API_KEY}"

def main():
    script_dir = os.path.dirname(os.path.abspath(__file__))
    seeds_dir = os.path.join(script_dir, "..", "seeds")
    
    seed_files = [
        os.path.join(seeds_dir, "exercises.json"),
        os.path.join(seeds_dir, "exercises-part2.json"),
        os.path.join(seeds_dir, "exercises-part3.json"),
    ]
    
    all_exercises = []
    for fname in seed_files:
        with open(fname) as f:
            all_exercises.extend(json.load(f))
    
    print(f"Total exercises to map: {len(all_exercises)}")
    print(f"API calls needed: ~{len(all_exercises)} (free tier: 100/day)")
    print(f"Estimated time: ~{len(all_exercises) * 2} seconds (2s delay between calls)")
    print()
    
    input("Press Enter to start (make sure your daily quota has reset)...")
    
    mapped = 0
    failed = []
    
    for i, ex in enumerate(all_exercises):
        print(f"[{i+1}/{len(all_exercises)}] {ex['name']}...", end=" ")
        
        exercise_id = search_exercise(ex["name"])
        if exercise_id:
            gif_url = build_gif_url(exercise_id)
            ex["image_url"] = gif_url
            ex["image_url_end"] = ""  # Not needed for animated GIFs
            mapped += 1
            print(f"✓ (ID: {exercise_id})")
        else:
            failed.append(ex["name"])
            print("✗ (keeping current image)")
        
        time.sleep(2)  # Rate limit safety
    
    # Save back to files
    offset = 0
    for fname in seed_files:
        with open(fname) as f:
            original = json.load(f)
        
        count = len(original)
        updated = all_exercises[offset:offset + count]
        
        with open(fname, "w") as f:
            json.dump(updated, f, indent=2)
        
        offset += count
        print(f"Saved {fname}")
    
    print(f"\n{'='*50}")
    print(f"Mapped: {mapped}/{len(all_exercises)}")
    if failed:
        print(f"Failed ({len(failed)}):")
        for name in failed:
            print(f"  - {name}")
    print(f"\nDone! Re-run your seed script to update MongoDB.")

if __name__ == "__main__":
    main()
