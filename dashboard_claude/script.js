/*
 * 작성: Claude (Anthropic)
 * 장마트 실적 모니터링 대시보드
 * data.js가 넣어 둔 window.JANG_MART 숫자로 KPI 카드, 월별 막대 차트, 월별 표를 그립니다.
 * 바깥 라이브러리 없이 HTML·CSS·JS만 씁니다.
 */
(function () {
  'use strict';

  const DATA = window.JANG_MART;
  const SVG_NS = 'http://www.w3.org/2000/svg';
  const MONTH_COUNT = 12;

  const JM = window.JM;

  // 처음 열었을 때 보여 줄 조건: 주소 해시에 담긴 값을 쓰고, 없거나 틀리면 기본값
  const segmentNames = DATA ? DATA.segments.map((s) => s.name) : [];
  const state = JM.readHash(location.hash, segmentNames);
  const { KPIS, withUnit } = JM;

  // ---- 도우미 -------------------------------------------------------------
  function el(tag, className, text) {
    const node = document.createElement(tag);
    if (className) node.className = className;
    if (text !== undefined) node.textContent = text;
    return node;
  }

  function svg(tag, attrs) {
    const node = document.createElementNS(SVG_NS, tag);
    Object.keys(attrs).forEach((k) => node.setAttribute(k, attrs[k]));
    return node;
  }

  const currentKpi = () => KPIS.find((k) => k.key === state.kpi);
  const segmentValues = () => DATA.values[state.segment];
  const series = (kpi) => JM.series(kpi, segmentValues());
  const yearText = DATA ? DATA.period[0].slice(0, 4) : '';

  // 전월 대비 변화. 비교할 전월이 없으면 null
  function change(kpi, cur, prev) {
    if (prev === undefined) return null;
    const isPoint = kpi.change === 'pp';
    if (!isPoint && !prev) return null;
    const digits = isPoint ? 2 : 1;
    const suffix = isPoint ? '%p' : '%';
    const diff = Number((isPoint ? cur - prev : ((cur - prev) / prev) * 100).toFixed(digits));
    if (diff === 0) return { icon: '–', text: (0).toFixed(digits) + suffix, tone: 'is-flat', word: '변화 없음' };
    const up = diff > 0;
    const good = kpi.better === 'up' ? up : !up;
    return {
      icon: up ? '▲' : '▼',
      text: Math.abs(diff).toFixed(digits) + suffix,
      tone: good ? 'is-good' : 'is-bad',
      word: (up ? '증가' : '감소') + (good ? ', 좋아짐' : ', 나빠짐'),
    };
  }

  function changeRow(className, kpi, values, i) {
    const row = el('span', className);
    const d = change(kpi, values[i], i > 0 ? values[i - 1] : undefined);
    if (d) {
      row.classList.add(d.tone);
      row.appendChild(el('span', null, d.icon + ' ' + d.text));
      row.appendChild(el('span', 'sr-only', ' (' + d.word + ')'));
      row.appendChild(el('span', 'kpi-vs', '전월 대비'));
    } else {
      row.classList.add('is-flat');
      row.appendChild(el('span', 'kpi-vs', '비교할 전월 없음'));
    }
    return row;
  }

  // ---- 조회 조건 ----------------------------------------------------------
  function setupFilters() {
    const segSelect = document.getElementById('segment');
    let parent = segSelect;
    let group = null;
    DATA.segments.forEach((s) => {
      if (s.group !== s.name && s.group !== group) {
        parent = el('optgroup');
        parent.label = s.group;
        segSelect.appendChild(parent);
        group = s.group;
      }
      const opt = el('option', null, s.name);
      opt.value = s.name;
      parent.appendChild(opt);
    });
    segSelect.addEventListener('change', () => update({ segment: segSelect.value }));

    const monthSelect = document.getElementById('month');
    for (let m = 1; m <= MONTH_COUNT; m++) {
      const opt = el('option', null, m + '월');
      opt.value = String(m);
      monthSelect.appendChild(opt);
    }
    monthSelect.addEventListener('change', () => update({ month: Number(monthSelect.value) }));
  }

  function renderFilters() {
    document.getElementById('segment').value = state.segment;
    document.getElementById('month').value = String(state.month);
    const m = state.month;
    document.getElementById('filter-note').textContent =
      state.segment + ' · ' + yearText + '년 ' + m + '월 실적' +
      (m > 1 ? ' · ' + (m - 1) + '월과 비교' : ' · 1월은 비교할 전월이 없어요');
  }

  // ---- KPI 카드 -----------------------------------------------------------
  function sparkline(values, idx) {
    const W = 100;
    const H = 32;
    const pad = 4;
    const min = Math.min(...values);
    const max = Math.max(...values);
    const x = (i) => (i / (values.length - 1)) * W;
    const y = (v) => (max === min ? H / 2 : pad + (1 - (v - min) / (max - min)) * (H - pad * 2));

    const box = el('span', 'spark');
    box.setAttribute('aria-hidden', 'true');
    const line = svg('svg', { viewBox: '0 0 ' + W + ' ' + H, preserveAspectRatio: 'none', focusable: 'false' });
    line.appendChild(svg('path', {
      d: values.map((v, i) => (i ? 'L' : 'M') + x(i).toFixed(2) + ' ' + y(v).toFixed(2)).join(' '),
    }));
    box.appendChild(line);

    const dot = el('span', 'spark-dot');
    dot.style.left = (x(idx) / W) * 100 + '%';
    dot.style.top = (y(values[idx]) / H) * 100 + '%';
    box.appendChild(dot);
    return box;
  }

  // 한 줄 요약
  function renderSummary() {
    document.getElementById('summary').textContent = JM.buildSummary(state.segment, state.month, segmentValues());
  }

  // 카드의 목표 줄: '✔ 달성 105.1% · 목표 3.28억 원'. 목표가 없으면 '목표 없음(4월부터)'만
  function targetRow(kpi, values, i) {
    const row = el('span', 'kpi-target');
    const target = JM.targetsFor(kpi, values)[i];
    const j = JM.judge(kpi, values[i], target);
    const tText = JM.targetText(kpi, target, i, values[i]);
    if (!j) {
      row.classList.add('is-none');
      row.appendChild(el('span', 'kpi-goal', tText));
      return row;
    }
    const level = JM.LEVELS[j.level];
    const rest = level.label + ' ' + JM.judgeDetail(kpi, j);
    const icon = el('span', 'lv-icon lv-' + j.level, level.icon);
    icon.setAttribute('aria-hidden', 'true');
    const judged = el('span', 'kpi-judge');
    judged.append(icon, ' ', el('span', 'kpi-judge-text', rest));
    row.append(judged, ' · ', el('span', 'kpi-goal', tText));
    return row;
  }

  function renderKpis() {
    const host = document.getElementById('kpis');
    host.replaceChildren();
    const i = state.month - 1;

    KPIS.forEach((kpi) => {
      const values = series(kpi);
      const card = el('button', 'kpi');
      card.type = 'button';
      card.setAttribute('aria-pressed', String(kpi.key === state.kpi));
      card.setAttribute('data-focus', 'kpi-' + kpi.key);
      card.addEventListener('click', () => update({ kpi: kpi.key }));

      const label = el('span', 'kpi-label', kpi.label);
      if (kpi.hint) label.appendChild(el('span', 'kpi-hint', ' · ' + kpi.hint));

      const value = el('span', 'kpi-value');
      value.title = withUnit(kpi, kpi.full(values[i]));
      value.appendChild(el('span', null, kpi.short(values[i])));
      value.appendChild(el('span', 'kpi-unit', kpi.unit));

      const year = el('span', 'kpi-year', kpi.yearLabel + ' ');
      year.appendChild(el('span', 'nowrap', withUnit(kpi, kpi.short(kpi.year(segmentValues())))));

      card.append(label, value, changeRow('kpi-delta', kpi, values, i), targetRow(kpi, values, i), sparkline(values, i), year);
      host.appendChild(card);
    });
  }

  // ---- 월별 막대 차트 -----------------------------------------------------
  let layout = null; // 툴팁 위치 계산에 쓰는 마지막 차트 좌표

  // 0부터 시작하는 깔끔한 눈금(1·2·2.5·5 단위)
  function niceTicks(max, count) {
    if (!(max > 0)) return [0, 1];
    const raw = max / count;
    const pow = Math.pow(10, Math.floor(Math.log10(raw)));
    const step = [1, 2, 2.5, 5, 10].map((s) => s * pow).find((s) => s >= raw);
    const steps = Math.ceil(max / step - 1e-9);
    return Array.from({ length: steps + 1 }, (_, k) => Number((k * step).toPrecision(12)));
  }

  // 위쪽 모서리만 4px 둥근 막대
  function barPath(x, top, w, base) {
    const r = Math.min(4, w / 2, base - top);
    return 'M' + x + ',' + base + ' V' + (top + r) +
      ' Q' + x + ',' + top + ' ' + (x + r) + ',' + top +
      ' H' + (x + w - r) +
      ' Q' + (x + w) + ',' + top + ' ' + (x + w) + ',' + (top + r) +
      ' V' + base + ' Z';
  }

  // 범례: '■ 실적'과 '─ 목표'(반품률은 '─ 목표(상한)'). 기호는 막대·눈금과 같은 색
  function renderLegend(kpi) {
    const item = (swatch, text) => {
      const li = el('li', 'lg-item');
      const mark = el('span', swatch);
      mark.setAttribute('aria-hidden', 'true');
      li.append(mark, el('span', null, text));
      return li;
    };
    document.getElementById('legend').replaceChildren(
      item('lg-bar', '실적'),
      item('lg-line', kpi.better === 'down' ? '목표(상한)' : '목표')
    );
  }

  function renderChart() {
    const kpi = currentKpi();
    const values = series(kpi);
    const targets = JM.targetsFor(kpi, values);
    const sel = state.month - 1;
    const host = document.getElementById('chart');

    document.getElementById('chart-title').textContent = kpi.label + ' 월별 추이';
    document.getElementById('chart-sub').textContent =
      state.segment + ' · ' + (kpi.hint ? kpi.hint + ' · ' : '') + '막대를 누르면 기준 월이 바뀌어요';
    renderLegend(kpi);

    const width = host.clientWidth;
    if (!width) return;
    const height = 300;
    const m = { top: 28, right: 4, bottom: 30, left: width < 520 ? 44 : 56 };
    const plotW = width - m.left - m.right;
    const plotH = height - m.top - m.bottom;
    const slot = plotW / MONTH_COUNT;
    const barW = Math.min(24, slot * 0.56);
    // 세로축 최댓값은 실적과 목표 중 큰 값
    const ticks = niceTicks(Math.max(...values, ...targets.filter((t) => t != null)), 4);
    const top = ticks[ticks.length - 1];
    const y = (v) => m.top + plotH * (1 - v / top);
    const cx = (i) => m.left + slot * (i + 0.5);
    const base = y(0);
    layout = { cx, y };

    const root = svg('svg', {
      width: width, height: height, viewBox: '0 0 ' + width + ' ' + height,
      role: 'group', 'aria-label': state.segment + ' ' + kpi.label + ' 월별 막대 차트',
    });

    ticks.forEach((t) => {
      const ty = Math.round(y(t)) + 0.5;
      if (t > 0) root.appendChild(svg('line', { class: 'gridline', x1: m.left, x2: width - m.right, y1: ty, y2: ty }));
      const label = svg('text', { class: 'tick', x: m.left - 8, y: ty, 'text-anchor': 'end', 'dominant-baseline': 'middle' });
      label.textContent = kpi.axis(t);
      root.appendChild(label);
    });

    const bars = values.map((v, i) => {
      const bar = svg('path', {
        class: 'bar' + (i === sel ? ' is-selected' : ''),
        d: barPath(cx(i) - barW / 2, y(v), barW, base),
      });
      root.appendChild(bar);

      const xl = svg('text', { class: 'tick' + (i === sel ? ' is-current' : ''), x: cx(i), y: height - 8, 'text-anchor': 'middle' });
      xl.textContent = slot < 34 ? String(i + 1) : i + 1 + '월';
      root.appendChild(xl);
      return bar;
    });

    root.appendChild(svg('line', { class: 'baseline', x1: m.left, x2: width - m.right, y1: Math.round(base) + 0.5, y2: Math.round(base) + 0.5 }));

    // 목표가 있는 달마다 막대 양옆으로 튀어나오는 가로 눈금(기준 월과 상관없이 모두)
    targets.forEach((t, i) => {
      if (t == null) return;
      const ty = y(t);
      const half = barW / 2 + 4;
      root.appendChild(svg('line', { class: 'target-mark', x1: cx(i) - half, x2: cx(i) + half, y1: ty, y2: ty }));
    });

    // 기준 월 막대에만 값을 붙입니다. 나머지 값은 툴팁과 표에 있어요.
    // 목표 눈금이 막대보다 높으면 눈금 위에 둬서 겹치지 않게 해요.
    const labelTop = Math.min(y(values[sel]), targets[sel] == null ? Infinity : y(targets[sel]));
    const valueLabel = svg('text', { class: 'value-label', x: cx(sel), y: labelTop - 8, 'text-anchor': 'middle' });
    valueLabel.textContent = withUnit(kpi, kpi.short(values[sel]));
    root.appendChild(valueLabel);

    // 막대보다 넓은 투명 영역으로 마우스·키보드 입력을 받습니다.
    values.forEach((v, i) => {
      const hit = svg('rect', {
        class: 'hit', x: m.left + slot * i, y: m.top, width: slot, height: plotH,
        tabindex: '0', role: 'button', 'data-focus': 'bar-' + i,
        'aria-label': (i + 1) + '월 ' + kpi.label + ' ' + withUnit(kpi, kpi.full(v)) + (i === sel ? ', 기준 월' : ''),
      });
      const show = () => { bars[i].classList.add('is-hover'); showTip(i); };
      const hide = () => { bars[i].classList.remove('is-hover'); hideTip(); };
      hit.addEventListener('pointerenter', show);
      hit.addEventListener('pointerleave', hide);
      hit.addEventListener('focus', show);
      hit.addEventListener('blur', hide);
      hit.addEventListener('click', () => update({ month: i + 1 }));
      hit.addEventListener('keydown', (e) => {
        if (e.key === 'Enter' || e.key === ' ') {
          e.preventDefault();
          update({ month: i + 1 });
        }
      });
      root.appendChild(hit);
    });

    host.replaceChildren(root);
  }

  function showTip(i) {
    const kpi = currentKpi();
    const values = series(kpi);
    const tip = document.getElementById('tooltip');
    const card = document.getElementById('chart-card');
    const host = document.getElementById('chart');

    // 목표가 있으면 '목표 3.28억 원 · ✔ 달성 105.1%', 없으면 '목표 없음(4월부터)'만
    const target = JM.targetsFor(kpi, values)[i];
    const j = JM.judge(kpi, values[i], target);
    const goalText = j
      ? JM.targetText(kpi, target, i, values[i]) + ' · ' + JM.judgeText(kpi, j)
      : JM.targetText(kpi, null, i);

    tip.replaceChildren(
      el('div', 'tt-title', yearText + '년 ' + (i + 1) + '월 · ' + state.segment),
      el('div', 'tt-value', withUnit(kpi, kpi.full(values[i]))),
      changeRow('tt-delta', kpi, values, i),
      el('div', 'tt-target', goalText)
    );
    tip.hidden = false;

    const cardBox = card.getBoundingClientRect();
    const hostBox = host.getBoundingClientRect();
    const barX = hostBox.left - cardBox.left + layout.cx(i);
    const barTop = hostBox.top - cardBox.top + layout.y(target == null ? values[i] : Math.max(values[i], target));
    const left = Math.max(8, Math.min(barX - tip.offsetWidth / 2, card.clientWidth - tip.offsetWidth - 8));
    let top = barTop - tip.offsetHeight - 14;
    if (top < 8) top = barTop + 14;
    tip.style.left = left + 'px';
    tip.style.top = top + 'px';
  }

  function hideTip() {
    document.getElementById('tooltip').hidden = true;
  }

  // ---- 월별 표 ------------------------------------------------------------
  function renderTable() {
    const table = document.getElementById('table');
    const v = segmentValues();
    const sel = state.month - 1;
    const cell = (tag, kpi, text) => {
      const c = el(tag, kpi.key === state.kpi ? 'is-active' : '', text);
      if (tag === 'th') c.scope = 'col';
      return c;
    };

    const caption = el('caption', 'sr-only', state.segment + ' 월별 실적 표');

    // 지표마다 12개월 값·목표·판정을 한 번씩만 계산해 둬요.
    const rows = KPIS.map((kpi) => {
      const values = series(kpi);
      const targets = JM.targetsFor(kpi, values);
      return {
        kpi: kpi,
        values: values,
        targets: targets,
        judges: values.map((val, i) => JM.judge(kpi, val, targets[i])),
        count: JM.achievedCount(kpi, values),
      };
    });
    const chartRow = rows.find((r) => r.kpi.key === state.kpi);
    const chartKpi = chartRow.kpi;

    // 차트 지표의 목표·달성률 열. 목표가 없으면 '–'
    const targetCell = (tag, text) => {
      const c = el(tag, 'is-target', text);
      if (tag === 'th') c.scope = 'col';
      return c;
    };
    // 달성률 칸 글자: 오를수록 좋은 지표는 '105.1%', 반품률은 '0.39%p 초과' / '0.10%p 여유'
    const rateText = (kpi, j) => (j ? JM.judgeDetail(kpi, j) : '–');
    // 목표 칸 글자. 반품률은 실적과 같아 보이면 셋째 자리까지 보여 줘서(pairText) 판정과 어긋나 보이지 않게 해요.
    const targetCellText = (kpi, actual, target) => {
      if (target == null) return '–';
      return kpi.unit === '%' ? JM.pairText(kpi, actual, target).target.replace(/%$/, '') : kpi.full(target);
    };
    // 판정 기호 칸. 판정이 없는 칸도 같은 폭의 빈 칸을 둬서 오른쪽 맞춤 숫자의 끝이 줄을 맞춰요.
    const levelMark = (j) => {
      const mark = el('span', j ? 'lv lv-' + j.level : 'lv', j ? JM.LEVELS[j.level].icon : undefined);
      mark.setAttribute('aria-hidden', 'true');
      return mark;
    };

    const headRow = el('tr');
    const monthHead = el('th', null, '월');
    monthHead.scope = 'col';
    headRow.appendChild(monthHead);
    KPIS.forEach((kpi) => headRow.appendChild(cell('th', kpi, kpi.label + '(' + kpi.unit + ')')));
    headRow.append(
      targetCell('th', chartKpi.label + ' 목표'),
      targetCell('th', chartKpi.label + ' 달성률')
    );
    const thead = el('thead');
    thead.appendChild(headRow);

    const tbody = el('tbody');
    for (let i = 0; i < MONTH_COUNT; i++) {
      const row = el('tr', i === sel ? 'is-selected' : '');
      const monthCell = el('th', null, i + 1 + '월');
      monthCell.scope = 'row';
      row.appendChild(monthCell);
      rows.forEach((r) => {
        const c = cell('td', r.kpi, r.kpi.full(r.values[i]));
        const j = r.judges[i];
        c.appendChild(levelMark(j));
        // 판정은 기호만으로 알리지 않고 글자도 함께 붙여요(보조 기기용 글자는 화면에서 숨김)
        if (j) c.appendChild(el('span', 'sr-only', JM.LEVELS[j.level].label));
        row.appendChild(c);
      });
      row.append(
        targetCell('td', targetCellText(chartKpi, chartRow.values[i], chartRow.targets[i])),
        targetCell('td', rateText(chartKpi, chartRow.judges[i]))
      );
      tbody.appendChild(row);
    }

    const footRow = el('tr');
    const yearCell = el('th', null, '연간');
    yearCell.scope = 'row';
    footRow.appendChild(yearCell);
    KPIS.forEach((kpi) => {
      const c = cell('td', kpi, kpi.full(kpi.year(v)));
      c.appendChild(levelMark(null));
      footRow.appendChild(c);
    });
    footRow.append(targetCell('td', '–'), targetCell('td', '–'));

    const hitRow = el('tr');
    const hitHead = el('th', null, '달성 개월');
    hitHead.scope = 'row';
    hitRow.appendChild(hitHead);
    rows.forEach((r) => {
      const c = cell('td', r.kpi, r.count.hit + '/' + r.count.total);
      c.appendChild(levelMark(null));
      hitRow.appendChild(c);
    });
    hitRow.append(targetCell('td', '–'), targetCell('td', '–'));

    const tfoot = el('tfoot');
    tfoot.append(footRow, hitRow);

    table.replaceChildren(caption, thead, tbody, tfoot);
  }

  // ---- 전체 갱신 ----------------------------------------------------------
  function render() {
    renderFilters();
    renderSummary();
    renderKpis();
    renderChart();
    renderTable();
  }

  // 주소 해시를 현재 상태로 맞춥니다. file:// 등에서 replaceState가 막혀도 화면은 계속 동작해요.
  function syncHash() {
    try {
      history.replaceState(null, '', JM.hashFor(state));
    } catch (e) { /* 주소를 못 고쳐도 넘어갑니다 */ }
  }

  // 다시 그려도 키보드 위치(포커스)가 그대로 남게 합니다.
  function update(patch) {
    const focused = document.activeElement && document.activeElement.getAttribute('data-focus');
    Object.assign(state, patch);
    hideTip();
    JM.hideFallback(); // 화면 상태가 바뀌면 옛 주소가 든 입력칸은 닫아요
    render();
    syncHash();
    if (focused) {
      const again = document.querySelector('[data-focus="' + focused + '"]');
      if (again) again.focus();
    }
  }

  if (!DATA) {
    const box = document.getElementById('kpis');
    box.appendChild(el('p', 'load-error', 'data.js를 불러오지 못했어요. index.html과 같은 폴더에 data.js가 있는지 확인해 주세요.'));
    return;
  }

  setupFilters();
  render();
  // 틀린 값이 들어 있던 주소는 처음에 바로 바른 주소로 고쳐 둡니다.
  syncHash();

  // 주소창에서 해시를 고치거나 뒤로 가기를 하면 화면도 따라 바꿉니다.
  // replaceState는 hashchange를 일으키지 않아서 다시 그리기가 되풀이되지 않아요.
  window.addEventListener('hashchange', () => update(JM.readHash(location.hash, segmentNames)));

  const linkButton = document.getElementById('btn-link');
  linkButton.addEventListener('click', () => JM.copyLink(linkButton));

  // 복사 대신 나온 주소 입력칸: 포커스를 잃거나 Esc를 누르면 닫아요.
  const linkFallback = document.getElementById('link-fallback');
  linkFallback.addEventListener('blur', JM.hideFallback);
  linkFallback.addEventListener('keydown', (e) => {
    if (e.key !== 'Escape') return;
    JM.hideFallback();
    linkButton.focus();
  });

  // CSV는 지금 고른 점포의 12개월 실적을 내려받아요.
  const csvButton = document.getElementById('btn-csv');
  csvButton.addEventListener('click', () => JM.downloadCsv(state.segment, segmentValues()));

  // 인쇄: 버튼으로 누르든 Ctrl+P든 인쇄 직전에 조회 조건 줄과 출력 날짜를 채워요.
  function fillPrintInfo() {
    const d = new Date();
    const two = (n) => String(n).padStart(2, '0');
    document.getElementById('print-conditions').textContent =
      '조회 조건: ' + state.segment + ' · ' + yearText + '년 ' + state.month + '월 · ' + currentKpi().label;
    document.getElementById('print-date').textContent =
      '출력 ' + d.getFullYear() + '-' + two(d.getMonth() + 1) + '-' + two(d.getDate());
  }
  window.addEventListener('beforeprint', fillPrintInfo);
  document.getElementById('btn-print').addEventListener('click', () => window.print());

  // 창 너비가 바뀌면 차트만 다시 그립니다.
  const chartHost = document.getElementById('chart');
  let lastWidth = chartHost.clientWidth;
  let frame = 0;
  new ResizeObserver(() => {
    if (chartHost.clientWidth === lastWidth) return;
    lastWidth = chartHost.clientWidth;
    cancelAnimationFrame(frame);
    frame = requestAnimationFrame(() => {
      hideTip();
      renderChart();
    });
  }).observe(chartHost);
  chartHost.addEventListener('pointerleave', hideTip);
})();
