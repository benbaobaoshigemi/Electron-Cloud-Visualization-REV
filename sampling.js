// 点采样逻辑模块
window.ElectronCloud = window.ElectronCloud || {};
window.ElectronCloud.Sampling = {};

// 更新点的位置（主要采样逻辑）
window.ElectronCloud.Sampling.updatePoints = function() {
    const state = window.ElectronCloud.state;
    const ui = window.ElectronCloud.ui;
    const constants = window.ElectronCloud.constants;
    
    if (!state.points) return;
    
    const positions = state.points.geometry.attributes.position.array;
    const colorsAttr = state.points.geometry.getAttribute('color') || (function(){
        const colors = new Float32Array(state.points.geometry.attributes.position.count * 3);
        state.points.geometry.setAttribute('color', new THREE.BufferAttribute(colors, 3));
        return state.points.geometry.getAttribute('color');
    })();
    
    const paramsList = state.currentOrbitals.map(k => Hydrogen.orbitalParamsFromKey(k)).filter(Boolean);
    if (!paramsList.length) return;

    let newPoints = 0;
    const attemptPerFrame = window.ElectronCloud.Sampling.getAttemptsPerFrame();
    const samplingVolumeSize = state.samplingBoundary * 2;

    // 性能优化：允许更长的计算时间，充分利用帧间隔
    const startTime = performance.now();
    const maxTimePerFrame = 15; // 毫秒（60fps下每帧约16.67ms）

    let attempts = 0;
    while (attempts < attemptPerFrame && newPoints < state.pointsPerFrame && state.pointCount < state.MAX_POINTS) {
        // 每1000次尝试检查一次时间（减少开销）
        if (attempts % 1000 === 0 && attempts > 0 && (performance.now() - startTime) > maxTimePerFrame) {
            break;
        }
        attempts++;
        const x = (Math.random() - 0.5) * samplingVolumeSize;
        const y = (Math.random() - 0.5) * samplingVolumeSize;
        const z = (Math.random() - 0.5) * samplingVolumeSize;
        const r = Math.sqrt(x * x + y * y + z * z);

        if (r === 0) continue;

        const theta = Math.acos(z / r);
        const phi = Math.atan2(y, x);

        // 比照模式：分轨道独立采样策略
        if (ui.compareToggle && ui.compareToggle.checked) {
            const success = window.ElectronCloud.Sampling.processCompareModePoint(
                x, y, z, r, theta, phi, paramsList, positions, colorsAttr.array
            );
            if (success) {
                newPoints++;
            }
        } else {
            // 非比照模式：使用原有的叠加逻辑
            const success = window.ElectronCloud.Sampling.processNormalModePoint(
                x, y, z, r, theta, phi, paramsList, positions, colorsAttr.array
            );
            if (success) {
                newPoints++;
            }
        }
    }
    
    // 采样完成时使用实际数据更新角向分布
    if (state.samplingCompleted && ui.angular3dToggle && ui.angular3dToggle.checked) {
        if (!state.angularUpdated) {
            state.angularUpdated = true;
            setTimeout(() => {
                window.ElectronCloud.Visualization.updateAngularOverlayFromSamples();
                state.angularUpdated = false;
            }, 100);
        }
    } else if (ui.angular3dToggle && ui.angular3dToggle.checked && state.pointCount % 10000 === 0) {
        window.ElectronCloud.Visualization.updateAngularOverlayFromSamples();
    }
    
    state.points.geometry.setDrawRange(0, state.pointCount);
    state.points.geometry.attributes.position.needsUpdate = true;
    if (state.points.geometry.attributes.color) state.points.geometry.attributes.color.needsUpdate = true;
    
    const ui_pointCountSpan = window.ElectronCloud.ui.pointCountSpan;
    if (ui_pointCountSpan) {
        ui_pointCountSpan.textContent = state.pointCount;
    }
};

