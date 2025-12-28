/**
 * sp³ 杂化方向验证测试
 */
const core = require('../physics-core.js');

// sp³ 轨道参数：2s + 2px + 2py + 2pz
const sp3Params = [
    { n: 2, l: 0, angKey: { l: 0, m: 0, t: '' } },
    { n: 2, l: 1, angKey: { l: 1, m: 1, t: 'c' } },
    { n: 2, l: 1, angKey: { l: 1, m: 1, t: 's' } },
    { n: 2, l: 1, angKey: { l: 1, m: 0, t: '' } },
];

console.log('=== sp³ 杂化方向验证测试 ===\n');

// 1. Thomson 几何
console.log('1. Thomson (N=4):');
const thomsonPoints = core.optimizeThomson(4);
thomsonPoints.forEach((p, i) => console.log(`   [${i}]: [${p[0].toFixed(4)}, ${p[1].toFixed(4)}, ${p[2].toFixed(4)}]`));

console.log('\n   Thomson 夹角 (期望 109.47°):');
for (let i = 0; i < 4; i++) {
    for (let j = i + 1; j < 4; j++) {
        const dot = thomsonPoints[i][0] * thomsonPoints[j][0] + thomsonPoints[i][1] * thomsonPoints[j][1] + thomsonPoints[i][2] * thomsonPoints[j][2];
        console.log(`   (${i}-${j}): ${(Math.acos(Math.max(-1, Math.min(1, dot))) * 180 / Math.PI).toFixed(2)}°`);
    }
}

// 2. 排序
console.log('\n2. 轨道排序:');
const sorted = core.sortOrbitalsForHybridization(sp3Params);
sorted.forEach((p, i) => {
    const label = p.l === 0 ? 's' : (p.angKey.t === 'c' ? 'px' : (p.angKey.t === 's' ? 'py' : 'pz'));
    console.log(`   [${i}] l=${p.l} (${label})`);
});

// 3. 约束方向
console.log('\n3. 生成方向:');
const directions = core.generateConstrainedDirections(sorted);
directions.forEach((d, i) => console.log(`   d${i}: [${d[0].toFixed(4)}, ${d[1].toFixed(4)}, ${d[2].toFixed(4)}]`));

console.log('\n   方向夹角 (期望 109.47°):');
let angleErrors = [];
for (let i = 0; i < 4; i++) {
    for (let j = i + 1; j < 4; j++) {
        const dot = directions[i][0] * directions[j][0] + directions[i][1] * directions[j][1] + directions[i][2] * directions[j][2];
        const angle = Math.acos(Math.max(-1, Math.min(1, dot))) * 180 / Math.PI;
        angleErrors.push(Math.abs(angle - 109.47));
        console.log(`   (${i}-${j}): ${angle.toFixed(2)}° [误差 ${Math.abs(angle - 109.47).toFixed(2)}°]`);
    }
}

// 4. 系数矩阵
console.log('\n4. 系数矩阵:');
const coeffMatrix = core.getHybridCoefficients(sp3Params);
const labels = ['s', 'px', 'py', 'pz'];
console.log('         h0     h1     h2     h3');
for (let i = 0; i < 4; i++) {
    const row = coeffMatrix.map(col => col[i].toFixed(3).padStart(6));
    console.log(`   ${labels[i].padEnd(4)}${row.join(' ')}`);
}

// 5. 正交性
console.log('\n5. 正交性 ⟨hᵢ|hⱼ⟩:');
for (let i = 0; i < 4; i++) {
    for (let j = i; j < 4; j++) {
        let dot = 0;
        for (let k = 0; k < 4; k++) dot += coeffMatrix[i][k] * coeffMatrix[j][k];
        const exp = i === j ? 1 : 0;
        console.log(`   ⟨h${i}|h${j}⟩ = ${dot.toFixed(4)} [${Math.abs(dot - exp) < 0.01 ? '✓' : '✗'}]`);
    }
}

// 6. 极大方向
console.log('\n6. 杂化轨道极大方向:');
const hybridDirs = [];
for (let hi = 0; hi < 4; hi++) {
    const coeffs = coeffMatrix[hi];
    let maxVal = 0, bestT = 0, bestP = 0;
    for (let t = 0; t <= Math.PI; t += 0.1) {
        for (let p = 0; p < 2 * Math.PI; p += 0.1) {
            let psi = coeffs[0] * core.realYlm_value(0, 0, '', t, p)
                + coeffs[1] * core.realYlm_value(1, 1, 'c', t, p)
                + coeffs[2] * core.realYlm_value(1, 1, 's', t, p)
                + coeffs[3] * core.realYlm_value(1, 0, '', t, p);
            if (psi > maxVal) { maxVal = psi; bestT = t; bestP = p; }
        }
    }
    const dir = [Math.sin(bestT) * Math.cos(bestP), Math.sin(bestT) * Math.sin(bestP), Math.cos(bestT)];
    hybridDirs.push(dir);
    console.log(`   h${hi}: θ=${(bestT * 180 / Math.PI).toFixed(0)}° φ=${(bestP * 180 / Math.PI).toFixed(0)}° → [${dir[0].toFixed(3)}, ${dir[1].toFixed(3)}, ${dir[2].toFixed(3)}]`);
}

console.log('\n   极大方向夹角:');
for (let i = 0; i < 4; i++) {
    for (let j = i + 1; j < 4; j++) {
        const dot = hybridDirs[i][0] * hybridDirs[j][0] + hybridDirs[i][1] * hybridDirs[j][1] + hybridDirs[i][2] * hybridDirs[j][2];
        const angle = Math.acos(Math.max(-1, Math.min(1, dot))) * 180 / Math.PI;
        const err = Math.abs(angle - 109.47);
        console.log(`   (h${i}-h${j}): ${angle.toFixed(1)}° [误差 ${err.toFixed(1)}° ${err < 10 ? '✓' : '✗'}]`);
    }
}

// 总结
console.log('\n=== 总结 ===');
const maxErr = Math.max(...angleErrors);
if (maxErr > 30) console.log(`❌ 严重: 方向夹角偏差 ${maxErr.toFixed(1)}°，sp³ 几何严重失真`);
else if (maxErr > 10) console.log(`⚠ 警告: 方向夹角偏差 ${maxErr.toFixed(1)}°，超阈值`);
else console.log(`✓ 通过: 方向夹角正常 (最大误差 ${maxErr.toFixed(1)}°)`);
