# -*- coding: utf-8 -*-
"""
AML 인사이트 제재 체커 — convert.py
원천 데이터(sdn.csv, alt.csv, un.xml, eu.csv) → data.json 변환
사용법: python3 convert.py
레코드 포맷(배열): [source, type, name, aliases, programs, country, extra]
  source: 0=OFAC, 1=UN, 2=EU
  type:   0=개인, 1=단체, 2=선박, 3=항공기, 4=기타
"""
import csv, json, os, re, sys
import xml.etree.ElementTree as ET
from collections import defaultdict
from datetime import date

NULL = "-0- "

def clean(s):
    if s is None: return ""
    s = s.strip()
    return "" if s in ("-0-", "-0- ", "") else s

# ---------- OFAC ----------
def parse_ofac():
    aliases = defaultdict(list)
    with open("alt.csv", encoding="latin-1", newline="") as f:
        for row in csv.reader(f):
            if len(row) < 4: continue
            ent, name = row[0].strip(), clean(row[3])
            if name: aliases[ent].append(name)
    recs = []
    typemap = {"individual": 0, "vessel": 2, "aircraft": 3}
    with open("sdn.csv", encoding="latin-1", newline="") as f:
        for row in csv.reader(f):
            if len(row) < 12: continue
            ent = row[0].strip()
            name = clean(row[1])
            if not name: continue
            t = typemap.get(clean(row[2]).lower(), 1)  # 빈 값 = 단체
            prog = clean(row[3])
            remarks = clean(row[11])
            if len(remarks) > 400: remarks = remarks[:397] + "..."
            recs.append([0, t, name, " | ".join(aliases.get(ent, [])), prog, "", remarks])
    return recs

# ---------- UN ----------
def parse_un():
    tree = ET.parse("un.xml")
    root = tree.getroot()
    gen = root.get("dateGenerated", "")[:10]
    recs = []
    for ind in root.iter("INDIVIDUAL"):
        parts = [ind.findtext(k, "") or "" for k in
                 ("FIRST_NAME", "SECOND_NAME", "THIRD_NAME", "FOURTH_NAME")]
        name = " ".join(p.strip() for p in parts if p and p.strip())
        if not name: continue
        prog = ind.findtext("UN_LIST_TYPE", "") or ""
        ref = ind.findtext("REFERENCE_NUMBER", "") or ""
        listed = (ind.findtext("LISTED_ON", "") or "")[:10]
        nat = "; ".join(v.text.strip() for v in ind.findall("./NATIONALITY/VALUE") if v.text)
        als = [a.findtext("ALIAS_NAME", "") or "" for a in ind.findall("INDIVIDUAL_ALIAS")]
        als = [a.strip() for a in als if a.strip()]
        dobs = []
        for d in ind.findall("INDIVIDUAL_DATE_OF_BIRTH"):
            v = d.findtext("DATE", "") or d.findtext("YEAR", "") or ""
            if v: dobs.append(v[:10])
        extra = " · ".join(x for x in [f"Ref {ref}" if ref else "",
                                       f"등재 {listed}" if listed else "",
                                       ("DOB " + ", ".join(dobs[:3])) if dobs else ""] if x)
        recs.append([1, 0, name, " | ".join(als), prog, nat, extra])
    for ent in root.iter("ENTITY"):
        name = (ent.findtext("FIRST_NAME", "") or "").strip()
        if not name: continue
        prog = ent.findtext("UN_LIST_TYPE", "") or ""
        ref = ent.findtext("REFERENCE_NUMBER", "") or ""
        listed = (ent.findtext("LISTED_ON", "") or "")[:10]
        als = [a.findtext("ALIAS_NAME", "") or "" for a in ent.findall("ENTITY_ALIAS")]
        als = [a.strip() for a in als if a.strip()]
        extra = " · ".join(x for x in [f"Ref {ref}" if ref else "",
                                       f"등재 {listed}" if listed else ""] if x)
        recs.append([1, 1, name, " | ".join(als), prog, "", extra])
    return recs, gen

