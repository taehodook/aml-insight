# -*- coding: utf-8 -*-
"""수배 인물 수집 — FBI Most Wanted(공개 API) + 인터폴 적색수배(IP에 따라 차단될 수 있음)
사용법: python3 fetch_wanted.py  (이후 convert.py가 fbi.json/interpol.json을 자동 병합)"""
import urllib.request, json, time, sys
H={"User-Agent":"Mozilla/5.0 (AML-Insight/1.0)","Accept":"application/json"}
def get(u,t=30):
    return json.load(urllib.request.urlopen(urllib.request.Request(u,headers=H),timeout=t))

def fbi():
    items, page = [], 1
    while True:
        try: d=get(f"https://api.fbi.gov/wanted/v1/list?page={page}&pageSize=50")
        except Exception as e: print("FBI page",page,"err:",e,file=sys.stderr); break
        rows=d.get("items",[])
        if not rows: break
        items+=rows
        if len(items)>=d.get("total",0) or page>40: break
        page+=1; time.sleep(0.4)
    json.dump(items,open("fbi.json","w",encoding="utf-8"),ensure_ascii=False)
    print(f"FBI {len(items)}건 저장")

def interpol():
    """인터폴 공개 API는 일부 서버 IP를 차단합니다. 차단 시 자동 스킵."""
    try:
        test=get("https://ws-public.interpol.int/notices/v1/red?resultPerPage=1&page=1")
    except Exception as e:
        print("Interpol 접근 불가(차단/네트워크) — 스킵:",str(e)[:60]); return
    items=[]
    # API가 쿼리당 최대 160건만 반환 → 국적별 분할 수집
    import string
    nats=[a+b for a in string.ascii_uppercase for b in string.ascii_uppercase]
    for nat in nats:
        try:
            d=get(f"https://ws-public.interpol.int/notices/v1/red?nationality={nat}&resultPerPage=160&page=1",20)
            for n in d.get("_embedded",{}).get("notices",[]): items.append(n)
            time.sleep(0.25)
        except Exception: continue
    seen=set(); out=[]
    for n in items:
        eid=n.get("entity_id")
        if eid and eid not in seen: seen.add(eid); out.append(n)
    json.dump(out,open("interpol.json","w",encoding="utf-8"),ensure_ascii=False)
    print(f"Interpol {len(out)}건 저장")

if __name__=="__main__":
    fbi(); interpol()
