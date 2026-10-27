# -*- coding: utf-8 -*-
"""
'오늘' 탭 기사 안전장치 — daily_fallback.py

평일 아침 Claude 예약 작업이 data/daily/latest.json 을 오늘 날짜로 올리지 못했을 때만,
그날 브리핑 수집 결과(briefing/data.json)의 picks 로 기사 3건을 대신 만들어 채워요.
- 오늘 기사가 이미 있으면 아무것도 하지 않아요(Claude가 쓴 기사를 덮어쓰지 않음).
- 주말에는 쉬어요(예약 작업도 평일만 돌아서).
- GEMINI_API_KEY 가 있으면 요약·점검 문장을 AI로 쓰고, 없거나 실패하면 정해진 문장으로 써요.
산출물: data/daily/YYYYMMDD.json, data/daily/latest.json  (만든 기사에는 "auto": true 표시)
사용법: python3 scripts/daily_fallback.py   (저장소 맨 위 폴더에서)
"""
import json, os, re, sys, time, urllib.request
from datetime import datetime, timezone, timedelta

KST = timezone(timedelta(hours=9))
NOW = datetime.now(KST)
TODAY = NOW.strftime("%Y-%m-%d")
DAILY = "data/daily"
LATEST = os.path.join(DAILY, "latest.json")
SOURCE = "briefing/data.json"

# 키워드별 기본 점검 문장(AI를 못 쓸 때)
KW_CHECK = {
    "자금세탁": ("자금세탁 수법", "기사 속 수법과 비슷한 거래 패턴이 우리 모니터링 룰에 걸리는지 확인해 보세요.", True),
    "보이스피싱": ("보이스피싱 자금 흐름", "피해금이 빠르게 들어왔다 나가는 계좌를 잡는 룰이 돌고 있는지 확인해 보세요.", True),
    "피싱": ("피싱 피해 계좌", "피해 신고가 들어온 계좌의 지급정지·STR 절차가 바로 돌아가나요?", True),
    "대포통장": ("대포통장 개설", "신규 계좌가 개설 직후 큰돈을 주고받는 경우를 걸러 내고 있나요?", True),
    "도박": ("불법 도박 자금", "도박 관련 집금 계좌로 보이는 패턴(소액 다수 입금 후 일괄 출금)을 점검해 보세요.", False),
    "가상자산": ("가상자산 연계 거래", "거래 목적과 자금 출처를 확인하고 고객 위험을 고·중·저 기준으로 평가했는지 확인해 보세요.", False),
    "거래소": ("거래소 연계 거래", "거래소 입출금이 잦은 고객의 거래 목적을 확인해 두었는지 보세요.", False),
    "코인": ("코인 거래 자금", "코인 매수 자금 출처가 소득 수준과 맞는지 확인해 보세요.", False),
    "FIU": ("금융정보분석원(FIU)·국제기구 동향", "FIU 발표 내용이 우리 회사 내부 규정에 반영돼 있는지 확인해 보세요.", False),
    "제재": ("제재 대상", "새 제재 대상이 요주의 인물 명단(WLF)에 반영됐는지 확인해 보세요.", True),
    "사기": ("금융사기 유형", "기사 속 사기 유형이 직원 교육 자료에 들어가 있는지 확인해 보세요.", False),
    "환치기": ("불법 환치기", "해외 송금이 잘게 나뉘어 반복되는 고객이 있는지 점검해 보세요.", True),
    "상품권": ("상품권 거래", "상품권 업종 가맹점의 결제 집중 여부를 점검해 보세요.", False),
}
DEFAULT_CHECK = ("이 사건의 수법", "기사 속 수법이 우리 회사 고객·거래에도 나타날 수 있는지 확인해 보세요.", False)


def bigrams(t):
    t = re.sub(r"[^0-9A-Za-z가-힣]", "", (t or "").replace("금융정보분석원", "FIU"))
    return {t[i:i + 2] for i in range(len(t) - 1)}


def same_story(a, b):
    """제목 글자 쌍이 절반 이상 겹치면 같은 사건으로 봐요."""
    A, B = bigrams(a), bigrams(b)
    return bool(A and B) and len(A & B) / min(len(A), len(B)) >= 0.45


def load(path):
    try:
        return json.load(open(path, encoding="utf-8"))
    except Exception:
        return None


