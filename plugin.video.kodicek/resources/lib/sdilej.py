# -*- coding: utf-8 -*-
"""
Jednoduchý parser výsledků vyhledávání na Sdílej.cz.
"""
import re
import html
import unicodedata
from urllib.parse import unquote, urljoin
import requests
from typing import Optional, List, Dict, Any

HEADERS = {
    "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) "
                  "AppleWebKit/537.36 (KHTML, like Gecko) "
                  "Chrome/125.0 Safari/537.36"
}

# Corrected regex based on the actual HTML from sdilej_debug.html
# It targets the 'videobox' divs and their internal structure.
RESULTS_RE = re.compile(
    r'<div class="[^"]*videobox[^"]*">.*?'
    r'<p class="videobox-title"><a href="(?P<url>[^"]+)"[^>]*>(?P<title>[^<]+)</a></p>.*?'
    r'<p>(?P<size>[\d.,]+\s*[KMGTP]B)(?: / <b>Délka:</b>\s*(?P<length>[\d:]+))?</p>',
    re.S | re.I
)

def slugify(text: str) -> str:
    """
    Converts text to a URL-friendly slug.
    """
    text = unicodedata.normalize('NFKD', text).encode('ascii', 'ignore').decode('ascii')
    text = text.lower()
    text = re.sub(r'[^a-z0-9]+', '-', text).strip('-')
    return text

def search(query: str, limit: int = 50, session: Optional[requests.Session] = None) -> List[Dict[str, Any]]:
    """
    Searches for files on sdilej.cz using the slug-based URL.
    """
    if session is None:
        session = requests.Session()

    slug = slugify(query)
    url = f"https://sdilej.cz/{slug}/s"
    
    try:
        resp = session.get(url, headers=HEADERS, timeout=15)
        resp.raise_for_status()
        html_content = resp.text
    except requests.exceptions.RequestException:
        return []

    results = []
    for m in RESULTS_RE.finditer(html_content):
        # The URL is absolute, so no need for urljoin
        item_url = m.group('url')
        
        results.append({
            "title": html.unescape(m.group("title").strip()),
            "url": item_url,
            "size": m.group("size").strip(),
            "length": m.group("length").strip() if m.group("length") else "",
        })
        if len(results) >= limit:
            break
            
    return results

if __name__ == '__main__':
    search_query = "telefonni budka"
    search_results = search(search_query)
    print(f"Found {len(search_results)} results for '{search_query}'")
    if search_results:
        print("First result:", search_results[0])

DOWNLOAD_RE = re.compile(
    r'(?:href|src)=["\'](?P<link>https?://[^"\']+/download/[^"\']+)["\']',
    re.I
)

def get_download_url(file_page_url: str,
                     session: Optional[requests.Session] = None) -> Optional[str]:
    """Vrátí přímý odkaz na soubor (MP4/AVI/ZIP…)."""
    if session is None:
        session = requests.Session()

    try:
        r = session.get(file_page_url, headers=HEADERS, timeout=15)
        r.raise_for_status()
    except requests.exceptions.RequestException:
        return None

    m = DOWNLOAD_RE.search(r.text)
    return html.unescape(m.group('link')) if m else None
