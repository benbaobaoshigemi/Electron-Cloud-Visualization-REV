// 3D 可视化效果模块
window.ElectronCloud = window.ElectronCloud || {};
window.ElectronCloud.Visualization = {};

// 创建角向分布3D可视化
window.ElectronCloud.Visualization.createAngularOverlay = function() {
    const state = window.ElectronCloud.state;
    
    const overlayGroup = new THREE.Group();
    
    // 检查是否有选中的轨道
    if (!state.currentOrbitals || state.currentOrbitals.length === 0) return overlayGroup;
    
    // 创建轨道形状网格
    const baseRadius = Math.max(15, state.farthestDistance * 0.6);
    window.ElectronCloud.Visualization.createOrbitalMesh(overlayGroup, null, baseRadius);
    
    return overlayGroup;
};

// 创建轨道网格表面
window.ElectronCloud.Visualization.createOrbitalMesh = function(group, params, baseRadius) {
    const state = window.ElectronCloud.state;
    
    // 提高网格密度：从64x32增加到96x48，使网格更加稠密
    const geometry = new THREE.SphereGeometry(baseRadius, 96, 48);
    const vertices = geometry.attributes.position.array;
    const colors = new Float32Array(vertices.length);
    
    // 变形球面以匹配多轨道叠加的角向形状
    for (let i = 0; i < vertices.length; i += 3) {
        const x = vertices[i];
        const y = vertices[i + 1];
        const z = vertices[i + 2];
        
        const r = Math.sqrt(x * x + y * y + z * z);
        const theta = Math.acos(z / r);
        const phi = Math.atan2(y, x);
        
        // 计算所有选中轨道的角向函数叠加
        let totalAngularIntensity = 0;
        for (const orbitalKey of state.currentOrbitals) {
            const orbitalParams = Hydrogen.orbitalParamsFromKey(orbitalKey);
            if (orbitalParams) {
                const Y = Hydrogen.realYlm_value(
                    orbitalParams.angKey.l, 
                    orbitalParams.angKey.m, 
                    orbitalParams.angKey.t, 
                    theta, 
                    phi
                );
                totalAngularIntensity += Y * Y; // 概率密度叠加
            }
        }
        
        // 根据叠加后的角向强度调整顶点位置
        const radiusScale = 1 + Math.sqrt(totalAngularIntensity) * 1.5;
        vertices[i] = x * radiusScale;
        vertices[i + 1] = y * radiusScale;
        vertices[i + 2] = z * radiusScale;
        
        // 设置颜色 - 提高亮度，更清晰的对比
        const intensity = Math.min(totalAngularIntensity * 3, 1); // 增强亮度倍数从2到3
        colors[i] = intensity;
        colors[i + 1] = intensity;
        colors[i + 2] = intensity;
    }
    
    geometry.setAttribute('color', new THREE.BufferAttribute(colors, 3));
    geometry.attributes.position.needsUpdate = true;
    
    // 创建半透明网格 - 提高线条粗细和亮度
    const material = new THREE.MeshBasicMaterial({
        vertexColors: true,
        transparent: true,
        opacity: 0.7, // 从0.5增加到0.7，提高网格亮度
        side: THREE.DoubleSide,
        wireframe: true,
        wireframeLinewidth: 2 // 线条略粗
    });
    
    const mesh = new THREE.Mesh(geometry, material);
    group.add(mesh);
};

// 更新角向分布叠加
window.ElectronCloud.Visualization.updateAngularOverlay = function() {
    const state = window.ElectronCloud.state;
    const ui = window.ElectronCloud.ui;
    
    if (!ui.angular3dToggle || !ui.angular3dToggle.checked) return;
    
    // 移除旧的叠加
    if (state.angularOverlay) {
        state.scene.remove(state.angularOverlay);
        state.angularOverlay.traverse((child) => {
            if (child.geometry) child.geometry.dispose();
            if (child.material) child.material.dispose();
        });
    }
    
    // 创建新的叠加
    state.angularOverlay = window.ElectronCloud.Visualization.createAngularOverlay();
    state.angularOverlay.visible = true;
    state.scene.add(state.angularOverlay);
};

