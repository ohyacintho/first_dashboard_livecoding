/*
 * 작성: Claude (Anthropic)
 * 월별 목표 계산, 달성 판정, 한 줄 요약 문장.
 * 목표 = 직전 3개월 값의 단순 평균 × 계수(JM.TARGET_FACTOR). 1~3월과 직전 평균이 0 이하인 달은 목표가 없어요.
 * DOM을 건드리지 않아요. kpis.js 다음에 불러오고, 결과는 window.JM에 더해요.
 */
(function () {
  'use strict';

  const JM = window.JM;
  const LOOKBACK = 3; // 직전 몇 개월로 목표를 잡을지
  const NEAR = 0.95; // 목표의 95%까지(반품률은 목표 ÷ 0.95까지) 근접으로 봐요

  const LEVELS = {
    good: { icon: '✔', label: '달성' },
    near: { icon: '△', label: '근접' },
    bad: { icon: '✖', label: '미달' },
  };

  // 12개월 값 → 12개월 목표(없으면 null)
  function targetsFor(kpi, values) {
    const factor = JM.TARGET_FACTOR[kpi.key];
    return values.map((_, i) => {
      if (i < LOOKBACK) return null;
      let sum = 0;
      for (let k = i - LOOKBACK; k < i; k++) sum += values[k];
      const avg = sum / LOOKBACK;
      return avg > 0 ? avg * factor : null;
    });
  }

  // 판정은 반올림 전 값으로 해요.
  function judge(kpi, actual, target) {
    if (target == null) return null;
    if (kpi.better === 'down') {
      const level = actual <= target ? 'good' : actual <= target / NEAR ? 'near' : 'bad';
      return { level: level, ratio: null, gap: actual - target };
    }
    const ratio = actual / target * 100;
    const level = ratio >= 100 ? 'good' : ratio >= NEAR * 100 ? 'near' : 'bad';
    return { level: level, ratio: ratio, gap: null };
  }

  // 실적과 목표를 단위까지 붙여 나란히 씁니다.
  // % 지표는 두 값이 다른데 소수 둘째 자리까지 같아 보이면 셋째 자리까지 보여 줘요(0.91% vs 0.91% 방지).
  function pairText(kpi, actual, target) {
    let a = kpi.short(actual);
    let t = kpi.short(target);
    if (kpi.unit === '%' && a === t && actual !== target) {
      a = actual.toFixed(3);
      t = target.toFixed(3);
    }
    return { actual: JM.withUnit(kpi, a), target: JM.withUnit(kpi, t) };
  }

  // '✔ 달성 105.1%', 반품률은 '✖ 미달 0.39%p 초과' / '✔ 달성 0.10%p 여유'
  function judgeText(kpi, j) {
    if (!j) return '';
    const head = LEVELS[j.level].icon + ' ' + LEVELS[j.level].label + ' ';
    if (kpi.better === 'down') {
      const size = Math.abs(j.gap);
      const text = size.toFixed(2) === '0.00' && size !== 0 ? size.toFixed(3) : size.toFixed(2);
      return head + text + '%p ' + (j.gap > 0 ? '초과' : '여유');
    }
    return head + JM.fmt.pctFloor1(j.ratio);
  }

  // '목표 3.28억 원', '목표 1.28% 이하', '목표 없음(4월부터)'
  // actual을 넘기면 실적과 같아 보이지 않게 자릿수를 맞춰요(pairText).
  function targetText(kpi, target, monthIndex, actual) {
    if (target == null) return monthIndex < LOOKBACK ? '목표 없음(4월부터)' : '목표 없음';
    const shown = actual == null ? JM.withUnit(kpi, kpi.short(target)) : pairText(kpi, actual, target).target;
    const text = '목표 ' + shown;
    return kpi.better === 'down' ? text + ' 이하' : text;
  }

  // 목표가 있는 달 중 달성한 달 수
  function achievedCount(kpi, values) {
    const targets = targetsFor(kpi, values);
    let hit = 0;
    let total = 0;
    targets.forEach((t, i) => {
      const j = judge(kpi, values[i], t);
      if (!j) return;
      total++;
      if (j.level === 'good') hit++;
    });
    return { hit: hit, total: total };
  }

  // 한 지표의 i번째 달 판정(목표가 없으면 null)
  function judgeAt(kpi, v, i) {
    const values = JM.series(kpi, v);
    const target = targetsFor(kpi, values)[i];
    const j = judge(kpi, values[i], target);
    return j && Object.assign(j, { actual: values[i], target: target });
  }

  // 첫 문장: 1~3월은 목표 대신 전월 비교, 4월부터는 매출 판정
  function salesSentence(segName, month, v) {
    const sales = JM.kpiByKey('sales');
    const s = JM.series(sales, v);
    const i = month - 1;
    const head = segName + ' ' + month + '월 매출은 ' + JM.withUnit(sales, sales.short(s[i]));

    if (i < LOOKBACK) {
      if (i === 0) return head + '이에요. 목표는 4월부터 계산돼요.';
      const prev = s[i - 1];
      const pct = prev ? (s[i] - prev) / prev * 100 : 0;
      const size = Math.abs(pct).toFixed(1);
      const change = !prev || size === '0.0'
        ? '전월과 같아요.'
        : '전월보다 ' + size + '% ' + (pct > 0 ? '늘었어요.' : '줄었어요.');
      return head + '으로 ' + change + ' 목표는 4월부터 계산돼요.';
    }

    const j = judgeAt(sales, v, i);
    if (!j) return head + '이에요. 이번 달은 목표가 없어요.';
    const pct = JM.fmt.pctFloor1(j.ratio);
    if (j.level === 'good') return head + '으로 목표의 ' + pct + '를 달성했어요.';
    if (j.level === 'near') return head + '으로 목표에 조금 못 미쳤어요(목표의 ' + pct + ').';
    return head + '으로 목표의 ' + pct + '에 그쳤어요.';
  }

  // 둘째 문장: 매출을 뺀 지표 중 달성하지 못한 것만 KPIS 순서로 모아요. 목표가 없는 지표는 빼요.
  // salesGood: 매출이 달성이면 '나머지 지표도', 아니면 '나머지 지표는'
  function restSentence(i, v, salesGood) {
    let judged = 0;
    const parts = [];
    let lastIsDown = false;
    JM.KPIS.forEach((kpi) => {
      if (kpi.key === 'sales') return;
      const j = judgeAt(kpi, v, i);
      if (!j) return;
      judged++;
      if (j.level === 'good') return;
      if (kpi.better === 'down') {
        const p = pairText(kpi, j.actual, j.target);
        parts.push(kpi.label + '(' + p.actual + ')' + kpi.topic + ' 목표(' + p.target + ' 이하)를 넘었어요');
      } else {
        parts.push(kpi.label + kpi.topic + ' 목표의 ' + JM.fmt.pctFloor1(j.ratio));
      }
      lastIsDown = kpi.better === 'down';
    });
    if (judged === 0) return '';
    if (parts.length === 0) return '나머지 지표' + (salesGood ? '도' : '는') + ' 모두 목표를 달성했어요.';
    return parts.join(', ') + (lastIsDown ? '.' : '예요.');
  }

  // month는 1~12, v는 JANG_MART.values[점포]
  function buildSummary(segName, month, v) {
    const first = salesSentence(segName, month, v);
    if (month - 1 < LOOKBACK) return first;
    const sales = judgeAt(JM.kpiByKey('sales'), v, month - 1);
    const rest = restSentence(month - 1, v, !!sales && sales.level === 'good');
    return rest ? first + ' ' + rest : first;
  }

  Object.assign(JM, {
    LEVELS: LEVELS,
    targetsFor: targetsFor,
    judge: judge,
    judgeText: judgeText,
    targetText: targetText,
    pairText: pairText,
    achievedCount: achievedCount,
    buildSummary: buildSummary,
  });
})();
