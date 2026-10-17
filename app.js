/**
 * 장마트(JANG MART) 2025 경영 실적 모니터링 대시보드 로직
 * 
 * - 다차원 동적 필터링 (점포 / 기준 월 / 상품군)
 * - 실시간 KPI 및 4종 인터랙티브 차트 리렌더링
 * - 월별 상세 실적 데이터 테이블 동적 렌더링 (순수 CSS 클래스 기반)
 * - 엑셀 호환 CSV 데이터 내보내기 (UTF-8 BOM)
 * - 인쇄 / PDF 보고서 내보내기 최적화
 */

// 1. 대시보드 상태 관리
const dashboardState = {
  store: "all",      // 'all', 'online', 'offline_all', 또는 개별 점포명
  month: "all",      // 'all' 또는 1 ~ 12
  category: "all",   // 'all' 또는 개별 상품군명
  monthlyMetric: "sales",   // 'sales' | 'orders'
  categoryMetric: "sales"   // 'sales' | 'qty'
};

// 차트 인스턴스 보관
let monthlyChart = null;
let categoryChart = null;
let channelChart = null;
let storeChart = null;

// 포맷터 유틸
function formatCurrency(num) {
  return "₩" + Math.round(num).toLocaleString();
}
function formatNumber(num) {
  return Math.round(num).toLocaleString();
}

// 2. 데이터 필터링 및 집계 엔진
function getFilteredSummary() {
  const { store, month, category } = dashboardState;
  
  // 조건에 맞는 레코드 필터링
  const filtered = JANG_DATA.records.filter(r => {
    // 점포 조건
    if (store === "online" && r.ch !== "온라인") return false;
    if (store === "offline_all" && r.ch !== "오프라인") return false;
    if (store !== "all" && store !== "online" && store !== "offline_all" && r.st !== store) return false;
    
    // 월 조건
    if (month !== "all" && r.m !== parseInt(month)) return false;
    
    // 상품군 조건
    if (category !== "all" && r.cat !== category) return false;
    
    return true;
  });

  // KPI 총계 계산
  let totalSales = 0;
  let totalRefund = 0;
  let totalOrders = 0;
  let totalQty = 0;
  let totalCust = 0;
  let onlineSales = 0;
  let offlineSales = 0;

  // 월별 집계 (1~12)
  const monthlyAgg = Array.from({ length: 12 }, (_, i) => ({
    month: i + 1,
    sales: 0,
    refund: 0,
    orders: 0,
    qty: 0,
    cust: 0
  }));

  // 상품군별 집계
  const categoryMap = {};
  JANG_DATA.categories.forEach(cat => {
    categoryMap[cat] = { sales: 0, qty: 0 };
  });

  // 점포별 집계
  const storeMap = {};
  JANG_DATA.stores.forEach(st => {
    if (st !== "온라인몰") storeMap[st] = { sales: 0, orders: 0 };
  });

  filtered.forEach(r => {
    totalSales += r.sales;
    totalRefund += r.refund;
    totalOrders += r.orders;
    totalQty += r.qty;
    totalCust += r.cust;

    if (r.ch === "온라인") {
      onlineSales += r.sales;
    } else {
      offlineSales += r.sales;
    }

    // 월별
    const mIdx = r.m - 1;
    if (mIdx >= 0 && mIdx < 12) {
      monthlyAgg[mIdx].sales += r.sales;
      monthlyAgg[mIdx].refund += r.refund;
      monthlyAgg[mIdx].orders += r.orders;
      monthlyAgg[mIdx].qty += r.qty;
      monthlyAgg[mIdx].cust += r.cust;
    }

    // 상품군별
    if (categoryMap[r.cat]) {
      categoryMap[r.cat].sales += r.sales;
      categoryMap[r.cat].qty += r.qty;
    }

    // 오프라인 점포별
    if (r.ch === "오프라인" && storeMap[r.st]) {
      storeMap[r.st].sales += r.sales;
      storeMap[r.st].orders += r.orders;
    }
  });

  const aov = totalOrders > 0 ? Math.round(totalSales / totalOrders) : 0;
  const returnRate = (totalSales + totalRefund) > 0 
    ? ((totalRefund / (totalSales + totalRefund)) * 100).toFixed(2) 
    : "0.00";
  const onlineRatio = totalSales > 0 
    ? ((onlineSales / totalSales) * 100).toFixed(1) 
    : "0.0";

  return {
    kpis: {
      totalSales,
      totalRefund,
      totalOrders,
      totalQty,
      totalCust,
      aov,
      returnRate,
      onlineSales,
      offlineSales,
      onlineRatio
    },
    monthly: monthlyAgg,
    categoryMap,
    storeMap,
    filteredRecords: filtered
  };
}

