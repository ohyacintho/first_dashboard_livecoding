/*
 * 작성: Claude (Anthropic)
 * 장마트 대시보드 공용 지표 정의와 숫자 모양 도우미.
 * DOM을 건드리지 않아서 index.html과 tests.html이 함께 씁니다. 결과는 window.JM에 담겨요.
 */
(function () {
  'use strict';

  // ---- 목표 계수: 목표를 더 빡빡하게/느슨하게 하려면 여기 숫자만 고치세요 ----
  // 목표 = 직전 3개월 평균 × 계수 (반품률만 낮출수록 좋아서 0.95)
  const TARGET_FACTOR = { sales: 1.05, customers: 1.05, orders: 1.05, aov: 1.05, returnRate: 0.95 };

  const MONTH_COUNT = 12;

  // ---- 숫자 모양 ----------------------------------------------------------
  const nf = new Intl.NumberFormat('ko-KR');
  const fmtInt = (v) => nf.format(Math.round(v));
  const trim = (v) => String(Number(v.toFixed(2)));
  const ratio = (a, b) => (b ? a / b : 0);

  // 3.45억, 2,345만처럼 줄여 씁니다.
  function fmtWonShort(v) {
    if (Math.abs(v) >= 1e8) return (v / 1e8).toFixed(2) + '억';
    if (Math.abs(v) >= 1e4) return nf.format(Math.round(v / 1e4)) + '만';
    return fmtInt(v);
  }

  function fmtWonAxis(v) {
    if (v === 0) return '0';
    if (v >= 1e8) return trim(v / 1e8) + '억';
    if (v >= 1e4) return nf.format(Number((v / 1e4).toFixed(2))) + '만';
    return fmtInt(v);
  }

  // 소수 첫째 자리 내림: 99.96 -> '99.9%'
  const fmtPctFloor1 = (x) => (Math.floor(x * 10) / 10).toFixed(1) + '%';

  // ---- 5개 지표 정의: 지표를 바꾸거나 더하려면 이 목록만 고치면 됩니다 ----
  // better: 'up'은 오를수록 좋은 지표, 'down'은 내릴수록 좋은 지표
  // change: 'pct'는 전월 대비 증감률(%), 'pp'는 차이(%p)
  // topic: 문장에서 지표 이름 뒤에 붙는 조사('은'/'는')
  const KPIS = [
    {
      key: 'sales', label: '매출', topic: '은', unit: '원', better: 'up', change: 'pct',
      month: (v, i) => v.sales[i],
      year: (v) => v.year.sales, yearLabel: '연간 합계',
      short: fmtWonShort, full: fmtInt, axis: fmtWonAxis,
    },
    {
      key: 'customers', label: '구매 고객 수', topic: '는', unit: '명', better: 'up', change: 'pct',
      month: (v, i) => v.customers[i],
      year: (v) => v.year.customers, yearLabel: '연간(중복 제외)',
      short: fmtInt, full: fmtInt, axis: fmtInt,
    },
    {
      key: 'orders', label: '주문 건수', topic: '는', unit: '건', better: 'up', change: 'pct',
      month: (v, i) => v.orders[i],
      year: (v) => v.year.orders, yearLabel: '연간 합계',
      short: fmtInt, full: fmtInt, axis: fmtInt,
    },
    {
      key: 'aov', label: '객단가', topic: '는', unit: '원', better: 'up', change: 'pct',
      month: (v, i) => ratio(v.sales[i], v.orders[i]),
      year: (v) => ratio(v.year.sales, v.year.orders), yearLabel: '연간 평균',
      short: fmtInt, full: fmtInt, axis: fmtWonAxis,
    },
    {
      key: 'returnRate', label: '반품률', topic: '은', hint: '낮을수록 좋아요', unit: '%', better: 'down', change: 'pp',
      month: (v, i) => ratio(v.returnAmount[i], v.grossAmount[i]) * 100,
      year: (v) => ratio(v.year.returnAmount, v.year.grossAmount) * 100, yearLabel: '연간',
      short: (v) => v.toFixed(2), full: (v) => v.toFixed(2), axis: (v) => trim(v) + '%',
    },
  ];

  const kpiByKey = (key) => KPIS.find((k) => k.key === key);

  // 한 조건(v)의 12개월 값
  const series = (kpi, v) => Array.from({ length: MONTH_COUNT }, (_, i) => kpi.month(v, i));

  // "29.71억 원", "10,000명", "1.45%"처럼 단위를 붙입니다.
  function withUnit(kpi, text) {
    if (kpi.unit === '%') return text + '%';
    return /[억만]$/.test(text) ? text + ' ' + kpi.unit : text + kpi.unit;
  }

  window.JM = {
    fmt: { int: fmtInt, trim: trim, wonShort: fmtWonShort, wonAxis: fmtWonAxis, pctFloor1: fmtPctFloor1 },
    ratio: ratio,
    withUnit: withUnit,
    KPIS: KPIS,
    TARGET_FACTOR: TARGET_FACTOR,
    kpiByKey: kpiByKey,
    series: series,
  };
})();
