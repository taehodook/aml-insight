#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
뉴스 기반 업종 위험평가 수집기
- 국내(한국어) + 해외(영문) 자금세탁/범죄 뉴스 수집 (Google News RSS)
- 업종 키워드 매칭 → 업종별 노출 빈도 집계
- 기준 위험등급(FATF·특금법·FinCEN)과 결합해 종합 위험점수 산출
- 근거 뉴스 링크 목록 포함
- 결과: ra_news.json
"""
import urllib.request, ssl, re, json, html
from xml.etree import ElementTree as ET
from datetime import datetime, timezone, timedelta

H = {"User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) Chrome/120"}
CTX = ssl.create_default_context(); CTX.check_hostname=False; CTX.verify_mode=ssl.CERT_NONE
KST = timezone(timedelta(hours=9))

# ── 수집할 뉴스 쿼리 (국내 + 해외) ──
FEEDS = [
    # 국내
    ("KR", "자금세탁", "https://news.google.com/rss/search?q=%EC%9E%90%EA%B8%88%EC%84%B8%ED%83%81&hl=ko&gl=KR&ceid=KR:ko"),
    ("KR", "범죄수익", "https://news.google.com/rss/search?q=%EB%B2%94%EC%A3%84%EC%88%98%EC%9D%B5+%EC%9D%80%EB%8B%89&hl=ko&gl=KR&ceid=KR:ko"),
    ("KR", "보이스피싱", "https://news.google.com/rss/search?q=%EB%B3%B4%EC%9D%B4%EC%8A%A4%ED%94%BC%EC%8B%B1+%EA%B3%84%EC%A2%8C&hl=ko&gl=KR&ceid=KR:ko"),
    # 해외 영문
    ("EN", "money laundering", "https://news.google.com/rss/search?q=money+laundering&hl=en-US&gl=US&ceid=US:en"),
    ("EN", "money laundering arrest", "https://news.google.com/rss/search?q=money+laundering+arrest+OR+charged&hl=en-US&gl=US&ceid=US:en"),
    ("EN", "crypto laundering", "https://news.google.com/rss/search?q=crypto+money+laundering&hl=en-US&gl=US&ceid=US:en"),
]

# ── 업종 키워드 (국문 + 영문) ──
INDUSTRIES = [
    {"name":"가상자산사업자", "level":3, "flags":["FATF","특금법","FinCEN"],
     "kw":["가상자산","코인","거래소","비트코인","암호화폐","디파이","스테이블코인","가상화폐","crypto","bitcoin","virtual asset","stablecoin","exchange","token","defi"]},
    {"name":"환전·송금(MSB)", "level":3, "flags":["FATF","특금법","FinCEN"],
     "kw":["환전","환치기","외환","송금","해외송금","money transfer","remittance","hawala","msb","currency exchange","wire transfer"]},
    {"name":"카지노·사행산업", "level":3, "flags":["FATF","특금법","FinCEN"],
     "kw":["카지노","도박","사행","casino","gambling","betting"]},
    {"name":"귀금속·보석", "level":3, "flags":["FATF","FinCEN"],
     "kw":["귀금속","금괴","보석","골드바","gold","jewelry","precious metal","diamond","bullion"]},
    {"name":"부동산", "level":3, "flags":["FATF","특금법"],
     "kw":["부동산","분양","real estate","property","realtor"]},
    {"name":"법인설립·신탁(TCSP)", "level":3, "flags":["FATF","특금법"],
     "kw":["페이퍼컴퍼니","페이퍼 컴퍼니","신탁","법인설립","shell company","shell corporation","trust","offshore","nominee"]},
    {"name":"변호사·회계 등 전문직", "level":2, "flags":["FATF"],
     "kw":["변호사","법무법인","회계","세무","lawyer","attorney","accountant","law firm","gatekeeper"]},
    {"name":"상품권·선불수단", "level":2, "flags":["특금법","FinCEN"],
     "kw":["상품권","선불","깡","페이","gift card","prepaid","voucher"]},
    {"name":"무역(TBML)", "level":2, "flags":["FATF"],
     "kw":["무역","수출입","무역기반","trade-based","trade based","invoice","over-invoicing","trade finance"]},
    {"name":"전당포·대부업", "level":2, "flags":["특금법"],
     "kw":["전당포","대부업","사채","pawn","payday","loan shark"]},
    {"name":"미술품·골동품", "level":2, "flags":["FATF","FinCEN"],
     "kw":["미술품","골동품","경매","art","antique","auction"]},
    {"name":"주점·유흥업", "level":2, "flags":["특금법"],
     "kw":["유흥","주점","룸살롱","nightclub","entertainment venue"]},
    {"name":"건설업", "level":2, "flags":["FATF"],
     "kw":["건설","시공","하도급","construction","contractor"]},
    {"name":"PG·결제대행", "level":2, "flags":["특금법"],
     "kw":["pg","전자지급","결제대행","간편결제","페이먼트","payment processor","psp","merchant acquir"]},
]

def fetch(url):
    try:
        r = urllib.request.urlopen(urllib.request.Request(url, headers=H), timeout=20, context=CTX)
        return r.read()
    except Exception as e:
        print("  fetch fail:", str(e)[:50]); return None

def clean(t):
    t = html.unescape(t or "")
    t = re.sub(r"\s+", " ", t).strip()
    return t

def collect():
    seen = set()
    news = []  # {title, src, link, lang, ts}
    for lang, q, url in FEEDS:
        data = fetch(url)
        if not data: continue
        try:
            root = ET.fromstring(data)
        except Exception:
            continue
        for it in root.findall(".//item"):
            title = clean(it.findtext("title"))
            link = (it.findtext("link") or "").strip()
            srcEl = it.find("{*}source")
            src = clean(srcEl.text) if srcEl is not None else ""
            pub = it.findtext("pubDate") or ""
            if not title or not link: continue
            key = re.sub(r"[^가-힣a-z0-9]", "", title.lower())[:40]
            if key in seen: continue
            seen.add(key)
            news.append({"t": title, "src": src, "link": link, "lang": lang, "pub": pub})
        print(f"  [{lang}] {q}: 누적 {len(news)}건")
    return news

def match_industries(news):
    results = []
    for ind in INDUSTRIES:
        kws = [k.lower() for k in ind["kw"]]
        hits = []
        for n in news:
            t = n["t"].lower()
            if any(k in t for k in kws):
                hits.append(n)
        cnt = len(hits)
        # 종합 점수: 구조(등급+기준) + 뉴스 노출
        base = {3:55, 2:35, 1:15}.get(ind["level"], 15)
        struct = min(70, base + len(ind["flags"])*5)
        results.append({
            "name": ind["name"], "level": ind["level"], "flags": ind["flags"],
            "news_count": cnt,
            "struct": struct,
            "hits": hits[:12],  # 근거 뉴스 최대 12건
        })
    # 뉴스 점수 정규화 후 종합
    maxc = max([r["news_count"] for r in results] + [1])
    for r in results:
        r["news_score"] = round(r["news_count"]/maxc*30)
        r["total"] = min(100, r["struct"] + r["news_score"])
    results.sort(key=lambda x: (-x["total"], -x["news_count"]))
    return results

def main():
    print("뉴스 수집 중...")
    news = collect()
    print(f"총 {len(news)}건 수집 (국내+해외)")
    ranked = match_industries(news)
    kr = len([n for n in news if n["lang"]=="KR"])
    en = len([n for n in news if n["lang"]=="EN"])
    out = {
        "generated": datetime.now(KST).isoformat(),
        "today": datetime.now(KST).strftime("%Y-%m-%d"),
        "total_news": len(news), "kr": kr, "en": en,
        "ranking": ranked,
    }
    json.dump(out, open("ra_news.json","w"), ensure_ascii=False, indent=2)
    print(f"\nra_news.json 저장 완료")
    print(f"\n=== 업종 위험 순위 (종합점수) ===")
    for i, r in enumerate(ranked[:8], 1):
        print(f"  {i}. {r['name']:20s} 종합 {r['total']:3d} (구조 {r['struct']}, 뉴스 {r['news_count']}건)")

if __name__ == "__main__":
    main()
