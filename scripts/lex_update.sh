#!/usr/bin/env bash
# AML 규정 탭 데이터(data/lex) 갱신. 월요일엔 판례도 새로 찾아요.
set -euo pipefail
cd "$(dirname "$0")/.."
OUT=$(mktemp -d)
FLAG=""; [ "$(TZ=Asia/Seoul date +%u)" = "1" ] && FLAG="--cases"
python3 scripts/lexupd.py data/lex "$OUT" $FLAG | tee "$OUT/_summary.json"
python3 - "$OUT" <<'PY'
import json,sys,os,shutil
o=sys.argv[1];r=json.loads(open(os.path.join(o,"_summary.json")).read().strip().splitlines()[-1])
if r.get("error"):raise SystemExit(r["error"])
docs=[d for d in json.load(open("data/lex/meta.json"))["docs"]]
if len(r["failed"])>=len(docs):raise SystemExit("법령 API에 연결하지 못했어요")
for n in r["writes"]:shutil.copy(os.path.join(o,n+".json"),os.path.join("data/lex",n+".json"))
for n in r["deletes"]:os.remove(os.path.join("data/lex",n+".json"))
print("바뀐 규정:",r["notes"] or "없음","/ 새 판례:",r["new_cases"],"/ 확인 실패:",r["failed"] or "없음")
PY
