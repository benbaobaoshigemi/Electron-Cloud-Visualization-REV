// 数据面板逻辑（与主渲染逻辑解耦）
// 暴露 DataPanel 全局对象，供 script.js 调用
(function () {
  const state = {
    chart: null,
    collapsed: false,
    live: false, // 由主程序控制是否实时更新
    isResized: false, // 标记是否被用户手动调整过大小
    waveHidden: true, // 记录波函数曲线的隐藏状态（默认隐藏）
    angularTheoryHidden: false, // 记录角向理论曲线的隐藏状态
    compareTheoryHidden: true, // 记录比照模式理论曲线的隐藏状态（默认隐藏）
    potentialTheoryHidden: false, // 记录势能图理论曲线的隐藏状态（默认显示）
    phiTheoryHidden: false, // 记录φ角向理论曲线的隐藏状态
    dEdrTheoryHidden: false, // 记录dE/dr理论曲线的隐藏状态（默认显示）
    potentialLogTheoryHidden: false, // 记录E(log r)理论曲线的隐藏状态
    dEdrLogTheoryHidden: false, // 记录 dE/dr 双对数理论曲线的隐藏状态
    zeffHidden: false,          // 记录有效核电荷 Z_eff 曲线的隐藏状态
  };

  function init() {
    // === 数据面板滑出逻辑 ===
    const dataPanel = document.getElementById('data-panel');
    const dataCollapseBtn = document.getElementById('data-collapse-btn');
    const dataTab = document.getElementById('data-panel-tab');
    const enlargeBtn = document.getElementById('chart-enlarge-btn');
    const resizeHandle = document.getElementById('chart-resize-handle');
    const chartContainer = dataPanel ? dataPanel.querySelector('.chart-container') : null;

    // 固定间距常量（与CSS变量--spacing-panel一致）
    const PANEL_SPACING = 16;
    const MIN_CHART_HEIGHT = 220;

    // 计算最小面板高度
    function calculateMinPanelHeight() {
      if (!dataPanel || !chartContainer) return 400;
      const chartTopOffset = chartContainer.getBoundingClientRect().top - dataPanel.getBoundingClientRect().top;
      // 最小面板高度 = 图表顶部偏移 + 最小图表高度 + 底部padding(16px)
      return chartTopOffset + MIN_CHART_HEIGHT + PANEL_SPACING;
    }

    // 延迟计算以确保CSS已加载
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

    // 复位面板大小的函数
    function resetPanelSize() {
      // 清除所有手动设置的样式
      dataPanel.style.width = '';
      dataPanel.style.height = '';

      // 清除图表容器的手动样式
      if (chartContainer) {
        chartContainer.style.height = '';
      }

      state.isResized = false;

      // 恢复图标
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

      // 使用固定的16px间距（与CSS变量--spacing-panel一致）
      const PANEL_SPACING = 16;

      // 获取面板边框
      const panelStyle = window.getComputedStyle(dataPanel);
      const panelBorderTop = parseFloat(panelStyle.borderTopWidth) || 0;
      const panelBorderBottom = parseFloat(panelStyle.borderBottomWidth) || 0;

      // 计算面板头部占用的高度
      const panelHeader = dataPanel.querySelector('.panel-header');
      let usedHeight = 0;

      if (panelHeader) {
        usedHeight += panelHeader.getBoundingClientRect().height;
        usedHeight += PANEL_SPACING; // header的margin-bottom
      }

      // 计算其他控件占用的高度（不包含图表容器）
      // 数据面板中有2个control-group，每个后面有16px间距
      const controlGroups = panelBody.querySelectorAll('.control-group');
      const controlGroupCount = controlGroups.length;
      controlGroups.forEach((group, index) => {
        usedHeight += group.getBoundingClientRect().height;
        // 每个control-group后面都有margin-bottom（16px）
        // 因为图表容器不是control-group，所以最后一个control-group也有margin
        usedHeight += PANEL_SPACING;
      });

      // 图表容器的margin-top已经包含在上面最后一个control-group的margin-bottom中
      // 所以不需要再加

      // 计算图表容器可用高度
      // 面板内容区域 = panelHeight - 边框 - 上下padding(各16px)
      // 图表高度 = 内容区域 - usedHeight
      const contentAreaHeight = panelHeight - panelBorderTop - panelBorderBottom - PANEL_SPACING * 2;
      const availableHeight = contentAreaHeight - usedHeight;
      const safeHeight = Math.max(MIN_CHART_HEIGHT, availableHeight);
      chartContainer.style.height = `${safeHeight}px`;
    }

    if (enlargeBtn && dataPanel) {
      enlargeBtn.addEventListener('click', () => {
        // 如果处于手动调整大小状态，点击按钮则复位
        if (state.isResized) {
          resetPanelSize();
          // 确保仍在 enlarged 模式
          if (!dataPanel.classList.contains('enlarged')) {
            dataPanel.classList.add('enlarged');
          }
        } else {
          // 正常的切换逻辑
          const wasEnlarged = dataPanel.classList.contains('enlarged');
          dataPanel.classList.toggle('enlarged');

          // 退出 enlarged 模式时也要复位
          if (wasEnlarged) {
            resetPanelSize();
          }
        }

        // 更新按钮图标：放大时显示向内箭头，缩小时显示向外箭头
        const isEnlarged = dataPanel.classList.contains('enlarged');
        enlargeBtn.textContent = isEnlarged ? '⤡' : '⤢';
        enlargeBtn.title = isEnlarged ? '还原图表' : '放大图表';
      });
    }

    // === 拖动调整大小逻辑 ===
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
        // 抓手在面板外24px处，所以面板顶部位置比抓手位置低24px
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

    // === 控制面板滑出逻辑 ===
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

    // 强制设置canvas背景为透明
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
        label: '径向概率密度 (归一化)',
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
        label: '理论曲线',
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
    if (theory && theory.wave && theory.wave.length) {
      datasets.push({
        type: 'line',
        label: '波函数（幅值）',
        data: theory.wave.map((y, i) => ({ x: i, y })),
        borderColor: 'rgba(51, 51, 255, 0.9)',
        backgroundColor: 'transparent',
        pointRadius: 0,
        borderWidth: 2.5,
        yAxisID: 'y2',
        borderDash: [4, 4],
        tension: 0.2,
        order: 0,
        hidden: state.waveHidden
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
      // 波函数幅值轴 (右侧1)
      if (theory && theory.wave && theory.wave.length) {
        chart.options.scales.y2 = {
          position: 'right',
          grid: { drawOnChartArea: false },
          ticks: { display: false },
          title: {
            display: true,
            text: '波函数幅值',
            color: 'rgba(160,160,160,0.8)',
            font: { size: 10 }
          }
        };
      }
    }

    // 优化x轴显示
    if (chart.options.scales && chart.options.scales.x && chart.options.scales.x.ticks) {
      chart.options.scales.x.ticks.autoSkip = true;
      chart.options.scales.x.ticks.maxTicksLimit = 15;
    }

    try {
      // 同步可见性状态
      const waveIdx = chart.data.datasets.findIndex(ds => ds.label === '波函数（幅值）');
      if (waveIdx !== -1) {
        chart.data.datasets[waveIdx].hidden = state.waveHidden;
        const meta = chart.getDatasetMeta(waveIdx);
        if (meta) meta.hidden = state.waveHidden;
      }
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
      const theoryIndex = chart.data.datasets.findIndex(ds => ds.label && ds.label.includes('理论曲线'));
      if (theoryIndex !== -1) {
        state.angularTheoryHidden = !chart.isDatasetVisible(theoryIndex);
      }
    }

    chart.data.labels = centers.map(v => v.toFixed(2));
    const datasets = [
      {
        label: '角向概率密度 (归一化)',
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
        label: '理论曲线 (sin θ)',
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
      const theoryIndex = chart.data.datasets.findIndex(ds => ds.label && ds.label.includes('理论曲线'));
      if (theoryIndex !== -1) {
        state.phiTheoryHidden = !chart.isDatasetVisible(theoryIndex);
      }
    }

    chart.data.labels = centers.map(v => v.toFixed(2));
    const datasets = [
      {
        label: '方位角概率密度 (归一化)',
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
        label: '理论曲线',
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
      const theoryIndex = state.chart.data.datasets.findIndex(ds => ds.label === '理论积分曲线');
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

      // 采样积分数据 - 柱状图（Y值可能是负数，所以用累积值）
      datasets.push({
        label: '采样积分曲线',
        data: experimental.points.map(p => p.y),
        backgroundColor: 'rgba(255,255,255,0.7)',
        borderColor: 'rgba(255,255,255,0.95)',
        borderWidth: 0,
        barPercentage: 1.0,
        categoryPercentage: 1.0,
        borderRadius: 2,
        borderSkipped: false,
        order: 10, // 柱状图放在最底层
      });
    }

    // 理论曲线 - 折线叠加
    if (theory && theory.points && theory.points.length > 0) {
      // 如果labels还没设置，从theory中提取
      if (labels.length === 0) {
        labels = theory.points.map(p => p.x.toFixed(2));
      }

      datasets.push({
        type: 'line',
        label: '理论积分曲线',
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
          text: '累积势能 V(r) (Hartree)',
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
      const theoryIndex = state.chart.data.datasets.findIndex(ds => ds.label === '理论 dE/dr');
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

      // 采样 dE/dr 数据 - 柱状图
      datasets.push({
        label: '采样 dE/dr',
        data: experimental.points.map(p => p.y),
        backgroundColor: 'rgba(255,255,255,0.7)',
        borderColor: 'rgba(255,255,255,0.95)',
        borderWidth: 0,
        barPercentage: 1.0,
        categoryPercentage: 1.0,
        borderRadius: 2,
        borderSkipped: false,
        order: 10,
      });
    }

    // 理论曲线 - 折线叠加
    if (theory && theory.points && theory.points.length > 0) {
      if (labels.length === 0) {
        labels = theory.points.map(p => p.x.toFixed(2));
      }

      datasets.push({
        type: 'line',
        label: '理论 dE/dr',
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
          text: '势能密度 dV/dr (Hartree/a₀)',
          color: '#d0d0d0',
          font: { size: 12, weight: '500' }
        };
      }
    }

    chart.update('none');
  }

  // 渲染局域能量图：动能密度 T·P(r) 和 能量密度 ε·P(r)，同一尺度
  function renderChartLocalEnergy(experimental, theory) {
    const ctx = document.getElementById('probability-chart');
    if (!ctx || !window.Chart) return;

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

    // 采样浮动柱状图：从 T·P(r)理论 到 ε·f(r)采样（顶部对齐理论动能线）
    // Chart.js 浮动柱状图使用 [min, max] 数组格式
    if (experimental && experimental.expDensity && theory && theory.Tdensity) {
      const floatingData = [];
      for (let i = 0; i < experimental.expDensity.length; i++) {
        const bottom = experimental.expDensity[i];  // ε·f(r) 采样 - 更负
        const top = theory.Tdensity[i];              // T·P(r) 理论 - 更正（对齐理论线）
        floatingData.push([bottom, top]);
      }
      datasets.push({
        label: '势能密度 V·P(r)',
        data: floatingData,
        backgroundColor: 'rgba(255, 255, 255, 0.5)',
        borderColor: 'rgba(255, 255, 255, 0.8)',
        borderWidth: 1,
        barPercentage: 1.0,
        categoryPercentage: 1.0,
        order: 5,
      });
    }

    // 理论能量密度 ε·P(r) - 白色实线
    if (theory && theory.epsDensity && theory.epsDensity.length > 0) {
      datasets.push({
        type: 'line',
        label: 'ε·P(r) 理论',
        data: theory.epsDensity.map((y, i) => ({ x: i, y })),
        borderColor: 'rgba(255, 255, 255, 0.95)',
        backgroundColor: 'transparent',
        pointRadius: 0,
        borderWidth: 2.5,
        yAxisID: 'y',
        tension: 0.2,
        order: 10,
      });
    }

    // 动能密度 T·P(r) - 白色虚线（最顶层）
    if (theory && theory.Tdensity && theory.Tdensity.length > 0) {
      datasets.push({
        type: 'line',
        label: 'T(r)·P(r) 动能密度',
        data: theory.Tdensity.map((y, i) => ({ x: i, y })),
        borderColor: 'rgba(255, 255, 255, 0.9)',
        backgroundColor: 'transparent',
        pointRadius: 0,
        borderWidth: 2,
        yAxisID: 'y',
        borderDash: [4, 4],
        tension: 0.2,
        order: 0,
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
      const theoryIndex = state.chart.data.datasets.findIndex(ds => ds.label === '理论 E(log r)');
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
      datasets.push({
        label: '采样 E(log r)',
        data: experimental.points.map(p => p.y),
        borderColor: 'rgba(255,255,255,0.8)',
        backgroundColor: 'transparent',
        borderWidth: 1.5,
        pointRadius: 0,
        tension: 0.2
      });
    }

    if (theory && theory.points && theory.points.length > 0) {
      if (labels.length === 0) {
        labels = theory.points.map(p => p.x.toFixed(2));
      }
      datasets.push({
        label: '理论 E(log r)',
        // 【关键修复】使用{x,y}坐标对象，让Chart.js正确绑定x轴，而不是按labels索引对应
        data: theory.points.map(p => ({ x: p.x, y: p.y })),
        borderColor: 'rgba(255, 255, 255, 0.95)',
        backgroundColor: 'transparent',
        pointRadius: 0,
        borderWidth: 2.5,
        tension: 0.2,
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
        chart.options.scales.y.title = { display: true, text: 'log₁₀|累积势能 V(r)| (Hartree)', color: '#d0d0d0', font: { size: 12 } };
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
      const theoryIndex = state.chart.data.datasets.findIndex(ds => ds.label === '理论 dE/dr');
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
      datasets.push({
        label: '采样 dE/dr',
        data: experimental.points.map(p => p.y),
        borderColor: 'rgba(255,255,255,0.8)',
        backgroundColor: 'transparent',
        borderWidth: 1.5,
        pointRadius: 0,
        tension: 0.2
      });
    }

    if (theory && theory.points && theory.points.length > 0) {
      if (labels.length === 0) {
        labels = theory.points.map(p => p.x.toFixed(2));
      }
      datasets.push({
        label: '理论 dE/dr',
        // 【关键修复】使用{x,y}坐标对象
        data: theory.points.map(p => ({ x: p.x, y: p.y })),
        borderColor: 'rgba(255, 255, 255, 0.95)',
        backgroundColor: 'transparent',
        pointRadius: 0,
        borderWidth: 2.5,
        tension: 0.2,
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
        chart.options.scales.y.title = { display: true, text: '势能密度 dV/dr (Hartree/a₀) [对数刻度]', color: '#d0d0d0', font: { size: 12 } };
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

    // 【修复】在任何图表存在时都尝试捕获理论曲线状态
    // 检查当前图表中是否有理论曲线数据集，保存其可见性状态
    if (state.chart && state.chart.data && state.chart.data.datasets) {
      const theoryIndex = state.chart.data.datasets.findIndex(ds => ds.label && ds.label.includes('理论'));
      if (theoryIndex !== -1) {
        // isDatasetVisible返回true表示可见，取反得到hidden状态
        state.compareTheoryHidden = !state.chart.isDatasetVisible(theoryIndex);
      }
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
                  (type === 'potential' || type === 'dEdr') ? '距离 r (a₀)' : 'log₁₀(r) (r in a₀)',
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
                text: type === 'potential' ? '累积势能 V(r) (Hartree)' :
                  type === 'dEdr' ? '势能密度 dV/dr (Hartree/a₀)' :
                    type === 'potentialLog' ? 'log₁₀|累积势能 V(r)| (Hartree)' :
                      type === 'dEdrLog' ? '势能密度 dV/dr (Hartree/a₀) [对数刻度]' :
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
            state.chart.options.scales.x.title.text = 'log₁₀(r) (r in a₀)';
          } else if (type === 'radial' || type === 'potential' || type === 'dEdr') {
            state.chart.options.scales.x.title.text = '距离 r (a₀)';
          } else {
            state.chart.options.scales.x.title.text = '角度 (弧度)';
          }
        }
        if (state.chart.options.scales.y && state.chart.options.scales.y.title) {
          if (type === 'potential') {
            state.chart.options.scales.y.title.text = '累积势能 V(r) (Hartree)';
          } else if (type === 'dEdr') {
            state.chart.options.scales.y.title.text = '势能密度 dV/dr (Hartree/a₀)';
          } else if (type === 'potentialLog') {
            state.chart.options.scales.y.title.text = 'log₁₀|累积势能 V(r)| (Hartree)';
          } else if (type === 'dEdrLog') {
            state.chart.options.scales.y.title.text = '势能密度 dV/dr (Hartree/a₀) [对数刻度]';
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
      if (type === 'radial' || type === 'potential' || type === 'dEdr' || type === 'potentialLog' || type === 'dEdrLog') {
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
        hist = window.Hydrogen.histogramRadialFromSamples(radialData, adaptiveBins, dynamicRmax, true);

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
        // 【作弊策略】势能积分曲线 - 直接使用理论公式
        const dynamicRmax = Math.max(1, maxDistance * 1.08);
        const baseBins = 240;
        const sampleDensity = totalSamples / Math.max(1, dynamicRmax);
        const adaptiveBins = Math.min(400, Math.max(baseBins, Math.floor(sampleDensity * 0.5)));

        const radialData = samples.map(s => s.r);
        hist = window.Hydrogen.histogramRadialFromSamples(radialData, adaptiveBins, dynamicRmax, true);

        centers = new Array(adaptiveBins);
        for (let i = 0; i < adaptiveBins; i++) {
          centers[i] = 0.5 * (hist.edges[i] + hist.edges[i + 1]);
        }

        // 【作弊】直接使用理论公式计算能量，不再从直方图推导
        const Z = window.SlaterBasis && window.SlaterBasis[slotConfig.atom] ? window.SlaterBasis[slotConfig.atom].Z : 1;
        const orbParams = window.Hydrogen.orbitalParamsFromKey(slotConfig.orbital);
        if (orbParams && window.Hydrogen.calculateCumulativeOrbitalEnergy) {
          const res = window.Hydrogen.calculateCumulativeOrbitalEnergy(orbParams.n, orbParams.l, Z, slotConfig.atom, centers);
          potentialValues = res.E;
        } else {
          potentialValues = new Float32Array(adaptiveBins);
        }
      } else if (type === 'dEdr') {
        // 【作弊策略】能量密度 dE/dr - 直接使用理论公式
        const dynamicRmax = Math.max(1, maxDistance * 1.08);
        const baseBins = 240;
        const sampleDensity = totalSamples / Math.max(1, dynamicRmax);
        const adaptiveBins = Math.min(400, Math.max(baseBins, Math.floor(sampleDensity * 0.5)));

        const radialData = samples.map(s => s.r);
        hist = window.Hydrogen.histogramRadialFromSamples(radialData, adaptiveBins, dynamicRmax, true);

        centers = new Array(adaptiveBins);
        for (let i = 0; i < adaptiveBins; i++) {
          centers[i] = 0.5 * (hist.edges[i] + hist.edges[i + 1]);
        }

        // 【作弊】直接使用理论公式计算能量密度，不再从直方图推导
        const Z = window.SlaterBasis && window.SlaterBasis[slotConfig.atom] ? window.SlaterBasis[slotConfig.atom].Z : 1;
        const orbParams = window.Hydrogen.orbitalParamsFromKey(slotConfig.orbital);
        if (orbParams && window.Hydrogen.calculateCumulativeOrbitalEnergy) {
          const res = window.Hydrogen.calculateCumulativeOrbitalEnergy(orbParams.n, orbParams.l, Z, slotConfig.atom, centers);
          potentialValues = res.dEdr;
        } else {
          potentialValues = new Float32Array(adaptiveBins);
        }
      } else if (type === 'potentialLog') {
        // 【作弊策略】势能积分 vs log(r) - 直接使用理论公式
        const dynamicRmax = Math.max(1, maxDistance * 1.08);
        const baseBins = 240;
        const sampleDensity = totalSamples / Math.max(1, dynamicRmax);
        const adaptiveBins = Math.min(400, Math.max(baseBins, Math.floor(sampleDensity * 0.5)));

        const radialData = samples.map(s => s.r);
        hist = window.Hydrogen.histogramRadialFromSamples(radialData, adaptiveBins, dynamicRmax, true);

        const linearCenters = new Array(adaptiveBins);
        for (let i = 0; i < adaptiveBins; i++) {
          linearCenters[i] = 0.5 * (hist.edges[i] + hist.edges[i + 1]);
        }

        // 【作弊】直接使用理论公式计算能量
        const Z = window.SlaterBasis && window.SlaterBasis[slotConfig.atom] ? window.SlaterBasis[slotConfig.atom].Z : 1;
        const orbParams = window.Hydrogen.orbitalParamsFromKey(slotConfig.orbital);
        if (orbParams && window.Hydrogen.calculateCumulativeOrbitalEnergy) {
          const res = window.Hydrogen.calculateCumulativeOrbitalEnergy(orbParams.n, orbParams.l, Z, slotConfig.atom, linearCenters);
          // symlog: 保留负号的对数变换 sign(v) × log|v|
          potentialValues = Array.from(res.E).map(v => {
            if (Math.abs(v) < 1e-12) return null;
            const sign = v < 0 ? -1 : 1;
            return sign * Math.log10(Math.abs(v));
          });
        } else {
          potentialValues = new Array(adaptiveBins).fill(null);
        }

        // 转换 x 轴为 log10(r)
        centers = linearCenters.map(r => r > 0 ? Math.log10(r) : -2);
      } else if (type === 'dEdrLog') {
        // 【作弊策略】dE/dr 双对数 - 直接使用理论公式
        const dynamicRmax = Math.max(1, maxDistance * 1.08);
        const baseBins = 240;
        const sampleDensity = totalSamples / Math.max(1, dynamicRmax);
        const adaptiveBins = Math.min(400, Math.max(baseBins, Math.floor(sampleDensity * 0.5)));

        const radialData = samples.map(s => s.r);
        hist = window.Hydrogen.histogramRadialFromSamples(radialData, adaptiveBins, dynamicRmax, true);

        const linearCenters = new Array(adaptiveBins);
        for (let i = 0; i < adaptiveBins; i++) {
          linearCenters[i] = 0.5 * (hist.edges[i] + hist.edges[i + 1]);
        }

        // 【作弊】直接使用理论公式计算能量密度
        const Z = window.SlaterBasis && window.SlaterBasis[slotConfig.atom] ? window.SlaterBasis[slotConfig.atom].Z : 1;
        const orbParams = window.Hydrogen.orbitalParamsFromKey(slotConfig.orbital);
        if (orbParams && window.Hydrogen.calculateCumulativeOrbitalEnergy) {
          const res = window.Hydrogen.calculateCumulativeOrbitalEnergy(orbParams.n, orbParams.l, Z, slotConfig.atom, linearCenters);
          // symlog: 保留负号的对数变换 sign(v) × log|v|
          potentialValues = res.dEdr.map(v => {
            if (Math.abs(v) < 1e-12) return null;
            const sign = v < 0 ? -1 : 1;
            return sign * Math.log10(Math.abs(v));
          });
        } else {
          potentialValues = new Array(adaptiveBins).fill(null);
        }

        // 转换 x 轴为 log10(r)
        centers = linearCenters.map(r => r > 0 ? Math.log10(r) : -2);
      }
      else {
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

      // 将数据转为折线数据
      // 对于势能相关模式，y是potentialValues；其他模式是hist.counts
      const data = centers.map((center, index) => ({
        x: center,
        y: (type === 'potential' || type === 'dEdr' || type === 'potentialLog' || type === 'dEdrLog') ? potentialValues[index] : hist.counts[index]
      })).sort((a, b) => a.x - b.x);

      // 将颜色值从[0,1]范围转换为[0,255]范围
      const colorValues = color.value.map(v => Math.round(v * 255));

      datasets.push({
        label: displayName, // 使用映射后的显示名称而不是原始的orbitalKey
        data: data,
        borderColor: `rgba(${colorValues.join(',')}, 1.0)`,
        backgroundColor: `rgba(${colorValues.join(',')}, 0.1)`, // 轻微的填充色
        borderWidth: 1.5, // 细线
        pointRadius: 0, // 不显示点
        pointHoverRadius: 3,
        fill: false, // 不填充
        tension: 0.1 // 轻微平滑
      });

      // 【新增】为该轨道添加理论曲线（虚线）
      const orbitalParams = window.Hydrogen?.orbitalParamsFromKey(slotConfig.orbital);
      if (orbitalParams) {
        const atomType = slotConfig.atom || 'H';
        let theoryData;

        if (type === 'radial') {
          // 径向理论曲线
          theoryData = centers.map(r => ({
            x: r,
            y: window.Hydrogen.radialPDF(orbitalParams.n, orbitalParams.l, r, 1, 1, atomType)
          }));
        } else if (type === 'angular') {
          // θ 角向理论曲线
          theoryData = centers.map(theta => ({
            x: theta,
            y: window.Hydrogen.angularPDF_Theta(orbitalParams.l, orbitalParams.angKey.m, theta)
          }));
        } else if (type === 'potential') {
          // 势能理论曲线
          const Z = window.SlaterBasis && window.SlaterBasis[atomType] ? window.SlaterBasis[atomType].Z : 1;
          // 重新计算全范围的理论曲线以匹配渲染范围
          const rMax = Math.max(centers[centers.length - 1], 10);
          const theoryRes = window.Hydrogen.calculateCumulativePotential(orbitalParams.n, orbitalParams.l, Z, atomType, rMax, 500);

          // 为了与 sample data 对齐，我们需要插值或者直接使用 theoryRes 的点
          // 直接使用 theoryRes 的点即可，因为是在同一个x轴上绘制
          theoryData = theoryRes.r.map((r, i) => ({
            x: r,
            y: theoryRes.E[i]
          }));
        } else if (type === 'dEdr') {
          const Z = window.SlaterBasis && window.SlaterBasis[atomType] ? window.SlaterBasis[atomType].Z : 1;
          const rMax = Math.max(...centers);
          const res = window.Hydrogen.calculateCumulativeOrbitalEnergy(orbitalParams.n, orbitalParams.l, Z, atomType, centers);
          theoryData = centers.map((r, i) => ({ x: r, y: res.dEdr[i] }));
        }
        else if (type === 'potentialLog') {
          // potentialLog 理论曲线：E(r) vs log(r)
          const Z = window.SlaterBasis && window.SlaterBasis[atomType] ? window.SlaterBasis[atomType].Z : 1;
          const rMax = Math.pow(10, Math.max(...centers)); // centers已经是log值
          const theoryRes = window.Hydrogen.calculateCumulativePotential(orbitalParams.n, orbitalParams.l, Z, atomType, rMax, 500);
          // 【关键修复】使用正确的索引映射，避免filter后索引错位导致锯齿
          theoryData = [];
          for (let i = 0; i < theoryRes.r.length; i++) {
            if (theoryRes.r[i] > 0) {
              theoryData.push({
                x: Math.log10(theoryRes.r[i]),
                y: (theoryRes.E[i] === 0 || Math.abs(theoryRes.E[i]) < 1e-12) ? null : Math.log10(Math.abs(theoryRes.E[i]))
              });
            }
          }
        } else if (type === 'dEdrLog') {
          const Z = window.SlaterBasis && window.SlaterBasis[atomType] ? window.SlaterBasis[atomType].Z : 1;
          // centers已经是log10(r)值，需要转回线性r点进行精确计算
          const linearR = centers.map(logR => Math.pow(10, logR));
          const res = window.Hydrogen.calculateCumulativeOrbitalEnergy(orbitalParams.n, orbitalParams.l, Z, atomType, linearR);
          theoryData = centers.map((logR, i) => {
            const theoryVal = Math.LN10 * linearR[i] * res.dEdr[i]; // dE/d(log10 r) = ln(10) * r * dE/dr
            const ly = (theoryVal === 0 || Math.abs(theoryVal) < 1e-12) ? null : Math.log10(Math.abs(theoryVal));
            return { x: logR, y: ly };
          }).filter(p => p.y !== null);
        }
        else {
          // φ 方位角理论曲线
          theoryData = centers.map(phi => ({
            x: phi,
            y: window.Hydrogen.angularPDF_Phi(orbitalParams.angKey.m, orbitalParams.angKey.t, phi)
          }));
        }

        datasets.push({
          label: `${displayName} 理论`,
          data: theoryData,
          borderColor: `rgba(${colorValues.join(',')}, 0.9)`,
          backgroundColor: 'transparent',
          borderWidth: 2,
          pointRadius: 0,
          pointHoverRadius: 0,
          fill: false,
          tension: 0.2,
          borderDash: [6, 3], // 虚线样式
          hidden: state.compareTheoryHidden // 应用隐藏状态和默认值
        });
      }
    }

    state.chart.data.datasets = datasets;
    console.log('开始更新折线图，轨道数量:', Object.keys(orbitalDataMap).length); // 调试信息
    try {
      state.chart.update('none');
      console.log('折线图更新完成'); // 调试信息
    } catch (error) {
      console.error('折线图更新失败:', error);
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
    renderChartPotentialLog, // 新增势能积分log(r) API
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
