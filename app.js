/**
 * 장마트(JANG MART) 2025 경영 실적 모니터링 대시보드 로직
 * 
 * - Chart.js 기반 반응형 차트 렌더링
 * - KPI 숫자 카운트업 애니메이션
 * - 차트별 탭 전환 (매출액 / 수량 / 주문건수)
 * - 로컬 파일 및 웹 호스팅(GitHub, Cloudflare Pages) 무결점 동작
 */

// 1. 집계 데이터 정의 (CORS 이슈 없는 즉시 렌더링 보장)
const DASHBOARD_DATA = {
  kpis: {
    total_sales: 3014606800,
    normal_sales: 2970996100,
    total_orders: 60079,
    aov: 50177,
    total_customers: 10000,
    repurchase_rate: 91.6,
    online_ratio: 39.6,
    online_sales: 1194598500,
    offline_sales: 1820008300,
    total_qty: 121493
  },
  monthly: {
    months: ["1월", "2월", "3월", "4월", "5월", "6월", "7월", "8월", "9월", "10월", "11월", "12월"],
    sales: [184526600, 176976600, 215098800, 207042600, 222034400, 221549000, 234212800, 252428100, 299202600, 319941400, 330870200, 350723700],
    orders: [3711, 3575, 4186, 4134, 4431, 4512, 4754, 4950, 6011, 6396, 6562, 6857],
    qty: [7411, 7328, 8437, 8461, 8881, 9089, 9700, 10029, 12074, 12752, 13364, 13967]
  },
  category: {
    categories: ["소형가전", "침구홈", "신선식품", "기초화장품", "건강식품", "주방용품", "생활용품", "욕실청소", "가공식품", "베이커리델리"],
    sales: [739695500, 464403700, 320134000, 306085800, 292395200, 289115400, 211510000, 156471700, 144324700, 90470800],
    qty: [6322, 7666, 17408, 8071, 11626, 9906, 15997, 11934, 19750, 12813]
  },
  channel: {
    labels: ["오프라인 매장", "온라인몰"],
    sales: [1820008300, 1194598500],
    shares: [60.4, 39.6]
  },
  store: {
    stores: ["수원점", "잠실점", "영등포점", "서울역점", "청량리점"],
    sales: [240911300, 231957100, 228884900, 226559900, 226350900]
  }
};

// 차트 인스턴스 보관
let monthlyChart = null;
let categoryChart = null;
let channelChart = null;
let storeChart = null;

// 금액 및 숫자 포맷 함수
function formatCurrency(num) {
  return "₩" + num.toLocaleString();
}
function formatNumber(num) {
  return num.toLocaleString();
}

