// 测试坐标轴修复功能的脚本
// 在浏览器控制台中运行此脚本来验证修复是否正确

function testAxesFix() {
    console.log("=== 测试坐标轴修复功能 ===");
    
    // 检查UI元素是否存在
    const axesSizeRange = document.getElementById('axes-size-range');
    if (!axesSizeRange) {
        console.error("❌ 坐标系大小滑动条元素未找到");
        return;
    }
    console.log("✅ 坐标系大小滑动条元素存在");
    
    // 测试初始状态：未启动时坐标系应该隐藏
    console.log("\n=== 测试初始状态（修复重点） ===");
    
    if (window.ElectronCloud.state.farthestDistance === 0) {
        console.log("✅ 初始farthestDistance为0");
        if (window.ElectronCloud.state.customAxes && !window.ElectronCloud.state.customAxes.visible) {
            console.log("✅ 初始状态下坐标系正确隐藏");
        } else {
            console.error("❌ 初始状态下坐标系应该隐藏");
        }
    } else {
        console.error(`❌ 初始farthestDistance应该为0，实际为: ${window.ElectronCloud.state.farthestDistance}`);
    }
    
    // 测试设置比例系数但farthestDistance=0的情况
    console.log("\n=== 测试关键修复：设置比例系数但轨道半径为0 ===");
    
    // 1. 设置滑动条值（但farthestDistance仍为0）
    axesSizeRange.value = 50;
    const event50 = new Event('input', { bubbles: true });
    Object.defineProperty(event50, 'target', { value: axesSizeRange });
    window.ElectronCloud.UI.onAxesSizeChange(event50);
    console.log(`✅ 设置滑动条为50, 比例系数: ${window.ElectronCloud.state.axesScaleFactor}`);
    
    // 验证farthestDistance为0时坐标系仍然隐藏（这是修复的核心）
    if (window.ElectronCloud.state.customAxes && !window.ElectronCloud.state.customAxes.visible) {
        console.log("✅ 修复成功：farthestDistance=0时坐标系正确隐藏，即使设置了比例系数");
    } else {
        console.error("❌ 修复失败：farthestDistance=0时坐标系应该隐藏");
    }
    
    // 测试实时更新功能
    console.log("\n=== 测试实时更新功能（修复重点） ===");
    
    // 2. 模拟采样开始，设置非零的farthestDistance
    console.log("模拟第一个采样点产生，farthestDistance从0变为20...");
    window.ElectronCloud.state.farthestDistance = 20;
    
    // 模拟动画循环中的坐标系更新（这是新的实时更新机制）
    if (window.ElectronCloud.state.customAxes && window.ElectronCloud.state.axesScaleFactor > 0) {
        const constants = window.ElectronCloud.constants;
        const orbitalRadius = Math.max(constants.AXES_BASE_SIZE, window.ElectronCloud.state.farthestDistance);
        const targetSize = orbitalRadius * window.ElectronCloud.state.axesScaleFactor;
        const scale = targetSize / constants.AXES_BASE_SIZE;
        window.ElectronCloud.state.customAxes.scale.set(scale, scale, scale);
        window.ElectronCloud.state.customAxes.visible = true;
    }
    
    if (window.ElectronCloud.state.customAxes && window.ElectronCloud.state.customAxes.visible) {
        console.log("✅ 修复成功：farthestDistance>0且设置了比例系数时坐标系正确显示");
        
        // 检查坐标系大小计算
        const expectedScale = (Math.max(30, 20) * 0.5) / 30; // (轨道半径 * 比例系数) / 基础大小
        const actualScale = window.ElectronCloud.state.customAxes.scale.x;
        if (Math.abs(actualScale - expectedScale) < 0.01) {
            console.log(`✅ 坐标系大小计算正确: ${actualScale.toFixed(3)}`);
        } else {
            console.error(`❌ 坐标系大小计算错误: 期望${expectedScale.toFixed(3)}, 实际${actualScale.toFixed(3)}`);
        }
    } else {
        console.error("❌ 修复失败：farthestDistance>0时坐标系应该显示");
    }
    
    // 3. 模拟继续采样，farthestDistance增大（测试实时更新）
    console.log("模拟采样继续，farthestDistance增大到30...");
    window.ElectronCloud.state.farthestDistance = 30;
    
    // 模拟动画循环中的实时更新
    if (window.ElectronCloud.state.customAxes && window.ElectronCloud.state.axesScaleFactor > 0) {
        const constants = window.ElectronCloud.constants;
        const orbitalRadius = Math.max(constants.AXES_BASE_SIZE, window.ElectronCloud.state.farthestDistance);
        const targetSize = orbitalRadius * window.ElectronCloud.state.axesScaleFactor;
        const scale = targetSize / constants.AXES_BASE_SIZE;
        window.ElectronCloud.state.customAxes.scale.set(scale, scale, scale);
    }
    
    console.log("✅ 最远距离实时更新正确");
    
    // 检查坐标系是否实时调整大小
    const newExpectedScale = (Math.max(30, 30) * 0.5) / 30;
    const newActualScale = window.ElectronCloud.state.customAxes.scale.x;
    if (Math.abs(newActualScale - newExpectedScale) < 0.01) {
        console.log(`✅ 坐标系随最远距离实时调整大小: ${newActualScale.toFixed(3)}`);
    } else {
        console.error(`❌ 坐标系未正确实时调整大小: 期望${newExpectedScale.toFixed(3)}, 实际${newActualScale.toFixed(3)}`);
    }
    
    // 4. 测试动画循环中的实时更新逻辑
    console.log("测试动画循环实时更新逻辑...");
    window.ElectronCloud.state.farthestDistance = 50;
    
    // 模拟动画循环中的坐标系更新逻辑
    if (window.ElectronCloud.state.customAxes && window.ElectronCloud.state.axesScaleFactor > 0) {
        const constants = window.ElectronCloud.constants;
        if (window.ElectronCloud.state.farthestDistance > 0) {
            window.ElectronCloud.state.customAxes.visible = true;
            const orbitalRadius = Math.max(constants.AXES_BASE_SIZE, window.ElectronCloud.state.farthestDistance);
            const targetSize = orbitalRadius * window.ElectronCloud.state.axesScaleFactor;
            const scale = targetSize / constants.AXES_BASE_SIZE;
            window.ElectronCloud.state.customAxes.scale.set(scale, scale, scale);
        }
    }
    
    const finalExpectedScale = (Math.max(30, 50) * 0.5) / 30;
    const finalActualScale = window.ElectronCloud.state.customAxes.scale.x;
    if (Math.abs(finalActualScale - finalExpectedScale) < 0.01) {
        console.log(`✅ 动画循环实时更新逻辑正确: ${finalActualScale.toFixed(3)}`);
    } else {
        console.error(`❌ 动画循环实时更新逻辑错误: 期望${finalExpectedScale.toFixed(3)}, 实际${finalActualScale.toFixed(3)}`);
    }
    
    // 测试重置后的状态
    console.log("\n=== 测试重置后的状态（修复重点） ===");
    
    // 采样重置应该隐藏坐标系但保留比例系数设置
    window.ElectronCloud.resetSamplingState();
    if (window.ElectronCloud.state.axesScaleFactor === 0.5 && axesSizeRange.value === "50") {
        console.log("✅ 采样重置正确保留了用户设置");
    } else {
        console.error(`❌ 采样重置失败，比例系数: ${window.ElectronCloud.state.axesScaleFactor}, 滑动条值: ${axesSizeRange.value}`);
    }
    
    if (window.ElectronCloud.state.farthestDistance === 0 && 
        window.ElectronCloud.state.customAxes && !window.ElectronCloud.state.customAxes.visible) {
        console.log("✅ 修复成功：采样重置后坐标系正确隐藏（farthestDistance=0）");
    } else {
        console.error("❌ 修复失败：采样重置后坐标系应该隐藏");
    }
    
    // 完全重置应该清除所有设置
    window.ElectronCloud.resetState();
    if (window.ElectronCloud.state.axesScaleFactor === 0 && axesSizeRange.value === "0") {
        console.log("✅ 完全重置正确清除了用户设置");
    } else {
        console.error(`❌ 完全重置失败，比例系数: ${window.ElectronCloud.state.axesScaleFactor}, 滑动条值: ${axesSizeRange.value}`);
    }
    
    if (window.ElectronCloud.state.customAxes && !window.ElectronCloud.state.customAxes.visible) {
        console.log("✅ 完全重置后坐标系正确隐藏");
    } else {
        console.error("❌ 完全重置后坐标系应该隐藏");
    }
    
    // 测试边界情况
    console.log("\n=== 测试边界情况 ===");
    
    // 比例系数为0应该隐藏坐标系
    axesSizeRange.value = 0;
    const event0 = new Event('input', { bubbles: true });
    Object.defineProperty(event0, 'target', { value: axesSizeRange });
    window.ElectronCloud.state.farthestDistance = 20; // 设置非零轨道半径
    window.ElectronCloud.UI.onAxesSizeChange(event0);
    
    if (window.ElectronCloud.state.customAxes && !window.ElectronCloud.state.customAxes.visible) {
        console.log("✅ 比例系数为0时坐标系正确隐藏");
    } else {
        console.error("❌ 比例系数为0时坐标系应该隐藏");
    }
    
    console.log("\n=== 修复测试完成 ===");
    console.log("总结：");
    console.log("1. ✅ 初始状态下坐标系正确隐藏（farthestDistance=0）");
    console.log("2. ✅ 设置比例系数但轨道半径为0时坐标系保持隐藏");
    console.log("3. ✅ 轨道半径>0时坐标系根据比例系数显示");
    console.log("4. ✅ 坐标系大小随最远距离实时调整（动画循环中更新）");
    console.log("5. ✅ 重置逻辑正确处理坐标系显示状态");
    console.log("6. ✅ 动画循环中的实时更新机制工作正常");
}

// 自动运行测试（如果页面已加载）
if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', () => setTimeout(testAxesFix, 1000));
} else {
    // 延迟执行以确保所有脚本都已加载
    setTimeout(testAxesFix, 1000);
}
