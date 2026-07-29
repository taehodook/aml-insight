# -*- coding: utf-8 -*-
"""
데일리 AML 브리핑 — collect.py
뉴스 수집(Google News RSS, 키 불필요) + 키워드 트렌드 + 제재 리스트 변동(diff) + 브리핑 생성
사용법: python3 collect.py   (이후 python3 build.py 로 index.html 생성)
환경변수 GEMINI_API_KEY 가 있으면 AI 브리핑, 없으면 템플릿 브리핑으로 동작.
산출물: data.json, sanctions_snapshot.json (다음 날 diff 기준)
"""
import csv, io, json, os, re, ssl, sys, urllib.request, urllib.parse
import xml.etree.ElementTree as ET
from email.utils import parsedate_to_datetime
from datetime import datetime, timezone, timedelta

KST = timezone(timedelta(hours=9))
TODAY = datetime.now(KST).strftime("%Y-%m-%d")
UA = {"User-Agent": "Mozilla/5.0 (AML-Insight-Briefing/1.0)"}

NEWS_QUERIES = ["자금세탁", "보이스피싱 계좌", "가상자산 규제", "금융정보분석원",
                "대포통장", "상품권 깡", "불법 환치기", "의심거래 보고"]

# STR 테마점검용 키워드 워치리스트 (제목+요약에서 출현 빈도 집계)
WATCHLIST = ["자금세탁","보이스피싱","대포통장","가상자산","코인","거래소","환치기","상품권",
             "리딩방","도박","마약","사기","횡령","제재","북한","FIU","특금법","STR","CDD",
             "가상계좌","테더","불법사금융","유사수신","피싱","명의도용","외환","밀수","탈세"]

# 픽 선정용 가중치 (AML 직결도)
KW_WEIGHT = {"자금세탁":3,"FIU":3,"특금법":3,"STR":3,"환치기":3,"제재":2,"대포통장":2,
             "보이스피싱":2,"가상계좌":2,"상품권":2,"불법사금융":2,"유사수신":2,"CDD":2,"북한":2}

# 키워드 → 관련 탐지 룰 추천 (STR 라이브러리 연계)
RULE_MAP = {"상품권":"상품권 업종 결제 집중 룰","보이스피싱":"급조 계좌 고속 통과(Pass-through) 룰",
            "대포통장":"급조 계좌 고속 통과(Pass-through) 룰","가상자산":"집금→거래소 당일 연계 룰",
            "거래소":"집금→거래소 당일 연계 룰","환치기":"집금→거래소 당일 연계 룰",
            "가상계좌":"가상계좌 정산금 제3자 이전 룰","횡령":"법인→대표 개인계좌 비정형 유출 룰"}

def fetch(url, timeout=40):
    req = urllib.request.Request(url, headers=UA)
    ctx = ssl.create_default_context()
    with urllib.request.urlopen(req, timeout=timeout, context=ctx) as r:
        return r.read()

# ───────────────────────── 뉴스 수집 ─────────────────────────
def collect_news():
    seen, items = set(), []
    cutoff = datetime.now(timezone.utc) - timedelta(days=3)
    for q in NEWS_QUERIES:
        url = ("https://news.google.com/rss/search?q=" + urllib.parse.quote(q) +
               "&hl=ko&gl=KR&ceid=KR:ko")
        try:
            root = ET.fromstring(fetch(url))
        except Exception as e:
            print(f"  [skip] {q}: {e}", file=sys.stderr); continue
        for it in root.iter("item"):
            title = (it.findtext("title") or "").strip()
            link = (it.findtext("link") or "").strip()
            src = (it.findtext("source") or "").strip()
            pub = it.findtext("pubDate") or ""
            try:
                ts = parsedate_to_datetime(pub)
            except Exception:
                continue
            if ts < cutoff: continue
            # 제목 끝 " - 매체명" 제거
            tclean = re.sub(r"\s+-\s+[^-]+$", "", title)
            key = re.sub(r"\s+", "", tclean)[:40]
            if key in seen: continue
            seen.add(key)
            items.append({"t": tclean, "src": src, "link": link,
                          "ts": ts.astimezone(KST).strftime("%Y-%m-%d %H:%M"), "q": q})
    items.sort(key=lambda x: x["ts"], reverse=True)
    return items[:60]