// 3. 숫자 애니메이션
function animateValue(elementId, start, end, duration, formatter) {
  const obj = document.getElementById(elementId);
  if (!obj) return;
  
  let startTimestamp = null;
  const step = (timestamp) => {
    if (!startTimestamp) startTimestamp = timestamp;
    const progress = Math.min((timestamp - startTimestamp) / duration, 1);
    const easeProgress = 1 - (1 - progress) * (1 - progress);
    const current = Math.floor(easeProgress * (end - start) + start);
    
    obj.innerHTML = formatter ? formatter(current) : current;
    if (progress < 1) {
      window.requestAnimationFrame(step);
    } else {
      obj.innerHTML = formatter ? formatter(end) : end;
    }
  };
  window.requestAnimationFrame(step);
}

// 4. UI 갱신 (KPI 카드 & 상태 뱃지)
function updateKPIView(summary) {
  const { kpis } = summary;

  // 1) 총 매출액 (억원)
  const salesInEok = (kpis.totalSales / 100000000).toFixed(1);
  document.getElementById("kpi-sales").textContent = salesInEok;
  document.getElementById("kpi-sales-full").textContent = formatCurrency(kpis.totalSales);

  // 2) 총 주문 건수
  animateValue("kpi-orders", 0, kpis.totalOrders, 800, formatNumber);
  document.getElementById("kpi-total-qty").textContent = formatNumber(kpis.totalQty) + "개";

  // 3) 평균 객단가
  animateValue("kpi-aov", 0, kpis.aov, 800, (v) => "₩" + formatNumber(v));

  // 4) 총 판매수량 및 고객수
  animateValue("kpi-qty", 0, kpis.totalQty, 800, formatNumber);
  document.getElementById("kpi-cust-sub").textContent = formatNumber(kpis.totalCust) + "명";

  // 5) 반품률 & 온라인 비중
  document.getElementById("kpi-return-rate").textContent = kpis.returnRate + "%";
  document.getElementById("kpi-online-ratio").textContent = kpis.onlineRatio + "%";
  document.getElementById("kpi-online-amt").textContent = (kpis.onlineSales / 100000000).toFixed(1) + "억";

  // 필터 상태 뱃지 갱신
  updateFilterStatusBadge();
}

function updateFilterStatusBadge() {
  const storeSelect = document.getElementById("filterStore");
  const monthSelect = document.getElementById("filterMonth");
  const categorySelect = document.getElementById("filterCategory");

  if (!storeSelect || !monthSelect || !categorySelect) return;
  
  const storeText = storeSelect.selectedOptions[0].text;
  const monthText = monthSelect.selectedOptions[0].text;
  const categoryText = categorySelect.selectedOptions[0].text;
  
  const statusEl = document.getElementById("filterStatusBadge");
  if (statusEl) {
    statusEl.textContent = `적용 조건: ${storeText} · ${monthText} · ${categoryText}`;
  }
}

// 5. 차트 공통 설정 및 렌더링
Chart.defaults.color = "#94a3b8";
Chart.defaults.font.family = '-apple-system, BlinkMacSystemFont, "Pretendard Variable", Pretendard, "Segoe UI", Roboto, sans-serif';

