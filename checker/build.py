# -*- coding: utf-8 -*-
"""
AML 인사이트 제재 체커 — build.py
data.json을 template.html에 인라인하여 index.html 생성
사용법: python3 convert.py && python3 build.py
"""
import json

with open("data.json", encoding="utf-8") as f:
    data = f.read()

with open("template.html", encoding="utf-8") as f:
    tpl = f.read()

out = tpl.replace("/*__DATA__*/", "const DATA=" + data + ";")

with open("index.html", "w", encoding="utf-8") as f:
    f.write(out)

meta = json.loads(data)["meta"]
size = len(out.encode("utf-8")) / 1024 / 1024
print(f"index.html 생성 완료 ({size:.1f} MB) · 빌드일 {meta['built']}")
