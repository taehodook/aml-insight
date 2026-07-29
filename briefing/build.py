# -*- coding: utf-8 -*-
"""데일리 AML 브리핑 — build.py : data.json을 template.html에 인라인하여 index.html 생성"""
import json
data = open("data.json", encoding="utf-8").read()
tpl = open("template.html", encoding="utf-8").read()
out = tpl.replace("/*__DATA__*/", "const DATA=" + data + ";")
open("index.html", "w", encoding="utf-8").write(out)
print(f"index.html 생성 ({len(out)//1024} KB)")