def pick_news(news):
    """AML 직결 키워드 가중 스코어 상위 3건 — 인사이트 픽"""
    scored = []
    for n in news:
        hits = [k for k in WATCHLIST if re.search(re.escape(k), n["t"], re.IGNORECASE)]
        if not hits: continue
        score = sum(KW_WEIGHT.get(k, 1) for k in hits)
        scored.append((score, hits, n))
    scored.sort(key=lambda x: -x[0])
    out, seen = [], set()
    for score, hits, n in scored:
        key = n["src"]  # 매체 다양성: 같은 매체 1건씩
        if key in seen: continue
        seen.add(key)
        out.append({**n, "kws": hits[:4], "score": score})
        if len(out) == 3: break
    return out

def keyword_counts(news):
    text = " ".join(n["t"] for n in news)
    out = []
    for k in WATCHLIST:
        n = len(re.findall(re.escape(k), text, re.IGNORECASE))
        if n: out.append({"k": k, "n": n})
    out.sort(key=lambda x: -x["n"])
    return out

# ───────────────────────── 레그워치 (제재공시·유권해석) ─────────────────────────
import ssl as _ssl
_CTX=_ssl.create_default_context(); _CTX.check_hostname=False; _CTX.verify_mode=_ssl.CERT_NONE
def fetch_gov(url, timeout=25):
    req=urllib.request.Request(url, headers=UA)
    with urllib.request.urlopen(req, timeout=timeout, context=_CTX) as r:
        return r.read().decode("utf-8","ignore")

def collect_fss_sanctions():
    """금감원 검사결과제재 공시 — 자금세탁방지실 조사 건만 수집 (최대 15페이지 스캔)"""
    out=[]
    try:
        for p in range(1, 16):
            b=fetch_gov(f"https://www.fss.or.kr/fss/job/openInfoImpr/list.do?menuNo=200476&pageIndex={p}")
            m=re.search(r"<tbody>(.*?)</tbody>", b, re.S)
            if not m: break
            rows=re.findall(r"<tr>(.*?)</tr>", m.group(1), re.S)
            if not rows: break
            for tr in rows:
                if "자금세탁" not in tr: continue
                tds=re.findall(r"<td[^>]*>(.*?)</td>", tr, re.S)
                if len(tds)<5: continue
                org=re.sub(r"<[^>]+>","",tds[1]).strip()
                d=re.sub(r"\D","",tds[2])[:8]
                href=re.search(r'href="([^"]+)"', tds[3])
                if not org or len(d)!=8: continue
                out.append({"org":org,"d":f"{d[:4]}-{d[4:6]}-{d[6:]}","dept":"자금세탁방지실","aml":1,
                            "url":"https://www.fss.or.kr"+href.group(1).replace("&amp;","&") if href else ""})
            if len(out)>=8: break
        return out[:8]
    except Exception as e:
        print(f"  [skip] FSS 제재: {e}", file=sys.stderr); return out

def collect_fsc_interp():
    """금융위 자금세탁 관련 공시 — 의결서 공개·보도자료에서 키워드 필터.
    금융위 WAF가 클라우드 IP를 차단(503)하는 경우가 있어 실패 시 자동 스킵."""
    out=[]
    kw=re.compile(r"자금세탁|특정\s*금융|FIU|테러자금|가상자산사업자")
    for base in ("https://www.fsc.go.kr/po040200", "https://www.fsc.go.kr/no010101"):
        try:
            b=fetch_gov(base, 18)
            for mm in re.finditer(r'href="(/(?:po|no)\d+/\d+[^"]*)"[^>]*>\s*([^<]{6,140})', b):
                t=re.sub(r"\s+"," ",mm.group(2)).strip()
                if not kw.search(t): continue
                out.append({"t":t,"url":"https://www.fsc.go.kr"+mm.group(1).replace("&amp;","&")})
                if len(out)>=6: return out
        except Exception as e:
            print(f"  [skip] 금융위({base.split('/')[-1]}): {str(e)[:40]}", file=sys.stderr)
    return out