// 处理比照模式下的点采样
window.ElectronCloud.Sampling.processCompareModePoint = function(x, y, z, r, theta, phi, paramsList, positions, colors) {
    const state = window.ElectronCloud.state;
    const constants = window.ElectronCloud.constants;
    
    // 随机选择一个轨道进行采样尝试
    const randomOrbitalIndex = Math.floor(Math.random() * paramsList.length);
    const p = paramsList[randomOrbitalIndex];
    const density = Hydrogen.density3D_real(p.angKey, p.n, p.l, r, theta, phi);
    
    // 使用该轨道的密度进行独立的蒙特卡罗采样
    // 动态计算 scaleFactor，避免在低密度区域采样过慢或在高密度区域截断
    // 1s 轨道最大密度约为 0.32 (1/pi)，所以 scaleFactor 应约为 3.14
    // 4f 轨道最大密度约为 0.005，所以 scaleFactor 应约为 200
    // 简单的启发式：根据 n 值调整
    const maxDensityEstimate = 1 / (Math.PI * Math.pow(p.n, 3)); // 粗略估计 s 轨道最大值
    // 为了安全起见（避免截断），我们使用略小于 1/maxDensity 的值，或者直接使用保守值
    // 但为了效率，我们需要尽可能大。
    // 让我们使用一个更保守的估计，确保 density * scaleFactor <= 1
    // 对于 n=1, max ~ 0.32. 1/0.32 = 3.125.
    // 对于 n=2, max ~ 0.04. 1/0.04 = 25.
    // 对于 n=4, max ~ 0.005. 1/0.005 = 200.
    // 之前的 baseScale = 200 对于 n=1 来说太大了 (200 * 0.32 = 64 >> 1)，导致中心区域被截断成均匀分布
    
    // 修正：根据 n 动态调整 scaleFactor
    const scaleFactor = Math.min(200, 3.0 * Math.pow(p.n, 3)); 
    
    if (Math.random() < density * scaleFactor) {
        const i3 = state.pointCount * 3;
        positions[i3] = x;
        positions[i3 + 1] = y;
        positions[i3 + 2] = z;
        
        // 直接使用采样轨道对应的颜色
        if (randomOrbitalIndex < constants.compareColors.length) {
            const color = constants.compareColors[randomOrbitalIndex].value;
            colors[i3] = color[0];
            colors[i3 + 1] = color[1];
            colors[i3 + 2] = color[2];
        } else {
            colors[i3] = 1;
            colors[i3 + 1] = 1;
            colors[i3 + 2] = 1;
        }
        
        // 记录这个点属于哪个轨道（用于后续的显示开关）
        const orbitalKey = state.currentOrbitals[randomOrbitalIndex];
        if (!state.orbitalPointsMap[orbitalKey]) {
            state.orbitalPointsMap[orbitalKey] = [];
        }
        state.orbitalPointsMap[orbitalKey].push(state.pointCount);
        
        // 在对比模式下，只为被采样的轨道记录数据
        if (!state.orbitalSamplesMap[orbitalKey]) {
            state.orbitalSamplesMap[orbitalKey] = [];
        }
        state.orbitalSamplesMap[orbitalKey].push({
            r: r,
            theta: theta,
            probability: density
        });
        
        state.pointCount++;
        state.radialSamples.push(r);
        state.angularSamples.push(theta);
        
        window.ElectronCloud.Sampling.updateFarthestDistance(r);
        
        return true;
    }
    
    return false;
};

// 处理正常模式下的点采样
window.ElectronCloud.Sampling.processNormalModePoint = function(x, y, z, r, theta, phi, paramsList, positions, colors) {
    const state = window.ElectronCloud.state;
    
    let probability = 0;
    
    // 计算所有轨道的概率密度叠加，同时找出最小n值
    let minN = paramsList[0].n;
    for (let i = 0; i < paramsList.length; i++) {
        const p = paramsList[i];
        const density = Hydrogen.density3D_real(p.angKey, p.n, p.l, r, theta, phi);
        probability += density;
        if (p.n < minN) minN = p.n;
    }
    
    // 使用最小n值计算scaleFactor，确保低n轨道（高密度区域）不被截断
    // 除以sqrt(轨道数)是因为叠加的密度峰值通常小于各轨道峰值之和
    const scaleFactor = Math.min(200, 3.0 * Math.pow(minN, 3) / Math.sqrt(paramsList.length));
    
    if (Math.random() < probability * scaleFactor) {
        const i3 = state.pointCount * 3;
        positions[i3] = x;
        positions[i3 + 1] = y;
        positions[i3 + 2] = z;
        
        // 多选模式和默认模式：都支持相位显示功能
        const phaseOn = document.getElementById('phase-toggle')?.checked;
        let sign = 0;
        if (phaseOn) {
            let psi = 0;
            for (const p of paramsList) {
                const R = Hydrogen.radialR(p.n, p.l, r);
                const Y = Hydrogen.realYlm_value(p.angKey.l, p.angKey.m, p.angKey.t, theta, phi);
                psi += R * Y;
            }
            sign = psi > 0 ? 1 : (psi < 0 ? -1 : 0);
        }
        
        if (sign > 0) { // 红色
            colors[i3] = 1; colors[i3 + 1] = 0.2; colors[i3 + 2] = 0.2;
        } else if (sign < 0) { // 蓝色
            colors[i3] = 0.2; colors[i3 + 1] = 0.2; colors[i3 + 2] = 1;
        } else { // 中性白
            colors[i3] = 1; colors[i3 + 1] = 1; colors[i3 + 2] = 1;
        }
        
        state.pointCount++;
        state.radialSamples.push(r);
        state.angularSamples.push(theta);
        
        window.ElectronCloud.Sampling.updateFarthestDistance(r);
        
        return true;
    }
    
    return false;
};

// 更新最远距离和相关参数
window.ElectronCloud.Sampling.updateFarthestDistance = function(r) {
    const state = window.ElectronCloud.state;
    const ui = window.ElectronCloud.ui;
    const constants = window.ElectronCloud.constants;
    
    if (r > state.farthestDistance) {
        state.farthestDistance = r;
        state.samplingBoundary = Math.max(state.samplingBoundary, state.farthestDistance * 1.05);
        
        // 注意：坐标系的实时更新现在主要在动画循环中处理
        // 这里不再需要显式调用 onAxesSizeChange，因为动画循环会自动处理
        
        if (state.angularOverlay && ui.angular3dToggle && ui.angular3dToggle.checked) {
            if (state.pointCount % 5000 === 0) {
                window.ElectronCloud.Visualization.updateAngularOverlay();
            }
        }
    }
};

// 获取每帧尝试次数
window.ElectronCloud.Sampling.getAttemptsPerFrame = function() {
    const ui = window.ElectronCloud.ui;
    
    if (!ui.speedRange) return 20000;
    
    const v = parseInt(ui.speedRange.value, 10);
    if (isNaN(v) || v <= 0) return 20000;
    return v;
};
