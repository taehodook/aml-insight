#!/usr/bin/env python3
# AML 인사이트 '규정' 탭 갱신기. 사용: python3 lexupd.py <현재 lex 문서 폴더> <출력 폴더> [--cases]
import subprocess, re, time, urllib.parse, html, json, os, sys, glob, difflib, datetime

B = "https://www.law.go.kr/DRF/"
OCS = [os.environ.get("LAW_OC", "xogh1004"), "test"]
NAMES = {"fta": "특정 금융거래정보의 보고 및 이용 등에 관한 법률",
         "tf": "공중 등 협박목적 및 대량살상무기확산을 위한 자금조달행위의 금지에 관한 법률",
         "pc": "범죄수익은닉의 규제 및 처벌 등에 관한 법률",
         "vp": "전기통신금융사기 피해 방지 및 피해자산 환급에 관한 특별법",
         "rn": "금융실명거래 및 비밀보장에 관한 법률"}
CASEKEYS = [("특정금융거래정보의보고", "fta"), ("공중등협박목적", "tf"), ("범죄수익은닉의규제", "pc"), ("전기통신금융사기피해", "vp"), ("금융실명거래", "rn")]
LIM = 180000


def get(path, params, need=None, tries=6):
    for t in range(tries):
        oc = OCS[0] if t < 4 else OCS[1]
        url = B + path + "?OC=" + oc + "&" + "&".join(k + "=" + urllib.parse.quote(str(v)) for k, v in params.items())
        try:
            s = subprocess.run(["curl", "-s", "--max-time", "40", url], capture_output=True, timeout=60).stdout.decode("utf-8", "replace")
        except Exception:
            s = ""
        if s and (need is None or need in s):
            return s
        time.sleep(2 + 2 * t)
    return ""


def clean(x):
    x = re.sub(r"<!\[CDATA\[(.*?)\]\]>", r"\1", x, flags=re.S)
    x = re.sub(r"<br\s*/?>", "\n", x)
    return html.unescape(x).strip()


def tag(b, k):
    m = re.search("<" + k + r"(?: [^>]*)?>(.*?)</" + k + ">", b, re.S)
    return clean(m.group(1)) if m else ""


def lawname(key):
    return NAMES[key[:-1]] + " 시행령" if key.endswith("d") else NAMES[key]


def find_law(key):
    name = lawname(key)
    s = get("lawSearch.do", {"target": "law", "type": "XML", "query": name, "display": 100}, need="<totalCnt>")
    for m in re.finditer(r"<law id.*?</law>", s, re.S):
        b = m.group(0)
        if tag(b, "법령명한글") == name and tag(b, "현행연혁코드") == "현행":
            return dict(serial=tag(b, "법령일련번호"), prom=tag(b, "공포일자"), no=tag(b, "공포번호"), eff=tag(b, "시행일자"), type=tag(b, "제개정구분명"))
    return None


def find_adm(name):
    s = get("lawSearch.do", {"target": "admrul", "type": "XML", "query": name, "display": 100}, need="<totalCnt>")
    for m in re.finditer(r"<admrul id.*?</admrul>", s, re.S):
        b = m.group(0)
        if tag(b, "행정규칙명") == name and tag(b, "현행연혁구분") == "현행":
            return dict(serial=tag(b, "행정규칙일련번호"), prom=tag(b, "발령일자"), no=tag(b, "발령번호"), eff=tag(b, "시행일자"), type=tag(b, "제개정구분명"))
    return None


def artno(n, g):
    return n + ("의" + g if g else "")


def parse_law(xml):
    arts, ch = [], ""
    for m in re.finditer(r"<조문단위 [^>]*>(.*?)</조문단위>", xml, re.S):
        b = m.group(1)
        body = tag(b, "조문내용")
        if tag(b, "조문여부") == "전문":
            ch = re.sub(r"\s*<[^>]*>\s*$", "", body).strip()
            continue
        lines = [body]
        def hos(blk):
            for hom in re.finditer(r"<호>(.*?)</호>", blk, re.S):
                t = tag(hom.group(1), "호내용")
                if t: lines.append("  " + t)
                for mm in re.finditer(r"<목>(.*?)</목>", hom.group(1), re.S):
                    t = tag(mm.group(1), "목내용")
                    if t: lines.append("    " + t)
        if re.search(r"<항>", b):
            for hm in re.finditer(r"<항>(.*?)</항>", b, re.S):
                t = tag(hm.group(1), "항내용")
                if t: lines.append(t)
                hos(hm.group(1))
        else:
            hos(b)
        arts.append({"n": artno(tag(b, "조문번호"), tag(b, "조문가지번호")), "t": tag(b, "조문제목"),
                     "x": "\n".join(l.rstrip() for l in lines if l.strip()), "c": ch})
    return arts