function renderMonthlyChart(summary) {
  const canvas = document.getElementById("monthlyChart");
  if (!canvas) return;
  const ctx = canvas.getContext("2d");
  if (monthlyChart) monthlyChart.destroy();

  const isSales = dashboardState.monthlyMetric === "sales";
  const labels = summary.monthly.map(m => `${m.month}월`);
  const data = summary.monthly.map(m => isSales ? m.sales : m.orders);
  const label = isSales ? "매출액 (원)" : "주문 건수 (건)";

  const gradient = ctx.createLinearGradient(0, 0, 0, 300);
  if (isSales) {
    gradient.addColorStop(0, "rgba(99, 102, 241, 0.4)");
    gradient.addColorStop(1, "rgba(99, 102, 241, 0.02)");
  } else {
    gradient.addColorStop(0, "rgba(6, 182, 212, 0.4)");
    gradient.addColorStop(1, "rgba(6, 182, 212, 0.02)");
  }

  const activeMonth = parseInt(dashboardState.month);
  const pointBg = labels.map((_, i) => (i + 1 === activeMonth) ? "#f43f5e" : (isSales ? "#818cf8" : "#22d3ee"));
  const pointRadius = labels.map((_, i) => (i + 1 === activeMonth) ? 7 : 4);

  monthlyChart = new Chart(ctx, {
    type: "line",
    data: {
      labels,
      datasets: [{
        label,
        data,
        borderColor: isSales ? "#6366f1" : "#06b6d4",
        backgroundColor: gradient,
        borderWidth: 3,
        pointBackgroundColor: pointBg,
        pointBorderColor: "#ffffff",
        pointBorderWidth: 2,
        pointRadius,
        pointHoverRadius: 8,
        fill: true,
        tension: 0.35
      }]
    },
    options: {
      responsive: true,
      maintainAspectRatio: false,
      plugins: {
        legend: { display: false },
        tooltip: {
          backgroundColor: "rgba(17, 24, 39, 0.95)",
          padding: 12,
          callbacks: {
            label: (ctx) => isSales ? ` 매출액: ${formatCurrency(ctx.raw)}` : ` 주문건수: ${formatNumber(ctx.raw)}건`
          }
        }
      },
      scales: {
        x: { grid: { color: "rgba(255, 255, 255, 0.05)" } },
        y: {
          grid: { color: "rgba(255, 255, 255, 0.05)" },
          ticks: {
            callback: (v) => isSales ? (v / 100000000).toFixed(1) + "억" : formatNumber(v)
          }
        }
      }
    }
  });
}

function renderChannelChart(summary) {
  const canvas = document.getElementById("channelChart");
  if (!canvas) return;
  const ctx = canvas.getContext("2d");
  if (channelChart) channelChart.destroy();

  const { onlineSales, offlineSales } = summary.kpis;
  const hasData = (onlineSales + offlineSales) > 0;

  channelChart = new Chart(ctx, {
    type: "doughnut",
    data: {
      labels: ["오프라인 매장", "온라인몰"],
      datasets: [{
        data: hasData ? [offlineSales, onlineSales] : [1, 0],
        backgroundColor: ["#6366f1", "#06b6d4"],
        borderColor: "#0f172a",
        borderWidth: 3,
        hoverOffset: 6
      }]
    },
    options: {
      responsive: true,
      maintainAspectRatio: false,
      plugins: {
        legend: {
          position: "bottom",
          labels: { color: "#cbd5e1", padding: 16, font: { size: 12, weight: "600" } }
        },
        tooltip: {
          backgroundColor: "rgba(17, 24, 39, 0.95)",
          padding: 12,
          callbacks: {
            label: function(ctx) {
              const total = (onlineSales + offlineSales) || 1;
              const pct = ((ctx.raw / total) * 100).toFixed(1);
              return ` ${ctx.label}: ${formatCurrency(ctx.raw)} (${pct}%)`;
            }
          }
        }
      },
      cutout: "68%"
    }
  });
}

function renderCategoryChart(summary) {
  const canvas = document.getElementById("categoryChart");
  if (!canvas) return;
  const ctx = canvas.getContext("2d");
  if (categoryChart) categoryChart.destroy();

  const isSales = dashboardState.categoryMetric === "sales";
  const items = Object.entries(summary.categoryMap).map(([cat, val]) => ({
    cat,
    val: isSales ? val.sales : val.qty
  }));

  items.sort((a, b) => b.val - a.val);

  categoryChart = new Chart(ctx, {
    type: "bar",
    data: {
      labels: items.map(i => i.cat),
      datasets: [{
        label: isSales ? "매출액 (원)" : "판매수량 (개)",
        data: items.map(i => i.val),
        backgroundColor: isSales ? "rgba(99, 102, 241, 0.85)" : "rgba(16, 185, 129, 0.85)",
        hoverBackgroundColor: isSales ? "#818cf8" : "#34d399",
        borderRadius: 6
      }]
    },
    options: {
      indexAxis: "y",
      responsive: true,
      maintainAspectRatio: false,
      plugins: {
        legend: { display: false },
        tooltip: {
          backgroundColor: "rgba(17, 24, 39, 0.95)",
          padding: 12,
          callbacks: {
            label: (ctx) => isSales ? ` 매출액: ${formatCurrency(ctx.raw)}` : ` 판매수량: ${formatNumber(ctx.raw)}개`
          }
        }
      },
      scales: {
        x: {
          grid: { color: "rgba(255, 255, 255, 0.05)" },
          ticks: {
            callback: (v) => isSales ? (v / 100000000).toFixed(1) + "억" : formatNumber(v)
          }
        },
        y: { grid: { display: false }, ticks: { color: "#e2e8f0" } }
      }
    }
  });
}

