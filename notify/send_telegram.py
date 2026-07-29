#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
AML 인사이트 → 텔레그램 데일리 다이제스트 발송
- 환경변수 필요: TELEGRAM_BOT_TOKEN, TELEGRAM_CHAT_ID
- 브리핑·수법·업종위험 데이터를 읽어 요약 메시지 1건 발송
- 데이터/토큰 없으면 조용히 스킵 (크론 실패 방지)
사용: python3 notify/send_telegram.py   (저장소 루트에서)
"""
import os, json, urllib.request, urllib.parse, ssl

TOKEN=os.environ.get("TELEGRAM_BOT_TOKEN","").strip()
CHAT=os.environ.get("TELEGRAM_CHAT_ID","").strip()
SITE=os.environ.get("SITE_URL","https://amlinsight-test1.netlify.app").rstrip("/")
CTX=ssl.create_default_context()

def load(p):
    try: return json.load(open(p,encoding="utf-8"))
    except Exception: return None

def build_message():
    brief=load("briefing/data.json")
    meth=load("typology/methods.json")
    ra=load("business-risk/ra_news.json")
    today=(brief or meth or ra or {}).get("today","")
    L=[f"🛡 <b>AML 인사이트 데일리</b> · {today}",""]

    # ① 오늘의 키워드 (브리핑)
    if brief and brief.get("keywords"):
        kws=brief["keywords"][:4]
        L.append("📰 <b>오늘의 키워드</b>")
        L.append(" · ".join(f"{k['k']} {k['n']}건" for k in kws))
        L.append("")

    # ② 수법 동향 (상위 3)
    if meth and meth.get("methods"):
        top=[m for m in meth["methods"] if m["count"]>0][:3]
        if top:
            L.append("🎯 <b>수법 동향</b> (score · 당국적발)")
            for m in top:
                L.append(f" {m['score']:>3} · {m['name']} (적발 {m['auth']}건)")
            L.append("")

    # ③ 업종 위험 1위 + 재평가 후보
    if ra and ra.get("ranking"):
        t=ra["ranking"][0]
        L.append(f"📊 <b>업종 위험 1위</b> {t['name']} (종합 {t['total']})")
        gap=[x for x in ra["ranking"] if x["level"]<3 and x["news_count"]>=3][:2]
        if gap:
            L.append("⚠ 재평가 후보: "+", ".join(f"{g['name']}({g['news_count']}건)" for g in gap))
        L.append("")

    # ④ 주요 기사 3건 (브리핑 picks 우선, 없으면 수법 근거)
    links=[]
    if brief and brief.get("picks"):
        for p in brief["picks"][:3]:
            t=p.get("t") or p.get("title","");u=p.get("link","")
            if t and u: links.append((t,u))
    if not links and meth:
        for m in meth.get("methods",[]):
            for h in m.get("hits",[])[:1]:
                links.append((h["t"],h["link"]))
            if len(links)>=3: break
    if links:
        L.append("🔗 <b>주요 기사</b>")
        for t,u in links[:3]:
            L.append(f'· <a href="{u}">{t[:52]}</a>')
        L.append("")

    L.append(f'전체 보기 → {SITE}')
    msg="\n".join(L)
    return msg[:4000]  # 텔레그램 4096자 제한 여유

def send(msg):
    url=f"https://api.telegram.org/bot{TOKEN}/sendMessage"
    data=urllib.parse.urlencode({"chat_id":CHAT,"text":msg,"parse_mode":"HTML",
        "disable_web_page_preview":"true"}).encode()
    req=urllib.request.Request(url,data=data)
    with urllib.request.urlopen(req,timeout=20,context=CTX) as r:
        res=json.load(r)
        return res.get("ok",False)

if __name__=="__main__":
    if not TOKEN or not CHAT:
        print("TELEGRAM_BOT_TOKEN / TELEGRAM_CHAT_ID 미설정 — 발송 스킵"); exit(0)
    msg=build_message()
    print("--- 발송 메시지 미리보기 ---"); print(msg[:500]); print("---")
    ok=send(msg)
    print("텔레그램 발송:", "성공 ✅" if ok else "실패 ❌")