# ---------- EU ----------
def parse_eu():
    entities = {}
    gen = ""
    with open("eu.csv", encoding="utf-8-sig", newline="") as f:
        rdr = csv.DictReader(f, delimiter=";")
        for row in rdr:
            if not gen:
                g = (row.get("fileGenerationDate", "") or "")[:10]
                m = re.match(r"(\d{2})/(\d{2})/(\d{4})", g)
                gen = f"{m.group(3)}-{m.group(2)}-{m.group(1)}" if m else g
            lid = row.get("Entity_LogicalId", "")
            if not lid: continue
            e = entities.setdefault(lid, {
                "ref": row.get("Entity_EU_ReferenceNumber", "") or "",
                "stype": (row.get("Entity_SubjectType", "") or "").lower(),
                "prog": row.get("Entity_Regulation_Programme", "") or "",
                "listed": (row.get("Entity_DesignationDate", "") or "")[:10],
                "names": [], "countries": set(), "years": set()})
            wn = (row.get("NameAlias_WholeName", "") or "").strip()
            if wn and wn not in e["names"]: e["names"].append(wn)
            c = (row.get("Address_CountryDescription", "") or "").strip()
            if c and c.upper() != "UNKNOWN": e["countries"].add(c)
            y = (row.get("BirthDate_Year", "") or "").strip()
            if y: e["years"].add(y)
    recs = []
    for e in entities.values():
        if not e["names"]: continue
        name, als = e["names"][0], e["names"][1:]
        t = 0 if e["stype"] == "person" else 1
        extra = " · ".join(x for x in [f"Ref {e['ref']}" if e["ref"] else "",
                                       f"등재 {e['listed']}" if e["listed"] else "",
                                       ("출생연도 " + ", ".join(sorted(e["years"])[:3])) if e["years"] else ""] if x)
        recs.append([2, t, name, " | ".join(als[:25]), e["prog"],
                     "; ".join(sorted(e["countries"])[:3]), extra])
    return recs, gen

def parse_fbi():
    if not os.path.exists("fbi.json"): return []
    recs=[]
    for it in json.load(open("fbi.json",encoding="utf-8")):
        name=(it.get("title") or "").strip()
        if not name: continue
        als=[a for a in (it.get("aliases") or []) if a]
        subj=", ".join((it.get("subjects") or [])[:3])
        dobs=", ".join((it.get("dates_of_birth_used") or [])[:2])
        nat=it.get("nationality") or ""
        extra=" · ".join(x for x in [f"DOB {dobs}" if dobs else "", "FBI Most Wanted"] if x)
        recs.append([4,0,name," | ".join(als[:15]),subj,nat,extra])
    return recs

def parse_interpol():
    if not os.path.exists("interpol.json"): return []
    recs=[]
    for n in json.load(open("interpol.json",encoding="utf-8")):
        name=" ".join(x for x in [(n.get("forename") or "").strip(),(n.get("name") or "").strip()] if x)
        if not name: continue
        nat="; ".join(n.get("nationalities") or [])
        dob=n.get("date_of_birth") or ""
        extra=" · ".join(x for x in [f"DOB {dob}" if dob else "", f"Ref {n.get('entity_id','')}", "Red Notice"] if x)
        recs.append([3,0,name,"","INTERPOL RED NOTICE",nat,extra])
    return recs

def main():
    ofac = parse_ofac()
    un, un_date = parse_un()
    eu, eu_date = parse_eu()
    itp = parse_interpol()
    fbi = parse_fbi()
    data = {
        "meta": {
            "built": date.today().isoformat(),
            "un_date": un_date, "eu_date": eu_date,
            "counts": {"ofac": len(ofac), "un": len(un), "eu": len(eu),
                        "interpol": len(itp), "fbi": len(fbi)},
        },
        "records": ofac + un + eu + itp + fbi,
    }
    with open("data.json", "w", encoding="utf-8") as f:
        json.dump(data, f, ensure_ascii=False, separators=(",", ":"))
    print(f"OFAC {len(ofac):,} / UN {len(un):,} / EU {len(eu):,} / INTERPOL {len(itp):,} / FBI {len(fbi):,} → data.json")

if __name__ == "__main__":
    main()