def parse_adm(xml):
    arts, ch = [], ""
    blocks = [clean(b).strip() for b in re.findall(r"<조문내용>(.*?)</조문내용>", xml, re.S)]
    for body in blocks:
        if not body: continue
        mm = re.match(r"제(\d+)조(?:의(\d+))?\s*(?:\(([^)]*)\))?", body)
        if not mm:
            if re.match(r"제\d+(장|절|관)", body): ch = body.split("\n")[0].strip()
            continue
        x = re.sub(r"\n\s{2,}", "\n", "\n".join(l.rstrip() for l in body.split("\n") if l.strip()))
        arts.append({"n": artno(mm.group(1), mm.group(2)), "t": (mm.group(3) or "").strip(), "x": x, "c": ch})
    if not arts:
        body = "\n".join(blocks).replace("　", " ")
        for p in re.split(r"(?m)^(?=\d+\.\s)", body):
            mm = re.match(r"(\d+)\.\s*([^\n]*)", p)
            if mm:
                arts.append({"n": mm.group(1) + "호", "t": mm.group(2).strip(), "x": "\n".join(l.rstrip() for l in p.split("\n") if l.strip()), "c": ""})
    return arts


def cdata_lines(xml, k):
    rs = re.search("<" + k + r">(.*?)</" + k + ">", xml, re.S)
    if not rs: return []
    return [l.strip() for l in (clean(x) for x in re.findall(r"<!\[CDATA\[(.*?)\]\]>", rs.group(1), re.S)) if l.strip()]


def mark_p(s):
    s = re.sub(r"<P>(.*?)</P>", r"[[\1]]", clean(s), flags=re.S)
    return re.sub(r"<[^>]+>", "", s).strip()


def old_new(serial):
    s = get("lawService.do", {"target": "oldAndNew", "MST": serial, "type": "XML"}, need="OldAndNewService")
    ol = re.search(r"<구조문목록>(.*?)</구조문목록>", s, re.S)
    nl = re.search(r"<신조문목록>(.*?)</신조문목록>", s, re.S)
    if not (ol and nl): return None
    olds = [mark_p(x) for x in re.findall(r"<조문 no=\"\d+\">(.*?)</조문>", ol.group(1), re.S)]
    news = [mark_p(x) for x in re.findall(r"<조문 no=\"\d+\">(.*?)</조문>", nl.group(1), re.S)]
    return [{"o": a, "n": b} for a, b in zip(olds, news)]


def diff_mark(a, b):
    """두 문자열을 비교해 지운 부분/새 부분을 [[ ]]로 표시"""
    ta, tb = re.findall(r"\s+|[^\s]+", a), re.findall(r"\s+|[^\s]+", b)
    sm = difflib.SequenceMatcher(None, ta, tb, autojunk=False)
    oa, ob = [], []
    for op, i1, i2, j1, j2 in sm.get_opcodes():
        A, Bt = "".join(ta[i1:i2]), "".join(tb[j1:j2])
        if op == "equal":
            oa.append(A); ob.append(Bt)
        else:
            if A.strip(): oa.append("[[" + A + "]]")
            else: oa.append(A)
            if Bt.strip(): ob.append("[[" + Bt + "]]")
            else: ob.append(Bt)
    return "".join(oa), "".join(ob)


def art_diff(ox, nx):
    la, lb = ox.split("\n"), nx.split("\n")
    head = re.match(r"제\d+조(?:의\d+)?(?:\([^)]*\))?", lb[0] if lb else "")
    sm = difflib.SequenceMatcher(None, la, lb, autojunk=False)
    oa, ob, last = [], [], -1
    for op, i1, i2, j1, j2 in sm.get_opcodes():
        if op == "equal": continue
        if last != -1 and i1 > last or (last == -1 and i1 > 0):
            oa.append("⋯"); ob.append("⋯")
        A, Bl = la[i1:i2], lb[j1:j2]
        for k in range(max(len(A), len(Bl))):
            a, b = (A[k] if k < len(A) else ""), (Bl[k] if k < len(Bl) else "")
            if a and b:
                x, y = diff_mark(a, b); oa.append(x); ob.append(y)
            elif a: oa.append("[[" + a.strip() + "]]")
            elif b: ob.append("[[" + b.strip() + "]]")
        last = i2
    if head and not (oa and oa[0].startswith(head.group(0))):
        oa.insert(0, head.group(0)); ob.insert(0, head.group(0))
    return "\n".join(oa), "\n".join(ob)


