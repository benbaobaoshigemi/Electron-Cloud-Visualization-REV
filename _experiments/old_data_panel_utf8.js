// 鏁版嵁闈㈡澘閫昏緫锛堜笌涓绘覆鏌撻€昏緫瑙ｈ€︼級
// 鏆撮湶 DataPanel 鍏ㄥ眬瀵硅薄锛屼緵 script.js 璋冪敤
(function () {
  const state = {
    chart: null,
    collapsed: false,
    live: false, // 鐢变富绋嬪簭鎺у埗鏄惁瀹炴椂鏇存柊
    isResized: false, // 鏍囪鏄惁琚敤鎴锋墜鍔ㄨ皟鏁磋繃澶у皬
    waveHidden: true, // 璁板綍娉㈠嚱鏁版洸绾跨殑闅愯棌鐘舵€侊紙榛樿闅愯棌锛?    angularTheoryHidden: false, // 璁板綍瑙掑悜鐞嗚鏇茬嚎鐨勯殣钘忕姸鎬?    compareTheoryHidden: true, // 璁板綍姣旂収妯″紡鐞嗚鏇茬嚎鐨勯殣钘忕姸鎬侊紙榛樿闅愯棌锛?    potentialTheoryHidden: false, // 璁板綍鍔胯兘鍥剧悊璁烘洸绾跨殑闅愯棌鐘舵€侊紙榛樿鏄剧ず锛?    phiTheoryHidden: false, // 璁板綍蠁瑙掑悜鐞嗚鏇茬嚎鐨勯殣钘忕姸鎬?    dEdrTheoryHidden: false, // 璁板綍dE/dr鐞嗚鏇茬嚎鐨勯殣钘忕姸鎬侊紙榛樿鏄剧ず锛?    potentialLogTheoryHidden: false, // 璁板綍E(log r)鐞嗚鏇茬嚎鐨勯殣钘忕姸鎬?    dEdrLogTheoryHidden: false, // 璁板綍dE/d(log r)鐞嗚鏇茬嚎鐨勯殣钘忕姸鎬?  };

  function init() {
    // === 鏁版嵁闈㈡澘婊戝嚭閫昏緫 ===
    const dataPanel = document.getElementById('data-panel');
    const dataCollapseBtn = document.getElementById('data-collapse-btn');
    const dataTab = document.getElementById('data-panel-tab');
    const enlargeBtn = document.getElementById('chart-enlarge-btn');
    const resizeHandle = document.getElementById('chart-resize-handle');
    const chartContainer = dataPanel ? dataPanel.querySelector('.chart-container') : null;

    // 鍥哄畾闂磋窛甯搁噺锛堜笌CSS鍙橀噺--spacing-panel涓€鑷达級
    const PANEL_SPACING = 16;
    const MIN_CHART_HEIGHT = 220;

    // 璁＄畻鏈€灏忛潰鏉块珮搴?    function calculateMinPanelHeight() {
      if (!dataPanel || !chartContainer) return 400;
      const chartTopOffset = chartContainer.getBoundingClientRect().top - dataPanel.getBoundingClientRect().top;
      // 鏈€灏忛潰鏉块珮搴?= 鍥捐〃椤堕儴鍋忕Щ + 鏈€灏忓浘琛ㄩ珮搴?+ 搴曢儴padding(16px)
      return chartTopOffset + MIN_CHART_HEIGHT + PANEL_SPACING;
    }

    // 寤惰繜璁＄畻浠ョ‘淇滳SS宸插姞杞?    let minPanelHeight = 400;
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

    // 澶嶄綅闈㈡澘澶у皬鐨勫嚱鏁?    function resetPanelSize() {
      // 娓呴櫎鎵€鏈夋墜鍔ㄨ缃殑鏍峰紡
      dataPanel.style.width = '';
      dataPanel.style.height = '';

      // 娓呴櫎鍥捐〃瀹瑰櫒鐨勬墜鍔ㄦ牱寮?      if (chartContainer) {
        chartContainer.style.height = '';
      }

      state.isResized = false;

      // 鎭㈠鍥炬爣
      if (enlargeBtn) {
        enlargeBtn.textContent = '猡?;
        enlargeBtn.title = '鏀惧ぇ/杩樺師鍥捐〃';
      }
    }

    function updateChartContainerHeight(panelHeight) {
      if (!chartContainer || !dataPanel) {
        return;
      }
      const panelContent = dataPanel.querySelector('.panel-content');
      const panelBody = dataPanel.querySelector('.panel-body');
      if (!panelContent || !panelBody) return;

      // 浣跨敤鍥哄畾鐨?6px闂磋窛锛堜笌CSS鍙橀噺--spacing-panel涓€鑷达級
      const PANEL_SPACING = 16;

      // 鑾峰彇闈㈡澘杈规
      const panelStyle = window.getComputedStyle(dataPanel);
      const panelBorderTop = parseFloat(panelStyle.borderTopWidth) || 0;
      const panelBorderBottom = parseFloat(panelStyle.borderBottomWidth) || 0;

      // 璁＄畻闈㈡澘澶撮儴鍗犵敤鐨勯珮搴?      const panelHeader = dataPanel.querySelector('.panel-header');
      let usedHeight = 0;

      if (panelHeader) {
        usedHeight += panelHeader.getBoundingClientRect().height;
        usedHeight += PANEL_SPACING; // header鐨刴argin-bottom
      }

      // 璁＄畻鍏朵粬鎺т欢鍗犵敤鐨勯珮搴︼紙涓嶅寘鍚浘琛ㄥ鍣級
      // 鏁版嵁闈㈡澘涓湁2涓猚ontrol-group锛屾瘡涓悗闈㈡湁16px闂磋窛
      const controlGroups = panelBody.querySelectorAll('.control-group');
      const controlGroupCount = controlGroups.length;
      controlGroups.forEach((group, index) => {
        usedHeight += group.getBoundingClientRect().height;
        // 姣忎釜control-group鍚庨潰閮芥湁margin-bottom锛?6px锛?        // 鍥犱负鍥捐〃瀹瑰櫒涓嶆槸control-group锛屾墍浠ユ渶鍚庝竴涓猚ontrol-group涔熸湁margin
        usedHeight += PANEL_SPACING;
      });

      // 鍥捐〃瀹瑰櫒鐨刴argin-top宸茬粡鍖呭惈鍦ㄤ笂闈㈡渶鍚庝竴涓猚ontrol-group鐨刴argin-bottom涓?      // 鎵€浠ヤ笉闇€瑕佸啀鍔?
      // 璁＄畻鍥捐〃瀹瑰櫒鍙敤楂樺害
      // 闈㈡澘鍐呭鍖哄煙 = panelHeight - 杈规 - 涓婁笅padding(鍚?6px)
      // 鍥捐〃楂樺害 = 鍐呭鍖哄煙 - usedHeight
      const contentAreaHeight = panelHeight - panelBorderTop - panelBorderBottom - PANEL_SPACING * 2;
      const availableHeight = contentAreaHeight - usedHeight;
      const safeHeight = Math.max(MIN_CHART_HEIGHT, availableHeight);
      chartContainer.style.height = `${safeHeight}px`;
    }

    if (enlargeBtn && dataPanel) {
      enlargeBtn.addEventListener('click', () => {
        // 濡傛灉澶勪簬鎵嬪姩璋冩暣澶у皬鐘舵€侊紝鐐瑰嚮鎸夐挳鍒欏浣?        if (state.isResized) {
          resetPanelSize();
          // 纭繚浠嶅湪 enlarged 妯″紡
          if (!dataPanel.classList.contains('enlarged')) {
            dataPanel.classList.add('enlarged');
          }
        } else {
          // 姝ｅ父鐨勫垏鎹㈤€昏緫
          const wasEnlarged = dataPanel.classList.contains('enlarged');
          dataPanel.classList.toggle('enlarged');

          // 閫€鍑?enlarged 妯″紡鏃朵篃瑕佸浣?          if (wasEnlarged) {
            resetPanelSize();
          }
        }

        // 鏇存柊鎸夐挳鍥炬爣锛氭斁澶ф椂鏄剧ず鍚戝唴绠ご锛岀缉灏忔椂鏄剧ず鍚戝绠ご
        const isEnlarged = dataPanel.classList.contains('enlarged');
        enlargeBtn.textContent = isEnlarged ? '猡? : '猡?;
        enlargeBtn.title = isEnlarged ? '杩樺師鍥捐〃' : '鏀惧ぇ鍥捐〃';
      });
    }

    // === 鎷栧姩璋冩暣澶у皬閫昏緫 ===
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
        // 鎶撴墜鍦ㄩ潰鏉垮24px澶勶紝鎵€浠ラ潰鏉块《閮ㄤ綅缃瘮鎶撴墜浣嶇疆浣?4px
        const panelTopY = handleTargetY + 24;
        const newWidth = Math.max(300, window.innerWidth - handleTargetX - 20 - 24);
        const rawHeight = window.innerHeight - panelTopY - 20;
        const newHeight = Math.max(minPanelHeight, rawHeight);

        dataPanel.style.width = `${newWidth}px`;
        dataPanel.style.height = `${newHeight}px`;
        updateChartContainerHeight(newHeight);

        if (!state.isResized) {
          state.isResized = true;
          enlargeBtn.textContent = '鉄?;
          enlargeBtn.title = '澶嶄綅澶у皬';
        }
      });

      document.addEventListener('mouseup', () => {
        if (!isResizing) return;
        isResizing = false;
        dataPanel.classList.remove('resizing');
        window.dispatchEvent(new Event('resize'));
      });
    }

    // === 鎺у埗闈㈡澘婊戝嚭閫昏緫 ===
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

    // 寮哄埗璁剧疆canvas鑳屾櫙涓洪€忔槑
    ctx.style.backgroundColor = 'transparent';

    state.chart = new Chart(ctx, {
      type: 'bar',
      data: { labels: [], datasets: [] },
      options: {
        responsive: true,
        maintainAspectRatio: false,
        backgroundColor: 'transparent',
        animation: {
          duration: 300, // 娣诲姞骞虫粦鍔ㄧ敾
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
              // color: '#e8e8e8', // 绉婚櫎纭紪鐮侀鑹诧紝鏀圭敱 generateLabels 鍔ㄦ€佹帶鍒?              font: { size: 11, weight: '500' },
              padding: 12,
              generateLabels: function (chart) {
                const original = Chart.defaults.plugins.legend.labels.generateLabels;
                const labels = original.call(this, chart);
                labels.forEach(label => {
                  if (label.hidden) {
                    label.fontColor = '#666666'; // 闈炴縺娲绘椂鍙樼伆
                    label.fillStyle = '#666666';
                    label.strokeStyle = '#666666';
                    label.textDecoration = 'line-through';
                  } else {
                    label.fontColor = '#e8e8e8'; // 婵€娲绘椂浜壊
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
              maxTicksLimit: 12 // 闄愬埗鏍囩鏁伴噺锛岄伩鍏嶆嫢鎸?            },
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
    console.log('鏂板浘琛ㄥ疄渚嬪垱寤烘垚鍔?); // 璋冭瘯淇℃伅
    return state.chart;
  }

  function renderChartRadial(hist, theory) {
    const ctx = document.getElementById('probability-chart');
    if (!ctx || !window.Chart) {
      return;
    }

    // 鍦ㄦ洿鏂版垨閲嶅缓鍥捐〃鍓嶏紝鍏堜粠鐜版湁鍥捐〃瀹炰緥涓崟鑾锋尝鍑芥暟鏇茬嚎鐨勫彲瑙佹€х姸鎬?    // 杩欐牱鍗充娇鐢ㄦ埛閫氳繃鐐瑰嚮鍥句緥鏀瑰彉浜嗙姸鎬侊紝鍒锋柊鏃朵篃鑳戒繚鎸?    if (state.chart && state.chart.data && state.chart.data.datasets) {
      const waveDatasetIndex = state.chart.data.datasets.findIndex(ds => ds.label === '娉㈠嚱鏁帮紙骞呭€硷級');
      if (waveDatasetIndex !== -1) {
        // isDatasetVisible杩斿洖true琛ㄧず鍙锛屾墍浠ュ彇鍙嶅緱鍒癶idden鐘舵€?        state.waveHidden = !state.chart.isDatasetVisible(waveDatasetIndex);
      }
    }

    // 鑻ュ綋鍓嶆槸鏋佸潗鏍囧浘锛岄渶閿€姣佸悗閲嶆柊鍒涘缓鏌辩姸鍥?    if (state.chart && state.chart.config && state.chart.config.type !== 'bar') {
      try { state.chart.destroy(); } catch (e) { console.warn('鍥捐〃閿€姣佸け璐?', e); }
      state.chart = null;
    }
    const chart = ensureChart();
    if (!chart) {
      return;
    }
    // 灏嗙洿鏂瑰浘涓績浣滀负 x 杞达紙绾挎€?r锛夛紝鐞嗚鏇茬嚎鍦ㄧ浉鍚屼腑蹇冨彇鏍?    const centers = (theory && theory.centers) || (() => { const n = hist.counts.length; const a = new Array(n); for (let i = 0; i < n; i++) a[i] = 0.5 * (hist.edges[i] + hist.edges[i + 1]); return a; })();

    // 鍔ㄦ€佽皟鏁存樉绀虹簿搴︼細鏍规嵁鏁版嵁鑼冨洿鏅鸿兘閫夋嫨灏忔暟浣嶆暟
    const maxValue = Math.max(...centers);
    const decimalPlaces = maxValue > 100 ? 1 : (maxValue > 10 ? 2 : 3);

    chart.data.labels = centers.map(v => v.toFixed(decimalPlaces));
    const datasets = [
      {
        label: '寰勫悜姒傜巼瀵嗗害 (褰掍竴鍖?',
        data: Array.from(hist.counts),
        backgroundColor: 'rgba(255,255,255,0.7)',
        borderColor: 'rgba(255,255,255,0.95)',
        borderWidth: 0, // 娑堥櫎鎽╁皵绾癸紙鏂戦┈绾癸級
        barPercentage: 1.0,
        categoryPercentage: 1.0,
        borderRadius: 2,
        borderSkipped: false,
        order: 10, // 鏌辩姸鍥炬斁鍦ㄦ渶搴曞眰锛圕hart.js涓璷rder瓒婂ぇ瓒婇潬鍚庯級
      },
    ];
    if (theory && theory.values && theory.values.length) {
      datasets.push({
        type: 'line',
        label: '鐞嗚鏇茬嚎',
        data: theory.values.map((y, i) => ({ x: i, y })),
        borderColor: 'rgba(255, 255, 255, 0.95)',
        backgroundColor: 'transparent',
        pointRadius: 0,
        borderWidth: 2.5,
        yAxisID: 'y',
        tension: 0.2,
        order: 5, // 鐞嗚鏇茬嚎鍦ㄤ腑闂?      });
    }
    if (theory && theory.wave && theory.wave.length) {
      datasets.push({
        type: 'line',
        label: '娉㈠嚱鏁帮紙骞呭€硷級',
        data: theory.wave.map((y, i) => ({ x: i, y })),
        borderColor: 'rgba(51, 51, 255, 0.9)', // 椤圭洰涓娇鐢ㄧ殑钃濊壊 [0.2, 0.2, 1]
        backgroundColor: 'transparent',
        pointRadius: 0,
        borderWidth: 2.5,
        yAxisID: 'y2',
        borderDash: [4, 4],
        tension: 0.2,
        order: 0, // 娉㈠嚱鏁版斁鍦ㄦ渶涓婂眰锛坥rder鏈€灏忥級
        hidden: state.waveHidden
      });
    }
    chart.data.datasets = datasets;

    // 娣诲姞鍧愭爣杞存爣棰?    if (chart.options.scales) {
      if (chart.options.scales.x) {
        chart.options.scales.x.title = {
          display: true,
          text: '寰勫悜璺濈 (a鈧€)',
          color: '#d0d0d0',
          font: { size: 12, weight: '500' }
        };
      }
      if (chart.options.scales.y) {
        chart.options.scales.y.title = {
          display: true,
          text: '姒傜巼瀵嗗害',
          color: '#d0d0d0',
          font: { size: 12, weight: '500' }
        };
      }
      // 娉㈠嚱鏁板箙鍊艰酱
      if (theory && theory.wave && theory.wave.length) {
        chart.options.scales.y2 = {
          position: 'right',
          grid: { drawOnChartArea: false },
          ticks: { display: false },
          title: {
            display: true,
            text: '娉㈠嚱鏁板箙鍊?,
            color: 'rgba(160,160,160,0.8)',
            font: { size: 10 }
          }
        };
      }
    }

    // 浼樺寲x杞存樉绀猴細鍔ㄦ€佽皟鏁存爣绛惧瘑搴︼紝閬垮厤杩囦簬鎷ユ尋
    if (chart.options.scales && chart.options.scales.x && chart.options.scales.x.ticks) {
      const totalLabels = centers.length;
      const maxDisplayLabels = 15; // 鏈€澶氭樉绀?5涓爣绛?      const stepSize = Math.max(1, Math.ceil(totalLabels / maxDisplayLabels));

      // 绉婚櫎鑷畾涔塩allback锛屼娇鐢╝utoSkip
      chart.options.scales.x.ticks.autoSkip = true;
      chart.options.scales.x.ticks.maxTicksLimit = maxDisplayLabels;
      delete chart.options.scales.x.ticks.callback;
    }

    // 寮哄埗鏇存柊鍥捐〃锛岀‘淇濋娆℃覆鏌撴纭樉绀?    try {
      // 鍦ㄦ洿鏂板墠锛屽厛鎵惧埌娉㈠嚱鏁版暟鎹泦骞惰缃叾闅愯棌鐘舵€?      const waveDatasetIndex = chart.data.datasets.findIndex(ds => ds.label === '娉㈠嚱鏁帮紙骞呭€硷級');
      if (waveDatasetIndex !== -1) {
        // 鐩存帴鍦╠ataset鍜宮eta涓婅缃甴idden灞炴€э紝纭繚鍒锋柊鍚庣姸鎬佷繚鎸?        chart.data.datasets[waveDatasetIndex].hidden = state.waveHidden;
        const waveMeta = chart.getDatasetMeta(waveDatasetIndex);
        if (waveMeta) {
          waveMeta.hidden = state.waveHidden;
        }
      }

      chart.update('none'); // 浣跨敤'none'妯″紡寮哄埗绔嬪嵆鏇存柊锛屼笉浣跨敤鍔ㄧ敾
    } catch (error) {
      console.error('鍥捐〃鏇存柊澶辫触:', error);
      // 濡傛灉鏇存柊澶辫触锛屽皾璇曢噸鏂板垱寤哄浘琛?      try {
        state.chart.destroy();
        state.chart = null;
        const newChart = ensureChart();
        if (newChart) {
          newChart.data.datasets = datasets;
          newChart.update('none');
        }
      } catch (e) {
        console.error('鍥捐〃閲嶆柊鍒涘缓涔熷け璐?', e);
      }
    }
  }

  function renderChartAngular(hist, theory) {
    const ctx = document.getElementById('probability-chart');
    if (!ctx || !window.Chart) return;
    // 濡傚綋鍓嶄笉鏄煴鐘跺浘锛岄攢姣佸悗鐢ㄦ煴鐘跺浘閲嶅缓
    if (state.chart && (!state.chart.config || state.chart.config.type !== 'bar')) {
      try { state.chart.destroy(); } catch (e) { console.warn('鍥捐〃閿€姣佸け璐?', e); }
      state.chart = null;
    }
    const bins = hist.counts.length;
    const centers = (theory && theory.centers) || (() => { const n = hist.counts.length; const a = new Array(n); for (let i = 0; i < n; i++) a[i] = 0.5 * (hist.edges[i] + hist.edges[i + 1]); return a; })();

    const chart = ensureChart();
    if (!chart) return;

    // 鎹曡幏瑙掑悜鐞嗚鏇茬嚎鐨勫彲瑙佹€х姸鎬?    if (chart.data && chart.data.datasets) {
      const theoryIndex = chart.data.datasets.findIndex(ds => ds.label && ds.label.includes('鐞嗚鏇茬嚎'));
      if (theoryIndex !== -1) {
        state.angularTheoryHidden = !chart.isDatasetVisible(theoryIndex);
      }
    }

    chart.data.labels = centers.map(v => v.toFixed(2));
    const datasets = [
      {
        label: '瑙掑悜姒傜巼瀵嗗害 (褰掍竴鍖?',
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
        label: '鐞嗚鏇茬嚎 (sin 胃)',
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

    // 寮哄埗璁剧疆鍏ㄥ眬鍏冪礌閰嶇疆锛岀‘淇濈嚎鏉′笉鏄剧ず鐐?    if (!chart.options.elements) chart.options.elements = {};
    chart.options.elements.point = { radius: 0, hoverRadius: 0 };

    // 娣诲姞鍧愭爣杞存爣棰?    if (chart.options.scales) {
      if (chart.options.scales.x) {
        chart.options.scales.x.title = {
          display: true,
          text: '瑙掑害 胃 (寮у害)',
          color: '#d0d0d0',
          font: { size: 12, weight: '500' }
        };
        // 浼樺寲x杞存樉绀?        chart.options.scales.x.ticks.autoSkip = true;
        chart.options.scales.x.ticks.maxTicksLimit = 15;
        delete chart.options.scales.x.ticks.callback;
      }
      if (chart.options.scales.y) {
        chart.options.scales.y.title = {
          display: true,
          text: '姒傜巼瀵嗗害 P(胃)',
          color: '#d0d0d0',
          font: { size: 12, weight: '500' }
        };
      }
    }

    chart.update('none'); // 浣跨敤鏃犲姩鐢绘洿鏂帮紝閬垮厤鏇茬嚎璺冲姩
  }

  function renderChartPhi(hist, theory) {
    const ctx = document.getElementById('probability-chart');
    if (!ctx || !window.Chart) return;
    // 濡傚綋鍓嶄笉鏄煴鐘跺浘锛岄攢姣佸悗鐢ㄦ煴鐘跺浘閲嶅缓
    if (state.chart && (!state.chart.config || state.chart.config.type !== 'bar')) {
      try { state.chart.destroy(); } catch (e) { console.warn('鍥捐〃閿€姣佸け璐?', e); }
      state.chart = null;
    }
    const bins = hist.counts.length;
    const centers = (theory && theory.centers) || (() => { const n = hist.counts.length; const a = new Array(n); for (let i = 0; i < n; i++) a[i] = 0.5 * (hist.edges[i] + hist.edges[i + 1]); return a; })();

    const chart = ensureChart();
    if (!chart) return;

    // 鎹曡幏蠁瑙掑悜鐞嗚鏇茬嚎鐨勫彲瑙佹€х姸鎬?    if (chart.data && chart.data.datasets) {
      const theoryIndex = chart.data.datasets.findIndex(ds => ds.label && ds.label.includes('鐞嗚鏇茬嚎'));
      if (theoryIndex !== -1) {
        state.phiTheoryHidden = !chart.isDatasetVisible(theoryIndex);
      }
    }

    chart.data.labels = centers.map(v => v.toFixed(2));
    const datasets = [
      {
        label: '鏂逛綅瑙掓鐜囧瘑搴?(褰掍竴鍖?',
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
        label: '鐞嗚鏇茬嚎',
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

    // 寮哄埗璁剧疆鍏ㄥ眬鍏冪礌閰嶇疆锛岀‘淇濈嚎鏉′笉鏄剧ず鐐?    if (!chart.options.elements) chart.options.elements = {};
    chart.options.elements.point = { radius: 0, hoverRadius: 0 };

    // 娣诲姞鍧愭爣杞存爣棰?    if (chart.options.scales) {
      if (chart.options.scales.x) {
        chart.options.scales.x.title = {
          display: true,
          text: '瑙掑害 蠁 (寮у害)',
          color: '#d0d0d0',
          font: { size: 12, weight: '500' }
        };
        // 浼樺寲x杞存樉绀?        chart.options.scales.x.ticks.autoSkip = true;
        chart.options.scales.x.ticks.maxTicksLimit = 15;
        delete chart.options.scales.x.ticks.callback;
      }
      if (chart.options.scales.y) {
        chart.options.scales.y.title = {
          display: true,
          text: '姒傜巼瀵嗗害 P(蠁)',
          color: '#d0d0d0',
          font: { size: 12, weight: '500' }
        };
      }
    }

    chart.update('none'); // 浣跨敤鏃犲姩鐢绘洿鏂帮紝閬垮厤鏇茬嚎璺冲姩
  }

  function renderChartPotential(experimental, theory) {
    const ctx = document.getElementById('probability-chart');
    if (!ctx || !window.Chart) {
      return;
    }

    // 淇濆瓨鐞嗚鏇茬嚎鍙鎬х姸鎬?    if (state.chart && state.chart.data && state.chart.data.datasets) {
      const theoryIndex = state.chart.data.datasets.findIndex(ds => ds.label === '鐞嗚绉垎鏇茬嚎');
      if (theoryIndex !== -1) {
        state.potentialTheoryHidden = !state.chart.isDatasetVisible(theoryIndex);
      }
    }

    // 鑻ュ綋鍓嶄笉鏄煴鐘跺浘锛岄渶閿€姣佸悗閲嶆柊鍒涘缓
    if (state.chart && state.chart.config && state.chart.config.type !== 'bar') {
      try { state.chart.destroy(); } catch (e) { console.warn('鍥捐〃閿€姣佸け璐?', e); }
      state.chart = null;
    }

    const chart = ensureChart();
    if (!chart) {
      return;
    }

    // 鍑嗗 X 杞存爣绛惧拰鏁版嵁闆?    const datasets = [];
    let labels = [];

    // 浠庡疄楠屾暟鎹腑鎻愬彇X杞存爣绛?(浣跨敤points鐨剎鍊?
    if (experimental && experimental.points && experimental.points.length > 0) {
      labels = experimental.points.map(p => p.x.toFixed(2));

      // 閲囨牱绉垎鏁版嵁 - 鏌辩姸鍥撅紙Y鍊煎彲鑳芥槸璐熸暟锛屾墍浠ョ敤绱Н鍊硷級
      datasets.push({
        label: '閲囨牱绉垎鏇茬嚎',
        data: experimental.points.map(p => p.y),
        backgroundColor: 'rgba(255,255,255,0.7)',
        borderColor: 'rgba(255,255,255,0.95)',
        borderWidth: 0,
        barPercentage: 1.0,
        categoryPercentage: 1.0,
        borderRadius: 2,
        borderSkipped: false,
        order: 10, // 鏌辩姸鍥炬斁鍦ㄦ渶搴曞眰
      });
    }

    // 鐞嗚鏇茬嚎 - 鎶樼嚎鍙犲姞
    if (theory && theory.points && theory.points.length > 0) {
      // 濡傛灉labels杩樻病璁剧疆锛屼粠theory涓彁鍙?      if (labels.length === 0) {
        labels = theory.points.map(p => p.x.toFixed(2));
      }

      datasets.push({
        type: 'line',
        label: '鐞嗚绉垎鏇茬嚎',
        data: theory.points.map((p, i) => ({ x: i, y: p.y })),
        borderColor: 'rgba(255, 255, 255, 0.95)',
        backgroundColor: 'transparent',
        pointRadius: 0,
        borderWidth: 2.5,
        yAxisID: 'y',
        tension: 0.2,
        order: 5, // 鐞嗚鏇茬嚎鍦ㄤ笂灞?        hidden: state.potentialTheoryHidden || false
      });
    }

    chart.data.labels = labels;
    chart.data.datasets = datasets;

    // 鏇存柊鍧愭爣杞存爣棰?    if (chart.options.scales) {
      if (chart.options.scales.x) {
        chart.options.scales.x.title = {
          display: true,
          text: '璺濈 r (a鈧€)',
          color: '#d0d0d0',
          font: { size: 12, weight: '500' }
        };
        chart.options.scales.x.ticks.autoSkip = true;
        chart.options.scales.x.ticks.maxTicksLimit = 15;
      }
      if (chart.options.scales.y) {
        chart.options.scales.y.title = {
          display: true,
          text: '绱Н鍔胯兘 E(r) (Hartree)',
          color: '#d0d0d0',
          font: { size: 12, weight: '500' }
        };
      }
    }

    chart.update('none');
  }

  // 娓叉煋鍔胯兘瀵嗗害 dE/dr 鏇茬嚎锛堢被浼?renderChartPotential锛?  function renderChartDEdr(experimental, theory) {
    const ctx = document.getElementById('probability-chart');
    if (!ctx || !window.Chart) {
      return;
    }

    // 淇濆瓨鐞嗚鏇茬嚎鍙鎬х姸鎬?    if (state.chart && state.chart.data && state.chart.data.datasets) {
      const theoryIndex = state.chart.data.datasets.findIndex(ds => ds.label === '鐞嗚 dE/dr');
      if (theoryIndex !== -1) {
        state.dEdrTheoryHidden = !state.chart.isDatasetVisible(theoryIndex);
      }
    }

    // 鑻ュ綋鍓嶄笉鏄煴鐘跺浘锛岄渶閿€姣佸悗閲嶆柊鍒涘缓
    if (state.chart && state.chart.config && state.chart.config.type !== 'bar') {
      try { state.chart.destroy(); } catch (e) { console.warn('鍥捐〃閿€姣佸け璐?', e); }
      state.chart = null;
    }

    const chart = ensureChart();
    if (!chart) {
      return;
    }

    // 鍑嗗 X 杞存爣绛惧拰鏁版嵁闆?    const datasets = [];
    let labels = [];

    // 浠庡疄楠屾暟鎹腑鎻愬彇X杞存爣绛?(浣跨敤points鐨剎鍊?
    if (experimental && experimental.points && experimental.points.length > 0) {
      labels = experimental.points.map(p => p.x.toFixed(2));

      // 閲囨牱 dE/dr 鏁版嵁 - 鏌辩姸鍥?      datasets.push({
        label: '閲囨牱 dE/dr',
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

    // 鐞嗚鏇茬嚎 - 鎶樼嚎鍙犲姞
    if (theory && theory.points && theory.points.length > 0) {
      if (labels.length === 0) {
        labels = theory.points.map(p => p.x.toFixed(2));
      }

      datasets.push({
        type: 'line',
        label: '鐞嗚 dE/dr',
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

    // 鏇存柊鍧愭爣杞存爣棰?    if (chart.options.scales) {
      if (chart.options.scales.x) {
        chart.options.scales.x.title = {
          display: true,
          text: '璺濈 r (a鈧€)',
          color: '#d0d0d0',
          font: { size: 12, weight: '500' }
        };
        chart.options.scales.x.ticks.autoSkip = true;
        chart.options.scales.x.ticks.maxTicksLimit = 15;
      }
      if (chart.options.scales.y) {
        chart.options.scales.y.title = {
          display: true,
          text: '鍔胯兘瀵嗗害 dE/dr (Hartree/a鈧€)',
          color: '#d0d0d0',
          font: { size: 12, weight: '500' }
        };
      }
    }

    chart.update('none');
  }

  // 娓叉煋鍔胯兘绉垎 vs log(r) 鏇茬嚎
  function renderChartPotentialLog(experimental, theory) {
    const ctx = document.getElementById('probability-chart');
    if (!ctx || !window.Chart) return;

    // 淇濆瓨鐞嗚鏇茬嚎鍙鎬х姸鎬?    if (state.chart && state.chart.data && state.chart.data.datasets) {
      const theoryIndex = state.chart.data.datasets.findIndex(ds => ds.label === '鐞嗚 E(log r)');
      if (theoryIndex !== -1) {
        state.potentialLogTheoryHidden = !state.chart.isDatasetVisible(theoryIndex);
      }
    }

    // 浣跨敤鎶樼嚎鍥?    if (!ensureChartLine()) return;
    const chart = state.chart;

    const datasets = [];
    let labels = [];

    if (experimental && experimental.points && experimental.points.length > 0) {
      labels = experimental.points.map(p => p.x.toFixed(2));
      datasets.push({
        label: '閲囨牱 E(log r)',
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
        label: '鐞嗚 E(log r)',
        // 銆愬叧閿慨澶嶃€戜娇鐢▄x,y}鍧愭爣瀵硅薄锛岃Chart.js姝ｇ‘缁戝畾x杞达紝鑰屼笉鏄寜labels绱㈠紩瀵瑰簲
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
        chart.options.scales.x.title = { display: true, text: 'log鈧佲個(r) (r in a鈧€)', color: '#d0d0d0', font: { size: 12 } };
      }
      if (chart.options.scales.y) {
        chart.options.scales.y.title = { display: true, text: '绱Н鍔胯兘 E(r) (Hartree)', color: '#d0d0d0', font: { size: 12 } };
      }
    }

    chart.update('none');
  }

  // 娓叉煋鍔胯兘瀵嗗害 dE/d(log r) 鏇茬嚎
  function renderChartDEdrLog(experimental, theory) {
    const ctx = document.getElementById('probability-chart');
    if (!ctx || !window.Chart) return;

    // 淇濆瓨鐞嗚鏇茬嚎鍙鎬х姸鎬?    if (state.chart && state.chart.data && state.chart.data.datasets) {
      const theoryIndex = state.chart.data.datasets.findIndex(ds => ds.label === '鐞嗚 dE/d(log r)');
      if (theoryIndex !== -1) {
        state.dEdrLogTheoryHidden = !state.chart.isDatasetVisible(theoryIndex);
      }
    }

    // 浣跨敤鎶樼嚎鍥?    if (!ensureChartLine()) return;
    const chart = state.chart;

    const datasets = [];
    let labels = [];

    if (experimental && experimental.points && experimental.points.length > 0) {
      labels = experimental.points.map(p => p.x.toFixed(2));
      datasets.push({
        label: '閲囨牱 dE/d(log r)',
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
        label: '鐞嗚 dE/d(log r)',
        // 銆愬叧閿慨澶嶃€戜娇鐢▄x,y}鍧愭爣瀵硅薄
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
        chart.options.scales.x.title = { display: true, text: 'log鈧佲個(r) (r in a鈧€)', color: '#d0d0d0', font: { size: 12 } };
      }
      if (chart.options.scales.y) {
        chart.options.scales.y.title = { display: true, text: '鍔胯兘瀵嗗害 dE/d(log r) (Hartree)', color: '#d0d0d0', font: { size: 12 } };
      }
    }

    chart.update('none');
  }

  // 纭繚鍒涘缓涓€涓姌绾垮浘瀹炰緥
  function ensureChartLine() {
    const ctx = document.getElementById('probability-chart');
    if (!ctx || !window.Chart) return false;

    if (state.chart && state.chart.config.type === 'line') return true;
    if (state.chart) {
      state.chart.destroy();
      state.chart = null;
    }

    // 鍒涘缓鏂板浘琛?    state.chart = new Chart(ctx, {
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

  // 瀵规瘮妯″紡涓撶敤锛氭覆鏌撴暎鐐瑰浘
  function renderChartCompare(orbitalDataMap, type) {
    console.log('renderChartCompare 琚皟鐢紝绫诲瀷:', type); // 璋冭瘯淇℃伅
    const ctx = document.getElementById('probability-chart');
    if (!ctx || !window.Chart || !window.Hydrogen) {
      console.log('鍥捐〃娓叉煋澶辫触锛歝anvas銆丆hart.js鎴朒ydrogen涓嶅彲鐢?); // 璋冭瘯淇℃伅
      return;
    }

    // 銆愪慨澶嶃€戝湪浠讳綍鍥捐〃瀛樺湪鏃堕兘灏濊瘯鎹曡幏鐞嗚鏇茬嚎鐘舵€?    // 妫€鏌ュ綋鍓嶅浘琛ㄤ腑鏄惁鏈夌悊璁烘洸绾挎暟鎹泦锛屼繚瀛樺叾鍙鎬х姸鎬?    if (state.chart && state.chart.data && state.chart.data.datasets) {
      const theoryIndex = state.chart.data.datasets.findIndex(ds => ds.label && ds.label.includes('鐞嗚'));
      if (theoryIndex !== -1) {
        // isDatasetVisible杩斿洖true琛ㄧず鍙锛屽彇鍙嶅緱鍒癶idden鐘舵€?        state.compareTheoryHidden = !state.chart.isDatasetVisible(theoryIndex);
      }
    }

    // 濡傛灉褰撳墠涓嶆槸鎶樼嚎鍥撅紝閿€姣佸悗閲嶆柊鍒涘缓
    if (state.chart && state.chart.config && state.chart.config.type !== 'line') {
      console.log('閿€姣佹棫鍥捐〃锛屽垱寤烘姌绾垮浘'); // 璋冭瘯淇℃伅
      try { state.chart.destroy(); } catch (e) { console.warn('鍥捐〃閿€姣佸け璐?', e); }
      state.chart = null;
    }

    // 鍒涘缓鎶樼嚎鍥?    if (!state.chart) {
      console.log('鍒涘缓鏂扮殑鎶樼嚎鍥惧疄渚?); // 璋冭瘯淇℃伅
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
                text: type === 'radial' ? '寰勫悜璺濈 (a鈧€)' : (type === 'potential' ? '璺濈 r (a鈧€)' : '瑙掑害 (寮у害)'),
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
                text: type === 'potential' ? '绱Н鍔胯兘璐＄尞 E(r) (Hartree)' : '姒傜巼瀵嗗害',
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
              radius: 0, // 涓嶆樉绀烘暟鎹偣
              hoverRadius: 3
            },
            line: {
              tension: 0.1 // 杞诲井鐨勬洸绾垮钩婊?            }
          }
        }
      });
    } else {
      // 濡傛灉鍥捐〃宸插瓨鍦紝鏇存柊鍧愭爣杞存爣棰?      if (state.chart.options.scales) {
        if (state.chart.options.scales.x && state.chart.options.scales.x.title) {
          if (type === 'potentialLog' || type === 'dEdrLog') {
            state.chart.options.scales.x.title.text = 'log鈧佲個(r) (r in a鈧€)';
          } else if (type === 'radial' || type === 'potential' || type === 'dEdr') {
            state.chart.options.scales.x.title.text = '璺濈 r (a鈧€)';
          } else {
            state.chart.options.scales.x.title.text = '瑙掑害 (寮у害)';
          }
        }
        if (state.chart.options.scales.y && state.chart.options.scales.y.title) {
          if (type === 'potential' || type === 'potentialLog') {
            state.chart.options.scales.y.title.text = '绱Н鍔胯兘 E(r) (Hartree)';
          } else if (type === 'dEdr') {
            state.chart.options.scales.y.title.text = '鍔胯兘瀵嗗害 dE/dr (Hartree/a鈧€)';
          } else if (type === 'dEdrLog') {
            state.chart.options.scales.y.title.text = '鍔胯兘瀵嗗害 dE/d(log r) (Hartree)';
          } else {
            state.chart.options.scales.y.title.text = '姒傜巼瀵嗗害';
          }
        }
      }
    }

    // 鍑嗗鏁版嵁闆?- 鍏堝皢鍘熷鏁版嵁杞负鐩存柟鍥撅紝鍐嶈浆涓烘暎鐐?    const datasets = [];

    // 浣跨敤缁熶竴鐨勫父閲忓畾涔?    const compareColors = window.ElectronCloud?.constants?.compareColors || [
      { name: 'red', value: [1, 0.2, 0.2] },
      { name: 'green', value: [0.2, 1, 0.2] },
      { name: 'blue', value: [0.2, 0.2, 1] }
    ];

    // 浣跨敤缁熶竴鐨勮建閬撴樉绀哄悕绉版槧灏?    const orbitalDisplayNameMap = window.ElectronCloud?.constants?.orbitalDisplayNames || {};

    // 涓轰簡淇濇寔涓€鑷存€э紝浣跨敤涓庢櫘閫氭ā寮忕浉鍚岀殑鍙傛暟璁＄畻鐩存柟鍥?    let maxDistance = 0;
    let totalSamples = 0;

    // 棣栧厛鎵惧埌鏈€澶ц窛绂荤敤浜庣‘瀹氬姩鎬佽寖鍥?    for (const [orbitalKey, samples] of Object.entries(orbitalDataMap)) {
      if (!samples || samples.length === 0) continue;
      totalSamples += samples.length;
      if (type === 'radial' || type === 'potential' || type === 'dEdr' || type === 'potentialLog' || type === 'dEdrLog') {
        // 銆愭€ц兘淇銆戜娇鐢ㄥ惊鐜浛浠ath.max(...array)锛岄伩鍏嶅ぇ鏁扮粍鏍堟孩鍑?        for (let i = 0; i < samples.length; i++) {
          if (samples[i].r > maxDistance) {
            maxDistance = samples[i].r;
          }
        }
      }
    }

    // 鑾峰彇褰撳墠閫夋嫨鐨勮建閬撻『搴忥紝纭繚棰滆壊鍒嗛厤涓庨€夋嫨椤哄簭涓€鑷?    // 銆愰噸鏋勩€戞瘮鐓фā寮忎笅浣跨敤activeSlots鑾峰彇slot閰嶇疆锛堝寘鍚師瀛愮被鍨嬶級
    const activeSlots = window.ElectronCloud?.state?.compareMode?.activeSlots || [];
    const currentOrbitals = window.ElectronCloud?.state?.currentOrbitals || Object.keys(orbitalDataMap);
    console.log('褰撳墠杞ㄩ亾椤哄簭:', currentOrbitals, 'activeSlots:', activeSlots); // 璋冭瘯淇℃伅

    // 鎸夌収閫夋嫨椤哄簭澶勭悊杞ㄩ亾鏁版嵁
    for (let colorIndex = 0; colorIndex < activeSlots.length; colorIndex++) {
      const slotConfig = activeSlots[colorIndex];
      // 鏋勫缓涓巗ampling.js涓浉鍚岀殑閿?      const sampleKey = `${slotConfig.atom}_${slotConfig.orbital}_slot${slotConfig.slotIndex}`;
      const samples = orbitalDataMap[sampleKey];

      if (!samples || samples.length === 0) continue;

      const color = compareColors[colorIndex % compareColors.length];
      // 銆愬叧閿慨澶嶃€戞爣绛句腑鏄剧ず鍘熷瓙绫诲瀷
      const displayName = `${slotConfig.atom} ${orbitalDisplayNameMap[slotConfig.orbital] || slotConfig.orbital}`;
      let hist, centers;
      let potentialValues; // 瀛樺偍鍔胯兘鍊?
      if (type === 'radial') {
        // 浣跨敤涓庢櫘閫氭ā寮忕浉鍚岀殑鍙傛暟
        const dynamicRmax = Math.max(1, maxDistance * 1.08);
        const baseBins = 240;
        const sampleDensity = totalSamples / Math.max(1, dynamicRmax);
        const adaptiveBins = Math.min(400, Math.max(baseBins, Math.floor(sampleDensity * 0.5)));

        // 鎻愬彇寰勫悜鏁版嵁
        const radialData = samples.map(s => s.r);
        hist = window.Hydrogen.histogramRadialFromSamples(radialData, adaptiveBins, dynamicRmax, true);

        // 璁＄畻bin涓績
        centers = new Array(adaptiveBins);
        for (let i = 0; i < adaptiveBins; i++) {
          centers[i] = 0.5 * (hist.edges[i] + hist.edges[i + 1]);
        }
      } else if (type === 'angular') {
        // 胃瑙掑悜鏁版嵁
        const angularBins = 180;
        const angularData = samples.map(s => s.theta);
        hist = window.Hydrogen.histogramThetaFromSamples(angularData, angularBins, true);

        // 璁＄畻bin涓績
        centers = new Array(angularBins);
        for (let i = 0; i < angularBins; i++) {
          centers[i] = 0.5 * (hist.edges[i] + hist.edges[i + 1]);
        }
      } else if (type === 'potential') {
        // 鍔胯兘绉垎鏇茬嚎
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

        // 璁＄畻鏍哥數鑽锋暟
        const Z = window.SlaterBasis && window.SlaterBasis[slotConfig.atom] ? window.SlaterBasis[slotConfig.atom].Z : 1;

        // 杞崲鐩存柟鍥句负鍔胯兘绉垎
        // 銆愬叧閿慨澶嶃€慼ist.counts 鏄綊涓€鍖栫殑姒傜巼瀵嗗害锛岄渶鐢?1/dr 缂╂斁
        const dr = hist.edges[1] - hist.edges[0];
        const scaleFactor = (dr > 0) ? (1.0 / dr) : 1.0;
        potentialValues = window.Hydrogen.transformHistogramToPotential(hist.counts, hist.edges, scaleFactor, Z);
      } else if (type === 'dEdr') {
        // 鍔胯兘瀵嗗害 dE/dr = -Z/r * P(r)
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

        const Z = window.SlaterBasis && window.SlaterBasis[slotConfig.atom] ? window.SlaterBasis[slotConfig.atom].Z : 1;

        // 璁＄畻 dE/dr = -Z/r * P(r)
        potentialValues = centers.map((r, i) => {
          const Pr = hist.counts[i] || 0;
          return r > 0.01 ? (-Z / r) * Pr : 0;
        });
      } else if (type === 'potentialLog') {
        // 鍔胯兘绉垎 vs log(r)
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

        const Z = window.SlaterBasis && window.SlaterBasis[slotConfig.atom] ? window.SlaterBasis[slotConfig.atom].Z : 1;
        const dr = hist.edges[1] - hist.edges[0];
        const scaleFactor = (dr > 0) ? (1.0 / dr) : 1.0;
        potentialValues = window.Hydrogen.transformHistogramToPotential(hist.counts, hist.edges, scaleFactor, Z);

        // 杞崲 x 杞翠负 log10(r)
        centers = centers.map(r => r > 0 ? Math.log10(r) : -2);
      } else if (type === 'dEdrLog') {
        // dE/d(log r) = -Z * P(r)
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

        const Z = window.SlaterBasis && window.SlaterBasis[slotConfig.atom] ? window.SlaterBasis[slotConfig.atom].Z : 1;

        // dE/d(log r) = r * dE/dr = -Z * P(r)
        potentialValues = linearCenters.map((r, i) => {
          const Pr = hist.counts[i] || 0;
          return -Z * Pr;
        });

        // 杞崲 x 杞翠负 log10(r)
        centers = linearCenters.map(r => r > 0 ? Math.log10(r) : -2);
      } else {
        // 蠁瑙掑悜鏁版嵁 (azimuthal)
        const phiBins = 180;
        const phiData = samples.map(s => s.phi);
        hist = window.Hydrogen.histogramPhiFromSamples(phiData, phiBins, true);

        // 璁＄畻bin涓績
        centers = new Array(phiBins);
        for (let i = 0; i < phiBins; i++) {
          centers[i] = 0.5 * (hist.edges[i] + hist.edges[i + 1]);
        }
      }

      // 灏嗘暟鎹浆涓烘姌绾挎暟鎹?      // 瀵逛簬鍔胯兘鐩稿叧妯″紡锛寉鏄痯otentialValues锛涘叾浠栨ā寮忔槸hist.counts
      const data = centers.map((center, index) => ({
        x: center,
        y: (type === 'potential' || type === 'dEdr' || type === 'potentialLog' || type === 'dEdrLog') ? potentialValues[index] : hist.counts[index]
      })).sort((a, b) => a.x - b.x);

      // 灏嗛鑹插€间粠[0,1]鑼冨洿杞崲涓篬0,255]鑼冨洿
      const colorValues = color.value.map(v => Math.round(v * 255));

      datasets.push({
        label: displayName, // 浣跨敤鏄犲皠鍚庣殑鏄剧ず鍚嶇О鑰屼笉鏄師濮嬬殑orbitalKey
        data: data,
        borderColor: `rgba(${colorValues.join(',')}, 1.0)`,
        backgroundColor: `rgba(${colorValues.join(',')}, 0.1)`, // 杞诲井鐨勫～鍏呰壊
        borderWidth: 1.5, // 缁嗙嚎
        pointRadius: 0, // 涓嶆樉绀虹偣
        pointHoverRadius: 3,
        fill: false, // 涓嶅～鍏?        tension: 0.1 // 杞诲井骞虫粦
      });

      // 銆愭柊澧炪€戜负璇ヨ建閬撴坊鍔犵悊璁烘洸绾匡紙铏氱嚎锛?      const orbitalParams = window.Hydrogen?.orbitalParamsFromKey(slotConfig.orbital);
      if (orbitalParams) {
        const atomType = slotConfig.atom || 'H';
        let theoryData;

        if (type === 'radial') {
          // 寰勫悜鐞嗚鏇茬嚎
          theoryData = centers.map(r => ({
            x: r,
            y: window.Hydrogen.radialPDF(orbitalParams.n, orbitalParams.l, r, 1, 1, atomType)
          }));
        } else if (type === 'angular') {
          // 胃 瑙掑悜鐞嗚鏇茬嚎
          theoryData = centers.map(theta => ({
            x: theta,
            y: window.Hydrogen.angularPDF_Theta(orbitalParams.l, orbitalParams.angKey.m, theta)
          }));
        } else if (type === 'potential') {
          // 鍔胯兘鐞嗚鏇茬嚎
          const Z = window.SlaterBasis && window.SlaterBasis[atomType] ? window.SlaterBasis[atomType].Z : 1;
          // 閲嶆柊璁＄畻鍏ㄨ寖鍥寸殑鐞嗚鏇茬嚎浠ュ尮閰嶆覆鏌撹寖鍥?          const rMax = Math.max(centers[centers.length - 1], 10);
          const theoryRes = window.Hydrogen.calculateCumulativePotential(orbitalParams.n, orbitalParams.l, Z, atomType, rMax, 500);

          // 涓轰簡涓?sample data 瀵归綈锛屾垜浠渶瑕佹彃鍊兼垨鑰呯洿鎺ヤ娇鐢?theoryRes 鐨勭偣
          // 鐩存帴浣跨敤 theoryRes 鐨勭偣鍗冲彲锛屽洜涓烘槸鍦ㄥ悓涓€涓獂杞翠笂缁樺埗
          theoryData = theoryRes.r.map((r, i) => ({
            x: r,
            y: theoryRes.E[i]
          }));
        } else if (type === 'dEdr') {
          // dE/dr 鐞嗚鏇茬嚎 = -Z/r * radialPDF
          const Z = window.SlaterBasis && window.SlaterBasis[atomType] ? window.SlaterBasis[atomType].Z : 1;
          theoryData = centers.map(r => ({
            x: r,
            y: r > 0.01 ? (-Z / r) * window.Hydrogen.radialPDF(orbitalParams.n, orbitalParams.l, r, 1, 1, atomType) : 0
          }));
        } else if (type === 'potentialLog') {
          // potentialLog 鐞嗚鏇茬嚎锛欵(r) vs log(r)
          const Z = window.SlaterBasis && window.SlaterBasis[atomType] ? window.SlaterBasis[atomType].Z : 1;
          const rMax = Math.pow(10, Math.max(...centers)); // centers宸茬粡鏄痩og鍊?          const theoryRes = window.Hydrogen.calculateCumulativePotential(orbitalParams.n, orbitalParams.l, Z, atomType, rMax, 500);
          // 銆愬叧閿慨澶嶃€戜娇鐢ㄦ纭殑绱㈠紩鏄犲皠锛岄伩鍏峟ilter鍚庣储寮曢敊浣嶅鑷撮敮榻?          theoryData = [];
          for (let i = 0; i < theoryRes.r.length; i++) {
            if (theoryRes.r[i] > 0) {
              theoryData.push({
                x: Math.log10(theoryRes.r[i]),
                y: theoryRes.E[i]
              });
            }
          }
        } else if (type === 'dEdrLog') {
          // dEdrLog 鐞嗚鏇茬嚎锛歞E/d(log r) = -Z * radialPDF
          const Z = window.SlaterBasis && window.SlaterBasis[atomType] ? window.SlaterBasis[atomType].Z : 1;
          // centers宸茬粡鏄痩og10(r)鍊硷紝闇€瑕佽浆鍥炵嚎鎬
          theoryData = centers.map(logR => {
            const r = Math.pow(10, logR);
            return {
              x: logR,
              y: -Z * window.Hydrogen.radialPDF(orbitalParams.n, orbitalParams.l, r, 1, 1, atomType)
            };
          });
        } else {
          // 蠁 鏂逛綅瑙掔悊璁烘洸绾?          theoryData = centers.map(phi => ({
            x: phi,
            y: window.Hydrogen.angularPDF_Phi(orbitalParams.angKey.m, orbitalParams.angKey.t, phi)
          }));
        }

        datasets.push({
          label: `${displayName} 鐞嗚`,
          data: theoryData,
          borderColor: `rgba(${colorValues.join(',')}, 0.9)`,
          backgroundColor: 'transparent',
          borderWidth: 2,
          pointRadius: 0,
          pointHoverRadius: 0,
          fill: false,
          tension: 0.2,
          borderDash: [6, 3], // 铏氱嚎鏍峰紡
          hidden: state.compareTheoryHidden // 搴旂敤闅愯棌鐘舵€佸拰榛樿鍊?        });
      }
    }

    state.chart.data.datasets = datasets;
    console.log('寮€濮嬫洿鏂版姌绾垮浘锛岃建閬撴暟閲?', Object.keys(orbitalDataMap).length); // 璋冭瘯淇℃伅
    try {
      state.chart.update('none');
      console.log('鎶樼嚎鍥炬洿鏂板畬鎴?); // 璋冭瘯淇℃伅
    } catch (error) {
      console.error('鎶樼嚎鍥炬洿鏂板け璐?', error);
    }
  }

  function reset() {
    if (state.chart) {
      state.chart.data.labels = [];
      state.chart.data.datasets = [];
      state.chart.update();
    }
  }

  // 渚涘閮ㄨ皟鐢ㄧ殑 API
  window.DataPanel = {
    init,
    reset, // 鏆撮湶閲嶇疆鏂规硶
    renderChartRadial,
    renderChartAngular,
    renderChartPhi, // 鏂板蠁瑙掑悜鍒嗗竷API
    renderChartPotential, // 鏂板鍔胯兘绉垎鏇茬嚎API
    renderChartDEdr, // 鏂板鍔胯兘瀵嗗害dE/dr API
    renderChartPotentialLog, // 鏂板鍔胯兘绉垎log(r) API
    renderChartDEdrLog, // 鏂板鍔胯兘瀵嗗害dE/d(log r) API
    renderChartCompare, // 鏂板瀵规瘮妯″紡API
    state, // 鏆撮湶鐘舵€佸璞?  };

  // 鑷姩鍒濆鍖?  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }
})();