def collect_papers():
    """arXiv 최신 AML 논문 (키 불필요)"""
    try:
        q=urllib.parse.quote('all:"money laundering" OR all:"anti-money laundering"')
        b=fetch(f"http://export.arxiv.org/api/query?search_query={q}&sortBy=submittedDate&sortOrder=descending&max_results=8")
        root=ET.fromstring(b)
        ns={"a":"http://www.w3.org/2005/Atom"}
        out=[]
        for e in root.findall("a:entry", ns):
            t=re.sub(r"\s+"," ",(e.findtext("a:title","",ns) or "")).strip()
            link=e.findtext("a:id","",ns) or ""
            d=(e.findtext("a:published","",ns) or "")[:10]
            if t: out.append({"t":t,"d":d,"url":link})
        return out
    except Exception as e:
        print(f"  [skip] arXiv: {e}", file=sys.stderr); return []

# ───────────────────────── 제재 변동 ─────────────────────────
def snap_ofac():
    d = {}
    raw = fetch("https://www.treasury.gov/ofac/downloads/sdn.csv", 120).decode("latin-1")
    for row in csv.reader(io.StringIO(raw)):
        if len(row) < 4: continue
        name = row[1].strip().strip('"')
        if not name or name.startswith("-0-"): continue
        t = row[2].strip()
        d[row[0].strip()] = [name, row[3].strip().strip('"'),
                             "개인" if t == "individual" else ("선박" if t == "vessel" else ("항공기" if t == "aircraft" else "단체"))]
    return d

def snap_un():
    d = {}
    root = ET.fromstring(fetch("https://scsanctions.un.org/resources/xml/en/consolidated.xml", 180))
    for tag, is_ind in (("INDIVIDUAL", True), ("ENTITY", False)):
        for e in root.iter(tag):
            ref = e.findtext("REFERENCE_NUMBER") or e.findtext("DATAID") or ""
            if not ref: continue
            if is_ind:
                name = " ".join(filter(None, [(e.findtext(k) or "").strip() for k in
                        ("FIRST_NAME","SECOND_NAME","THIRD_NAME","FOURTH_NAME")]))
            else:
                name = (e.findtext("FIRST_NAME") or "").strip()
            d[ref] = [name, e.findtext("UN_LIST_TYPE") or "", "개인" if is_ind else "단체"]
    return d

def snap_eu():
    d = {}
    raw = fetch("https://webgate.ec.europa.eu/fsd/fsf/public/files/csvFullSanctionsList_1_1/content?token=dG9rZW4tMjAxNw", 120).decode("utf-8-sig")
    rdr = csv.DictReader(io.StringIO(raw), delimiter=";")
    for row in rdr:
        ref = row.get("Entity_EU_ReferenceNumber") or ""
        if not ref or ref in d: continue
        d[ref] = [(row.get("NameAlias_WholeName") or "").strip(),
                  row.get("Entity_Regulation_Programme") or "",
                  "개인" if (row.get("Entity_SubjectType") or "").lower() == "person" else "단체"]
    return d