def adm_pairs(old, new):
    om = {a["n"]: a for a in old}
    nm = {a["n"]: a for a in new}
    order = [a["n"] for a in new] + [n for n in om if n not in nm]
    pairs = []
    for n in order:
        o, w = om.get(n), nm.get(n)
        ox, nx = (o or {}).get("x", ""), (w or {}).get("x", "")
        if ox == nx: continue
        if not o: pairs.append({"o": "(신설)", "n": "[[" + nx + "]]"})
        elif not w: pairs.append({"o": "[[" + ox + "]]", "n": "(삭제)"})
        else:
            a, b = art_diff(ox, nx)
            pairs.append({"o": a, "n": b})
    return pairs


def case_refs(rf, avail):
    out, cur = [], None
    for seg in re.split(r"[,/]|\[\d+\]", rf):
        ns = re.sub(r"\s+", "", seg)
        hit = None
        for nm, k in CASEKEYS:
            i = ns.find(nm)
            if i > -1: hit = k + ("d" if "시행령" in ns[i:i + 60] else "")
        if hit: cur = hit
        elif re.search(r"[가-힣](법|법률|특별법|시행령|시행규칙|규칙|규정)(\([^)]*\))?제\d", ns): cur = None
        if not cur: continue
        m = re.search(r"제(\d+)조(?:의(\d+))?", ns)
        if m:
            n = m.group(1) + ("의" + m.group(2) if m.group(2) else "")
            if n in avail.get(cur, ()) and cur + "|" + n not in out: out.append(cur + "|" + n)
    return out


def chunk(items, size_of=lambda x: len(json.dumps(x, ensure_ascii=False).encode())):
    parts, cur, size = [], [], 0
    for x in items:
        s = size_of(x)
        if cur and size + s > LIM:
            parts.append(cur); cur, size = [], 0
        cur.append(x); size += s
    if cur: parts.append(cur)
    return parts


