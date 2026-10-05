# 금융거래등제한대상자 명단을 법령정보 DRF API(XML)에서 받아 WLF 행 목록으로 바꿔요.
import re,json,sys,subprocess,urllib.parse
import os
OC=os.environ.get("LAW_OC","xogh1004")
def get(u):
    for i in range(3):
        r=subprocess.run(["curl","-s","--max-time","90",u],capture_output=True)
        if r.returncode==0 and r.stdout:return r.stdout.decode("utf-8")
    raise SystemExit("법령정보 API에 연결하지 못했어요")
q=urllib.parse.quote("금융거래등제한대상자 지정 및 지정 취소에 관한 규정")
s=get(f"https://www.law.go.kr/DRF/lawSearch.do?OC={OC}&target=admrul&type=XML&query={q}")
rid=re.search(r"<행정규칙일련번호>(\d+)</행정규칙일련번호>",s).group(1)
x=get(f"https://www.law.go.kr/DRF/lawService.do?OC={OC}&target=admrul&ID={rid}&type=XML")
meta={k:(re.search(f"<{k}>(.*?)</{k}>",x) or [None,""])[1] for k in ["발령일자","발령번호","시행일자"]}
annex=" ".join(re.findall(r"<별표내용>(.*?)</별표내용>",x,re.S))
text="\n".join(re.findall(r"<!\[CDATA\[(.*?)\]\]>",annex,re.S))
hm=re.search(r"\((\d{2,5})명\)",text);total=int(hm.group(1))
body=text[hm.end():]
cut=re.search(r"◇\s*참고|┌",body)
if cut:body=body[:cut.start()]
pos=[];exp=1
for m in re.finditer(r"(?m)^\s*(\d{1,4})\.\s",body):
    if int(m.group(1))==exp:pos.append((exp,m.start(),m.end()));exp+=1
rows=[]
for i,(n,s0,e) in enumerate(pos):
    end=pos[i+1][1] if i+1<len(pos) else len(body)
    t=re.sub(r"\s+"," ",body[e:end]).strip();t=re.sub(r"-\s(?=[a-z])","-",t)
    indiv=bool(re.search(r"\(individual\)|\bDOB\b|\bGender\b",t));vessel=bool(re.search(r"\bVessel\b|\bIMO\b",t))
    typ="개인" if indiv else ("선박" if vessel else "단체")
    head=re.split(r"\(|;|\s\[",t,maxsplit=1)[0].strip().rstrip(",")
    if indiv:
        p=[a.strip() for a in head.split(",")];name=", ".join(p[:2]) if len(p)>=2 else p[0]
    else:name=head.split(",")[0].strip()
    names=[name]+[a.strip().strip('"').strip() for a in re.findall(r'a\.k\.a\.?\s+"?([^;")]+)"?',t)]
    names+=[k.strip() for k in re.findall(r'[\("]([가-힣][가-힣 ]{0,14})[\)"]',t)]
    m=re.search(r"nationality ([A-Za-z ,\.'-]+?)(;|\(|$| alt\.| Gender| citizen| Passport)",t) or re.search(r"citizen ([A-Za-z ,\.'-]+?)(;|\(|$)",t)
    c=m.group(1).strip().rstrip(",;") if m else ""
    if not c:
        m=re.search(r"\[([A-Z][A-Z0-9\.\-]+)\]",t);c=m.group(1) if m else ""
    seen=set()
    for nm in names:
        nm=re.sub(r"\s+"," ",nm).strip(" ,.")
        if len(nm)<2 or nm.upper() in seen:continue
        seen.add(nm.upper());rows.append(["KoFIU","KF-%d"%n,nm,c,typ])
out={"notice":meta["발령번호"],"issued":meta["발령일자"],"effective":meta["시행일자"],"entries":len(pos),"declared":total,"rows":rows}

# ---- 저장: 고시가 바뀌었을 때만 data/wlf 갱신 ----
import os,glob,time
D=os.path.join(os.path.dirname(os.path.abspath(__file__)),"..","data","wlf")
old=json.load(open(os.path.join(D,"kofiu-meta.json"))) if os.path.exists(os.path.join(D,"kofiu-meta.json")) else {}
info={k:out[k] for k in ["notice","issued","effective","entries","declared"]}
if old.get("notice")==out["notice"] and old.get("issued")==out["issued"]:
    print("변경 없음",json.dumps(info,ensure_ascii=False));raise SystemExit(0)
if out["entries"]!=out["declared"] or out["entries"]<0.7*old.get("entries",0) or not rows:
    raise SystemExit("검증 실패: "+json.dumps(info,ensure_ascii=False))
parts=[rows[i:i+900] for i in range(0,len(rows),900)]
for f in glob.glob(os.path.join(D,"kofiu-[0-9]*.json")):os.remove(f)
for i,p in enumerate(parts,1):json.dump({"rows":p},open(os.path.join(D,"kofiu-%d.json"%i),"w"),ensure_ascii=False)
meta=dict(info,parts=len(parts),rows=len(rows),source="law.go.kr DRF API",updatedAt=int(time.time()*1000))
meta.pop("declared",None)
json.dump(meta,open(os.path.join(D,"kofiu-meta.json"),"w"),ensure_ascii=False)
print("갱신",json.dumps(info,ensure_ascii=False),len(rows))