def sanctions_diff():
    cur = {}
    for s, fn in (("OFAC", snap_ofac), ("UN", snap_un), ("EU", snap_eu)):
        try:
            cur[s] = fn(); print(f"  {s}: {len(cur[s]):,}")
        except Exception as e:
            print(f"  [skip] {s}: {e}", file=sys.stderr); cur[s] = None
    prev = None
    if os.path.exists("sanctions_snapshot.json"):
        prev = json.load(open("sanctions_snapshot.json", encoding="utf-8"))
    added, removed, first = [], [], prev is None
    if prev:
        for s in ("OFAC", "UN", "EU"):
            if cur.get(s) is None or s not in prev: continue
            for k, v in cur[s].items():
                if k not in prev[s]: added.append({"s": s, "name": v[0], "prog": v[1], "type": v[2]})
            for k, v in prev[s].items():
                if k not in cur[s]: removed.append({"s": s, "name": v[0], "prog": v[1], "type": v[2]})
    # 스냅샷 갱신 (실패한 소스는 이전 값 유지)
    save = {s: (cur[s] if cur.get(s) is not None else (prev or {}).get(s, {})) for s in ("OFAC","UN","EU")}
    json.dump(save, open("sanctions_snapshot.json", "w", encoding="utf-8"), ensure_ascii=False)
    counts = {s: len(save[s]) for s in save}
    return {"date": TODAY, "added": added[:80], "removed": removed[:80],
            "addedN": len(added), "removedN": len(removed), "counts": counts, "first": first}

# ───────────────────────── 브리핑 생성 ─────────────────────────
def gen_briefing(news, kws, sanc, prev_kw):
    key = os.environ.get("GEMINI_API_KEY", "")
    if key:
        # 모델 폴백 체인: 환경변수 GEMINI_MODEL 우선, 이후 무료 티어 모델 순차 시도
        models = ([os.environ["GEMINI_MODEL"]] if os.environ.get("GEMINI_MODEL") else []) + \
                 ["gemini-3-flash", "gemini-3-flash-preview", "gemini-2.5-flash", "gemini-2.5-flash-lite"]
        try:
            top_news = "\n".join(f"- {n['t']} ({n['src']})" for n in news[:25])
            sd = (f"제재 변동: 신규 {sanc['addedN']}건, 해제 {sanc['removedN']}건"
                  if not sanc["first"] else "제재 변동: 오늘 첫 스냅샷 생성")
            prompt = (f"당신은 한국 AML(자금세탁방지) 전문가입니다. 오늘({TODAY}) 수집된 아래 뉴스 제목과 "
                      f"제재 리스트 변동을 바탕으로 AML 실무자를 위한 '오늘의 브리핑'을 한국어로 작성하세요. "
                      f"3개 문단, 각 2~3문장. 1문단: 오늘의 핵심 동향. 2문단: 실무 시사점(STR 테마점검 관점). "
                      f"3문단: 제재 변동 요약. 과장 없이 사실 기반으로. 마크다운 기호 없이 평문으로.\n\n{sd}\n\n뉴스:\n{top_news}")
            body = json.dumps({"contents": [{"parts": [{"text": prompt}]}],
                               "generationConfig": {"maxOutputTokens": 800}}).encode()
            for model in models:
                try:
                    req = urllib.request.Request(
                        f"https://generativelanguage.googleapis.com/v1beta/models/{model}:generateContent?key=" + key,
                        data=body, headers={"Content-Type": "application/json"})
                    with urllib.request.urlopen(req, timeout=60) as r:
                        res = json.load(r)
                    text = res["candidates"][0]["content"]["parts"][0]["text"].strip()
                    print(f"  AI 브리핑 생성 (모델: {model})")
                    return {"mode": "ai", "paras": [p.strip() for p in text.split("\n") if p.strip()][:5]}
                except Exception as me:
                    print(f"  [모델 {model} 실패, 다음 시도] {me}", file=sys.stderr)
        except Exception as e:
            print(f"  [Gemini 실패→템플릿 전환] {e}", file=sys.stderr)
    # 템플릿 브리핑
    paras = []
    if kws:
        tops = ", ".join(f"{k['k']}({k['n']}건)" for k in kws[:4])
        rising = [k for k in kws[:6] if k["n"] > prev_kw.get(k["k"], 0)]
        p1 = f"오늘 수집된 AML 관련 뉴스는 {len(news)}건입니다. 가장 두드러진 키워드는 {tops}입니다."
        if rising and prev_kw:
            p1 += " 전일 대비 " + ", ".join(f"'{k['k']}'" for k in rising[:3]) + " 관련 보도가 늘었습니다."
        paras.append(p1)
        recs = []
        for k in kws[:6]:
            if k["k"] in RULE_MAP and RULE_MAP[k["k"]] not in recs:
                recs.append(RULE_MAP[k["k"]])
        if recs:
            paras.append("STR 테마점검 제안: 오늘의 키워드와 연관된 " + ", ".join(recs[:3]) +
                         "의 가동 여부와 임계값을 점검해 보세요.")
    else:
        paras.append(f"오늘 수집된 AML 관련 뉴스는 {len(news)}건입니다.")
    if sanc["first"]:
        paras.append(f"제재 리스트 기준 스냅샷을 생성했습니다 (OFAC {sanc['counts'].get('OFAC',0):,} · "
                     f"UN {sanc['counts'].get('UN',0):,} · EU {sanc['counts'].get('EU',0):,}건). 내일부터 신규 지정·해제 변동을 추적합니다.")
    elif sanc["addedN"] or sanc["removedN"]:
        progs = {}
        for a in sanc["added"]: progs[a["prog"]] = progs.get(a["prog"], 0) + 1
        ptxt = ", ".join(f"{p or '기타'} {n}건" for p, n in sorted(progs.items(), key=lambda x: -x[1])[:3])
        paras.append(f"제재 변동: 신규 지정 {sanc['addedN']}건({ptxt}), 해제 {sanc['removedN']}건. "
                     f"WLF 솔루션의 리스트 업데이트 반영 여부를 확인하세요.")
    else:
        paras.append("제재 변동: 오늘은 OFAC·UN·EU 신규 지정 및 해제가 없습니다.")
    return {"mode": "template", "paras": paras}