def main():
    src, out = sys.argv[1], sys.argv[2]
    do_cases = "--cases" in sys.argv
    os.makedirs(out, exist_ok=True)
    def load(n):
        p = os.path.join(src, n + ".json")
        if not os.path.exists(p): return None
        d = json.load(open(p))
        return d.get("data", d) if isinstance(d, dict) and "data" in d and isinstance(d["data"], dict) else d
    meta = load("meta")
    if not meta or not meta.get("docs"):
        print(json.dumps({"error": "meta 없음"})); return
    old_ids = set(os.path.basename(p)[:-5] for p in glob.glob(os.path.join(src, "*.json")))
    arts = {}
    for d in meta["docs"]:
        arts[d["key"]] = []
        for i in range(1, d.get("parts", 0) + 1):
            x = load("a-%s-%d" % (d["key"], i))
            if x: arts[d["key"]] += x.get("arts", [])
    chg = []
    for i in range(1, meta.get("chg", 0) + 1):
        x = load("chg-%d" % i)
        if x: chg += x.get("items", [])
    cases = []
    for i in range(1, meta.get("cases", 0) + 1):
        x = load("cases-%d" % i)
        if x: cases += x.get("cases", [])
    kst = datetime.datetime.now(datetime.timezone.utc).replace(tzinfo=None) + datetime.timedelta(hours=9)
    today = kst.strftime("%Y%m%d")
    changed, notes, failed = [], [], []
    for d in meta["docs"]:
        key = d["key"]
        info = find_law(key) if d["k"] == "law" else find_adm(d["name"])
        if not info:
            failed.append(key); continue
        if info["serial"] == d.get("serial"):
            continue
        if d["k"] == "law":
            xml = get("lawService.do", {"target": "law", "MST": info["serial"], "type": "XML"}, need="<조문단위")
            new = parse_law(xml)
        else:
            xml = get("lawService.do", {"target": "admrul", "ID": info["serial"], "type": "XML"}, need="<조문내용>")
            new = parse_adm(xml)
        if not new or len(new) < 0.7 * max(1, len(arts.get(key, []))):
            failed.append(key + "(본문 확인 실패)"); continue
        item = {"id": key + "-" + info["prom"], "key": key, "prom": info["prom"], "eff": info["eff"], "no": info["no"], "type": info["type"]}
        if d["k"] == "law":
            pairs = old_new(info["serial"])
            item["pairs"] = pairs if pairs else adm_pairs(arts.get(key, []), new)
        else:
            item["why"] = cdata_lines(xml, "제개정이유내용")
            item["amd"] = cdata_lines(xml, "개정문내용")
            item["pairs"] = adm_pairs(arts.get(key, []), new)
        if info["prom"] >= d.get("prom", "") and (item.get("pairs") or item.get("why")):
            chg = [x for x in chg if x["id"] != item["id"]] + [item]
            notes.append("%s %s %s(%s 시행)" % (d["short"], info["prom"], info["type"], info["eff"]))
        arts[key] = new
        d.update(serial=info["serial"], prom=info["prom"], no=info["no"], eff=info["eff"], type=info["type"])
        changed.append(key)
    cutoff = (kst - datetime.timedelta(days=730)).strftime("%Y%m%d")
    chg = sorted([x for x in chg if x["prom"] >= cutoff], key=lambda x: (x["eff"], x["prom"]), reverse=True)
    newcases = 0
    if do_cases:
        have = {c["id"] for c in cases}
        avail = {k: {a["n"] for a in v} for k, v in arts.items()}
        ids = []
        for q in ["특정금융거래정보", "범죄수익은닉", "전기통신금융사기", "금융실명"]:
            s = get("lawSearch.do", {"target": "prec", "type": "XML", "query": q, "display": 50, "sort": "ddes"}, need="<totalCnt>")
            ids += [i for i in re.findall(r"<판례일련번호>(\d+)</판례일련번호>", s) if i not in have and i not in ids]
        for q in ["자금세탁행위", "가상자산사업자"]:
            s = get("lawSearch.do", {"target": "prec", "type": "XML", "query": q, "search": 2, "display": 50, "sort": "ddes"}, need="<totalCnt>")
            ids += [i for i in re.findall(r"<판례일련번호>(\d+)</판례일련번호>", s) if i not in have and i not in ids]
        for i in ids[:60]:
            s = get("lawService.do", {"target": "prec", "ID": i, "type": "XML"}, need="<사건번호>")
            if not s: continue
            nm, hs, yo, rf = tag(s, "사건명"), tag(s, "판시사항"), tag(s, "판결요지"), tag(s, "참조조문")
            if not (hs or yo): continue
            r = case_refs(rf, avail)
            if not r: continue
            cl = lambda x, L: re.sub(r"\n{2,}", "\n", re.sub(r"[ \t]+", " ", x)).strip()[:L]
            cases.append({"id": i, "no": tag(s, "사건번호"), "d": tag(s, "선고일자").replace(".", ""), "ct": tag(s, "법원명"), "nm": cl(nm, 200),
                          "hs": cl(hs, 1200), "yo": cl(yo, 1500), "rf": cl(rf, 700), "refs": r})
            newcases += 1
        cases.sort(key=lambda x: x["d"], reverse=True)
    # 출력
    docs_out = {}
    for d in meta["docs"]:
        ps = chunk(arts[d["key"]])
        d["parts"] = len(ps); d["n"] = len(arts[d["key"]])
        for i, p in enumerate(ps, 1):
            docs_out["a-%s-%d" % (d["key"], i)] = {"key": d["key"], "i": i, "arts": p}
    cps = chunk(chg)
    for i, p in enumerate(cps, 1): docs_out["chg-%d" % i] = {"i": i, "items": p}
    kps = chunk(cases)
    for i, p in enumerate(kps, 1): docs_out["cases-%d" % i] = {"i": i, "cases": p}
    meta.update(asof=today, chg=len(cps), cases=len(kps), ncases=len(cases), nchg=len(chg),
                latest=max([x["prom"] for x in chg] or [meta.get("latest", "")]),
                heads=[{"id": x["id"], "key": x["key"], "prom": x["prom"], "eff": x["eff"], "type": x["type"]} for x in chg])
    docs_out["meta"] = meta
    writes = []
    for n, v in docs_out.items():
        old = load(n)
        if n == "meta" or old != v:
            json.dump(v, open(os.path.join(out, n + ".json"), "w"), ensure_ascii=False)
            writes.append(n)
    deletes = sorted(i for i in old_ids if i not in docs_out and (i.startswith("a-") or i.startswith("chg-") or i.startswith("cases-")))
    print(json.dumps({"today": today, "changed": changed, "notes": notes, "failed": failed, "new_cases": newcases,
                      "writes": sorted(writes, key=lambda n: (n == "meta", n)), "deletes": deletes,
                      "sizes": {n: os.path.getsize(os.path.join(out, n + ".json")) for n in writes}}, ensure_ascii=False))


main()
