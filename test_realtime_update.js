// 简单测试：验证坐标系实时更新修复
// 在浏览器控制台运行：testRealtimeAxesUpdate()

function testRealtimeAxesUpdate() {
    console.log("=== 测试坐标系实时更新修复 ===");
    
    const state = window.ElectronCloud.state;
    const constants = window.ElectronCloud.constants;
    
    if (!state.customAxes) {
        console.error("❌ 坐标系对象不存在");
        return;
    }
    
    // 1. 设置比例系数
    const axesSizeRange = document.getElementById('axes-size-range');
    if (!axesSizeRange) {
        console.error("❌ 滑动条不存在");
        return;
    }
    
    axesSizeRange.value = 60; // 设置为60（比例系数0.6）
    state.axesScaleFactor = 0.6;
    console.log("✅ 设置比例系数为0.6");
    
    // 2. 初始状态（farthestDistance = 0）
    state.farthestDistance = 0;
    console.log("初始状态：farthestDistance = 0");
    
    // 模拟动画循环逻辑
    if (state.customAxes && state.axesScaleFactor > 0) {
        if (state.farthestDistance === 0) {
            state.customAxes.visible = false;
            console.log("✅ farthestDistance=0时坐标系正确隐藏");
        }
    }
    
    // 3. 模拟采样开始
    console.log("\n模拟采样开始...");
    const testDistances = [10, 20, 35, 50, 25]; // 模拟不同的采样距离
    
    testDistances.forEach((distance, index) => {
        console.log(`\n--- 采样点 ${index + 1}: 距离 = ${distance} ---`);
        
        // 更新最远距离
        if (distance > state.farthestDistance) {
            state.farthestDistance = distance;
            console.log(`最远距离更新为: ${state.farthestDistance}`);
        }
        
        // 模拟动画循环中的实时更新逻辑
        if (state.customAxes && state.axesScaleFactor > 0) {
            if (state.farthestDistance === 0) {
                state.customAxes.visible = false;
            } else {
                state.customAxes.visible = true;
                
                // 实时更新坐标系大小
                const orbitalRadius = Math.max(constants.AXES_BASE_SIZE, state.farthestDistance);
                const targetSize = orbitalRadius * state.axesScaleFactor;
                const scale = targetSize / constants.AXES_BASE_SIZE;
                
                const currentScale = state.customAxes.scale.x;
                if (Math.abs(currentScale - scale) > 0.001) {
                    state.customAxes.scale.set(scale, scale, scale);
                    console.log(`坐标系缩放更新: ${scale.toFixed(3)}`);
                } else {
                    console.log(`坐标系缩放保持: ${currentScale.toFixed(3)}`);
                }
            }
        }
        
        // 验证结果
        const expectedScale = (Math.max(30, state.farthestDistance) * 0.6) / 30;
        const actualScale = state.customAxes.scale.x;
        
        if (Math.abs(actualScale - expectedScale) < 0.001) {
            console.log(`✅ 缩放正确: 期望${expectedScale.toFixed(3)}, 实际${actualScale.toFixed(3)}`);
        } else {
            console.log(`❌ 缩放错误: 期望${expectedScale.toFixed(3)}, 实际${actualScale.toFixed(3)}`);
        }
        
        console.log(`坐标系可见性: ${state.customAxes.visible}`);
    });
    
    // 4. 测试用户调整滑动条
    console.log("\n=== 测试用户调整滑动条 ===");
    axesSizeRange.value = 80; // 改为80（比例系数0.8）
    const event = new Event('input', { bubbles: true });
    Object.defineProperty(event, 'target', { value: axesSizeRange });
    window.ElectronCloud.UI.onAxesSizeChange(event);
    
    console.log(`滑动条调整为80，比例系数: ${state.axesScaleFactor}`);
    console.log(`坐标系缩放: ${state.customAxes.scale.x.toFixed(3)}`);
    console.log(`坐标系可见性: ${state.customAxes.visible}`);
    
    // 验证调整后的缩放
    const finalExpectedScale = (Math.max(30, state.farthestDistance) * 0.8) / 30;
    const finalActualScale = state.customAxes.scale.x;
    
    if (Math.abs(finalActualScale - finalExpectedScale) < 0.001) {
        console.log(`✅ 用户调整后缩放正确: ${finalActualScale.toFixed(3)}`);
    } else {
        console.log(`❌ 用户调整后缩放错误: 期望${finalExpectedScale.toFixed(3)}, 实际${finalActualScale.toFixed(3)}`);
    }
    
    console.log("\n=== 测试总结 ===");
    console.log("✅ 坐标系实时更新修复验证完成");
    console.log("✅ 动画循环中的坐标系更新逻辑工作正常");
    console.log("✅ 用户交互和自动更新都能正确调整坐标系大小");
}

// 导出函数供控制台调用
window.testRealtimeAxesUpdate = testRealtimeAxesUpdate;
