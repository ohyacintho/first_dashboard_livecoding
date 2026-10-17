"""data/JANG_MART.csv를 읽어 대시보드가 쓰는 월별 집계 파일(data.js)을 만듭니다.

작성: Claude (Anthropic)
실행: dashboard 폴더에서 `python build_data.py`
CSV가 바뀌었을 때만 다시 실행하면 됩니다. 웹에는 data.js만 있으면 됩니다.
"""
import json
import re
from datetime import date
from pathlib import Path

import pandas as pd

HERE = Path(__file__).resolve().parent
CSV_PATH = HERE.parent / "data" / "JANG_MART.csv"
OUT_PATH = HERE / "data.js"
MONTHS = range(1, 13)


def by_month(series):
    """월(1~12)별 값을 리스트로 바꿉니다. 거래가 없는 달은 0입니다."""
    return [int(series.get(m, 0)) for m in MONTHS]


def summarize(part):
    """한 구간(전체, 채널, 점포)의 월별·연간 숫자를 계산합니다.

    매출·고객·주문은 반품을 뺀 '정상' 행 기준입니다.
    객단가와 반품률은 화면(script.js)에서 이 숫자들로 계산합니다.
    """
    ok = part[part["최종상태"] == "정상"]
    returned = part[part["최종상태"] == "반품"]
    return {
        "sales": by_month(ok.groupby("월")["총구매금액"].sum()),
        "customers": by_month(ok.groupby("월")["고객번호"].nunique()),
        "orders": by_month(ok.groupby("월")["거래번호"].nunique()),
        "returnAmount": by_month(returned.groupby("월")["총구매금액"].sum()),
        "grossAmount": by_month(part.groupby("월")["총구매금액"].sum()),
        "year": {
            "sales": int(ok["총구매금액"].sum()),
            "customers": int(ok["고객번호"].nunique()),
            "orders": int(ok["거래번호"].nunique()),
            "returnAmount": int(returned["총구매금액"].sum()),
            "grossAmount": int(part["총구매금액"].sum()),
        },
    }


def main():
    df = pd.read_csv(CSV_PATH, encoding="utf-8-sig")

    # 한 거래(거래번호)는 한 점포에서만 일어나야 점포별 주문 건수가 맞습니다.
    assert df.groupby("거래번호")["점포명"].nunique().max() == 1, "한 거래가 여러 점포에 걸쳐 있습니다"

    stores = sorted(s for s in df["점포명"].unique() if s != "온라인몰")
    segments = [("전체", "전체", df)]
    segments.append(("채널", "온라인몰", df[df["구매채널"] == "온라인"]))
    segments.append(("채널", "오프라인 전체", df[df["구매채널"] == "오프라인"]))
    segments += [("오프라인 점포", s, df[df["점포명"] == s]) for s in stores]

    data = {
        "period": [df["주문일자"].min(), df["주문일자"].max()],
        "generated": date.today().isoformat(),
        "madeBy": "Claude (Anthropic)",
        "segments": [{"group": group, "name": name} for group, name, _ in segments],
        "values": {name: summarize(part) for _, name, part in segments},
    }

    text = json.dumps(data, ensure_ascii=False, indent=2)
    # 배열과 구간 목록은 한 줄로 모아 읽기 쉽게 합니다.
    text = re.sub(
        r"\[([^\[\]{}]*)\]",
        lambda m: "[" + ", ".join(x.strip() for x in m.group(1).split(",")) + "]",
        text,
    )
    text = re.sub(r'\{\s*("group": "[^"]*"),\s*("name": "[^"]*")\s*\}', r"{\1, \2}", text)
    OUT_PATH.write_text(
        "// 작성: Claude (Anthropic)\n"
        "// build_data.py가 data/JANG_MART.csv로 만든 파일입니다. 직접 고치지 말고 스크립트를 다시 실행하세요.\n"
        f"window.JANG_MART = {text};\n",
        encoding="utf-8",
    )
    print(f"{OUT_PATH.name} 저장: 구간 {len(segments)}개, 기간 {data['period'][0]} ~ {data['period'][1]}")


if __name__ == "__main__":
    main()
