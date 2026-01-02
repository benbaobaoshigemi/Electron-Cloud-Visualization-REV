// 应用入口文件
// 脚本依赖加载顺序（由 index.html 保证）：
// 1) core.js          全局状态与常量
// 2) scene.js         Three.js 场景生命周期
// 3) orbital.js        轨道选择与流程编排
// 4) sampling.js       点采样（主线程 + Worker 池）
// 5) visualization.js  3D 叠加与等值面渲染
// 6) ui.js             UI 事件绑定与交互
// 7) main.js           启动入口（本文件）

// 启动前依赖检查：确保关键模块已挂载到 window 上
function checkDependencies() {
    const requiredModules = [
        'ElectronCloud',
        'ElectronCloud.Scene',
        'ElectronCloud.Orbital',
        'ElectronCloud.Sampling',
        'ElectronCloud.Visualization',
        'ElectronCloud.UI'
    ];
    
    for (const module of requiredModules) {
        const parts = module.split('.');
        let obj = window;
        for (const part of parts) {
            if (!obj[part]) {
                console.error(`依赖模块缺失: ${module}`);
                return false;
            }
            obj = obj[part];
        }
    }
    
    return true;
}

// 启动应用
function startApplication() {
    console.log('开始启动 ElectronCloud 应用程序...');
    
    // 检查内部模块
    if (!checkDependencies()) {
        console.error('依赖检查失败，无法启动应用程序');
        return;
    }
    
    // 检查外部依赖
    if (typeof THREE === 'undefined') {
        console.error('Three.js 库未加载');
        return;
    }
    
    if (typeof window.Hydrogen === 'undefined') {
        console.error('Hydrogen 物理模型库未加载');
        return;
    }
    
    try {
        // 初始化并启动
        window.ElectronCloud.init();
        console.log('ElectronCloud 应用程序启动成功！');
    } catch (error) {
        console.error('应用程序启动失败:', error);
    }
}

// DOM 就绪后启动
if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', startApplication);
} else {
    // 已就绪：立即启动
    startApplication();
}

// 对外暴露启动函数（如有需要）
window.startElectronCloud = startApplication;
