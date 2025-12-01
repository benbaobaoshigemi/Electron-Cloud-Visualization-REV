// 面板动态光照模块 - 根据面板相对于场景中心的位置计算折射效果
window.ElectronCloud = window.ElectronCloud || {};
window.ElectronCloud.PanelLighting = {};

(function() {
    // 场景中心在屏幕上的位置（相对于视口）
    let sceneCenterX = 0.5; // 0-1
    let sceneCenterY = 0.5; // 0-1
    
    // 缓存的面板元素
    let panels = [];
    let isInitialized = false;
    
    // 更新频率控制
    let lastUpdateTime = 0;
    const UPDATE_INTERVAL = 50; // 毫秒，约20fps更新光照

    /**
     * 初始化面板光照系统
     */
    function init() {
        if (isInitialized) return;
        
        // 获取所有面板
        updatePanelList();
        
        // 监听窗口变化
        window.addEventListener('resize', onResize);
        
        // 开始更新循环
        requestAnimationFrame(updateLoop);
        
        isInitialized = true;
        console.log('面板光照系统已初始化');
    }

    /**
     * 更新面板列表
     */
    function updatePanelList() {
        panels = Array.from(document.querySelectorAll('.panel-content'));
    }

    /**
     * 窗口大小变化时更新
     */
    function onResize() {
        updateSceneCenter();
        updateAllPanels();
    }

    /**
     * 计算场景中心在屏幕上的位置
     * 场景渲染在canvas中心，通常就是视口中心
     */
    function updateSceneCenter() {
        const container = document.getElementById('container');
        if (container) {
            const rect = container.getBoundingClientRect();
            // 场景中心就是canvas的中心
            sceneCenterX = (rect.left + rect.width / 2) / window.innerWidth;
            sceneCenterY = (rect.top + rect.height / 2) / window.innerHeight;
        } else {
            // 默认屏幕中心
            sceneCenterX = 0.5;
            sceneCenterY = 0.5;
        }
    }

    /**
     * 计算面板的光照参数
     * @param {HTMLElement} panelContent - 面板内容元素
     * @returns {Object} {lightX, lightY, intensity}
     */
    function calculatePanelLighting(panelContent) {
        const rect = panelContent.getBoundingClientRect();
        
        // 面板中心位置（归一化到0-1）
        const panelCenterX = (rect.left + rect.width / 2) / window.innerWidth;
        const panelCenterY = (rect.top + rect.height / 2) / window.innerHeight;
        
        // 计算从面板中心指向场景中心的方向
        // 这个方向就是"光源"方向（场景发光照向面板内侧）
        const dx = sceneCenterX - panelCenterX;
        const dy = sceneCenterY - panelCenterY;
        
        // 归一化到0-1范围
        // lightX: 0表示光从左边来，1表示光从右边来
        // lightY: 0表示光从上边来，1表示光从下边来
        const lightX = Math.max(0, Math.min(1, 0.5 + dx * 2));
        const lightY = Math.max(0, Math.min(1, 0.5 + dy * 2));
        
        // 计算距离场景中心的距离，影响光照强度
        const distance = Math.sqrt(dx * dx + dy * dy);
        // 距离越近，光照越强（但有上限）
        // 距离0时强度1，距离0.5时强度约0.5
        const intensity = Math.max(0.3, Math.min(1, 1 - distance * 0.8));
        
        return { lightX, lightY, intensity };
    }

    /**
     * 更新单个面板的光照
     * @param {HTMLElement} panelContent - 面板内容元素
     */
    function updatePanelLighting(panelContent) {
        const { lightX, lightY, intensity } = calculatePanelLighting(panelContent);
        
        // 设置CSS变量
        panelContent.style.setProperty('--light-x', lightX.toFixed(3));
        panelContent.style.setProperty('--light-y', lightY.toFixed(3));
        panelContent.style.setProperty('--light-intensity', intensity.toFixed(3));
    }

    /**
     * 更新所有面板的光照
     */
    function updateAllPanels() {
        panels.forEach(panel => {
            if (panel.offsetParent !== null) { // 只更新可见面板
                updatePanelLighting(panel);
            }
        });
    }

    /**
     * 主更新循环
     */
    function updateLoop(timestamp) {
        // 节流控制
        if (timestamp - lastUpdateTime >= UPDATE_INTERVAL) {
            updateSceneCenter();
            updateAllPanels();
            lastUpdateTime = timestamp;
        }
        
        requestAnimationFrame(updateLoop);
    }

    /**
     * 手动刷新面板列表（当DOM变化时调用）
     */
    function refresh() {
        updatePanelList();
        updateAllPanels();
    }

    // 导出接口
    window.ElectronCloud.PanelLighting = {
        init: init,
        refresh: refresh,
        updateAllPanels: updateAllPanels
    };

    // DOM加载完成后自动初始化
    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', init);
    } else {
        // DOM已经加载完成，延迟初始化以确保其他模块先加载
        setTimeout(init, 100);
    }
})();