# ───────────────────────── 메인 ─────────────────────────
def main():
    prev = {}
    if os.path.exists("data.json"):
        prev = json.load(open("data.json", encoding="utf-8"))
    prev_kw = {k["k"]: k["n"] for k in prev.get("keywords", [])}

    print("뉴스 수집 중...")
    news = collect_news()
    kws = keyword_counts(news)
    for k in kws: k["prev"] = prev_kw.get(k["k"], 0)
    print(f"  뉴스 {len(news)}건, 키워드 {len(kws)}종")

    print("제재 리스트 변동 확인 중...")
    sanc = sanctions_diff()

    print("레그워치·논문 수집 중...")
    regwatch = {"fss": collect_fss_sanctions(), "fsc": collect_fsc_interp()}
    papers = collect_papers()
    print(f"  금감원 제재 {len(regwatch['fss'])}건 / 금융위 해석 {len(regwatch['fsc'])}건 / 논문 {len(papers)}건")

    print("브리핑 생성 중...")
    brief = gen_briefing(news, kws, sanc, prev_kw)

    # 아카이브 (최근 14일)
    hist = prev.get("history", [])
    hist = [h for h in hist if h["date"] != TODAY]
    if prev.get("today") and prev.get("today") != TODAY and prev.get("briefing"):
        hist.insert(0, {"date": prev["today"], "paras": prev["briefing"]["paras"],
                        "top": [k["k"] for k in prev.get("keywords", [])[:3]]})
    hist = hist[:14]

    data = {"generated": datetime.now(KST).strftime("%Y-%m-%d %H:%M"), "today": TODAY,
            "briefing": brief, "keywords": kws[:14], "news": news, "picks": pick_news(news), "regwatch": regwatch, "papers": papers,
            "sanctions": sanc, "history": hist}
    json.dump(data, open("data.json", "w", encoding="utf-8"), ensure_ascii=False, separators=(",", ":"))
    print(f"data.json 생성 완료 ({brief['mode']} 브리핑)")

if __name__ == "__main__":
    main()
