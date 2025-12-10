# -*- coding: utf-8 -*-

import sys
import os
import re
import urllib.parse
import json
import xbmc
import xbmcgui
import xbmcplugin
import xbmcaddon
import bencode

_URL = sys.argv[0]
_HANDLE = int(sys.argv[1])

def get_params():
    paramstring = sys.argv[2][1:]
    if paramstring:
        return dict(urllib.parse.parse_qsl(paramstring))
    return {}

def load_json_file(filename):
    try:
        addon = xbmcaddon.Addon()
        addon_path = addon.getAddonInfo('path')
        file_path = os.path.join(addon_path, 'resources', filename)
        if os.path.exists(file_path):
            with open(file_path, 'r', encoding='utf-8') as f:
                return json.load(f)
    except Exception as e:
        xbmc.log(f"[gilmore] Error loading {filename}: {e}", level=xbmc.LOGWARNING)
    return {}

def list_seasons():
    xbmcplugin.setPluginCategory(_HANDLE, "Gilmore Girls")
    # Gilmore Girls mají 7 sérií
    for i in range(1, 8):
        list_item = xbmcgui.ListItem(label=f"Série {i}")
        list_item.setInfo('video', {'title': f"Série {i}", 'season': i, 'tvshowtitle': 'Gilmore Girls'})
        url = f"{_URL}?action=list_episodes&season={i}"
        xbmcplugin.addDirectoryItem(handle=_HANDLE, url=url, listitem=list_item, isFolder=True)
    xbmcplugin.endOfDirectory(_HANDLE)

def get_torrent_files_info():
    addon = xbmcaddon.Addon()
    addon_path = addon.getAddonInfo('path')
    # Změna názvu torrentu
    torrent_file_path = os.path.join(addon_path, 'resources', 'gilmore.torrent')

    if not os.path.exists(torrent_file_path):
        xbmcgui.Dialog().notification("Chyba", "Torrent soubor nebyl nalezen!", xbmcgui.NOTIFICATION_ERROR)
        return None, None

    try:
        with open(torrent_file_path, 'rb') as f:
            torrent_data = bencode.bdecode(f.read())
    except Exception as e:
        xbmcgui.Dialog().notification("Chyba", f"Nepodařilo se načíst torrent: {e}", xbmcgui.NOTIFICATION_ERROR)
        return None, None

    files_in_torrent = []
    torrent_info = torrent_data.get(b'info', {})
    if b'files' in torrent_info:
        for idx, f in enumerate(torrent_info[b'files']):
            path_parts = [part.decode('utf-8', errors='ignore') for part in f.get(b'path', [])]
            if not path_parts: continue
            files_in_torrent.append({'path': os.path.join(*path_parts), 'oindex': idx})
    elif b'name' in torrent_info:
        files_in_torrent.append({'path': torrent_info[b'name'].decode('utf-8', errors='ignore'), 'oindex': 0})
    
    return files_in_torrent, torrent_file_path

def list_episodes(season):
    files_in_torrent, torrent_file_path = get_torrent_files_info()
    if files_in_torrent is None:
        xbmcplugin.endOfDirectory(_HANDLE, succeeded=False)
        return

    xbmcplugin.setPluginCategory(_HANDLE, f"Série {season}")

    # Změna REGEXu: Hledáme "01x08" nebo "S01E08"
    episode_pattern = re.compile(r'(?:(\d{1,2})x(\d{1,2}))|(?:S(\d{1,2})E(\d{1,2}))', re.IGNORECASE)

    data_map = load_json_file('map.json')
    se2e = data_map.get("se2e", {}) if isinstance(data_map, dict) else {}
    metadata = load_json_file('metadata.json')

    episode_items = []

    for file_info in files_in_torrent:
        f_path = file_info['path']
        oindex = file_info['oindex']
        filename = os.path.basename(f_path)

        # Změna: Filtr na AVI (podle tvého výpisu torrentu)
        if not filename.lower().endswith('.avi'):
            continue

        match = episode_pattern.search(filename)
        if not match:
            continue

        # Logika pro regex (buď matchnulo skupinu 1 a 2, nebo 3 a 4)
        if match.group(1):
            file_season = int(match.group(1))
            episode_num = int(match.group(2))
        else:
            file_season = int(match.group(3))
            episode_num = int(match.group(4))

        if file_season != int(season):
            continue

        episode_key = f"S{file_season:02d}E{episode_num:02d}"
        
        mapped_index = se2e.get(episode_key, oindex)
        meta_data = metadata.get(episode_key, {})
        
        display_title = meta_data.get('title', f"{file_season}x{episode_num}")
        display_plot = meta_data.get('plot', 'Popis není k dispozici.')
        display_thumb = meta_data.get('thumb', '')

        torrent_uri_encoded = urllib.parse.quote_plus(torrent_file_path)
        elementum_url = f"plugin://plugin.video.elementum/play?uri={torrent_uri_encoded}&index={mapped_index}"

        list_item = xbmcgui.ListItem(label=display_title)
        list_item.setInfo('video', {
            'title': display_title,
            'season': file_season,
            'episode': episode_num,
            'plot': display_plot,
            'tvshowtitle': 'Gilmore Girls',
            'mediatype': 'episode'
        })
        
        if display_thumb:
            list_item.setArt({'thumb': display_thumb, 'icon': display_thumb, 'fanart': display_thumb})
            
        list_item.setProperty('IsPlayable', 'true')
        play_url = f"{_URL}?action=play&uri={elementum_url}"
        episode_items.append((episode_num, play_url, list_item))

    for ep_num, url, item in sorted(episode_items, key=lambda x: x[0]):
        xbmcplugin.addDirectoryItem(handle=_HANDLE, url=url, listitem=item, isFolder=False)

    xbmcplugin.endOfDirectory(_HANDLE)

def play_item(uri):
    list_item = xbmcgui.ListItem(path=uri)
    xbmcplugin.setResolvedUrl(_HANDLE, True, listitem=list_item)

def router(paramstring):
    if 'action=play' in paramstring:
        try:
            uri_part = paramstring.split('&uri=', 1)[1]
            play_item(uri_part)
        except IndexError: pass
    else:
        params = get_params()
        action = params.get('action')
        if action is None:
            list_seasons()
        elif action == 'list_episodes':
            list_episodes(params['season'])

if __name__ == '__main__':
    router(sys.argv[2])