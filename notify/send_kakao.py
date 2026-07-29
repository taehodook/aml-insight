#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
AML 인사이트 → 카카오톡 '나에게 보내기' (선택·고급)
⚠ 한계: 본인 카톡('나와의 채팅')에만 발송 가능. 단톡방·친구 발송은 카카오 비즈니스 채널 심사 필요.
⚠ 토큰: refresh_token은 약 2개월 유효 — 만료 전 갱신되며, 오래 미사용 시 재발급 필요.
- 환경변수: KAKAO_REST_KEY, KAKAO_REFRESH_TOKEN
- 최초 1회 토큰 발급 절차는 DEPLOY_GUIDE.md 13장 참고
"""
import os, json, urllib.request, urllib.parse, ssl
REST=os.environ.get("KAKAO_REST_KEY","").strip()
REFRESH=os.environ.get("KAKAO_REFRESH_TOKEN","").strip()
SITE=os.environ.get("SITE_URL","https://amlinsight-test1.netlify.app").rstrip("/")
CTX=ssl.create_default_context()

def refresh_access():
    data=urllib.parse.urlencode({"grant_type":"refresh_token","client_id":REST,
        "refresh_token":REFRESH}).encode()
    req=urllib.request.Request("https://kauth.kakao.com/oauth/token",data=data)
    with urllib.request.urlopen(req,timeout=20,context=CTX) as r:
        return json.load(r).get("access_token")

def load(p):
    try: return json.load(open(p,encoding="utf-8"))
    except Exception: return None

def build_text():
    meth=load("typology/methods.json"); brief=load("briefing/data.json")
    today=(brief or meth or {}).get("today","")
    lines=[f"🛡 AML 인사이트 데일리 · {today}",""]
    if meth:
        top=[m for m in meth.get("methods",[]) if m["count"]>0][:3]
        lines.append("🎯 수법 동향")
        lines+= [f"{m['score']} · {m['name']} (적발 {m['auth']})" for m in top]
    return "\n".join(lines)[:180]  # 카카오 텍스트 템플릿 200자 제한

def send(access, text):
    tpl={"object_type":"text","text":text,
         "link":{"web_url":SITE,"mobile_web_url":SITE},"button_title":"전체 보기"}
    data=urllib.parse.urlencode({"template_object":json.dumps(tpl,ensure_ascii=False)}).encode()
    req=urllib.request.Request("https://kapi.kakao.com/v2/api/talk/memo/default/send",
        data=data,headers={"Authorization":f"Bearer {access}"})
    with urllib.request.urlopen(req,timeout=20,context=CTX) as r:
        return json.load(r).get("result_code")==0

if __name__=="__main__":
    if not REST or not REFRESH:
        print("KAKAO_REST_KEY / KAKAO_REFRESH_TOKEN 미설정 — 발송 스킵"); exit(0)
    at=refresh_access()
    if not at: print("access_token 갱신 실패"); exit(0)
    ok=send(at, build_text())
    print("카카오 발송:", "성공 ✅" if ok else "실패 ❌")
