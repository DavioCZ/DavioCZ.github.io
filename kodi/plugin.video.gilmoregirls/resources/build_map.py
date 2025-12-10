# resources/build_map.py
# -*- coding: utf-8 -*-
import io, os, re, json, csv, argparse
from collections import OrderedDict

# Regex upravený tak, aby bral prioritně "01x08" (což je v tomto torrentu)
SE_RE = re.compile(r'(?i)(\d{1,2})x(\d{1,2})|S(\d{1,2})E(\d{1,2})')

def bdecode(data: bytes):
    s = io.BytesIO(data)
    def r(n=1):
        b = s.read(n)
        if not b: raise ValueError("Unexpected EOF")
        return b
    def p():
        x = s.read(1)
        if not x: return b""
        s.seek(-1, 1); return x
    def parse():
        c = r(1)
        if c == b'i':
            num = b""; ch = r(1)
            if ch == b'-': num += ch; ch = r(1)
            while ch != b'e':
                if not (b'0' <= ch <= b'9'): raise ValueError("Bad int")
                num += ch; ch = r(1)
            return int(num)
        if c == b'l':
            out = []
            while p() != b'e': out.append(parse())
            r(1); return out
        if c == b'd':
            d = OrderedDict()
            while p() != b'e':
                k = parse()
                if not isinstance(k, (bytes, bytearray)): raise ValueError("Key must be bytes")
                d[bytes(k)] = parse()
            r(1); return d
        if b'0' <= c <= b'9':
            ln = c; ch = r(1)
            while ch != b':':
                if not (b'0' <= ch <= b'9'): raise ValueError("Bad strlen")
                ln += ch; ch = r(1)
            n = int(ln); return r(n)
        raise ValueError("Bad prefix: %r" % c)
    return parse()

def parse_filetree(node, prefix):
    files = []
    for name_b, sub in node.items():
        if name_b == b'':
            length = int(sub.get(b'length', 0)) if isinstance(sub, dict) else 0
            files.append(("/".join(prefix), length)); continue
        name = name_b.decode("utf-8", "ignore")
        if isinstance(sub, dict):
            if b'' in sub:
                meta = sub[b'']
                length = int(meta.get(b'length', 0)) if isinstance(meta, dict) else 0
                files.append(("/".join(prefix + [name]), length))
            children = {k: v for k, v in sub.items() if k != b''}
            if children:
                files += parse_filetree(children, prefix + [name])
    return files

def load_files(torrent_path):
    with open(torrent_path, 'rb') as f:
        t = bdecode(f.read())
    info = t.get(b'info', {})
    files = []
    if b'files' in info:
        for f in info[b'files']:
            parts = [p.decode("utf-8", "ignore") for p in f.get(b'path', [])]
            files.append(("/".join(parts), int(f.get(b'length', 0))))
    elif b'name' in info and b'length' in info:
        files.append((info[b'name'].decode("utf-8", "ignore"), int(info[b'length'])))
    elif b'file tree' in info:
        root = info.get(b'name', b'').decode("utf-8", "ignore")
        files = parse_filetree(info[b'file tree'], [root] if root else [])
    else:
        raise ValueError("Nepodporovaná struktura torrentu.")
    
    # ZMĚNA: Filtr na .avi (tento torrent obsahuje AVI)
    return [(p, l) for p, l in files if p.lower().endswith(".avi")]

def parse_se(path):
    m = SE_RE.search(path.replace(" ", ""))
    if not m: return None
    # Skupiny 1 a 2 jsou pro formát 01x08
    if m.group(1): return int(m.group(1)), int(m.group(2))
    # Skupiny 3 a 4 jsou pro formát S01E08 (kdyby náhodou)
    return int(m.group(3)), int(m.group(4))

def build_map(files):
    olist = [{"oindex": i, "path": p, "se": parse_se(p)} for i, (p, _) in enumerate(files)]
    esorted = sorted(olist, key=lambda x: x["path"])
    path2e = {row["path"]: idx for idx, row in enumerate(esorted)}
    o2e = {row["oindex"]: path2e[row["path"]] for row in olist}
    se2e = {}
    for row in olist:
        if row["se"]:
            s, e = row["se"]
            se2e[f"S{s:02d}E{e:02d}"] = path2e[row["path"]]
    return olist, o2e, se2e

def main():
    script_dir = os.path.dirname(os.path.abspath(__file__))
    # ZMĚNA: Název torrentu
    default_torrent = os.path.join(script_dir, "gilmore.torrent")
    default_json = os.path.join(script_dir, "map.json")
    default_csv  = os.path.join(script_dir, "map.csv")

    ap = argparse.ArgumentParser()
    ap.add_argument("--torrent", "-t", default=default_torrent)
    ap.add_argument("--out-json", default=default_json)
    ap.add_argument("--out-csv",  default=default_csv)
    args = ap.parse_args()

    if not os.path.isfile(args.torrent):
        print(f"Chybí soubor: {args.torrent}")
        raise SystemExit(2)

    files = load_files(args.torrent)
    if not files:
        print("V torrentu nejsou žádné .avi soubory.")
        raise SystemExit(3)

    _, o2e, se2e = build_map(files)

    with open(args.out_json, "w", encoding="utf-8") as f:
        json.dump({"o2e": o2e, "se2e": se2e}, f, ensure_ascii=False, indent=2)

    print(f"Mapa vytvořena: {len(se2e)} epizod nalezeno.")

if __name__ == "__main__":
    main()