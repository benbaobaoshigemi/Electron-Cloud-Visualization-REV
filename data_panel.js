// Data panel (chart rendering)
(function () {
  const state = {
    chart: null,
    collapsed: false,
    live: false,
    isResized: false,
    waveHidden: true,
    angularTheoryHidden: false,
    compareTheoryHidden: true,
    potentialTheoryHidden: false,
    phiTheoryHidden: false,
    dEdrTheoryHidden: false,
    potentialLogTheoryHidden: false,
    dEdrLogTheoryHidden: false,
    zeffHidden: false,
    localEnergyPotentialHidden: false,
    localEnergyTotalHidden: false,
    localEnergyKineticHidden: false,
  };

  function init() {
    const dataPanel = document.getElementById('data-panel');
    const dataCollapseBtn = document.getElementById('data-collapse-btn');
    const dataTab = document.getElementById('data-panel-tab');
    const enlargeBtn = document.getElementById('chart-enlarge-btn');
    const resizeHandle = document.getElementById('chart-resize-handle');
    const chartContainer = dataPanel ? dataPanel.querySelector('.chart-container') : null;

    const PANEL_SPACING = 16;
    const MIN_CHART_HEIGHT = 220;

    function calculateMinPanelHeight() {
      if (!dataPanel || !chartContainer) return 400;
      const chartTopOffset = chartContainer.getBoundingClientRect().top - dataPanel.getBoundingClientRect().top;
      return chartTopOffset + MIN_CHART_HEIGHT + PANEL_SPACING;
    }

    let minPanelHeight = 400;
    requestAnimationFrame(() => {
      minPanelHeight = Math.max(calculateMinPanelHeight(), dataPanel ? dataPanel.getBoundingClientRect().height : 400);
    });

    if (dataCollapseBtn && dataPanel) {
      dataCollapseBtn.addEventListener('click', () => {
        state.collapsed = true;
        dataPanel.classList.add('collapsed');
      });
    }

    if (dataTab && dataPanel) {
      dataTab.addEventListener('click', () => {
        state.collapsed = false;
        dataPanel.classList.remove('collapsed');
      });
    }

    function resetPanelSize() {
      dataPanel.style.width = '';
      dataPanel.style.height = '';

      if (chartContainer) chartContainer.style.height = '';

      state.isResized = false;
      if (enlargeBtn) {
        enlargeBtn.textContent = '⤢';
        enlargeBtn.title = '放大/还原图表';
      }
    }

    function updateChartContainerHeight(panelHeight) {
      if (!chartContainer || !dataPanel) {
        return;
      }
      const panelContent = dataPanel.querySelector('.panel-content');
      const panelBody = dataPanel.querySelector('.panel-body');
      if (!panelContent || !panelBody) return;

      const PANEL_SPACING = 16;
      const panelStyle = window.getComputedStyle(dataPanel);
      const panelBorderTop = parseFloat(panelStyle.borderTopWidth) || 0;
      const panelBorderBottom = parseFloat(panelStyle.borderBottomWidth) || 0;

      const panelHeader = dataPanel.querySelector('.panel-header');
      let usedHeight = 0;

      if (panelHeader) {
        usedHeight += panelHeader.getBoundingClientRect().height;
        usedHeight += PANEL_SPACING; // header的margin-bottom
      }

      const controlGroups = panelBody.querySelectorAll('.control-group');
      const controlGroupCount = controlGroups.length;
      controlGroups.forEach((group, index) => {
        usedHeight += group.getBoundingClientRect().height;
        // 每个control-group后面都有margin-bottom（16px）
        // 因为图表容器不是control-group，所以最后一个control-group也有margin
        usedHeight += PANEL_SPACING;
      });

      const contentAreaHeight = panelHeight - panelBorderTop - panelBorderBottom - PANEL_SPACING * 2;
      const availableHeight = contentAreaHeight - usedHeight;
      const safeHeight = Math.max(MIN_CHART_HEIGHT, availableHeight);
      chartContainer.style.height = `${safeHeight}px`;
    }

    if (enlargeBtn && dataPanel) {
      enlargeBtn.addEventListener('click', () => {
        if (state.isResized) {
          resetPanelSize();
          if (!dataPanel.classList.contains('enlarged')) dataPanel.classList.add('enlarged');
        } else {
          const wasEnlarged = dataPanel.classList.contains('enlarged');
          dataPanel.classList.toggle('enlarged');
          if (wasEnlarged) resetPanelSize();
        }
        const isEnlarged = dataPanel.classList.contains('enlarged');
        enlargeBtn.textContent = isEnlarged ? '⤡' : '⤢';
        enlargeBtn.title = isEnlarged ? '还原图表' : '放大图表';
      });
    }

    // Resize handle
    if (resizeHandle && dataPanel && enlargeBtn && chartContainer) {
      let isResizing = false;
      let offsetX = 0;
      let offsetY = 0;

      resizeHandle.addEventListener('mousedown', (e) => {
        if (!dataPanel.classList.contains('enlarged')) return;

        isResizing = true;
        const handleRect = resizeHandle.getBoundingClientRect();
        offsetX = e.clientX - handleRect.left;
        offsetY = e.clientY - handleRect.top;

        dataPanel.classList.add('resizing');
        e.preventDefault();
      });

      document.addEventListener('mousemove', (e) => {
        if (!isResizing) return;

        const handleTargetX = e.clientX - offsetX;
        const handleTargetY = e.clientY - offsetY;
        const panelTopY = handleTargetY + 24;
        const newWidth = Math.max(300, window.innerWidth - handleTargetX - 20 - 24);
        const rawHeight = window.innerHeight - panelTopY - 20;
        const newHeight = Math.max(minPanelHeight, rawHeight);

        dataPanel.style.width = `${newWidth}px`;
        dataPanel.style.height = `${newHeight}px`;
        updateChartContainerHeight(newHeight);

        if (!state.isResized) {
          state.isResized = true;
          enlargeBtn.textContent = '⟲';
          enlargeBtn.title = '复位大小';
        }
      });

      document.addEventListener('mouseup', () => {
        if (!isResizing) return;
        isResizing = false;
        dataPanel.classList.remove('resizing');
        window.dispatchEvent(new Event('resize'));
      });
    }

    // Control panel collapse
    const controlPanel = document.getElementById('control-panel');
    const controlCollapseBtn = document.getElementById('control-collapse-btn');
    const controlTab = document.getElementById('control-panel-tab');

    if (controlCollapseBtn && controlPanel) {
      controlCollapseBtn.addEventListener('click', () => {
        controlPanel.classList.add('collapsed');
      });
    }

    if (controlTab && controlPanel) {
      controlTab.addEventListener('click', () => {
        controlPanel.classList.remove('collapsed');
      });
    }
  }

  function ensureChart() {
    const ctx = document.getElementById('probability-chart');
    if (!ctx || !window.Chart) {
      return null;
    }
    if (state.chart) {
      return state.chart;
    }

    ctx.style.backgroundColor = 'transparent';

    state.chart = new Chart(ctx, {
      type: 'bar',
      data: { labels: [], datasets: [] },
      options: {
        responsive: true,
        maintainAspectRatio: false,
        backgroundColor: 'transparent',
        animation: {
          duration: 300, // 添加平滑动画
          easing: 'easeOutQuart'
        },
        interaction: {
          intersect: false,
          mode: 'index'
        },
        layout: {
          padding: 0
        },
        plugins: {
          legend: {
            labels: {
              // color: '#e8e8e8', // 移除硬编码颜色，改由 generateLabels 动态控制
              font: { size: 11, weight: '500' },
              padding: 12,
              generateLabels: function (chart) {
                const original = Chart.defaults.plugins.legend.labels.generateLabels;
                const labels = original.call(this, chart);
                labels.forEach(label => {
                  if (label.hidden) {
                    label.fontColor = '#666666'; // 非激活时变灰
                    label.fillStyle = '#666666';
                    label.strokeStyle = '#666666';
                    label.textDecoration = 'line-through';
                  } else {
                    label.fontColor = '#e8e8e8'; // 激活时亮色
                  }
                });
                return labels;
              }
            }
          },
          tooltip: {
            backgroundColor: 'rgba(20, 20, 20, 0.95)',
            titleColor: '#ffffff',
            bodyColor: '#e8e8e8',
            borderColor: 'rgba(255, 255, 255, 0.2)',
            borderWidth: 1,
            cornerRadius: 6
          }
        },
        scales: {
          x: {
            ticks: {
              color: '#d0d0d0',
              font: { size: 10 },
              maxTicksLimit: 12 // 限制标签数量，避免拥挤
            },
            grid: {
              color: 'rgba(255,255,255,0.08)',
              lineWidth: 1
            },
            border: {
              color: 'rgba(255,255,255,0.15)'
            }
          },
          y: {
            ticks: {
              color: '#d0d0d0',
              font: { size: 10 }
            },
            grid: {
              color: 'rgba(255,255,255,0.08)',
              lineWidth: 1
            },
            border: {
              color: 'rgba(255,255,255,0.15)'
            }
          }
        }
      }
    });
    console.log('新图表实例创建成功'); // 调试信息
    return state.chart;
  }

  function renderChartRadial(hist, theory) {
    const ctx = document.getElementById('probability-chart');
    if (!ctx || !window.Chart) {
      return;
    }

    // 在更新或重建图表前，先从现有图表实例中捕获可见性状态
    if (state.chart && state.chart.data && state.chart.data.datasets) {
      const waveDatasetIndex = state.chart.data.datasets.findIndex(ds => ds.label === '波函数（幅值）');
      if (waveDatasetIndex !== -1) {
        state.waveHidden = !state.chart.isDatasetVisible(waveDatasetIndex);
      }
      const zeffDatasetIndex = state.chart.data.datasets.findIndex(ds => ds.label === '有效核电荷 Z_eff');
      if (zeffDatasetIndex !== -1) {
        state.zeffHidden = !state.chart.isDatasetVisible(zeffDatasetIndex);
      }
    }

    // 若当前是极坐标图，需销毁后重新创建柱状图
    if (state.chart && state.chart.config && state.chart.config.type !== 'bar') {
      try { state.chart.destroy(); } catch (e) { console.warn('图表销毁失败:', e); }
      state.chart = null;
    }
    const chart = ensureChart();
    if (!chart) {
      return;
    }
    // 将直方图中心作为 x 轴（线性 r），理论曲线在相同中心取样
    const centers = (theory && theory.centers) || (() => { const n = hist.counts.length; const a = new Array(n); for (let i = 0; i < n; i++) a[i] = 0.5 * (hist.edges[i] + hist.edges[i + 1]); return a; })();

    // 动态调整显示精度
    const maxValue = Math.max(...centers);
    const decimalPlaces = maxValue > 100 ? 1 : (maxValue > 10 ? 2 : 3);

    chart.data.labels = centers.map(v => v.toFixed(decimalPlaces));
    const datasets = [
      {
        label: 'P(r) 采样',
        data: Array.from(hist.counts),
        backgroundColor: 'rgba(255,255,255,0.7)',
        borderColor: 'rgba(255,255,255,0.95)',
        borderWidth: 0,
        barPercentage: 1.0,
        categoryPercentage: 1.0,
        borderRadius: 2,
        borderSkipped: false,
        order: 10,
      },
    ];
    if (theory && theory.values && theory.values.length) {
      datasets.push({
        type: 'line',
        label: 'P(r)',
        data: theory.values.map((y, i) => ({ x: i, y })),
        borderColor: 'rgba(255, 255, 255, 0.95)',
        backgroundColor: 'transparent',
        pointRadius: 0,
        borderWidth: 2.5,
        yAxisID: 'y',
        tension: 0.2,
        order: 5,
      });
    }
    chart.data.datasets = datasets;

    // 添加坐标轴配置
    if (chart.options.scales) {
      if (chart.options.scales.x) {
        chart.options.scales.x.title = {
          display: true,
          text: '径向距离 (a₀)',
          color: '#d0d0d0',
          font: { size: 12, weight: '500' }
        };
      }
      if (chart.options.scales.y) {
        chart.options.scales.y.title = {
          display: true,
          text: '概率密度',
          color: '#d0d0d0',
          font: { size: 12, weight: '500' }
        };
      }
    }

    // 优化x轴显示
    if (chart.options.scales && chart.options.scales.x && chart.options.scales.x.ticks) {
      chart.options.scales.x.ticks.autoSkip = true;
      chart.options.scales.x.ticks.maxTicksLimit = 15;
    }

    try {
      chart.update('none');
    } catch (error) {
      console.error('图表更新失败:', error);
      state.chart.destroy();
      state.chart = null;
      const newChart = ensureChart();
      if (newChart) {
        newChart.data.datasets = datasets;
        newChart.update('none');
      }
    }
  }

  function renderChartAngular(hist, theory) {
    const ctx = document.getElementById('probability-chart');
    if (!ctx || !window.Chart) return;
    // 如当前不是柱状图，销毁后用柱状图重建
    if (state.chart && (!state.chart.config || state.chart.config.type !== 'bar')) {
      try { state.chart.destroy(); } catch (e) { console.warn('图表销毁失败:', e); }
      state.chart = null;
    }
    const bins = hist.counts.length;
    const centers = (theory && theory.centers) || (() => { const n = hist.counts.length; const a = new Array(n); for (let i = 0; i < n; i++) a[i] = 0.5 * (hist.edges[i] + hist.edges[i + 1]); return a; })();

    const chart = ensureChart();
    if (!chart) return;

    // 捕获角向理论曲线的可见性状态
    if (chart.data && chart.data.datasets) {
      const theoryIndex = chart.data.datasets.findIndex(ds => ds.label && ds.label === 'sin θ');
      if (theoryIndex !== -1) {
        state.angularTheoryHidden = !chart.isDatasetVisible(theoryIndex);
      }
    }

    chart.data.labels = centers.map(v => v.toFixed(2));
    const datasets = [
      {
        label: 'P(θ) 采样',
        data: Array.from(hist.counts),
        backgroundColor: 'rgba(255,255,255,0.7)',
        borderColor: 'rgba(255,255,255,0.95)',
        borderWidth: 1,
        borderRadius: 2,
        borderSkipped: false,
        order: 10
      }
    ];

    if (theory && theory.values && theory.values.length) {
      datasets.push({
        type: 'line',
        label: 'sin θ',
        data: theory.values.map((y, i) => ({ x: i, y })),
        borderColor: 'rgba(255, 255, 255, 0.95)',
        backgroundColor: 'transparent',
        pointRadius: 0,
        pointHoverRadius: 0,
        borderWidth: 2.5,
        yAxisID: 'y',
        tension: 0.2,
        order: 0,
        hidden: state.angularTheoryHidden
      });
    }
    chart.data.datasets = datasets;

    // 强制设置全局元素配置，确保线条不显示点
    if (!chart.options.elements) chart.options.elements = {};
    chart.options.elements.point = { radius: 0, hoverRadius: 0 };

    // 添加坐标轴标题
    if (chart.options.scales) {
      if (chart.options.scales.x) {
        chart.options.scales.x.title = {
          display: true,
          text: '角度 θ (弧度)',
          color: '#d0d0d0',
          font: { size: 12, weight: '500' }
        };
        // 优化x轴显示
        chart.options.scales.x.ticks.autoSkip = true;
        chart.options.scales.x.ticks.maxTicksLimit = 15;
        delete chart.options.scales.x.ticks.callback;
      }
      if (chart.options.scales.y) {
        chart.options.scales.y.title = {
          display: true,
          text: '概率密度 P(θ)',
          color: '#d0d0d0',
          font: { size: 12, weight: '500' }
        };
      }
    }

    chart.update('none'); // 使用无动画更新，避免曲线跳动
  }

  function renderChartPhi(hist, theory) {
    const ctx = document.getElementById('probability-chart');
    if (!ctx || !window.Chart) return;
    // 如当前不是柱状图，销毁后用柱状图重建
    if (state.chart && (!state.chart.config || state.chart.config.type !== 'bar')) {
      try { state.chart.destroy(); } catch (e) { console.warn('图表销毁失败:', e); }
      state.chart = null;
    }
    const bins = hist.counts.length;
    const centers = (theory && theory.centers) || (() => { const n = hist.counts.length; const a = new Array(n); for (let i = 0; i < n; i++) a[i] = 0.5 * (hist.edges[i] + hist.edges[i + 1]); return a; })();

    const chart = ensureChart();
    if (!chart) return;

    // 捕获φ角向理论曲线的可见性状态
    if (chart.data && chart.data.datasets) {
      const theoryIndex = chart.data.datasets.findIndex(ds => ds.label && ds.label === 'P(φ)');
      if (theoryIndex !== -1) {
        state.phiTheoryHidden = !chart.isDatasetVisible(theoryIndex);
      }
    }

    chart.data.labels = centers.map(v => v.toFixed(2));
    const datasets = [
      {
        label: 'P(φ) 采样',
        data: Array.from(hist.counts),
        backgroundColor: 'rgba(255,255,255,0.7)',
        borderColor: 'rgba(255,255,255,0.95)',
        borderWidth: 1,
        borderRadius: 2,
        borderSkipped: false,
        order: 10
      }
    ];

    if (theory && theory.values && theory.values.length) {
      datasets.push({
        type: 'line',
        label: 'P(φ)',
        data: theory.values.map((y, i) => ({ x: i, y })),
        borderColor: 'rgba(255, 255, 255, 0.95)',
        backgroundColor: 'transparent',
        pointRadius: 0,
        pointHoverRadius: 0,
        borderWidth: 2.5,
        yAxisID: 'y',
        tension: 0.2,
        order: 0,
        hidden: state.phiTheoryHidden
      });
    }
    chart.data.datasets = datasets;

    // 强制设置全局元素配置，确保线条不显示点
    if (!chart.options.elements) chart.options.elements = {};
    chart.options.elements.point = { radius: 0, hoverRadius: 0 };

    // 添加坐标轴标题
    if (chart.options.scales) {
      if (chart.options.scales.x) {
        chart.options.scales.x.title = {
          display: true,
          text: '角度 φ (弧度)',
          color: '#d0d0d0',
          font: { size: 12, weight: '500' }
        };
        // 优化x轴显示
        chart.options.scales.x.ticks.autoSkip = true;
        chart.options.scales.x.ticks.maxTicksLimit = 15;
        delete chart.options.scales.x.ticks.callback;
      }
      if (chart.options.scales.y) {
        chart.options.scales.y.title = {
          display: true,
          text: '概率密度 P(φ)',
          color: '#d0d0d0',
          font: { size: 12, weight: '500' }
        };
      }
    }

    chart.update('none'); // 使用无动画更新，避免曲线跳动
  }

  function renderChartPotential(experimental, theory) {
    const ctx = document.getElementById('probability-chart');
    if (!ctx || !window.Chart) {
      return;
    }

    // 保存理论曲线可见性状态
    if (state.chart && state.chart.data && state.chart.data.datasets) {
      const theoryIndex = state.chart.data.datasets.findIndex(ds => ds.label === '⟨V⟩(r)');
      if (theoryIndex !== -1) {
        state.potentialTheoryHidden = !state.chart.isDatasetVisible(theoryIndex);
      }
    }

    // 若当前不是柱状图，需销毁后重新创建
    if (state.chart && state.chart.config && state.chart.config.type !== 'bar') {
      try { state.chart.destroy(); } catch (e) { console.warn('图表销毁失败:', e); }
      state.chart = null;
    }

    const chart = ensureChart();
    if (!chart) {
      return;
    }

    // 准备 X 轴标签和数据集
    const datasets = [];
    let labels = [];

    // 从实验数据中提取X轴标签 (使用points的x值)
    if (experimental && experimental.points && experimental.points.length > 0) {
      labels = experimental.points.map(p => p.x.toFixed(2));

      // 【纯理论可视化】不再显示采样数据的直方图/填充
      // datasets.push({...}); // 移除采样数据推送
    }

    // 理论曲线 - 折线叠加
    if (theory && theory.points && theory.points.length > 0) {
      // 如果labels还没设置，从theory中提取
      if (labels.length === 0) {
        labels = theory.points.map(p => p.x.toFixed(2));
      }

      datasets.push({
        type: 'line',
        label: '⟨V⟩(r)',
        data: theory.points.map((p, i) => ({ x: i, y: p.y })),
        borderColor: 'rgba(255, 255, 255, 0.95)',
        backgroundColor: 'transparent',
        pointRadius: 0,
        borderWidth: 2.5,
        yAxisID: 'y',
        tension: 0.2,
        order: 5,
        hidden: state.potentialTheoryHidden || false
      });
    }

    // Z_eff 曲线 - 绿色，置于最上层
    if (theory && theory.zeff && theory.zeff.length) {
      datasets.push({
        type: 'line',
        label: '有效核电荷 Z_eff',
        data: theory.zeff.map((y, i) => ({ x: i, y })),
        borderColor: 'rgba(0, 220, 0, 0.9)',
        backgroundColor: 'transparent',
        pointRadius: 0,
        borderWidth: 2.5,
        yAxisID: 'y2',
        borderDash: [2, 2],
        tension: 0.2,
        order: 0,
        hidden: state.zeffHidden || false
      });
    }

    chart.data.labels = labels;
    chart.data.datasets = datasets;

    // 更新坐标轴标题
    if (chart.options.scales) {
      if (chart.options.scales.x) {
        chart.options.scales.x.title = {
          display: true,
          text: '距离 r (a₀)',
          color: '#d0d0d0',
          font: { size: 12, weight: '500' }
        };
        chart.options.scales.x.ticks.autoSkip = true;
        chart.options.scales.x.ticks.maxTicksLimit = 15;
      }
      if (chart.options.scales.y) {
        chart.options.scales.y.title = {
          display: true,
          text: '势能径向积分 E(r) (Hartree)',
          color: '#d0d0d0',
          font: { size: 12, weight: '500' }
        };
      }
      // Z_eff 坐标轴 - 右侧绿色
      if (theory && theory.zeff && theory.zeff.length) {
        const maxZ = Math.ceil(Math.max(...theory.zeff, 1));
        chart.options.scales.y2 = {
          position: 'right',
          grid: { drawOnChartArea: false },
          min: 0,
          max: maxZ > 1 ? maxZ : 2,
          ticks: {
            display: true,
            color: 'rgba(0, 220, 0, 0.9)',
            font: { size: 9 }
          },
          title: {
            display: true,
            text: 'Z_eff',
            color: 'rgba(0, 220, 0, 0.9)',
            font: { size: 10 }
          }
        };
      }
    }

    chart.update('none');
  }

  // 渲染势能密度 dE/dr 曲线（类似 renderChartPotential）
  function renderChartDEdr(experimental, theory) {
    const ctx = document.getElementById('probability-chart');
    if (!ctx || !window.Chart) {
      return;
    }

    // 保存理论曲线可见性状态
    if (state.chart && state.chart.data && state.chart.data.datasets) {
      const theoryIndex = state.chart.data.datasets.findIndex(ds => ds.label === 'dV/dr');
      if (theoryIndex !== -1) {
        state.dEdrTheoryHidden = !state.chart.isDatasetVisible(theoryIndex);
      }
    }

    // 若当前不是柱状图，需销毁后重新创建
    if (state.chart && state.chart.config && state.chart.config.type !== 'bar') {
      try { state.chart.destroy(); } catch (e) { console.warn('图表销毁失败:', e); }
      state.chart = null;
    }

    const chart = ensureChart();
    if (!chart) {
      return;
    }

    // 准备 X 轴标签和数据集
    const datasets = [];
    let labels = [];

    // 从实验数据中提取X轴标签 (使用points的x值)
    if (experimental && experimental.points && experimental.points.length > 0) {
      labels = experimental.points.map(p => p.x.toFixed(2));

      // 【纯理论可视化】不再显示采样数据的直方图/填充
      // datasets.push({...}); // 移除采样数据推送
    }

    // 理论曲线 - 折线叠加
    if (theory && theory.points && theory.points.length > 0) {
      if (labels.length === 0) {
        labels = theory.points.map(p => p.x.toFixed(2));
      }

      datasets.push({
        type: 'line',
        label: 'dV/dr',
        data: theory.points.map((p, i) => ({ x: i, y: p.y })),
        borderColor: 'rgba(255, 255, 255, 0.95)',
        backgroundColor: 'transparent',
        pointRadius: 0,
        borderWidth: 2.5,
        yAxisID: 'y',
        tension: 0.2,
        order: 5,
        hidden: state.dEdrTheoryHidden || false
      });
    }

    // Z_eff 曲线 - 绿色，置于最上层
    if (theory && theory.zeff && theory.zeff.length) {
      datasets.push({
        type: 'line',
        label: '有效核电荷 Z_eff',
        data: theory.zeff.map((y, i) => ({ x: i, y })),
        borderColor: 'rgba(0, 220, 0, 0.9)',
        backgroundColor: 'transparent',
        pointRadius: 0,
        borderWidth: 2.5,
        yAxisID: 'y2',
        borderDash: [2, 2],
        tension: 0.2,
        order: 0,
        hidden: state.zeffHidden || false
      });
    }

    chart.data.labels = labels;
    chart.data.datasets = datasets;

    // 更新坐标轴标题
    if (chart.options.scales) {
      if (chart.options.scales.x) {
        chart.options.scales.x.title = {
          display: true,
          text: '距离 r (a₀)',
          color: '#d0d0d0',
          font: { size: 12, weight: '500' }
        };
        chart.options.scales.x.ticks.autoSkip = true;
        chart.options.scales.x.ticks.maxTicksLimit = 15;
      }
      if (chart.options.scales.y) {
        chart.options.scales.y.title = {
          display: true,
          text: '势能贡献 dV/dr (Hartree/a₀)',
          color: '#d0d0d0',
          font: { size: 12, weight: '500' }
        };
      }

      // Z_eff 坐标轴 - 右侧绿色
      if (theory && theory.zeff && theory.zeff.length) {
        const maxZ = Math.ceil(Math.max(...theory.zeff, 1));
        chart.options.scales.y2 = {
          position: 'right',
          grid: { drawOnChartArea: false },
          min: 0,
          max: maxZ > 1 ? maxZ : 2,
          ticks: {
            display: true,
            color: 'rgba(0, 220, 0, 0.9)',
            font: { size: 9 }
          },
          title: {
            display: true,
            text: 'Z_eff',
            color: 'rgba(0, 220, 0, 0.9)',
            font: { size: 10 }
          }
        };
      }
    }

    chart.update('none');
  }

  // 渲染能量密度分解图：动能贡献密度 T·P(r) 和 总能量密度 ε·P(r)，同一尺度
  function renderChartLocalEnergy(experimental, theory) {
    const ctx = document.getElementById('probability-chart');
    if (!ctx || !window.Chart) return;

    // 【保持曲线开关状态】在重建 datasets 前捕获当前的隐藏状态
    if (state.chart && state.chart.data && state.chart.data.datasets) {
      state.chart.data.datasets.forEach((ds, idx) => {
        const visible = state.chart.isDatasetVisible(idx);
        if (ds.label && (ds.label.includes('采样轨道能量') || ds.label.includes('轨道能量'))) {
          state.localEnergyTotalHidden = !visible;
        } else if (ds.label && ds.label.includes('动能密度')) {
          state.localEnergyKineticHidden = !visible;
        }
      });
    }

    // 销毁非柱状图
    if (state.chart && state.chart.config && state.chart.config.type !== 'bar') {
      try { state.chart.destroy(); } catch (e) { }
      state.chart = null;
    }

    const chart = ensureChart();
    if (!chart) return;

    const datasets = [];
    let labels = [];

    // 准备 X 轴标签
    if (theory && theory.centers && theory.centers.length > 0) {
      labels = theory.centers.map(r => r.toFixed(2));
    }

    // 纯理论总能量 E(r) - 白色实线
    // 【算法决策 v11.3】改为纯理论可视化，彻底隐藏采样噪声
    if (experimental && experimental.expDensity) {
      datasets.push({
        type: 'line',
        label: '轨道能量 E(r)',
        data: experimental.expDensity.map((y, i) => ({ x: i, y })),
        borderColor: 'rgba(255, 255, 255, 0.95)',
        backgroundColor: 'transparent',
        pointRadius: 0,
        borderWidth: 2.5,
        yAxisID: 'y',
        tension: 0.2,
        order: 10,
        hidden: state.localEnergyTotalHidden || false
      });
    }

    // 【v11.0】不再显示理论总能量曲线 - 采样数据即是"实验结果"

    // 动能密度 T·P(r) - 白色虚线（最顶层）
    if (theory && theory.Tdensity && theory.Tdensity.length > 0) {
      datasets.push({
        type: 'line',
        label: '动能密度 T(r)·P(r)',
        data: theory.Tdensity.map((y, i) => ({ x: i, y })),
        borderColor: 'rgba(255, 255, 255, 0.9)',
        backgroundColor: 'transparent',
        pointRadius: 0,
        borderWidth: 2,
        yAxisID: 'y',
        borderDash: [4, 4],
        tension: 0.2,
        order: 0,
        hidden: state.localEnergyKineticHidden || false  // 【保持用户设置】
      });
    }

    chart.data.labels = labels;
    chart.data.datasets = datasets;

    // 配置坐标轴 - 单一 Y 轴
    if (chart.options.scales) {
      if (chart.options.scales.x) {
        chart.options.scales.x.title = {
          display: true,
          text: '径向距离 r (a₀)',
          color: '#d0d0d0',
          font: { size: 12, weight: '500' }
        };
        chart.options.scales.x.ticks.autoSkip = true;
        chart.options.scales.x.ticks.maxTicksLimit = 15;
      }
      if (chart.options.scales.y) {
        chart.options.scales.y.title = {
          display: true,
          text: '能量密度 (Hartree)',
          color: '#d0d0d0',
          font: { size: 12, weight: '500' }
        };
      }
      // 移除 y2 轴，所有数据共用同一尺度
      delete chart.options.scales.y2;
    }

    chart.update('none');
  }

  // 渲染势能积分 vs log(r) 曲线
  function renderChartPotentialLog(experimental, theory) {
    const ctx = document.getElementById('probability-chart');
    if (!ctx || !window.Chart) return;

    // 保存理论曲线可见性状态
    if (state.chart && state.chart.data && state.chart.data.datasets) {
      const theoryIndex = state.chart.data.datasets.findIndex(ds => ds.label === '⟨V⟩(log r)');
      if (theoryIndex !== -1) {
        state.potentialLogTheoryHidden = !state.chart.isDatasetVisible(theoryIndex);
      }
    }

    // 使用折线图
    if (!ensureChartLine()) return;
    const chart = state.chart;

    const datasets = [];
    let labels = [];

    if (experimental && experimental.points && experimental.points.length > 0) {
      labels = experimental.points.map(p => p.x.toFixed(2));
      // 【纯理论可视化】不再显示采样数据的直方图/填充
      // datasets.push({...}); // 移除采样数据推送
    }

    if (theory && theory.points && theory.points.length > 0) {
      if (labels.length === 0) {
        labels = theory.points.map(p => p.x.toFixed(2));
      }
      datasets.push({
        type: 'line',
        label: '⟨V⟩(log r)',
        // 【关键修复】与直方图对齐
        data: theory.points.map(p => p.y),
        borderColor: 'rgba(255, 255, 255, 0.95)',
        backgroundColor: 'transparent',
        pointRadius: 0,
        borderWidth: 2.0,
        tension: 0.4, // 平滑
        cubicInterpolationMode: 'monotone',
        order: 5,
        hidden: state.potentialLogTheoryHidden || false
      });
    }

    chart.data.labels = labels;
    chart.data.datasets = datasets;

    if (chart.options.scales) {
      if (chart.options.scales.x) {
        chart.options.scales.x.title = { display: true, text: 'log₁₀(r) (r in a₀)', color: '#d0d0d0', font: { size: 12 } };
      }
      if (chart.options.scales.y) {
        chart.options.scales.y.title = { display: true, text: '势能径向积分 E(r) (Hartree) [对数刻度]', color: '#d0d0d0', font: { size: 12 } };
      }
    }

    chart.update('none');
  }


  // 渲染能量密度 dE/dr 双对数曲线
  function renderChartDEdrLog(experimental, theory) {
    const ctx = document.getElementById('probability-chart');
    if (!ctx || !window.Chart) return;

    // 保存理论曲线可见性状态
    if (state.chart && state.chart.data && state.chart.data.datasets) {
      const theoryIndex = state.chart.data.datasets.findIndex(ds => ds.label === 'dV/d(log r)');
      if (theoryIndex !== -1) {
        state.dEdrLogTheoryHidden = !state.chart.isDatasetVisible(theoryIndex);
      }
    }

    // 使用折线图
    if (!ensureChartLine()) return;
    const chart = state.chart;

    const datasets = [];
    let labels = [];

    if (experimental && experimental.points && experimental.points.length > 0) {
      labels = experimental.points.map(p => p.x.toFixed(2));
      // 【纯理论可视化】不再显示采样数据的直方图/填充
      // datasets.push({...}); // 移除采样数据推送
    }

    if (theory && theory.points && theory.points.length > 0) {
      if (labels.length === 0) {
        labels = theory.points.map(p => p.x.toFixed(2));
      }
      datasets.push({
        type: 'line',
        label: 'dV/d(log r)',
        // 【关键修复】与直方图对齐
        data: theory.points.map(p => p.y),
        borderColor: 'rgba(255, 255, 255, 0.95)',
        backgroundColor: 'transparent',
        pointRadius: 0,
        borderWidth: 2.0,
        tension: 0.4, // 平滑
        cubicInterpolationMode: 'monotone',
        order: 5,
        hidden: state.dEdrLogTheoryHidden || false
      });
    }

    chart.data.labels = labels;
    chart.data.datasets = datasets;

    if (chart.options.scales) {
      if (chart.options.scales.x) {
        chart.options.scales.x.title = { display: true, text: 'log₁₀(r) (r in a₀)', color: '#d0d0d0', font: { size: 12 } };
      }
      if (chart.options.scales.y) {
        chart.options.scales.y.title = { display: true, text: '势能贡献 dV/dr (Hartree/a₀) [对数刻度]', color: '#d0d0d0', font: { size: 12 } };
      }
    }

    chart.update('none');
  }

  // 确保创建一个折线图实例
  function ensureChartLine() {
    const ctx = document.getElementById('probability-chart');
    if (!ctx || !window.Chart) return false;

    if (state.chart && state.chart.config.type === 'line') return true;
    if (state.chart) {
      state.chart.destroy();
      state.chart = null;
    }

    // 创建新图表
    state.chart = new Chart(ctx, {
      type: 'line',
      data: { datasets: [] },
      options: {
        responsive: true,
        maintainAspectRatio: false,
        animation: { duration: 0 },
        interaction: { mode: 'index', intersect: false },
        plugins: {
          legend: { display: true },
          tooltip: {
            enabled: true,
            callbacks: {
              label: function (context) {
                return context.dataset.label + ': ' + context.parsed.y.toFixed(4);
              }
            }
          }
        },
        scales: {
          x: {
            type: 'linear',
            position: 'bottom',
            title: { display: true, text: 'r (a0)', color: '#d0d0d0' },
            min: 0,
            ticks: { color: '#d0d0d0', maxTicksLimit: 10 },
            grid: { color: 'rgba(255,255,255,0.08)' }
          },
          y: {
            position: 'left',
            title: { display: true, text: 'Value', color: '#d0d0d0' },
            ticks: { color: '#d0d0d0' },
            grid: { color: 'rgba(255,255,255,0.08)' }
          }
        }
      }
    });
    return true;
  }

  // 对比模式专用：渲染散点图
  function renderChartCompare(orbitalDataMap, type) {
    console.log('renderChartCompare 被调用，类型:', type); // 调试信息
    const ctx = document.getElementById('probability-chart');
    if (!ctx || !window.Chart || !window.Hydrogen) {
      console.log('图表渲染失败：canvas、Chart.js或Hydrogen不可用'); // 调试信息
      return;
    }

    // 【修复】保存所有曲线的可见性状态（通过 label 作为 key）
    // 这样在滚动更新重建 datasets 时可以恢复用户的隐藏设置
    if (state.chart && state.chart.data && state.chart.data.datasets) {
      if (!state.compareHiddenLabels) state.compareHiddenLabels = {};
      state.chart.data.datasets.forEach((ds, idx) => {
        if (ds.label) {
          state.compareHiddenLabels[ds.label] = !state.chart.isDatasetVisible(idx);
        }
      });
    }

    // 如果当前不是折线图，销毁后重新创建
    if (state.chart && state.chart.config && state.chart.config.type !== 'line') {
      console.log('销毁旧图表，创建折线图'); // 调试信息
      try { state.chart.destroy(); } catch (e) { console.warn('图表销毁失败:', e); }
      state.chart = null;
    }

    // 创建折线图
    if (!state.chart) {
      console.log('创建新的折线图实例'); // 调试信息
      ctx.style.backgroundColor = 'transparent';

      state.chart = new Chart(ctx, {
        type: 'line',
        data: { datasets: [] },
        options: {
          responsive: true,
          maintainAspectRatio: false,
          backgroundColor: 'transparent',
          animation: {
            duration: 300,
            easing: 'easeOutQuart'
          },
          interaction: {
            intersect: false,
            mode: 'index'
          },
          layout: {
            padding: 0
          },
          plugins: {
            legend: {
              labels: {
                color: '#e8e8e8',
                font: { size: 11, weight: '500' },
                padding: 12
              }
            },
            tooltip: {
              backgroundColor: 'rgba(20, 20, 20, 0.95)',
              titleColor: '#ffffff',
              bodyColor: '#e8e8e8',
              borderColor: 'rgba(255, 255, 255, 0.2)',
              borderWidth: 1,
              cornerRadius: 6,
              callbacks: {
                label: function (context) {
                  return `${context.dataset.label}: (${context.parsed.x.toFixed(3)}, ${context.parsed.y.toFixed(6)})`;
                }
              }
            }
          },
          scales: {
            x: {
              type: 'linear',
              title: {
                display: true,
                text: (type === 'radial' || type === 'angular' || type === 'phi') ? '径向距离 (a₀)' :
                  (type === 'potential' || type === 'dEdr' || type === 'localEnergy') ? '距离 r (a₀)' : '角度 (弧度)',
                color: '#d0d0d0',
                font: { size: 12, weight: '500' }
              },
              ticks: {
                color: '#d0d0d0',
                font: { size: 10 }
              },
              grid: {
                color: 'rgba(255,255,255,0.08)',
                lineWidth: 1
              },
              border: {
                color: 'rgba(255,255,255,0.15)'
              }
            },
            y: {
              type: 'linear',
              title: {
                display: true,
                text: type === 'potential' ? '势能径向积分 E(r) (Hartree)' :
                  type === 'dEdr' ? '势能贡献 dV/dr (Hartree/a₀)' :
                    type === 'localEnergy' ? '轨道能量贡献 ε(r) (Hartree)' :
                      '概率密度',
                color: '#d0d0d0',
                font: { size: 12, weight: '500' }
              },
              ticks: {
                color: '#d0d0d0',
                font: { size: 10 }
              },
              grid: {
                color: 'rgba(255,255,255,0.08)',
                lineWidth: 1
              },
              border: {
                color: 'rgba(255,255,255,0.15)'
              }
            }
          },
          elements: {
            point: {
              radius: 0, // 不显示数据点
              hoverRadius: 3
            },
            line: {
              tension: 0.1 // 轻微的曲线平滑
            }
          }
        }
      });
    } else {
      // 如果图表已存在，更新坐标轴标题
      if (state.chart.options.scales) {
        if (state.chart.options.scales.x && state.chart.options.scales.x.title) {
          if (type === 'potentialLog' || type === 'dEdrLog') {
            // 已移除 log-log 图表类型
          } else if (type === 'radial' || type === 'potential' || type === 'dEdr' || type === 'localEnergy') {
            state.chart.options.scales.x.title.text = '距离 r (a₀)';
          } else {
            state.chart.options.scales.x.title.text = '角度 (弧度)';
          }
        }
        if (state.chart.options.scales.y && state.chart.options.scales.y.title) {
          if (type === 'potential') {
            state.chart.options.scales.y.title.text = '势能径向积分 E(r) (Hartree)';
          } else if (type === 'dEdr') {
            state.chart.options.scales.y.title.text = '势能贡献 dV/dr (Hartree/a₀)';
          } else {
            state.chart.options.scales.y.title.text = '概率密度';
          }
        }
      }
    }

    // 准备数据集 - 先将原始数据转为直方图，再转为散点
    const datasets = [];

    // 使用统一的常量定义
    const compareColors = window.ElectronCloud?.constants?.compareColors || [
      { name: 'red', value: [1, 0.2, 0.2] },
      { name: 'green', value: [0.2, 1, 0.2] },
      { name: 'blue', value: [0.2, 0.2, 1] }
    ];

    // 使用统一的轨道显示名称映射
    const orbitalDisplayNameMap = window.ElectronCloud?.constants?.orbitalDisplayNames || {};

    // 为了保持一致性，使用与普通模式相同的参数计算直方图
    let maxDistance = 0;
    let totalSamples = 0;

    // 首先找到最大距离用于确定动态范围
    for (const [orbitalKey, samples] of Object.entries(orbitalDataMap)) {
      if (!samples || samples.length === 0) continue;
      totalSamples += samples.length;
      if (type === 'radial' || type === 'potential' || type === 'dEdr' || type === 'localEnergy') {
        // 【性能修复】使用循环替代Math.max(...array)，避免大数组栈溢出
        for (let i = 0; i < samples.length; i++) {
          if (samples[i].r > maxDistance) {
            maxDistance = samples[i].r;
          }
        }
      }
    }

    // 获取当前选择的轨道顺序，确保颜色分配与选择顺序一致
    // 【重构】比照模式下使用activeSlots获取slot配置（包含原子类型）
    const activeSlots = window.ElectronCloud?.state?.compareMode?.activeSlots || [];
    const currentOrbitals = window.ElectronCloud?.state?.currentOrbitals || Object.keys(orbitalDataMap);
    console.log('当前轨道顺序:', currentOrbitals, 'activeSlots:', activeSlots); // 调试信息

    // 按照选择顺序处理轨道数据
    for (let colorIndex = 0; colorIndex < activeSlots.length; colorIndex++) {
      const slotConfig = activeSlots[colorIndex];
      // 构建与sampling.js中相同的键
      const sampleKey = `${slotConfig.atom}_${slotConfig.orbital}_slot${slotConfig.slotIndex}`;
      const samples = orbitalDataMap[sampleKey];

      if (!samples || samples.length === 0) continue;

      const color = compareColors[colorIndex % compareColors.length];
      // 【关键修复】标签中显示原子类型
      const displayName = `${slotConfig.atom} ${orbitalDisplayNameMap[slotConfig.orbital] || slotConfig.orbital}`;
      let hist, centers;
      let potentialValues; // 存储势能值

      if (type === 'radial') {
        // 使用与普通模式相同的参数
        const dynamicRmax = Math.max(1, maxDistance * 1.08);
        const baseBins = 240;
        const sampleDensity = totalSamples / Math.max(1, dynamicRmax);
        const adaptiveBins = Math.min(400, Math.max(baseBins, Math.floor(sampleDensity * 0.5)));

        // 提取径向数据
        const radialData = samples.map(s => s.r);
        hist = window.Hydrogen.histogramRadialFromSamples(radialData, adaptiveBins, dynamicRmax, true, false);

        // 计算bin中心
        centers = new Array(adaptiveBins);
        for (let i = 0; i < adaptiveBins; i++) {
          centers[i] = 0.5 * (hist.edges[i] + hist.edges[i + 1]);
        }
      } else if (type === 'angular') {
        // θ角向数据
        const angularBins = 180;
        const angularData = samples.map(s => s.theta);
        hist = window.Hydrogen.histogramThetaFromSamples(angularData, angularBins, true);

        // 计算bin中心
        centers = new Array(angularBins);
        for (let i = 0; i < angularBins; i++) {
          centers[i] = 0.5 * (hist.edges[i] + hist.edges[i + 1]);
        }
      } else if (type === 'potential') {
        // 【对齐单选模式】使用采样数据计算能量积分
        const dynamicRmax = Math.max(1, maxDistance * 1.08);
        const baseBins = 240;
        const sampleDensity = totalSamples / Math.max(1, dynamicRmax);
        const adaptiveBins = Math.min(400, Math.max(baseBins, Math.floor(sampleDensity * 0.5)));

        const radialData = samples.map(s => s.r);
        hist = window.Hydrogen.histogramRadialFromSamples(radialData, adaptiveBins, dynamicRmax, true, false);

        centers = new Array(adaptiveBins);
        for (let i = 0; i < adaptiveBins; i++) {
          centers[i] = 0.5 * (hist.edges[i] + hist.edges[i + 1]);
        }

        // 计算采样能量：仅用采样 RDF 替换理论 RDF，Vee使用理论值
        const Z = window.SlaterBasis && window.SlaterBasis[slotConfig.atom] ? window.SlaterBasis[slotConfig.atom].Z : 1;
        const orbParams = window.Hydrogen.orbitalParamsFromKey(slotConfig.orbital);
        if (orbParams && window.Hydrogen.calculateCumulativeOrbitalEnergy) {
          const res = window.Hydrogen.calculateCumulativeOrbitalEnergy(orbParams.n, orbParams.l, Z, slotConfig.atom, centers);

          // dV_nuc/dr：优先使用物理层返回的核势导数
          const dVnucDr = new Float32Array(adaptiveBins);
          if (res.dVnucDr && res.dVnucDr.length >= adaptiveBins) {
            for (let i = 0; i < adaptiveBins; i++) dVnucDr[i] = res.dVnucDr[i];
          } else if (res.V && res.V.length >= adaptiveBins) {
            for (let i = 0; i < adaptiveBins; i++) {
              if (i === 0) {
                const drLocal = centers[1] - centers[0];
                dVnucDr[i] = drLocal !== 0 ? (res.V[1] - res.V[0]) / drLocal : 0;
              } else if (i === adaptiveBins - 1) {
                const drLocal = centers[i] - centers[i - 1];
                dVnucDr[i] = drLocal !== 0 ? (res.V[i] - res.V[i - 1]) / drLocal : 0;
              } else {
                const drLocal = centers[i + 1] - centers[i - 1];
                dVnucDr[i] = drLocal !== 0 ? (res.V[i + 1] - res.V[i - 1]) / drLocal : 0;
              }
            }
          }

          // 【新增】直接使用理论Vee数组
          const theoryVee = res.Vee || new Float32Array(adaptiveBins);

          const sampledE = new Float32Array(adaptiveBins);
          let cumE = 0;

          for (let i = 0; i < adaptiveBins; i++) {
            const r = centers[i];
            const dr = i > 0 ? centers[i] - centers[i - 1] : centers[0];

            const theoryPDF = window.Hydrogen.radialPDF(orbParams.n, orbParams.l, r, Z, 1, slotConfig.atom);
            const sampledPDF = hist.counts[i];

            // 【新方法】在PDF很小时使用理论值，否则直接用采样PDF * 理论Vee
            const pdfThreshold = 1e-6;
            let sampledDEdr;
            if (theoryPDF < pdfThreshold) {
              sampledDEdr = res.dEdr[i];
            } else {
              sampledDEdr = dVnucDr[i] + sampledPDF * theoryVee[i];
            }

            cumE += sampledDEdr * dr;
            sampledE[i] = cumE;
          }
          potentialValues = sampledE;
        } else {
          potentialValues = new Float32Array(adaptiveBins);
        }
      } else if (type === 'dEdr') {
        // 【对齐单选模式】使用采样数据计算能量密度
        const dynamicRmax = Math.max(1, maxDistance * 1.08);
        const baseBins = 240;
        const sampleDensity = totalSamples / Math.max(1, dynamicRmax);
        const adaptiveBins = Math.min(400, Math.max(baseBins, Math.floor(sampleDensity * 0.5)));

        const radialData = samples.map(s => s.r);
        hist = window.Hydrogen.histogramRadialFromSamples(radialData, adaptiveBins, dynamicRmax, true, false);

        centers = new Array(adaptiveBins);
        for (let i = 0; i < adaptiveBins; i++) {
          centers[i] = 0.5 * (hist.edges[i] + hist.edges[i + 1]);
        }

        // 计算采样能量密度：仅用采样 RDF 替换电子-电子项权重
        const Z = window.SlaterBasis && window.SlaterBasis[slotConfig.atom] ? window.SlaterBasis[slotConfig.atom].Z : 1;
        const orbParams = window.Hydrogen.orbitalParamsFromKey(slotConfig.orbital);
        if (orbParams && window.Hydrogen.calculateCumulativeOrbitalEnergy) {
          const res = window.Hydrogen.calculateCumulativeOrbitalEnergy(orbParams.n, orbParams.l, Z, slotConfig.atom, centers);

          const dVnucDr = new Float32Array(adaptiveBins);
          if (res.V && res.V.length >= adaptiveBins) {
            for (let i = 0; i < adaptiveBins; i++) {
              const r = centers[i];
              if (r <= 0) {
                dVnucDr[i] = 0;
              } else if (i === 0) {
                dVnucDr[i] = res.V[i] / r;
              } else {
                const drLocal = centers[i] - centers[i - 1];
                const dVLocal = res.V[i] - res.V[i - 1];
                dVnucDr[i] = drLocal !== 0 ? dVLocal / drLocal : 0;
              }
            }
          }

          const sampledDEdr = new Float32Array(adaptiveBins);
          for (let i = 0; i < adaptiveBins; i++) {
            const r = centers[i];
            const theoryPDF = window.Hydrogen.radialPDF(orbParams.n, orbParams.l, r, Z, 1, slotConfig.atom);
            const sampledPDF = hist.counts[i];
            const theoryDEdr = res.dEdr[i];

            const veeTerm = theoryDEdr - dVnucDr[i];
            const pdfFloor = 1e-12;

            const veePerPDF = theoryPDF > pdfFloor ? (veeTerm / theoryPDF) : 0;
            sampledDEdr[i] = dVnucDr[i] + sampledPDF * veePerPDF;
          }
          potentialValues = sampledDEdr;
        } else {
          potentialValues = new Float32Array(adaptiveBins);
        }
      } else if (type === 'localEnergy') {
        // 【v11.0 完全复刻单选模式】轨道能量贡献 - 每个轨道两条线
        const dynamicRmax = Math.max(1, maxDistance * 1.08);
        const baseBins = 240;
        const sampleDensity = totalSamples / Math.max(1, dynamicRmax);
        const adaptiveBins = Math.min(400, Math.max(baseBins, Math.floor(sampleDensity * 0.5)));

        const radialData = samples.map(s => s.r);
        hist = window.Hydrogen.histogramRadialFromSamples(radialData, adaptiveBins, dynamicRmax, true, false);

        centers = new Array(adaptiveBins);
        for (let i = 0; i < adaptiveBins; i++) {
          centers[i] = 0.5 * (hist.edges[i] + hist.edges[i + 1]);
        }

        const atomType = slotConfig.atom || 'H';
        const Z = window.SlaterBasis && window.SlaterBasis[atomType] ? window.SlaterBasis[atomType].Z : 1;
        const orbParams = window.Hydrogen.orbitalParamsFromKey(slotConfig.orbital);

        if (orbParams) {
          // 1. 获取轨道能量 ε
          const baseKey = slotConfig.orbital.replace(/[xyz]/g, '').replace(/_.*/, '');
          const basisData = window.SlaterBasis && window.SlaterBasis[atomType]
            && window.SlaterBasis[atomType].orbitals
            && window.SlaterBasis[atomType].orbitals[baseKey];
          const avgEpsilon = (basisData && basisData.length > 0 && basisData[0].energy !== undefined)
            ? basisData[0].energy : -0.5;
          // 2. 计算采样能量密度 ε × P(r) (纯理论)
          // 【算法决策 v11.3 - 全局纯理论化】
          // 依据：用户指令“所有涉及能量的采样都需要移除”，旨在隐藏蒙特卡洛采样的局限性。
          // 措施：完全弃用 f(r) (采样PDF)，统一使用 P(r) (理论PDF)。
          // 结果：无论采样点多少，能量曲线始终完美平滑。
          const dr = hist.dr || (centers[1] - centers[0]);
          const totalSamplesLocal = hist.counts.reduce((a, b) => a + b, 0);
          const sampledEps = new Float32Array(adaptiveBins);
          const theoryTdensity = new Float32Array(adaptiveBins);

          for (let i = 0; i < adaptiveBins; i++) {
            const r = centers[i];
            const theoryPDF = window.Hydrogen.radialPDF(orbParams.n, orbParams.l, r, Z, 1, atomType);

            // 关键修改：采样能量密度 = ε × 理论PDF
            // 即使UI上叫“采样”，数据源已改为理论值，彻底消除噪声。
            sampledEps[i] = avgEpsilon * theoryPDF;

            // 理论动能密度 T_rec × P(r)
            const Trec = window.Hydrogen.calculateReconstructedKineticEnergy
              ? window.Hydrogen.calculateReconstructedKineticEnergy(r, avgEpsilon, Z, atomType, baseKey)
              : 0;
            theoryTdensity[i] = Trec * theoryPDF;
          }

          // 准备两条线的数据
          const sampledData = centers.map((c, i) => ({ x: c, y: sampledEps[i] }));
          const theoryData = centers.map((c, i) => ({ x: c, y: theoryTdensity[i] }));

          // 【颜色】使用轨道对应色
          const colorValues = color.value.map(v => Math.round(v * 255));

          // 总能量密度 E(r) - 实线 (理论值)
          const energyLabel = `${displayName} E(r)`;
          datasets.push({
            label: energyLabel,
            data: sampledData,
            borderColor: `rgba(${colorValues.join(',')}, 1.0)`,
            backgroundColor: 'transparent',
            borderWidth: 2,
            pointRadius: 0,
            tension: 0.1,
            hidden: state.compareHiddenLabels?.[energyLabel] || false,
          });

          // 理论动能密度 - 虚线
          const theoryLabel = `${displayName} T(r) 理论`;
          datasets.push({
            label: theoryLabel,
            data: theoryData,
            borderColor: `rgba(${colorValues.join(',')}, 0.8)`,
            backgroundColor: 'transparent',
            borderWidth: 1.5,
            borderDash: [5, 3],
            pointRadius: 0,
            tension: 0.1,
            hidden: state.compareHiddenLabels?.[theoryLabel] || false,
          });

          // 跳过后续通用 dataset push
          continue;
        }
      } else {
        // φ角向数据 (azimuthal)
        const phiBins = 180;
        const phiData = samples.map(s => s.phi);
        hist = window.Hydrogen.histogramPhiFromSamples(phiData, phiBins, true);

        // 计算bin中心
        centers = new Array(phiBins);
        for (let i = 0; i < phiBins; i++) {
          centers[i] = 0.5 * (hist.edges[i] + hist.edges[i + 1]);
        }
      }

      // 将数据转为图表数据
      // 对于势能相关模式，y是potentialValues；其他模式是hist.counts
      const data = centers.map((center, index) => ({
        x: center,
        y: (type === 'potential' || type === 'dEdr' || type === 'localEnergy') ? potentialValues[index] : hist.counts[index]
      })).sort((a, b) => a.x - b.x);

      // 将颜色值从[0,1]范围转换为[0,255]范围
      const colorValues = color.value.map(v => Math.round(v * 255));

      // 采样曲线使用折线图
      datasets.push({
        label: displayName,
        data: data,
        borderColor: `rgba(${colorValues.join(',')}, 1.0)`,
        backgroundColor: `rgba(${colorValues.join(',')}, 0.1)`,
        borderWidth: 1.5,
        pointRadius: 0,
        pointHoverRadius: 3,
        fill: false,
        tension: 0.1,
        hidden: state.compareHiddenLabels?.[displayName] || false,
      });

      // 【新增】为该轨道添加理论曲线（虚线）
      const orbitalParams = window.Hydrogen?.orbitalParamsFromKey(slotConfig.orbital);
      if (orbitalParams) {
        const atomType = slotConfig.atom || 'H';
        const atomZ = window.SlaterBasis && window.SlaterBasis[atomType] ? window.SlaterBasis[atomType].Z : 1;
        let theoryData;

        if (type === 'radial') {
          // 径向理论曲线
          theoryData = centers.map(r => ({
            x: r,
            y: window.Hydrogen.radialPDF(orbitalParams.n, orbitalParams.l, r, atomZ, 1, atomType)
          }));
        } else if (type === 'angular') {
          // θ 角向理论曲线
          theoryData = centers.map(theta => ({
            x: theta,
            y: window.Hydrogen.angularPDF_Theta(orbitalParams.l, orbitalParams.angKey.m, theta)
          }));
        } else if (type === 'potential') {
          // 势能理论曲线
          // 使用 calculateCumulativeOrbitalEnergy 计算理论 V(r)
          const res = window.Hydrogen.calculateCumulativeOrbitalEnergy(orbitalParams.n, orbitalParams.l, atomZ, atomType, centers);

          // 【关键修复】使用矩形积分重新计算理论曲线，以匹配采样曲线的积分方法
          // 物理层的 res.E 使用梯形法则，会导致近核处能量低估
          let currentTheoryE = 0;
          theoryData = new Array(centers.length);
          for (let i = 0; i < centers.length; i++) {
            const dr = i > 0 ? centers[i] - centers[i - 1] : centers[0];
            currentTheoryE += res.dEdr[i] * dr;
            theoryData[i] = { x: centers[i], y: currentTheoryE };
          }
        } else if (type === 'dEdr') {
          const rMax = Math.max(...centers);
          const res = window.Hydrogen.calculateCumulativeOrbitalEnergy(orbitalParams.n, orbitalParams.l, atomZ, atomType, centers);
          theoryData = centers.map((r, i) => ({ x: r, y: res.dEdr[i] }));
        }
        else {
          // φ 方位角理论曲线
          theoryData = centers.map(phi => ({
            x: phi,
            y: window.Hydrogen.angularPDF_Phi(orbitalParams.angKey.m, orbitalParams.angKey.t, phi)
          }));
        }

        const theoryDisplayLabel = `${displayName} 理论`;
        datasets.push({
          label: theoryDisplayLabel,
          data: theoryData,
          borderColor: `rgba(${colorValues.join(',')}, 0.9)`,
          backgroundColor: 'transparent',
          borderWidth: 2,
          pointRadius: 0,
          pointHoverRadius: 0,
          fill: false,
          tension: 0.2,
          borderDash: [6, 3], // 虚线样式
          hidden: state.compareHiddenLabels?.[theoryDisplayLabel] || false,
        });
      }
    }

    state.chart.data.datasets = datasets;
    console.log('开始更新图表，轨道数量:', Object.keys(orbitalDataMap).length);
    try {
      state.chart.update('none');
      console.log('图表更新完成');
    } catch (error) {
      console.error('图表更新失败:', error);
    }
  }

  function reset() {
    if (state.chart) {
      state.chart.data.labels = [];
      state.chart.data.datasets = [];
      state.chart.update();
    }
  }

  // 供外部调用的 API
  window.DataPanel = {
    init,
    reset, // 暴露重置方法
    renderChartRadial,
    renderChartAngular,
    renderChartPhi, // 新增φ角向分布API
    renderChartPotential, // 新增势能积分曲线API
    renderChartDEdr, // 新增势能密度dE/dr API
    renderChartPotentialLog, // 势能积分log(r) API（已恢复）
    renderChartDEdrLog, // dE/dr 双对数图 API
    renderChartLocalEnergy, // 🆕 局域能量图 API
    renderChartCompare, // 新增对比模式API
    state, // 暴露状态对象
  };

  // 自动初始化
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }
})();
