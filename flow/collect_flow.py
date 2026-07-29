# -*- coding: utf-8 -*-
"""
머니 플로우 — collect_flow.py
증권(다음 금융, 거래대금 상위) + 가상자산(업비트 공개 API, 24h 거래대금 상위) 수집
사용법: python3 collect_flow.py && python3 build_flow.py
"""
import json, urllib.request, sys
from datetime import datetime, timezone, timedelta

KST = timezone(timedelta(hours=9))
UA = {"User-Agent": "Mozilla/5.0 (AML-Insight-Flow/1.0)"}

def get(url, ref=None, timeout=30):
    h = dict(UA)
    if ref: h["Referer"] = ref
    req = urllib.request.Request(url, headers=h)
    with urllib.request.urlopen(req, timeout=timeout) as r:
        return json.load(r)

def collect_stocks():
    out = []
    for mkt in ("KOSPI", "KOSDAQ"):
        try:
            d = get(f"https://finance.daum.net/api/trend/trade_volume?market={mkt}&page=1&perPage=12&fieldName=accTradePrice&order=desc",
                    ref="https://finance.daum.net")
            for r in d.get("data", []):
                out.append({"name": r.get("name", ""), "mkt": mkt,
                            "price": r.get("tradePrice", 0),
                            "chg": round((r.get("changeRate", 0) or 0) * 100, 2),
                            "sign": -1 if r.get("change") == "FALL" else 1,
                            "val": int(r.get("accTradePrice", 0))})
        except Exception as e:
            print(f"  [skip] Daum {mkt}: {e}", file=sys.stderr)
    out.sort(key=lambda x: -x["val"])
    return out[:18]

def collect_crypto():
    try:
        mkts = get("https://api.upbit.com/v1/market/all")
        krw = [m for m in mkts if m["market"].startswith("KRW-")]
        names = {m["market"]: m["korean_name"] for m in krw}
        codes = [m["market"] for m in krw]
        rows = []
        for i in range(0, len(codes), 100):
            chunk = ",".join(codes[i:i+100])
            rows += get("https://api.upbit.com/v1/ticker?markets=" + chunk)
        out = [{"name": names.get(t["market"], t["market"]), "sym": t["market"].replace("KRW-", ""),
                "price": t["trade_price"],
                "chg": round(t["signed_change_rate"] * 100, 2),
                "val": int(t["acc_trade_price_24h"])} for t in rows]
        out.sort(key=lambda x: -x["val"])
        return out[:15]
    except Exception as e:
        print(f"  [skip] Upbit: {e}", file=sys.stderr)
        return []

def collect_kimchi():
    """김치프리미엄 — 환치기(불법 외환송금) 모니터링의 대표 신호"""
    try:
        fx = get("https://open.er-api.com/v6/latest/USD")["rates"]["KRW"]
        # 글로벌 USD 시세: Binance → CoinGecko → Coinbase 순 폴백
        usd = {}
        try:
            for sym, gp in (("BTC","BTCUSDT"), ("ETH","ETHUSDT"), ("XRP","XRPUSDT")):
                usd[sym] = float(get(f"https://api.binance.com/api/v3/ticker/price?symbol={gp}")["price"])
        except Exception:
            try:
                g = get("https://api.coingecko.com/api/v3/simple/price?ids=bitcoin,ethereum,ripple&vs_currencies=usd")
                usd = {"BTC": g["bitcoin"]["usd"], "ETH": g["ethereum"]["usd"], "XRP": g["ripple"]["usd"]}
            except Exception:
                for sym in ("BTC", "ETH", "XRP"):
                    usd[sym] = float(get(f"https://api.coinbase.com/v2/prices/{sym}-USD/spot")["data"]["amount"])
        out = []
        for sym in ("BTC", "ETH", "XRP"):
            up = get(f"https://api.upbit.com/v1/ticker?markets=KRW-{sym}")[0]["trade_price"]
            gl = usd[sym] * fx
            out.append({"sym": sym, "krw": up, "glob": round(gl),
                        "prem": round((up/gl - 1) * 100, 2)})
        return {"fx": round(fx, 1), "items": out}
    except Exception as e:
        print(f"  [skip] kimchi: {e}", file=sys.stderr)
        return None

def main():
    stocks = collect_stocks()
    crypto = collect_crypto()
    kimchi = collect_kimchi()
    data = {"generated": datetime.now(KST).strftime("%Y-%m-%d %H:%M"),
            "stocks": stocks, "crypto": crypto, "kimchi": kimchi,
            "totals": {"stock": sum(s["val"] for s in stocks),
                       "crypto": sum(c["val"] for c in crypto)}}
    json.dump(data, open("flow_data.json", "w", encoding="utf-8"), ensure_ascii=False, separators=(",", ":"))
    print(f"증권 {len(stocks)}종목 / 가상자산 {len(crypto)}종목 → flow_data.json")

if __name__ == "__main__":
    main()
