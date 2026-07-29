# -*- coding: utf-8 -*-
"""머니 플로우 — build_flow.py : flow_data.json 인라인 → index.html"""
data = open("flow_data.json", encoding="utf-8").read()
tpl = open("template_flow.html", encoding="utf-8").read()
open("index.html", "w", encoding="utf-8").write(tpl.replace("/*__DATA__*/", "const DATA=" + data + ";"))
print("flow index.html 생성")