// 2. 숫자 카운트업 애니메이션
function animateValue(elementId, start, end, duration, formatter) {
  const obj = document.getElementById(elementId);
  if (!obj) return;
  
  let startTimestamp = null;
  const step = (timestamp) => {
    if (!startTimestamp) startTimestamp = timestamp;
    const progress = Math.min((timestamp - startTimestamp) / duration, 1);
    // easeOutQuad 곡선
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

// 3. KPI 값 바인딩 및 애니메이션 시작
function renderKPIs() {
  const { kpis } = DASHBOARD_DATA;
  
  // 1) 총 매출액 (억원 환산 + 전체 원 단위)
  animateValue("kpi-sales", 0, Math.floor(kpis.total_sales / 100000000), 1200, (v) => `${v}.0`);
  document.getElementById("kpi-sales-full").textContent = formatCurrency(kpis.total_sales);
  
  // 2) 총 주문 건수
  animateValue("kpi-orders", 0, kpis.total_orders, 1200, formatNumber);
  
  // 3) 평균 객단가 (AOV)
  animateValue("kpi-aov", 0, kpis.aov, 1200, (v) => "₩" + formatNumber(v));
  
  // 4) 고객 수 및 재구매율
  animateValue("kpi-cust", 0, kpis.total_customers, 1200, formatNumber);
  document.getElementById("kpi-repurchase").textContent = `${kpis.repurchase_rate}%`;
  
  // 5) 온라인 채널 비중
  const onlineEl = document.getElementById("kpi-online");
  if (onlineEl) {
    let startTimestamp = null;
    const step = (timestamp) => {
      if (!startTimestamp) startTimestamp = timestamp;
      const progress = Math.min((timestamp - startTimestamp) / 1200, 1);
      const current = (progress * kpis.online_ratio).toFixed(1);
      onlineEl.textContent = `${current}%`;
      if (progress < 1) window.requestAnimationFrame(step);
    };
    window.requestAnimationFrame(step);
  }
}

// Chart.js 공통 폰트 및 다크모드 그리드 설정
Chart.defaults.color = "#94a3b8";
Chart.defaults.font.family = '-apple-system, BlinkMacSystemFont, "Pretendard Variable", Pretendard, "Segoe UI", Roboto, sans-serif';

// 4. 월별 실적 추이 차트
function initMonthlyChart(metric = "sales") {
  const ctx = document.getElementById("monthlyChart").getContext("2d");
  if (monthlyChart) monthlyChart.destroy();
  
  const isSales = metric === "sales";
  const data = isSales ? DASHBOARD_DATA.monthly.sales : DASHBOARD_DATA.monthly.orders;
  const label = isSales ? "월별 총 매출액 (원)" : "월별 주문 건수 (건)";
  
  // 그라데이션 채우기
  const gradient = ctx.createLinearGradient(0, 0, 0, 320);
  if (isSales) {
    gradient.addColorStop(0, "rgba(99, 102, 241, 0.45)");
    gradient.addColorStop(1, "rgba(99, 102, 241, 0.02)");
  } else {
    gradient.addColorStop(0, "rgba(6, 182, 212, 0.45)");
    gradient.addColorStop(1, "rgba(6, 182, 212, 0.02)");
  }

  monthlyChart = new Chart(ctx, {
    type: "line",
    data: {
      labels: DASHBOARD_DATA.monthly.months,
      datasets: [{
        label: label,
        data: data,
        borderColor: isSales ? "#6366f1" : "#06b6d4",
        backgroundColor: gradient,
        borderWidth: 3,
        pointBackgroundColor: isSales ? "#818cf8" : "#22d3ee",
        pointBorderColor: "#ffffff",
        pointBorderWidth: 2,
        pointRadius: 4,
        pointHoverRadius: 7,
        fill: true,
        tension: 0.38
      }]
    },
    options: {
      responsive: true,
      maintainAspectRatio: false,
      plugins: {
        legend: { display: false },
        tooltip: {
          backgroundColor: "rgba(17, 24, 39, 0.95)",
          titleColor: "#f8fafc",
          bodyColor: "#cbd5e1",
          borderColor: "rgba(99, 102, 241, 0.3)",
          borderWidth: 1,
          padding: 12,
          callbacks: {
            label: function(context) {
              return isSales 
                ? ` 매출액: ${formatCurrency(context.raw)}` 
                : ` 주문건수: ${formatNumber(context.raw)}건`;
            }
          }
        }
      },
      scales: {
        x: {
          grid: { color: "rgba(255, 255, 255, 0.05)" },
          ticks: { color: "#94a3b8" }
        },
        y: {
          grid: { color: "rgba(255, 255, 255, 0.05)" },
          ticks: {
            color: "#94a3b8",
            callback: function(value) {
              return isSales ? (value / 100000000).toFixed(1) + "억" : formatNumber(value);
            }
          }
        }
      }
    }
  });
}

// 5. 채널별 비중 차트 (도넛)
function initChannelChart() {
  const ctx = document.getElementById("channelChart").getContext("2d");
  if (channelChart) channelChart.destroy();
  
  channelChart = new Chart(ctx, {
    type: "doughnut",
    data: {
      labels: DASHBOARD_DATA.channel.labels,
      datasets: [{
        data: DASHBOARD_DATA.channel.sales,
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
          labels: {
            color: "#cbd5e1",
            padding: 18,
            font: { size: 12, weight: "600" }
          }
        },
        tooltip: {
          backgroundColor: "rgba(17, 24, 39, 0.95)",
          padding: 12,
          callbacks: {
            label: function(context) {
              const total = context.dataset.data.reduce((a, b) => a + b, 0);
              const percentage = ((context.raw / total) * 100).toFixed(1);
              return ` ${context.label}: ${formatCurrency(context.raw)} (${percentage}%)`;
            }
          }
        }
      },
      cutout: "68%"
    }
  });
}

// 6. 상품군별 기여도 차트 (가로 막대)
function initCategoryChart(metric = "sales") {
  const ctx = document.getElementById("categoryChart").getContext("2d");
  if (categoryChart) categoryChart.destroy();

  const isSales = metric === "sales";
  const data = isSales ? DASHBOARD_DATA.category.sales : DASHBOARD_DATA.category.qty;
  const label = isSales ? "매출액 (원)" : "판매수량 (개)";

  // 수량일 경우 수량 기준 정렬 데이터 매핑
  let categories = [...DASHBOARD_DATA.category.categories];
  let values = [...data];

  if (!isSales) {
    // 수량 내림차순 정렬
    const combined = categories.map((cat, i) => ({ cat, val: values[i] }));
    combined.sort((a, b) => b.val - a.val);
    categories = combined.map(item => item.cat);
    values = combined.map(item => item.val);
  }

  categoryChart = new Chart(ctx, {
    type: "bar",
    data: {
      labels: categories,
      datasets: [{
        label: label,
        data: values,
        backgroundColor: isSales ? "rgba(99, 102, 241, 0.85)" : "rgba(16, 185, 129, 0.85)",
        hoverBackgroundColor: isSales ? "#818cf8" : "#34d399",
        borderRadius: 6,
        borderSkipped: false
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
            label: function(context) {
              return isSales 
                ? ` 매출액: ${formatCurrency(context.raw)}`
                : ` 판매수량: ${formatNumber(context.raw)}개`;
            }
          }
        }
      },
      scales: {
        x: {
          grid: { color: "rgba(255, 255, 255, 0.05)" },
          ticks: {
            color: "#94a3b8",
            callback: function(value) {
              return isSales ? (value / 100000000).toFixed(1) + "억" : formatNumber(value);
            }
          }
        },
        y: {
          grid: { display: false },
          ticks: { color: "#e2e8f0", font: { weight: "500" } }
        }
      }
    }
  });
}

// 7. 오프라인 Top 5 점포 실적 차트
function initStoreChart() {
  const ctx = document.getElementById("storeChart").getContext("2d");
  if (storeChart) storeChart.destroy();

  storeChart = new Chart(ctx, {
    type: "bar",
    data: {
      labels: DASHBOARD_DATA.store.stores,
      datasets: [{
        label: "오프라인 매출액",
        data: DASHBOARD_DATA.store.sales,
        backgroundColor: [
          "#38bdf8",
          "#818cf8",
          "#a78bfa",
          "#f472b6",
          "#fb923c"
        ],
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
        x: {
          grid: { display: false },
          ticks: { color: "#cbd5e1" }
        },
        y: {
          grid: { color: "rgba(255, 255, 255, 0.05)" },
          ticks: {
            color: "#94a3b8",
            callback: (val) => (val / 100000000).toFixed(1) + "억"
          }
        }
      }
    }
  });
}

// 8. 탭 이벤트 리스너 등록
function setupTabs() {
  // 월별 추이 탭
  const monthlyTabs = document.querySelectorAll("#monthlyTabs .tab-btn");
  monthlyTabs.forEach(btn => {
    btn.addEventListener("click", () => {
      monthlyTabs.forEach(b => b.classList.remove("active"));
      btn.classList.add("active");
      initMonthlyChart(btn.dataset.metric);
    });
  });

  // 상품군별 탭
  const categoryTabs = document.querySelectorAll("#categoryTabs .tab-btn");
  categoryTabs.forEach(btn => {
    btn.addEventListener("click", () => {
      categoryTabs.forEach(b => b.classList.remove("active"));
      btn.classList.add("active");
      initCategoryChart(btn.dataset.metric);
    });
  });

  // 새로고침 버튼
  const refreshBtn = document.getElementById("refreshBtn");
  if (refreshBtn) {
    refreshBtn.addEventListener("click", () => {
      renderKPIs();
      initMonthlyChart();
      initCategoryChart();
      initChannelChart();
      initStoreChart();
    });
  }
}

// 초기 로딩 실행
document.addEventListener("DOMContentLoaded", () => {
  renderKPIs();
  initMonthlyChart("sales");
  initCategoryChart("sales");
  initChannelChart();
  initStoreChart();
  setupTabs();
});