// 基于实际采样数据更新角向分布
window.ElectronCloud.Visualization.updateAngularOverlayFromSamples = function() {
    const state = window.ElectronCloud.state;
    const ui = window.ElectronCloud.ui;
    
    if (!ui.angular3dToggle || !ui.angular3dToggle.checked || !state.angularSamples || state.angularSamples.length === 0) return;
    
    if (state.angularOverlay) {
        state.scene.remove(state.angularOverlay);
        state.angularOverlay.traverse((child) => {
            if (child.geometry) child.geometry.dispose();
            if (child.material) child.material.dispose();
        });
    }
    
    // 基于实际采样数据创建角向分布
    state.angularOverlay = window.ElectronCloud.Visualization.createAngularOverlayFromSamples();
    state.angularOverlay.visible = true;
    state.scene.add(state.angularOverlay);
};

// 基于采样数据创建角向分布
window.ElectronCloud.Visualization.createAngularOverlayFromSamples = function() {
    const state = window.ElectronCloud.state;
    
    const overlayGroup = new THREE.Group();
    
    if (!state.angularSamples || state.angularSamples.length === 0) {
        return window.ElectronCloud.Visualization.createAngularOverlay(); // 回退到理论计算
    }
    
    const baseRadius = Math.max(15, state.farthestDistance * 0.6);
    const thetaBins = 64; // 提高角度分辨率
    const phiBins = 128;   
    
    // 创建角向密度统计
    const densityMap = new Array(thetaBins).fill(0).map(() => new Array(phiBins).fill(0));
    
    // 统计采样点的角向分布
    for (let i = 0; i < state.pointCount && i < state.radialSamples.length; i++) {
        const r = state.radialSamples[i];
        const theta = state.angularSamples[i];
        
        // 计算phi (需要从原始采样点计算)
        if (state.points && state.points.geometry) {
            const positions = state.points.geometry.attributes.position.array;
            const x = positions[i * 3];
            const y = positions[i * 3 + 1];
            const z = positions[i * 3 + 2];
            const phi = Math.atan2(y, x);
            
            const thetaIndex = Math.floor((theta / Math.PI) * (thetaBins - 1));
            const phiIndex = Math.floor(((phi + Math.PI) / (2 * Math.PI)) * (phiBins - 1));
            
            if (thetaIndex >= 0 && thetaIndex < thetaBins && phiIndex >= 0 && phiIndex < phiBins) {
                densityMap[thetaIndex][phiIndex]++;
            }
        }
    }
    
    // 归一化密度
    let maxDensity = 0;
    for (let i = 0; i < thetaBins; i++) {
        for (let j = 0; j < phiBins; j++) {
            maxDensity = Math.max(maxDensity, densityMap[i][j]);
        }
    }
    
    if (maxDensity === 0) {
        return window.ElectronCloud.Visualization.createAngularOverlay(); // 回退到理论计算
    }
    
    // 创建基于实际数据的网格 - 提高网格密度
    const geometry = new THREE.SphereGeometry(baseRadius, phiBins, thetaBins);
    const vertices = geometry.attributes.position.array;
    const colors = new Float32Array(vertices.length);
    
    for (let i = 0; i < vertices.length; i += 3) {
        const x = vertices[i];
        const y = vertices[i + 1];
        const z = vertices[i + 2];
        
        const r = Math.sqrt(x * x + y * y + z * z);
        const theta = Math.acos(z / r);
        const phi = Math.atan2(y, x);
        
        const thetaIndex = Math.floor((theta / Math.PI) * (thetaBins - 1));
        const phiIndex = Math.floor(((phi + Math.PI) / (2 * Math.PI)) * (phiBins - 1));
        
        let density = 0;
        if (thetaIndex >= 0 && thetaIndex < thetaBins && phiIndex >= 0 && phiIndex < phiBins) {
            density = densityMap[thetaIndex][phiIndex] / maxDensity;
        }
        
        // 根据实际密度调整顶点位置
        const radiusScale = 1 + density * 2;
        vertices[i] = x * radiusScale;
        vertices[i + 1] = y * radiusScale;
        vertices[i + 2] = z * radiusScale;
        
        // 设置颜色 - 提高亮度
        const intensityColor = Math.min(density * 1.2, 1);
        colors[i] = intensityColor;
        colors[i + 1] = intensityColor;
        colors[i + 2] = intensityColor;
    }
    
    geometry.setAttribute('color', new THREE.BufferAttribute(colors, 3));
    geometry.attributes.position.needsUpdate = true;
    
    // 提高网格亮度和线条粗细
    const material = new THREE.MeshBasicMaterial({
        vertexColors: true,
        transparent: true,
        opacity: 0.75, // 提高网格亮度
        side: THREE.DoubleSide,
        wireframe: true,
        wireframeLinewidth: 2
    });
    
    const mesh = new THREE.Mesh(geometry, material);
    overlayGroup.add(mesh);
    
    return overlayGroup;
};