function renderStoreChart(summary) {
  const canvas = document.getElementById("storeChart");
  if (!canvas) return;
  const ctx = canvas.getContext("2d");
  if (storeChart) storeChart.destroy();

  const items = Object.entries(summary.storeMap).map(([st, val]) => ({
    st,
    sales: val.sales
  }));

  items.sort((a, b) => b.sales - a.sales);
  const top5 = items.slice(0, 5);

  storeChart = new Chart(ctx, {
    type: "bar",
    data: {
      labels: top5.map(i => i.st),
      datasets: [{
        label: "오프라인 매출액",
        data: top5.map(i => i.sales),
        backgroundColor: ["#38bdf8", "#818cf8", "#a78bfa", "#f472b6", "#fb923c"],
        borderRadius: 8
      }]
    },
    options: {
      responsive: true,
      maintainAspectRatio: false,
      plugins: {
        legend: { display: false },
        tooltip: {
          backgroundColor: "rgba(17, 24, 39, 0.95)",
          padding: 12,
          callbacks: {
            label: (ctx) => ` 연간 매출: ${formatCurrency(ctx.raw)}`
          }
        }
      },
      scales: {
        x: { grid: { display: false }, ticks: { color: "#cbd5e1" } },
        y: {
          grid: { color: "rgba(255, 255, 255, 0.05)" },
          ticks: { callback: (v) => (v / 100000000).toFixed(1) + "억" }
        }
      }
    }
  });
}

// 6. 상세 데이터 그리드 테이블 렌더링 (순수 CSS 클래스 사용)
function renderDataTable(summary) {
  const tbody = document.getElementById("dataTableBody");
  const tfoot = document.getElementById("dataTableFoot");
  if (!tbody) return;

  tbody.innerHTML = "";
  
  summary.monthly.forEach(m => {
    const aov = m.orders > 0 ? Math.round(m.sales / m.orders) : 0;
    const gross = m.sales + m.refund;
    const returnRate = gross > 0 ? ((m.refund / gross) * 100).toFixed(2) : "0.00";
    
    const isSelected = dashboardState.month !== "all" && parseInt(dashboardState.month) === m.month;
    const tr = document.createElement("tr");
    if (isSelected) tr.classList.add("tr-selected");

    tr.innerHTML = `
      <td class="td-month">${m.month}월</td>
      <td class="td-sales">${formatCurrency(m.sales)}</td>
      <td class="td-refund">${formatCurrency(m.refund)}</td>
      <td>${formatNumber(m.orders)}건</td>
      <td>${formatNumber(m.qty)}개</td>
      <td>${formatCurrency(aov)}</td>
      <td class="td-rate">${returnRate}%</td>
    `;
    tbody.appendChild(tr);
  });

  // 합계행(Footer)
  const { kpis } = summary;
  if (tfoot) {
    tfoot.innerHTML = `
      <tr>
        <td class="td-month">합계 / 평균</td>
        <td>${formatCurrency(kpis.totalSales)}</td>
        <td class="tfoot-refund">${formatCurrency(kpis.totalRefund)}</td>
        <td>${formatNumber(kpis.totalOrders)}건</td>
        <td>${formatNumber(kpis.totalQty)}개</td>
        <td>${formatCurrency(kpis.aov)}</td>
        <td class="tfoot-rate">${kpis.returnRate}%</td>
      </tr>
    `;
  }
}

// 7. 전체 대시보드 새로고침
function refreshDashboard() {
  const summary = getFilteredSummary();
  updateKPIView(summary);
  renderMonthlyChart(summary);
  renderChannelChart(summary);
  renderCategoryChart(summary);
  renderStoreChart(summary);
  renderDataTable(summary);
}

