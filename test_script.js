// 测试坐标轴功能的简单脚本
// 在浏览器控制台中运行此脚本来验证功能

function testAxesFeature() {
    console.log("=== 测试坐标轴功能 ===");
    
    // 检查UI元素是否存在
    const axesSizeRange = document.getElementById('axes-size-range');
    if (!axesSizeRange) {
        console.error("❌ 坐标系大小滑动条元素未找到");
        return;
    }
    console.log("✅ 坐标系大小滑动条元素存在");
    
    // 检查滑动条的范围设置
    if (axesSizeRange.min === "0" && axesSizeRange.max === "105") {
        console.log("✅ 滑动条范围正确 (0-105)");
    } else {
        console.error(`❌ 滑动条范围不正确: ${axesSizeRange.min}-${axesSizeRange.max}, 应该是 0-105`);
    }
    
    // 检查新的重置函数是否存在
    if (typeof window.ElectronCloud.resetState === 'function') {
        console.log("✅ resetState 函数存在");
    } else {
        console.error("❌ resetState 函数未找到");
    }
    
    if (typeof window.ElectronCloud.resetSamplingState === 'function') {
        console.log("✅ resetSamplingState 函数存在");
    } else {
        console.error("❌ resetSamplingState 函数未找到");
    }
    
    // 检查状态变量
    if (window.ElectronCloud.state && typeof window.ElectronCloud.state.axesScaleFactor === 'number') {
        console.log("✅ axesScaleFactor 状态变量存在");
    } else {
        console.error("❌ axesScaleFactor 状态变量未找到");
    }
    
    // 测试重置逻辑
    console.log("\n=== 测试重置逻辑 ===");
    
    // 1. 设置滑动条值
    axesSizeRange.value = 50;
    const event50 = new Event('input', { bubbles: true });
    Object.defineProperty(event50, 'target', { value: axesSizeRange });
    window.ElectronCloud.UI.onAxesSizeChange(event50);
    console.log(`✅ 设置滑动条为50, 比例系数: ${window.ElectronCloud.state.axesScaleFactor}`);
    
    // 2. 测试采样重置（应该保留设置）
    window.ElectronCloud.resetSamplingState();
    if (window.ElectronCloud.state.axesScaleFactor === 0.5 && axesSizeRange.value === "50") {
        console.log("✅ 采样重置正确保留了用户设置");
    } else {
        console.error(`❌ 采样重置失败，比例系数: ${window.ElectronCloud.state.axesScaleFactor}, 滑动条值: ${axesSizeRange.value}`);
    }
    
    // 3. 测试完全重置（应该清除设置）
    window.ElectronCloud.resetState();
    if (window.ElectronCloud.state.axesScaleFactor === 0 && axesSizeRange.value === "0") {
        console.log("✅ 完全重置正确清除了用户设置");
    } else {
        console.error(`❌ 完全重置失败，比例系数: ${window.ElectronCloud.state.axesScaleFactor}, 滑动条值: ${axesSizeRange.value}`);
    }
    
    // 测试状态控制功能
    console.log("\n=== 测试状态控制 ===");
    
    // 模拟开始渲染
    window.ElectronCloud.state.isDrawing = true;
    window.ElectronCloud.state.samplingCompleted = false;
    window.ElectronCloud.UI.updateAxesSizeRangeState();
    
    if (axesSizeRange.disabled) {
        console.log("✅ 渲染中滑动条正确置灰");
    } else {
        console.error("❌ 渲染中滑动条未置灰");
    }
    
    // 模拟渲染完成
    window.ElectronCloud.state.isDrawing = false;
    window.ElectronCloud.state.samplingCompleted = true;
    window.ElectronCloud.UI.updateAxesSizeRangeState();
    
    if (!axesSizeRange.disabled) {
        console.log("✅ 渲染完成后滑动条正确恢复");
    } else {
        console.error("❌ 渲染完成后滑动条未恢复");
    }
    
    // 恢复初始状态
    window.ElectronCloud.state.isDrawing = false;
    window.ElectronCloud.state.samplingCompleted = false;
    window.ElectronCloud.UI.updateAxesSizeRangeState();
    
    console.log("\n=== 测试实时调节 ===");
    
    // 设置一个比例系数
    axesSizeRange.value = 80;
    const event80 = new Event('input', { bubbles: true });
    Object.defineProperty(event80, 'target', { value: axesSizeRange });
    window.ElectronCloud.UI.onAxesSizeChange(event80);
    
    // 模拟最远距离更新
    window.ElectronCloud.state.farthestDistance = 20;
    if (window.ElectronCloud.state.axesScaleFactor === 0.8) {
        console.log("✅ 比例系数设置正确");
        console.log(`✅ 当轨道半径为20时，坐标轴大小应为: ${20 * 0.8} = 16`);
    } else {
        console.error(`❌ 比例系数设置错误: ${window.ElectronCloud.state.axesScaleFactor}`);
    }
    
    console.log("\n=== 测试完成 ===");
}

// 自动运行测试（如果页面已加载）
if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', testAxesFeature);
} else {
    // 延迟执行以确保所有脚本都已加载
    setTimeout(testAxesFeature, 1000);
}
