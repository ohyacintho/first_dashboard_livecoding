/*
 * 작성: Claude (Anthropic)
 * 화면 상태(점포·기준 월·지표)를 주소 해시로 읽고 쓰고, 링크 복사와 CSV 내려받기를 돕습니다.
 * 결과는 window.JM에 더해요. kpis.js, targets.js 다음에 불러옵니다.
 */
(function () {
  'use strict';

  const JM = window.JM;
  const STATUS_MS = 2000;
  const MONTH_NAMES = ['1월', '2월', '3월', '4월', '5월', '6월', '7월', '8월', '9월', '10월', '11월', '12월'];

  const DEFAULT_STATE = { segment: '전체', month: 12, kpi: 'sales' };

  // '#store=...&month=3&kpi=aov' → { segment, month, kpi }. 값마다 따로 검사해 틀린 값만 기본값으로 돌려요.
  function readHash(hash, segmentNames) {
    const params = new URLSearchParams(String(hash || '').replace(/^#/, ''));
    const store = params.get('store');
    const month = params.get('month');
    const kpi = params.get('kpi');
    const monthNum = /^\d{1,2}$/.test(month || '') ? Number(month) : NaN;
    return {
      segment: segmentNames.indexOf(store) !== -1 ? store : DEFAULT_STATE.segment,
      month: monthNum >= 1 && monthNum <= 12 ? monthNum : DEFAULT_STATE.month,
      kpi: JM.kpiByKey(kpi) ? kpi : DEFAULT_STATE.kpi,
    };
  }

  function hashFor(state) {
    return '#' + new URLSearchParams({ store: state.segment, month: String(state.month), kpi: state.kpi });
  }

  let statusTimer = 0;

  function showStatus(text) {
    const status = document.getElementById('link-status');
    clearTimeout(statusTimer);
    status.textContent = text;
    statusTimer = setTimeout(() => { status.textContent = ''; }, STATUS_MS);
  }

  // 복사를 못 하면 주소를 입력칸에 보여 주고 선택해 둬서 직접 복사할 수 있게 해요.
  function showFallback() {
    const input = document.getElementById('link-fallback');
    input.value = location.href;
    input.hidden = false;
    input.focus();
    input.select();
  }

  function copyLink(button) {
    const input = document.getElementById('link-fallback');
    const clip = navigator.clipboard;
    if (!clip || typeof clip.writeText !== 'function') {
      showFallback();
      return Promise.resolve();
    }
    return clip.writeText(location.href).then(
      () => {
        input.hidden = true;
        showStatus('링크를 복사했어요');
        if (button) button.focus();
      },
      showFallback
    );
  }

  // ---- CSV 내려받기 ----------------------------------------------------------
  // 반품률(%)은 소수 둘째 자리, 금액·명·건·객단가는 반올림한 정수(쉼표 없음)로 씁니다.
  function csvNum(kpi, x) {
    return kpi.unit === '%' ? x.toFixed(2) : String(Math.round(x));
  }

  // 한 지표의 한 달 칸 4개: 실적, 목표, 달성률, 판정. 목표가 없으면 뒤의 세 칸은 비워요.
  function monthCells(kpi, actual, target) {
    if (target == null) return [csvNum(kpi, actual), '', '', ''];
    const j = JM.judge(kpi, actual, target);
    const rate = kpi.better === 'down' ? '' : j.ratio.toFixed(2);
    return [csvNum(kpi, actual), csvNum(kpi, target), rate, JM.LEVELS[j.level].label];
  }

  // 머리줄 21열(월 + 지표마다 4열), 1~12월, 연간 행. 맨 앞 BOM으로 엑셀이 한글을 알아봐요.
  function buildCsv(segName, v) {
    const header = ['월'];
    JM.KPIS.forEach((kpi) => header.push(kpi.label, kpi.label + ' 목표', kpi.label + ' 달성률(%)', kpi.label + ' 판정'));

    const cols = JM.KPIS.map((kpi) => {
      const values = JM.series(kpi, v);
      return { kpi: kpi, values: values, targets: JM.targetsFor(kpi, values) };
    });
    const rows = MONTH_NAMES.map((name, i) => {
      const row = [name];
      cols.forEach((c) => row.push(...monthCells(c.kpi, c.values[i], c.targets[i])));
      return row;
    });

    const yearRow = ['연간'];
    cols.forEach((c) => {
      const hit = JM.achievedCount(c.kpi, c.values);
      yearRow.push(csvNum(c.kpi, c.kpi.year(v)), '', '', '달성 ' + hit.hit + '/' + hit.total + '개월');
    });

    const lines = [header].concat(rows, [yearRow]).map((r) => r.join(','));
    return '﻿' + lines.join('\r\n') + '\r\n';
  }

  // 장마트_실적_강남점_2025.csv
  function csvFileName(segName) {
    return '장마트_실적_' + segName + '_' + window.JANG_MART.period[0].slice(0, 4) + '.csv';
  }

  // 임시 a[download]를 눌러 내려받고, 링크와 객체 주소를 치워요.
  function downloadCsv(segName, v) {
    const blob = new Blob([buildCsv(segName, v)], { type: 'text/csv;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = csvFileName(segName);
    document.body.appendChild(a);
    a.click();
    a.remove();
    // 일부 브라우저는 내려받기가 끝나기 전에 주소를 지우면 파일을 못 받아서 잠깐 기다려요.
    setTimeout(() => URL.revokeObjectURL(url), 1000);
  }

  Object.assign(JM, {
    DEFAULT_STATE: DEFAULT_STATE,
    readHash: readHash,
    hashFor: hashFor,
    copyLink: copyLink,
    buildCsv: buildCsv,
    csvFileName: csvFileName,
    downloadCsv: downloadCsv,
  });
})();