// 8. CSV 데이터 내보내기 기능 (UTF-8 BOM)
function exportToCSV() {
  const summary = getFilteredSummary();
  const headers = ["월", "정상 매출액(원)", "반품 금액(원)", "주문 건수(건)", "판매 수량(개)", "평균 객단가(원)", "반품률(%)"];
  
  const rows = summary.monthly.map(m => {
    const aov = m.orders > 0 ? Math.round(m.sales / m.orders) : 0;
    const gross = m.sales + m.refund;
    const returnRate = gross > 0 ? ((m.refund / gross) * 100).toFixed(2) : "0.00";
    return [
      `${m.month}월`,
      m.sales,
      m.refund,
      m.orders,
      m.qty,
      aov,
      `${returnRate}%`
    ];
  });

  const { kpis } = summary;
  rows.push([
    "연간합계/평균",
    kpis.totalSales,
    kpis.totalRefund,
    kpis.totalOrders,
    kpis.totalQty,
    kpis.aov,
    `${kpis.returnRate}%`
  ]);

  let csvContent = "\uFEFF"; // UTF-8 BOM
  csvContent += headers.join(",") + "\r\n";
  rows.forEach(r => {
    csvContent += r.join(",") + "\r\n";
  });

  const blob = new Blob([csvContent], { type: "text/csv;charset=utf-8;" });
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  
  const storeName = dashboardState.store === "all" ? "전체점포" : dashboardState.store;
  const fileName = `장마트_실적집계_${storeName}_${new Date().toISOString().slice(0, 10)}.csv`;
  
  link.setAttribute("href", url);
  link.setAttribute("download", fileName);
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
}

// 9. 이벤트 리스너 등록
function setupEventListeners() {
  const storeSelect = document.getElementById("filterStore");
  const monthSelect = document.getElementById("filterMonth");
  const categorySelect = document.getElementById("filterCategory");

  if (storeSelect) {
    storeSelect.addEventListener("change", (e) => {
      dashboardState.store = e.target.value;
      refreshDashboard();
    });
  }

  if (monthSelect) {
    monthSelect.addEventListener("change", (e) => {
      dashboardState.month = e.target.value;
      refreshDashboard();
    });
  }

  if (categorySelect) {
    categorySelect.addEventListener("change", (e) => {
      dashboardState.category = e.target.value;
      refreshDashboard();
    });
  }

  const resetBtn = document.getElementById("btnResetFilters");
  if (resetBtn) {
    resetBtn.addEventListener("click", () => {
      dashboardState.store = "all";
      dashboardState.month = "all";
      dashboardState.category = "all";
      if (storeSelect) storeSelect.value = "all";
      if (monthSelect) monthSelect.value = "all";
      if (categorySelect) categorySelect.value = "all";
      refreshDashboard();
    });
  }

  const monthlyTabs = document.querySelectorAll("#monthlyTabs .tab-btn");
  monthlyTabs.forEach(btn => {
    btn.addEventListener("click", () => {
      monthlyTabs.forEach(b => b.classList.remove("active"));
      btn.classList.add("active");
      dashboardState.monthlyMetric = btn.dataset.metric;
      renderMonthlyChart(getFilteredSummary());
    });
  });

  const categoryTabs = document.querySelectorAll("#categoryTabs .tab-btn");
  categoryTabs.forEach(btn => {
    btn.addEventListener("click", () => {
      categoryTabs.forEach(b => b.classList.remove("active"));
      btn.classList.add("active");
      dashboardState.categoryMetric = btn.dataset.metric;
      renderCategoryChart(getFilteredSummary());
    });
  });

  const exportBtn = document.getElementById("btnExportCSV");
  if (exportBtn) {
    exportBtn.addEventListener("click", exportToCSV);
  }

  const printBtn = document.getElementById("btnPrintReport");
  if (printBtn) {
    printBtn.addEventListener("click", () => window.print());
  }

  const refreshBtn = document.getElementById("refreshBtn");
  if (refreshBtn) {
    refreshBtn.addEventListener("click", refreshDashboard);
  }
}

// 10. 초기화 실행
document.addEventListener("DOMContentLoaded", () => {
  setupEventListeners();
  refreshDashboard();
});
