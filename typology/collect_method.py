#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
자금세탁 수법(Typology) 인텔리전스 수집기
- 국내외 자금세탁 뉴스에서 '수법'을 추출 (업종이 아니라 방식)
- 각 수법에 STR 점검 포인트·대응 룰 매핑
- 변화(신규/급증) 감지
- 결과: methods.json
"""
import urllib.request, ssl, re, json, html
from xml.etree import ElementTree as ET
from datetime import datetime, timezone, timedelta

H={"User-Agent":"Mozilla/5.0 (Windows NT 10.0; Win64; x64) Chrome/120"}
CTX=ssl.create_default_context(); CTX.check_hostname=False; CTX.verify_mode=ssl.CERT_NONE
KST=timezone(timedelta(hours=9))

# 수법 중심 검색 쿼리 (더 넓게)
FEEDS=[
  ("KR","자금세탁 수법","https://news.google.com/rss/search?q=%EC%9E%90%EA%B8%88%EC%84%B8%ED%83%81&hl=ko&gl=KR&ceid=KR:ko"),
  ("KR","범죄수익 은닉","https://news.google.com/rss/search?q=%EB%B2%94%EC%A3%84%EC%88%98%EC%9D%B5+%EC%9D%80%EB%8B%89&hl=ko&gl=KR&ceid=KR:ko"),
  ("KR","대포통장","https://news.google.com/rss/search?q=%EB%8C%80%ED%8F%AC%ED%86%B5%EC%9E%A5&hl=ko&gl=KR&ceid=KR:ko"),
  ("KR","보이스피싱 인출","https://news.google.com/rss/search?q=%EB%B3%B4%EC%9D%B4%EC%8A%A4%ED%94%BC%EC%8B%B1+%EC%9D%B8%EC%B6%9C&hl=ko&gl=KR&ceid=KR:ko"),
  ("KR","환치기","https://news.google.com/rss/search?q=%ED%99%98%EC%B9%98%EA%B8%B0&hl=ko&gl=KR&ceid=KR:ko"),
  ("KR","상품권 자금세탁","https://news.google.com/rss/search?q=%EC%83%81%ED%92%88%EA%B6%8C+%EC%9E%90%EA%B8%88%EC%84%B8%ED%83%81&hl=ko&gl=KR&ceid=KR:ko"),
  ("EN","money laundering scheme","https://news.google.com/rss/search?q=money+laundering+scheme&hl=en-US&gl=US&ceid=US:en"),
  ("EN","crypto laundering","https://news.google.com/rss/search?q=crypto+money+laundering&hl=en-US&gl=US&ceid=US:en"),
  ("EN","shell company laundering","https://news.google.com/rss/search?q=shell+company+laundering&hl=en-US&gl=US&ceid=US:en"),
]

# ── 수법 사전: 각 수법에 키워드 + STR 대응 ──
METHODS=[
 {"id":"mule","name":"대포통장·차명계좌","sev":3,
  "kw":["대포통장","차명","명의 대여","명의대여","통장 매매","계좌 대여","mule account","money mule"],
  "why":"제3자 명의 계좌로 자금 출처와 실소유자를 단절. 거의 모든 자금세탁의 1차 통로.",
  "str":["신규 개설 계좌의 즉시 고액 입출금","계좌주 연령·직업과 거래규모 불일치","동일 IP·기기에서 다수 계좌 접속"],
  "sql":"-- [테마룰] 대포통장·차명계좌: 신규계좌 즉시 고액 회전\n-- 파라미터: :신규일수=30, :고액기준=10000000, :건수기준=5\nSELECT t.acct_no, COUNT(*) tx_cnt, SUM(t.amt) tot_amt\nFROM   t_txn t JOIN t_acct a ON a.acct_no=t.acct_no\nWHERE  a.open_dt >= CURRENT_DATE - INTERVAL ':신규일수' DAY\n  AND  t.tx_ts   >= CURRENT_DATE - INTERVAL '7' DAY\nGROUP BY t.acct_no\nHAVING SUM(t.amt) >= :고액기준 OR COUNT(*) >= :건수기준;"},
 {"id":"limit","name":"계좌 한도해제 악용","sev":3,
  "kw":["한도 해제","한도해제","한도 상향","이체한도"],
  "why":"한도 제한을 푼 계좌로 대량 자금을 빠르게 통과. 최근 코인 세탁의 핵심 길목.",
  "str":["한도해제 직후 한도 근접 거래 반복","해제 후 단기간 자금 급증 후 전액 인출","한도해제 사유와 실제 거래 패턴 불일치"],
  "sql":"-- [테마룰] 한도해제 직후 고액 회전 (코인세탁 신종 길목)\n-- 파라미터: :관찰일수=7, :근접비율=0.9 (해제 한도의 90% 이상 거래)\nSELECT t.acct_no, l.new_limit, SUM(t.amt) tot_amt, COUNT(*) cnt\nFROM   t_txn t\nJOIN   t_limit_chg l ON l.acct_no=t.acct_no\nWHERE  l.chg_type='해제' \n  AND  t.tx_ts BETWEEN l.chg_ts AND l.chg_ts + INTERVAL ':관찰일수' DAY\nGROUP BY t.acct_no, l.new_limit\nHAVING SUM(t.amt) >= l.new_limit * :근접비율;"},
 {"id":"layer","name":"다단계 세탁(레이어링)","sev":3,
  "kw":["3단계","여러 단계","다단계","경유 계좌","세탁 조직","layering","multiple transfers"],
  "why":"여러 계좌·자산을 거쳐 추적을 어렵게 함. 골드바→현금→코인 같은 자산 전환 결합.",
  "str":["입금 직후 다수 계좌로 연쇄 이체","자산 형태 전환(현금↔코인↔귀금속) 반복","N단계 자금흐름 추적 시 단순 통과 계좌 다수"],
  "sql":"-- [테마룰] 다단계 레이어링: 입금 후 단시간 연쇄 이체 (3단계+)\n-- 파라미터: :간격분=30, :최소단계=3\nWITH RECURSIVE chain AS (\n  SELECT tx_id, from_acct, to_acct, amt, tx_ts, 1 depth\n  FROM   t_txn WHERE tx_ts >= CURRENT_DATE - 1\n  UNION ALL\n  SELECT n.tx_id, c.from_acct, n.to_acct, n.amt, n.tx_ts, c.depth+1\n  FROM   chain c JOIN t_txn n ON n.from_acct=c.to_acct\n  WHERE  n.tx_ts BETWEEN c.tx_ts AND c.tx_ts + INTERVAL ':간격분' MINUTE\n    AND  c.depth < 6)\nSELECT * FROM chain WHERE depth >= :최소단계;"},
 {"id":"crypto","name":"가상자산 환전 세탁","sev":3,
  "kw":["가상자산","코인","비트코인","암호화폐","테더","crypto","bitcoin","usdt","stablecoin"],
  "why":"익명성·국경 초월로 자금 추적 차단. 거래소 환전·믹싱 결합.",
  "str":["법정화폐↔코인 빈번 전환","해외 거래소·개인지갑 직접 이체","트래블룰 회피용 분할 송금"],
  "sql":"-- [테마룰] 가상자산 환전 세탁: 거래소 상대 분할·연계 거래\n-- 파라미터: :임계=10000000, :분할건수=3, :창구시간=24 (시간)\nSELECT t.cust_id, COUNT(*) cnt, SUM(t.amt) tot\nFROM   t_txn t\nWHERE  t.cp_acct_no IN (SELECT acct_no FROM t_vasp_acct)  -- 거래소 계좌 목록\n  AND  t.amt < :임계\n  AND  t.tx_ts >= CURRENT_TIMESTAMP - INTERVAL ':창구시간' HOUR\nGROUP BY t.cust_id\nHAVING COUNT(*) >= :분할건수;"},
 {"id":"giftcard","name":"상품권 깡","sev":2,
  "kw":["상품권","깡","선불","문화상품권","핀번호"],
  "why":"현금→상품권→현금 전환으로 자금 출처 단절. 업체 위장 사례 빈발.",
  "str":["상품권 대량 매입 후 즉시 현금화","정상 매출 대비 과도한 상품권 결제 집중","법인카드 고액 한도로 상품권 반복 구매"],
  "sql":"-- [테마룰] 상품권 깡: 상품권 업종 결제 집중·법인카드 반복\n-- 파라미터: :집중비율=0.7, :기간일=7, :최소금액=5000000\nSELECT m.mer_no, m.mer_nm, SUM(t.amt) gift_amt,\n       SUM(t.amt)/NULLIF(SUM(SUM(t.amt)) OVER (PARTITION BY t.cust_id),0) ratio\nFROM   t_txn t JOIN t_merchant m ON m.mer_no=t.mer_no\nWHERE  m.mcc IN ('5947','상품권')          -- 상품권 업종코드\n  AND  t.tx_ts >= CURRENT_DATE - :기간일\nGROUP BY m.mer_no, m.mer_nm, t.cust_id\nHAVING SUM(t.amt) >= :최소금액;"},
 {"id":"fx","name":"환치기·불법외환","sev":3,
  "kw":["환치기","불법 외환","불법외환","외환거래법","해외 송금 대행"],
  "why":"공식 외환망을 우회한 국경 간 가치 이전. 무역·귀금속과 결합.",
  "str":["국내 입금과 해외 지급의 시점·금액 대응","무역 실물 없는 반복 송금","다수 송금인→단일 수취 구조"],
  "sql":'-- [테마룰] 환치기: 다수 송금인 → 단일 수취 집중\n-- 파라미터: :송금인수=5, :기간일=7\nSELECT t.to_acct, COUNT(DISTINCT t.from_acct) senders, SUM(t.amt) tot\nFROM   t_txn t\nWHERE  t.tx_ts >= CURRENT_DATE - :기간일\nGROUP BY t.to_acct\nHAVING COUNT(DISTINCT t.from_acct) >= :송금인수;'},
 {"id":"shell","name":"페이퍼컴퍼니·유령법인","sev":3,
  "kw":["페이퍼","유령법인","유령 법인","위장업체","위장 업체","shell company","front company"],
  "why":"실체 없는 법인으로 자금 정당화·실소유자 은폐.",
  "str":["설립 직후 고액 거래 발생","사업장·직원 실체 불명","대표·주주가 다수 법인에 중복 등장"],
  "sql":'-- [테마룰] 페이퍼컴퍼니: 설립 직후 고액 거래\n-- 파라미터: :설립일수=90, :고액=50000000\nSELECT c.corp_no, c.corp_nm, c.est_dt, SUM(t.amt) tot\nFROM   t_txn t JOIN t_corp c ON c.cust_id=t.cust_id\nWHERE  c.est_dt >= CURRENT_DATE - :설립일수\nGROUP BY c.corp_no, c.corp_nm, c.est_dt\nHAVING SUM(t.amt) >= :고액;'},
 {"id":"voice","name":"보이스피싱 인출·수거","sev":2,
  "kw":["보이스피싱","인출책","수거책","피싱","전기통신금융사기"],
  "why":"피해금을 대포통장·코인으로 신속 인출·세탁.",
  "str":["피해 신고 계좌와 연결된 자금흐름","입금 직후 ATM 분산 인출","수거→코인 환전 연계"],
  "sql":"-- [테마룰] 보이스피싱 인출: 피해신고 연계 + 즉시 분산 인출\n-- 파라미터: :분산분=60, :인출건수=3\nSELECT t.acct_no, COUNT(*) wd_cnt, SUM(t.amt) wd_amt\nFROM   t_txn t\nWHERE  t.tx_type='출금'\n  AND  EXISTS (SELECT 1 FROM t_fraud_report f\n               WHERE f.acct_no=t.acct_no\n                 AND t.tx_ts BETWEEN f.report_ts - INTERVAL '1' DAY AND f.report_ts + INTERVAL '1' DAY)\nGROUP BY t.acct_no HAVING COUNT(*) >= :인출건수;"},
 {"id":"gold","name":"골드바·금 매입","sev":2,
  "kw":["골드바","금괴","금 매입","귀금속","gold bar","bullion"],
  "why":"고가·휴대 용이한 금으로 가치 저장·운반.",
  "str":["현금으로 금 대량 매입 후 재매각","금-현금-코인 전환 결합","매입자 신원·자금원 불명"],
  "sql":"-- [테마룰] 골드바·귀금속: 현금 고액 매입 반복\n-- 파라미터: :현금기준=10000000, :기간일=30, :반복=2\nSELECT t.cust_id, COUNT(*) cnt, SUM(t.amt) tot\nFROM   t_txn t JOIN t_merchant m ON m.mer_no=t.mer_no\nWHERE  m.mcc IN ('5944','귀금속') AND t.pay_type='현금'\n  AND  t.amt >= :현금기준 AND t.tx_ts >= CURRENT_DATE - :기간일\nGROUP BY t.cust_id HAVING COUNT(*) >= :반복;"},
 {"id":"invest","name":"리딩방·투자사기","sev":2,
  "kw":["리딩방","리딩","투자사기","투자 사기","유사수신","코인 사기"],
  "why":"투자 가장으로 자금 모집 후 세탁. 가상자산과 결합 빈발.",
  "str":["불특정 다수→단일 계좌 집금","수익 배분 가장한 분산 이체","집금 직후 코인 환전·해외 이전"],
  "sql":'-- [테마룰] 리딩방·투자사기: 불특정 다수 → 단일 집금 → 단기 출금\n-- 파라미터: :입금인수=10, :출금비율=0.8, :기간일=14\nSELECT x.to_acct, x.senders, x.in_amt, o.out_amt\nFROM  (SELECT to_acct, COUNT(DISTINCT from_acct) senders, SUM(amt) in_amt\n       FROM t_txn WHERE tx_ts>=CURRENT_DATE-:기간일 GROUP BY to_acct\n       HAVING COUNT(DISTINCT from_acct)>=:입금인수) x\nJOIN  (SELECT from_acct, SUM(amt) out_amt FROM t_txn\n       WHERE tx_ts>=CURRENT_DATE-:기간일 GROUP BY from_acct) o\n  ON  o.from_acct=x.to_acct\nWHERE o.out_amt >= x.in_amt * :출금비율;'},
]

AUTHORITY=["금융정보분석원","fiu","금감원","금융감독원","검찰","경찰","국세청","관세청","fatf","fincen","doj","법원","선고","기소","검거","적발","구속","체포"]

def fetch(url):
    try:
        r=urllib.request.urlopen(urllib.request.Request(url,headers=H),timeout=20,context=CTX)
        return r.read()
    except Exception as e:
        print("  fail:",str(e)[:40]); return None

def clean(t):
    return re.sub(r"\s+"," ",html.unescape(t or "")).strip()

def collect():
    seen=set(); news=[]
    for lang,q,url in FEEDS:
        data=fetch(url)
        if not data: continue
        try: root=ET.fromstring(data)
        except: continue
        for it in root.findall(".//item"):
            t=clean(it.findtext("title")); link=(it.findtext("link") or "").strip()
            s=it.find("{*}source"); src=clean(s.text) if s is not None else ""
            if not t or not link: continue
            k=re.sub(r"[^가-힣a-z0-9]","",t.lower())[:35]
            if k in seen: continue
            seen.add(k)
            news.append({"t":t,"src":src,"link":link,"lang":lang})
        print(f"  [{lang}] {q}: 누적 {len(news)}")
    return news

def analyze(news):
    res=[]
    for m in METHODS:
        kws=[k.lower() for k in m["kw"]]
        hits=[n for n in news if any(k in n["t"].lower() for k in kws)]
        # 당국 출처(검거·기소 등) 가중 — 실제 적발 사례
        authcnt=sum(1 for n in hits if any(a in (n["t"]+n["src"]).lower() for a in AUTHORITY))
        res.append({**{k:m.get(k) for k in ["id","name","sev","why","str","sql"]},
                    "count":len(hits),"auth":authcnt,"hits":hits[:10]})
    # 점수: 빈도 + 심각도 + 당국적발 가중
    maxc=max([r["count"] for r in res]+[1])
    for r in res:
        r["score"]=min(100, round(r["count"]/maxc*50) + r["sev"]*10 + min(20,r["auth"]*3))
    res.sort(key=lambda x:(-x["score"],-x["count"]))
    return res

def main():
    print("자금세탁 수법 뉴스 수집...")
    news=collect()
    print(f"총 {len(news)}건\n")
    methods=analyze(news)
    out={"generated":datetime.now(KST).isoformat(),
         "today":datetime.now(KST).strftime("%Y-%m-%d"),
         "total_news":len(news),
         "kr":len([n for n in news if n["lang"]=="KR"]),
         "en":len([n for n in news if n["lang"]=="EN"]),
         "methods":methods}
    json.dump(out,open("methods.json","w"),ensure_ascii=False,indent=2)
    print("=== 수법 순위 ===")
    for i,m in enumerate(methods[:8],1):
        if m["count"]>0:
            print(f"  {i}. {m['name']:18s} score {m['score']:3d} (뉴스 {m['count']}, 당국적발 {m['auth']})")

if __name__=="__main__":
    main()