def pick_items(picks, prev_titles):
    out, seen = [], [t for t in prev_titles if t]
    for p in sorted(picks, key=lambda x: -x.get("score", 0)):
        t = p.get("t")
        if not t or not p.get("link") or any(same_story(t, s) for s in seen):
            continue
        seen.append(t)
        out.append(p)
        if len(out) == 3:
            break
    return out


def src_label(p):
    ts = p.get("ts", "")
    md = ts[5:10].replace("-", ".") if len(ts) >= 10 else NOW.strftime("%m.%d")
    return f"{p.get('src') or '언론'} · {md}"


def tags_for(p):
    kws = p.get("kws") or []
    second = next((k for k in kws if k in ("가상자산", "보이스피싱", "도박", "제재", "FIU", "대포통장")), None)
    abroad = re.search(r"미국|영국|유럽|EU|중국|일본|홍콩|싱가포르|호주|캐나다|OFAC|해외|글로벌", p.get("t", ""))
    return ["해외" if abroad else "국내", second or (kws[0] if kws else "AML")]


def template_item(p):
    kws = p.get("kws") or []
    kw = next((k for k in KW_CHECK if k in kws and k != "자금세탁"), None) or ("자금세탁" if "자금세탁" in kws else None)
    phrase, check, hi = KW_CHECK.get(kw, DEFAULT_CHECK)
    return {
        "tags": tags_for(p), "src": src_label(p), "title": p["t"], "url": p["link"],
        "summaryMode": "headline",
        "sum": ["기사 제목에서 확인한 내용이에요: " + p["t"],
                f"실무 점검 주제는 [[{phrase}]]예요. 아래 점검은 기사 사실과 구분되는 일반적인 검토 제안이에요. 자세한 사실관계는 원문에서 확인해 주세요."],
        "checks": [{"hi": hi, "t": check}],
    }


def ai_items(items):
    key = os.environ.get("GEMINI_API_KEY", "")
    if not key:
        return None
    lines = "\n".join(f"{i+1}. [{p.get('src')}] {p['t']} (키워드: {', '.join(p.get('kws') or [])})"
                      for i, p in enumerate(items))
    prompt = (
        "한국 금융회사 자금세탁방지(AML) 실무자를 위한 기사 요약을 만들어요. 아래 기사 제목만 보고 쓰세요.\n"
        "규칙: 제목에서 확인되는 사실만 쓰고 숫자·사실을 지어내지 않아요. 해석은 해석으로 들리게 써요.\n"
        "자연스러운 해요체, 이모지 금지, '~한다/~이다' 문어체 금지.\n"
        "각 기사마다 sum은 문자열 배열이에요. 배열 안에 2~3문장을 담은 문자열 1개를 넣고, 핵심 구절 1~2곳을 [[ ]]로 감싸요.\n"
        "기사 본문을 읽었다고 표현하지 말고, 제목 기반 정리라는 한계를 밝혀요. 점검 문장은 일반적인 검토 제안이라고 구분해요.\n"
        "checks는 [[ ]] 개수와 똑같은 개수이고, n번째 [[ ]]와 n번째 check가 짝이에요.\n"
        "check의 t는 실무자가 '해당/해당 없음'으로 답할 수 있는 점검 문장으로, '~했는지 확인해 보세요' 또는 '~돼 있나요?'처럼 끝내요. "
        "바로 해야 할 것은 hi true, 아니면 false. 등급 예시가 필요하면 고·중·저 3등급 기준으로 써요.\n"
        '출력은 JSON 배열만: [{"sum":["..."],"checks":[{"hi":true,"t":"..."}]}, ...] (기사 순서대로 '
        f"{len(items)}개)\n\n기사:\n{lines}"
    )
    schema = {"type": "array", "minItems": len(items), "maxItems": len(items), "items": {
        "type": "object", "required": ["sum", "checks"], "properties": {
            "sum": {"type": "array", "items": {"type": "string"}, "minItems": 1},
            "checks": {"type": "array", "minItems": 1, "items": {
                "type": "object", "required": ["hi", "t"], "properties": {
                    "hi": {"type": "boolean"}, "t": {"type": "string"}}}}}}}
    body = json.dumps({"contents": [{"parts": [{"text": prompt}]}],
                       "generationConfig": {"responseMimeType": "application/json", "responseJsonSchema": schema, "temperature": 0.4}}).encode()
    models = ([os.environ["GEMINI_MODEL"]] if os.environ.get("GEMINI_MODEL") else []) + \
             ["gemini-3-flash-preview", "gemini-2.5-flash", "gemini-2.5-flash-lite"]
    for model in models:
        try:
            req = urllib.request.Request(
                f"https://generativelanguage.googleapis.com/v1beta/models/{model}:generateContent?key=" + key,
                data=body, headers={"Content-Type": "application/json"})
            with urllib.request.urlopen(req, timeout=60) as r:
                res = json.load(r)
            text = res["candidates"][0]["content"]["parts"][0]["text"]
            arr = json.loads(re.sub(r"^```(json)?|```$", "", text.strip()).strip())
            if isinstance(arr, list) and len(arr) == len(items) and all(isinstance(it, dict) and valid(it) for it in arr):
                print(f"  AI 요약 생성 (모델: {model})")
                return arr
            print(f"  [모델 {model}] 응답 구조나 강조 구절·점검 짝이 맞지 않아 다음 모델로 재시도해요.", file=sys.stderr)
        except Exception as e:
            # 예외 문자열에는 API 키가 들어간 요청 URL이 포함될 수 있어요.
            print(f"  [모델 {model} 실패, 다음 시도] {type(e).__name__}", file=sys.stderr)
            time.sleep(1)
    return None


