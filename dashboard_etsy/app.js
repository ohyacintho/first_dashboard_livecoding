/*
 * 작성: Claude (Anthropic)
 * 장마트 2025 실적 리포트
 * data.js의 window.JM_DATA로 핵심 발견, KPI, 월별 차트, 상품군·채널·고객·요일·결제·상품을 그립니다.
 * 바깥 라이브러리 없이 HTML·CSS·JS만 씁니다. 문장 속 숫자도 모두 데이터에서 계산해요.
 */
(function () {
  'use strict';

  const D = window.JM_DATA;
  const SVG_NS = 'http://www.w3.org/2000/svg';
  if (!D) {
    document.getElementById('hero-number').textContent = 'data.js를 불러오지 못했어요';
    return;
  }

  // ---- 숫자 모양 ----------------------------------------------------------
  const nf = new Intl.NumberFormat('ko-KR');
  const int = (v) => nf.format(Math.round(v));
  const pct = (v, d = 1) => v.toFixed(d) + '%';
  // 3.45억, 2,345만처럼 줄여 씁니다.
  function won(v, digits = 2) {
    if (Math.abs(v) >= 1e8) return (v / 1e8).toFixed(digits) + '억';
    if (Math.abs(v) >= 1e4) return nf.format(Math.round(v / 1e4)) + '만';
    return int(v);
  }
  const share = (part, total) => (part / total) * 100;

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

  // "<b>값</b> 설명" 같은 문장을 안전하게 만듭니다. parts: [문자열 | {b: 문자열}]
  function rich(node, parts) {
    parts.forEach((p) => node.append(typeof p === 'string' ? p : el('strong', null, p.b)));
    return node;
  }

  function tabs(hostId, items, current, onPick) {
    const host = document.getElementById(hostId);
    host.replaceChildren();
    items.forEach((it) => {
      const b = el('button', 'tab', it.label);
      b.type = 'button';
      b.setAttribute('role', 'tab');
      b.setAttribute('aria-selected', String(it.key === current));
      b.addEventListener('click', () => onPick(it.key));
      host.appendChild(b);
    });
  }

  function barRow(name, ratio, valueParts, fillClass) {
    const li = el('li', 'bar-row');
    li.appendChild(el('span', 'bar-name', name));
    const track = el('span', 'bar-track');
    const fill = el('span', 'bar-fill' + (fillClass ? ' ' + fillClass : ''));
    fill.style.width = Math.max(1, ratio * 100) + '%';
    fill.style.display = 'block';
    track.appendChild(fill);
    li.appendChild(track);
    li.appendChild(rich(el('span', 'bar-val'), valueParts));
    return li;
  }

  const K = D.kpi;
  const months = D.monthly;
  const offline = D.stores.filter((s) => s.name !== '온라인몰');
  const totalQty = D.categories.reduce((a, c) => a + c.qty, 0);
  const topCat = D.categories[0];
  const gradeA = D.grades[0];
  const totalGradeCustomers = D.grades.reduce((a, g) => a + g.customers, 0);

  // ---- 머리글·핵심 발견 ---------------------------------------------------
  function renderHeader() {
    const chips = document.getElementById('chips');
    [D.period[0] + ' ~ ' + D.period[1], int(D.rows) + '행', '교육용 합성 데이터'].forEach((t) => {
      chips.appendChild(el('li', 'chip', t));
    });

    const hero = document.getElementById('hero-number');
    hero.append((K.sales / 1e8).toFixed(1));
    hero.appendChild(el('small', null, '억 원'));
    document.getElementById('hero-sub').textContent =
      '하반기 ' + won(D.half.h2, 1) + ' 원으로 상반기(' + won(D.half.h1, 1) + ' 원)보다 ' + pct(D.half.growth) + ' 많았어요.';

    const jan = months[0].sales;
    const dec = months[11].sales;
    const ab = D.grades.slice(0, 2);
    const abCust = share(ab[0].customers + ab[1].customers, totalGradeCustomers);
    const abSales = ab[0].salesShare + ab[1].salesShare;
    const findings = [
      ['매출이 꾸준히 늘었어요. 12월은 1월의 ', { b: (dec / jan).toFixed(1) + '배' }, '이고, 9월부터 오름폭이 커졌어요.'],
      [topCat.name + '은 판매수량의 ', { b: pct(share(topCat.qty, totalQty)) }, '뿐인데 매출은 ', { b: pct(topCat.share) }, '를 차지해요.'],
      ['A·B등급 고객 ', { b: pct(abCust) }, '가 매출의 ', { b: pct(abSales) }, '를 만들어요.'],
      ['온라인몰 한 곳이 매출의 ', { b: pct(K.onlineShare) }, ', 오프라인 8개 점포는 각각 ' +
        pct(Math.min(...offline.map((s) => s.share))) + '~' + pct(Math.max(...offline.map((s) => s.share))) + '로 고르게 나뉘어요.'],
    ];
    const list = document.getElementById('findings');
    findings.forEach((f) => list.appendChild(rich(el('li'), f)));
  }

  // ---- KPI ----------------------------------------------------------------
  function renderKpis() {
    const items = [
      ['순매출', won(K.sales), '원', '반품 금액 제외'],
      ['주문 건수', int(K.orders), '건', '판매수량 ' + int(K.qty) + '개'],
      ['구매 고객 수', int(K.customers), '명', '1인당 ' + (K.orders / K.customers).toFixed(1) + '회 주문'],
      ['객단가', int(K.aov), '원', '주문 1건당 평균'],
      ['반품률', K.returnRate.toFixed(2), '%', '금액 기준'],
      ['평균 할인율', K.discountRate.toFixed(1), '%', '정가 대비'],
    ];
    const host = document.getElementById('kpis');
    items.forEach(([label, value, unit, note]) => {
      const card = el('div', 'kpi');
      card.appendChild(el('p', 'kpi-label', label));
      const v = el('p', 'kpi-value', value);
      v.appendChild(el('small', null, unit));
      card.appendChild(v);
      card.appendChild(el('p', 'kpi-note', note));
      host.appendChild(card);
    });
  }

  // ---- 월별 차트 ----------------------------------------------------------
  const MONTHLY = [
    { key: 'sales', label: '매출', unit: '원', fmt: (v) => won(v) + ' 원', axis: (v) => (v ? won(v, 0) : '0'), full: (v) => int(v) + '원' },
    { key: 'orders', label: '주문 건수', unit: '건', fmt: (v) => int(v) + '건', axis: int, full: (v) => int(v) + '건' },
    { key: 'customers', label: '구매 고객 수', unit: '명', fmt: (v) => int(v) + '명', axis: int, full: (v) => int(v) + '명' },
  ];
  let monthlyKey = 'sales';

  function niceTicks(max, count) {
    const raw = max / count;
    const pow = Math.pow(10, Math.floor(Math.log10(raw)));
    const step = [1, 2, 2.5, 5, 10].map((s) => s * pow).find((s) => s >= raw);
    const steps = Math.ceil(max / step - 1e-9);
    return Array.from({ length: steps + 1 }, (_, k) => Number((k * step).toPrecision(12)));
  }

  function renderMonthly() {
    const m = MONTHLY.find((x) => x.key === monthlyKey);
    tabs('monthly-tabs', MONTHLY, monthlyKey, (key) => { monthlyKey = key; renderMonthly(); });
    const values = months.map((r) => r[m.key]);
    document.getElementById('monthly-sub').textContent =
      '1월 ' + m.fmt(values[0]) + ' → 12월 ' + m.fmt(values[11]) + ' (' + pct(share(values[11] - values[0], values[0])) + ' 증가)';

    const host = document.getElementById('monthly-chart');
    const width = host.clientWidth || 900;
    const height = 280;
    const pad = { top: 26, right: 6, bottom: 28, left: width < 520 ? 44 : 56 };
    const plotW = width - pad.left - pad.right;
    const plotH = height - pad.top - pad.bottom;
    const slot = plotW / 12;
    const barW = Math.min(28, slot * 0.6);
    const ticks = niceTicks(Math.max(...values), 4);
    const top = ticks[ticks.length - 1];
    const y = (v) => pad.top + plotH * (1 - v / top);
    const cx = (i) => pad.left + slot * (i + 0.5);

    const root = svg('svg', { viewBox: '0 0 ' + width + ' ' + height, width: width, height: height, role: 'img',
      'aria-label': m.label + ' 월별 막대 차트. 1월 ' + m.full(values[0]) + ', 12월 ' + m.full(values[11]) });
    ticks.forEach((t) => {
      const ty = Math.round(y(t)) + 0.5;
      root.appendChild(svg('line', { class: t ? 'grid' : 'base', x1: pad.left, x2: width - pad.right, y1: ty, y2: ty }));
      const label = svg('text', { class: 'tick', x: pad.left - 8, y: ty + 4, 'text-anchor': 'end' });
      label.textContent = m.axis(t);
      root.appendChild(label);
    });

    const tip = document.getElementById('tooltip');
    values.forEach((v, i) => {
      const x = cx(i) - barW / 2;
      const yt = y(v);
      const r = Math.min(6, barW / 2, y(0) - yt);
      const bar = svg('path', {
        class: 'bar' + (i >= 6 ? ' h2' : ''),
        d: 'M' + x + ',' + y(0) + ' V' + (yt + r) + ' Q' + x + ',' + yt + ' ' + (x + r) + ',' + yt +
          ' H' + (x + barW - r) + ' Q' + (x + barW) + ',' + yt + ' ' + (x + barW) + ',' + (yt + r) + ' V' + y(0) + ' Z',
      });
      root.appendChild(bar);

      const xl = svg('text', { class: 'tick', x: cx(i), y: height - 8, 'text-anchor': 'middle' });
      xl.textContent = slot < 36 ? String(i + 1) : i + 1 + '월';
      root.appendChild(xl);

      // 첫 달과 마지막 달에만 값을 붙여요. 나머지는 마우스를 올리면 보여요.
      if (i === 0 || i === 11) {
        const val = svg('text', { class: 'val', x: cx(i), y: yt - 8, 'text-anchor': 'middle' });
        val.textContent = m.fmt(v);
        root.appendChild(val);
      }

      const hit = svg('rect', { class: 'bar-hit', x: pad.left + slot * i, y: pad.top, width: slot, height: plotH, tabindex: '0',
        'aria-label': (i + 1) + '월 ' + m.label + ' ' + m.full(v) });
      const show = () => {
        bar.classList.add('is-hover');
        const prev = i ? values[i - 1] : null;
        tip.replaceChildren(el('span', null, '2025년 ' + (i + 1) + '월'), el('strong', null, m.full(v)),
          el('span', null, prev ? '전월 대비 ' + (v >= prev ? '+' : '') + pct(share(v - prev, prev)) : '첫 달'));
        tip.hidden = false;
        const left = Math.max(0, Math.min(cx(i) - tip.offsetWidth / 2, width - tip.offsetWidth));
        tip.style.left = left + 'px';
        tip.style.top = Math.max(0, yt - tip.offsetHeight - 10) + 'px';
      };
      const hide = () => { bar.classList.remove('is-hover'); tip.hidden = true; };
      hit.addEventListener('pointerenter', show);
      hit.addEventListener('pointerleave', hide);
      hit.addEventListener('focus', show);
      hit.addEventListener('blur', hide);
      root.appendChild(hit);
    });

    host.replaceChildren(root);
  }

  // ---- 상품군 -------------------------------------------------------------
  let catKey = 'sales';

  function renderCategories() {
    tabs('cat-tabs', [{ key: 'sales', label: '매출' }, { key: 'qty', label: '판매수량' }], catKey,
      (key) => { catKey = key; renderCategories(); });
    const rows = D.categories.slice().sort((a, b) => b[catKey] - a[catKey]);
    const max = rows[0][catKey];
    const sub = document.getElementById('cat-sub');
    sub.textContent = catKey === 'sales'
      ? '비싼 상품군이 매출을 이끌어요. 소형가전 한 곳이 ' + pct(topCat.share) + '예요.'
      : '자주 사는 건 식품이에요. 매출 순위와 거의 반대예요.';
    const list = document.getElementById('cat-bars');
    list.replaceChildren();
    rows.forEach((c) => {
      const value = catKey === 'sales'
        ? [{ b: won(c.sales) }, ' · ' + pct(c.share)]
        : [{ b: int(c.qty) + '개' }, ' · ' + pct(share(c.qty, totalQty))];
      list.appendChild(barRow(c.name, c[catKey] / max, value, catKey === 'qty' ? 'sage' : ''));
    });
  }

  // ---- 채널·점포 ----------------------------------------------------------
  function renderSplit(hostId, legendId, parts) {
    const host = document.getElementById(hostId);
    const legend = document.getElementById(legendId);
    parts.forEach((p) => {
      const seg = el('span', p.cls, p.value >= 12 ? pct(p.value) : '');
      seg.style.flex = String(p.value);
      seg.title = p.name + ' ' + pct(p.value);
      host.appendChild(seg);
      legend.appendChild(rich(el('span'), [p.name + ' ', { b: pct(p.value) }, p.extra ? ' · ' + p.extra : '']));
    });
  }

  function renderChannel() {
    const online = D.stores.find((s) => s.name === '온라인몰');
    document.getElementById('ch-sub').textContent =
      '오프라인 합계가 더 크지만, 점포 하나로 보면 온라인몰이 가장 큰 오프라인 점포의 ' +
      (online.sales / offline[0].sales).toFixed(1) + '배예요.';
    renderSplit('channel-split', 'channel-legend', [
      { name: '온라인몰', value: online.share, cls: 'on', extra: won(online.sales) + ' 원' },
      { name: '오프라인 8개 점포', value: 100 - online.share, cls: 'off', extra: won(K.sales - online.sales) + ' 원' },
    ]);
    const max = offline[0].sales;
    const list = document.getElementById('store-bars');
    offline.forEach((s) => list.appendChild(barRow(s.name, s.sales / max, [{ b: won(s.sales) }, ' · ' + pct(s.share)], 'sage')));
  }

  // ---- 고객 등급 ----------------------------------------------------------
  function renderGrades() {
    document.getElementById('rfm-sub').textContent =
      '9회차 RFM 등급표 기준이에요. A등급은 고객의 ' + pct(share(gradeA.customers, totalGradeCustomers)) +
      '인데 매출의 ' + pct(gradeA.salesShare) + '를 만들어요.';
    const host = document.getElementById('grades');
    D.grades.forEach((g) => {
      const custShare = share(g.customers, totalGradeCustomers);
      const card = el('div', 'grade');
      const head = el('div', 'grade-head');
      head.appendChild(el('span', 'grade-letter g-' + g.grade, g.grade));
      head.appendChild(el('span', 'grade-title', g.grade + '등급 · ' + int(g.customers) + '명'));
      card.appendChild(head);

      const dl = el('dl');
      [['매출', won(g.sales) + ' 원'], ['평균 구매 횟수', g.avgFreq.toFixed(1) + '회'], ['마지막 구매 후', '평균 ' + g.avgRecency + '일']]
        .forEach(([k, v]) => {
          const row = el('div');
          row.append(el('dt', null, k), el('dd', null, v));
          dl.appendChild(row);
        });
      card.appendChild(dl);

      const mini = el('div', 'mini-bars');
      [['고객', custShare, 'muted'], ['매출', g.salesShare, '']].forEach(([k, v, cls]) => {
        const row = el('div', 'mini');
        row.appendChild(el('span', null, k + ' ' + Math.round(v) + '%'));
        const track = el('span', 'bar-track');
        const fill = el('span', 'bar-fill' + (cls ? ' ' + cls : ''));
        fill.style.width = v + '%';
        fill.style.display = 'block';
        track.appendChild(fill);
        row.appendChild(track);
        mini.appendChild(row);
      });
      card.appendChild(mini);
      host.appendChild(card);
    });
  }

  // ---- 요일·결제·반품/할인 표 ---------------------------------------------
  function renderWeekday() {
    const diff = share(D.weekendAvg - D.weekdayAvg, D.weekdayAvg);
    document.getElementById('wd-sub').textContent =
      '주말 하루 평균이 평일보다 ' + pct(diff) + ' 높을 뿐이라 요일 차이는 작아요.';
    const max = Math.max(...D.weekday.map((w) => w.avgSales));
    const list = document.getElementById('wd-bars');
    D.weekday.forEach((w) => {
      const weekend = w.name === '토' || w.name === '일';
      list.appendChild(barRow(w.name + '요일', w.avgSales / max, [{ b: won(w.avgSales) + ' 원' }], weekend ? '' : 'muted'));
    });
  }

  function renderPayments() {
    document.getElementById('pay-sub').textContent = '신용카드가 절반을 넘고, 간편결제가 그다음이에요.';
    const cls = ['on', 'off', 'p3'];
    renderSplit('pay-split', 'pay-legend', D.payments.map((p, i) => ({ name: p.name, value: p.share, cls: cls[i] })));

    const table = document.getElementById('cat-table');
    const rates = D.categories.map((c) => c.returnRate);
    const hi = Math.max(...rates);
    const lo = Math.min(...rates);
    const head = el('tr');
    ['상품군', '반품률', '할인율'].forEach((t) => { const th = el('th', null, t); th.scope = 'col'; head.appendChild(th); });
    const thead = el('thead');
    thead.appendChild(head);
    const tbody = el('tbody');
    D.categories.slice().sort((a, b) => b.returnRate - a.returnRate).forEach((c) => {
      const tr = el('tr');
      const name = el('th', null, c.name);
      name.scope = 'row';
      tr.appendChild(name);
      const r = el('td');
      if (c.returnRate === hi) r.appendChild(el('span', 'badge hi', '가장 높음'));
      if (c.returnRate === lo) r.appendChild(el('span', 'badge lo', '가장 낮음'));
      r.append(' ' + pct(c.returnRate, 2));
      tr.append(r, el('td', null, pct(c.discountRate)));
      tbody.appendChild(tr);
    });
    table.replaceChildren(thead, tbody);
  }

  // ---- 많이 팔린 상품 -----------------------------------------------------
  function renderProducts() {
    const list = document.getElementById('products');
    D.products.forEach((p, i) => {
      const li = el('li', 'product');
      li.appendChild(el('span', 'rank', String(i + 1)));
      const info = el('div');
      info.style.minWidth = '0';
      const name = el('p', 'product-name', p.name);
      name.title = p.name;
      info.appendChild(name);
      const meta = el('p', 'product-meta');
      meta.append(el('span', 'badge cat', p.category), ' ' + int(p.qty) + '개 판매');
      info.appendChild(meta);
      li.appendChild(info);
      li.appendChild(el('span', 'product-sales', won(p.sales) + ' 원'));
      list.appendChild(li);
    });
    document.getElementById('footer-data').textContent =
      '데이터: 장마트 구매 데이터 ' + D.period[0] + ' ~ ' + D.period[1] + ', ' + int(D.rows) + '행 (교육용 합성 데이터). 집계일 ' + D.generated + '.';
  }

  renderHeader();
  renderKpis();
  renderMonthly();
  renderCategories();
  renderChannel();
  renderGrades();
  renderWeekday();
  renderPayments();
  renderProducts();

  // 창 너비가 바뀌면 월별 차트만 다시 그립니다.
  const chartHost = document.getElementById('monthly-chart');
  let lastWidth = chartHost.clientWidth;
  new ResizeObserver(() => {
    if (chartHost.clientWidth === lastWidth) return;
    lastWidth = chartHost.clientWidth;
    renderMonthly();
  }).observe(chartHost);
})();
