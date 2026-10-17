"""data/JANG_MART.csv와 RFM 백업 표를 읽어 대시보드용 집계(data.js)를 만듭니다.

작성: Claude (Anthropic)
실행: dashboard_etsy 폴더에서 `python build_data.py`
"""
import json
from datetime import date
from pathlib import Path

import pandas as pd

HERE = Path(__file__).resolve().parent
DATA_DIR = HERE.parent / "data"
OUT_PATH = HERE / "data.js"
WEEKDAYS = ["월", "화", "수", "목", "금", "토", "일"]


def main():
    df = pd.read_csv(DATA_DIR / "JANG_MART.csv", encoding="utf-8-sig")
    rfm = pd.read_csv(DATA_DIR / "rfm_customers_backup.csv", encoding="utf-8-sig")

    # 검증: 빈 값 없음, 할인 계산식 일치, 한 거래는 한 점포
    assert df.isna().sum().sum() == 0, "빈 값이 있습니다"
    assert ((df["상품단가"] * df["판매수량"] - df["할인금액"]) == df["총구매금액"]).all(), "할인 계산이 맞지 않습니다"
    assert df.groupby("거래번호")["점포명"].nunique().max() == 1

    ok = df[df["최종상태"] == "정상"]
    gross = df["총구매금액"].sum()
    list_price = (df["상품단가"] * df["판매수량"]).sum()
    sales = int(ok["총구매금액"].sum())
    orders = int(ok["거래번호"].nunique())

    kpi = {
        "sales": sales,
        "orders": orders,
        "customers": int(ok["고객번호"].nunique()),
        "aov": round(sales / orders),
        "qty": int(ok["판매수량"].sum()),
        "returnRate": round(df.loc[df["최종상태"] == "반품", "총구매금액"].sum() / gross * 100, 2),
        "discountRate": round(df["할인금액"].sum() / list_price * 100, 1),
        "onlineShare": round(ok.loc[ok["구매채널"] == "온라인", "총구매금액"].sum() / sales * 100, 1),
    }

    monthly = ok.groupby("월").agg(sales=("총구매금액", "sum"), orders=("거래번호", "nunique"),
                                   customers=("고객번호", "nunique")).reset_index()
    h1 = int(monthly.loc[monthly["월"] <= 6, "sales"].sum())
    h2 = int(monthly.loc[monthly["월"] > 6, "sales"].sum())

    def by(col, frame=ok):
        g = frame.groupby(col).agg(sales=("총구매금액", "sum"), qty=("판매수량", "sum"))
        return g.sort_values("sales", ascending=False)

    cat = by("상품군")
    cat_ret = df.groupby("상품군").apply(
        lambda g: g.loc[g["최종상태"] == "반품", "총구매금액"].sum() / g["총구매금액"].sum() * 100, include_groups=False)
    cat_disc = df.groupby("상품군").apply(
        lambda g: g["할인금액"].sum() / (g["상품단가"] * g["판매수량"]).sum() * 100, include_groups=False)
    categories = [{
        "name": n, "sales": int(r.sales), "qty": int(r.qty),
        "share": round(r.sales / sales * 100, 1),
        "returnRate": round(float(cat_ret[n]), 2), "discountRate": round(float(cat_disc[n]), 1),
    } for n, r in cat.iterrows()]

    stores = [{"name": n, "sales": int(r.sales), "share": round(r.sales / sales * 100, 1)}
              for n, r in by("점포명").iterrows()]

    days = ok.groupby("주문일자").agg(sales=("총구매금액", "sum"), wd=("요일", "first"))
    weekday = [{"name": w, "avgSales": round(days.loc[days["wd"] == w, "sales"].mean())} for w in WEEKDAYS]
    weekend_avg = round(days.loc[days["wd"].isin(["토", "일"]), "sales"].mean())
    weekday_avg = round(days.loc[~days["wd"].isin(["토", "일"]), "sales"].mean())

    pay = by("결제수단")
    payments = [{"name": n, "sales": int(r.sales), "share": round(r.sales / sales * 100, 1)} for n, r in pay.iterrows()]

    top = ok.groupby(["상품명", "상품군"]).agg(sales=("총구매금액", "sum"), qty=("판매수량", "sum")) \
        .sort_values("sales", ascending=False).head(8).reset_index()
    products = [{"name": r["상품명"], "category": r["상품군"], "sales": int(r["sales"]), "qty": int(r["qty"])}
                for _, r in top.iterrows()]

    g = rfm.groupby("등급").agg(customers=("고객번호", "count"), sales=("총구매금액", "sum"),
                              freq=("구매횟수", "mean"), recency=("최근구매경과일", "mean")).sort_index()
    rfm_total = g["sales"].sum()
    grades = [{"grade": n, "customers": int(r.customers), "sales": int(r.sales),
               "salesShare": round(r.sales / rfm_total * 100, 1), "avgFreq": round(r.freq, 1),
               "avgRecency": round(r.recency)} for n, r in g.iterrows()]

    data = {
        "madeBy": "Claude (Anthropic)",
        "generated": date.today().isoformat(),
        "period": [df["주문일자"].min(), df["주문일자"].max()],
        "rows": len(df),
        "kpi": kpi,
        "half": {"h1": h1, "h2": h2, "growth": round((h2 / h1 - 1) * 100, 1)},
        "monthly": [{"month": int(r["월"]), "sales": int(r.sales), "orders": int(r.orders),
                     "customers": int(r.customers)} for _, r in monthly.iterrows()],
        "categories": categories,
        "stores": stores,
        "weekday": weekday,
        "weekendAvg": weekend_avg,
        "weekdayAvg": weekday_avg,
        "payments": payments,
        "products": products,
        "grades": grades,
    }
    OUT_PATH.write_text(
        "// 작성: Claude (Anthropic)\n// build_data.py가 만든 파일입니다. 직접 고치지 말고 스크립트를 다시 실행하세요.\n"
        f"window.JM_DATA = {json.dumps(data, ensure_ascii=False, indent=1)};\n",
        encoding="utf-8",
    )
    print(json.dumps(data, ensure_ascii=False)[:4000])


if __name__ == "__main__":
    main()