def valid(it):
    sums = it.get("sum")
    checks = it.get("checks")
    if not (isinstance(sums, list) and sums and all(isinstance(s, str) and s.strip() for s in sums)):
        return False
    if not (isinstance(checks, list) and all(isinstance(c, dict) and isinstance(c.get("t"), str) and c["t"].strip() and isinstance(c.get("hi"), bool) for c in checks)):
        return False
    marks = sum(len(re.findall(r"\[\[.+?\]\]", s)) for s in sums)
    return (marks == len(checks) and marks >= 1
            and sum(s.count("[[") for s in sums) == marks
            and sum(s.count("]]") for s in sums) == marks)


def validate_document(doc):
    items = doc.get("items", [])
    if len(items) != 3 or not all(valid(it) for it in items):
        raise ValueError("기사 3건과 강조 구절·점검 문장 짝을 확인해 주세요.")
    if len({it.get("title") for it in items}) != 3:
        raise ValueError("중복 기사가 있어요.")
    if not all(re.match(r"^https?://", it.get("url", "")) for it in items):
        raise ValueError("기사 주소가 올바르지 않아요.")


def main():
    if NOW.weekday() >= 5:
        print("주말이라 쉬어요."); return
    latest = load(LATEST) or {}
    if latest.get("date") == TODAY:
        validate_document(latest)
        print(f"오늘({TODAY}) 기사 검증을 통과했어요. 그대로 둬요."); return
    data = load(SOURCE)
    if not data or data.get("today") != TODAY:
        print("오늘 브리핑 수집 결과가 없어 대신 만들지 못했어요."); return
    prev_titles = [i.get("title", "") for i in latest.get("items", [])]
    items = pick_items(data.get("picks") or [], prev_titles)
    if len(items) < 3:
        items = pick_items((data.get("picks") or []) + (data.get("news") or []), prev_titles)
    if len(items) != 3:
        raise ValueError("기사 3건을 확보하지 못해 이전 발행본을 유지해요.")

    ai = ai_items(items) or []
    out = []
    for i, p in enumerate(items):
        base = template_item(p)
        if i < len(ai) and isinstance(ai[i], dict):
            cand = dict(base, sum=ai[i].get("sum"), checks=[
                {"hi": bool(c.get("hi")), "t": str(c.get("t", "")).strip()}
                for c in (ai[i].get("checks") or []) if isinstance(c, dict)])
            if valid(cand):
                base = cand
                base["summaryMode"] = "headline-ai"
        out.append(base)

    doc = {"date": TODAY, "createdAt": int(time.time() * 1000), "auto": True, "items": out}
    validate_document(doc)
    os.makedirs(DAILY, exist_ok=True)
    for path in (os.path.join(DAILY, TODAY.replace("-", "") + ".json"), LATEST):
        json.dump(doc, open(path, "w", encoding="utf-8"), ensure_ascii=False)
    print(f"대신 만든 오늘 기사 {len(out)}건을 저장했어요: " + " / ".join(i["title"] for i in out))


if __name__ == "__main__":
    main()
