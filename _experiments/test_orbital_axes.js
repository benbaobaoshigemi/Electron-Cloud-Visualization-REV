/**
 * 测试：从轨道量子数推导极值方向
 * 
 * 目标：实现 getOrbitalPrincipalAxis(l, m, t) 函数，
 *      返回实球谐函数 |Yₗₘₜ|² 极大值所在的方向向量
 */

const core = require('../physics-core.js');

console.log('=== 轨道极值方向推导测试 ===\n');

/**
 * 通过数值搜索找到实球谐函数的极值方向
 * （验证用，不用于生产）
 */
function findPeakBySearch(l, m, t) {
    let maxVal = 0, bestT = 0, bestP = 0;
    for (let theta = 0.01; theta < Math.PI; theta += 0.02) {
        for (let phi = 0; phi < 2 * Math.PI; phi += 0.02) {
            const val = core.realYlm_value(l, m, t, theta, phi);
            if (val > maxVal) { maxVal = val; bestT = theta; bestP = phi; }
        }
    }
    return [
        Math.sin(bestT) * Math.cos(bestP),
        Math.sin(bestT) * Math.sin(bestP),
        Math.cos(bestT)
    ];
}

/**
 * 从量子数直接计算极值方向（无硬编码）
 * 
 * 原理：实球谐函数的极值方向可从其定义推导
 * 
 * 对于 l=1 (p轨道):
 *   Y₁₀ = √(3/4π) cos(θ) → 极值在 θ=0 (z轴)
 *   Y₁₁c = √(3/4π) sin(θ)cos(φ) → 极值在 θ=π/2, φ=0 (x轴)
 *   Y₁₁s = √(3/4π) sin(θ)sin(φ) → 极值在 θ=π/2, φ=π/2 (y轴)
 * 
 * 对于 l=2 (d轨道):
 *   由实球谐函数的笛卡尔形式决定极值方向
 */
function getOrbitalPrincipalAxis(l, m, t) {
    if (l === 0) {
        // s 轨道：各向同性，返回 +z 作为约定
        return [0, 0, 1];
    }

    if (l === 1) {
        // p 轨道
        if (m === 0) {
            // pz: cos(θ) 最大在 θ=0
            return [0, 0, 1];
        } else if (m === 1) {
            if (t === 'c' || t === 'cos') {
                // px: sin(θ)cos(φ) 最大在 θ=π/2, φ=0
                return [1, 0, 0];
            } else {
                // py: sin(θ)sin(φ) 最大在 θ=π/2, φ=π/2
                return [0, 1, 0];
            }
        }
    }

    if (l === 2) {
        // d 轨道
        // 从笛卡尔形式推导极值方向
        if (m === 0) {
            // d_z² ∝ (3z² - r²)/r² = (3cos²θ - 1)
            // 极值在 θ=0 (z轴)
            return [0, 0, 1];
        } else if (m === 1) {
            if (t === 'c' || t === 'cos') {
                // d_xz ∝ xz/r² = sin(θ)cos(θ)cos(φ)
                // 极值在 θ=π/4, φ=0 → 方向 [1/√2, 0, 1/√2]
                const s = 1 / Math.sqrt(2);
                return [s, 0, s];
            } else {
                // d_yz ∝ yz/r² = sin(θ)cos(θ)sin(φ)
                // 极值在 θ=π/4, φ=π/2 → 方向 [0, 1/√2, 1/√2]
                const s = 1 / Math.sqrt(2);
                return [0, s, s];
            }
        } else if (m === 2) {
            if (t === 'c' || t === 'cos') {
                // d_x²-y² ∝ (x²-y²)/r² = sin²θ cos(2φ)
                // 极值在 θ=π/2, φ=0 → 方向 [1, 0, 0]
                return [1, 0, 0];
            } else {
                // d_xy ∝ xy/r² = sin²θ sin(2φ)/2
                // 极值在 θ=π/2, φ=π/4 → 方向 [1/√2, 1/√2, 0]
                const s = 1 / Math.sqrt(2);
                return [s, s, 0];
            }
        }
    }

    // l >= 3: 回退到数值搜索
    return findPeakBySearch(l, m, t);
}

// 测试所有 p 轨道
console.log('--- P 轨道 ---');
const pOrbitals = [
    { l: 1, m: 0, t: '', name: 'pz' },
    { l: 1, m: 1, t: 'c', name: 'px' },
    { l: 1, m: 1, t: 's', name: 'py' },
];

for (const orb of pOrbitals) {
    const computed = getOrbitalPrincipalAxis(orb.l, orb.m, orb.t);
    const searched = findPeakBySearch(orb.l, orb.m, orb.t);

    // 计算两个方向的点积（应该接近 1）
    const dot = computed[0] * searched[0] + computed[1] * searched[1] + computed[2] * searched[2];
    const status = Math.abs(dot) > 0.99 ? '✓' : '✗';

    console.log(`${orb.name}: 计算=[${computed.map(x => x.toFixed(3)).join(', ')}] ` +
        `搜索=[${searched.map(x => x.toFixed(3)).join(', ')}] ${status}`);
}

// 测试所有 d 轨道
console.log('\n--- D 轨道 ---');
const dOrbitals = [
    { l: 2, m: 0, t: '', name: 'd_z²' },
    { l: 2, m: 1, t: 'c', name: 'd_xz' },
    { l: 2, m: 1, t: 's', name: 'd_yz' },
    { l: 2, m: 2, t: 'c', name: 'd_x²-y²' },
    { l: 2, m: 2, t: 's', name: 'd_xy' },
];

for (const orb of dOrbitals) {
    const computed = getOrbitalPrincipalAxis(orb.l, orb.m, orb.t);
    const searched = findPeakBySearch(orb.l, orb.m, orb.t);

    const dot = computed[0] * searched[0] + computed[1] * searched[1] + computed[2] * searched[2];
    const status = Math.abs(dot) > 0.95 ? '✓' : '✗';

    console.log(`${orb.name}: 计算=[${computed.map(x => x.toFixed(3)).join(', ')}] ` +
        `搜索=[${searched.map(x => x.toFixed(3)).join(', ')}] ${status}`);
}

// 测试组合轨道
console.log('\n--- 组合轨道 (px + py) ---');
const pxParams = { n: 2, l: 1, angKey: { l: 1, m: 1, t: 'c' } };
const pyParams = { n: 2, l: 1, angKey: { l: 1, m: 1, t: 's' } };
const combo = [pxParams, pyParams];

console.log('输入轨道:');
console.log('  px 主轴:', getOrbitalPrincipalAxis(1, 1, 'c'));
console.log('  py 主轴:', getOrbitalPrincipalAxis(1, 1, 's'));

console.log('\n期望结果:');
console.log('  h1 方向: [1/√2, 1/√2, 0] ≈ [0.707, 0.707, 0]');
console.log('  h2 方向: [1/√2, -1/√2, 0] ≈ [0.707, -0.707, 0]');

console.log('\n当前算法输出:');
const directions = core.generateConstrainedDirections(core.sortOrbitalsForHybridization(combo));
directions.forEach((d, i) => console.log(`  d${i}: [${d.map(x => x.toFixed(3)).join(', ')}]`));

// 验证算法是否正确
const expectedH1 = [1 / Math.sqrt(2), 1 / Math.sqrt(2), 0];
const expectedH2 = [1 / Math.sqrt(2), -1 / Math.sqrt(2), 0];

function alignmentScore(a, b) {
    return Math.abs(a[0] * b[0] + a[1] * b[1] + a[2] * b[2]);
}

const score1 = Math.max(alignmentScore(directions[0], expectedH1), alignmentScore(directions[0], expectedH2));
const score2 = Math.max(alignmentScore(directions[1], expectedH1), alignmentScore(directions[1], expectedH2));

console.log(`\n对齐评分: d0→${score1.toFixed(3)}, d1→${score2.toFixed(3)}`);
if (score1 > 0.95 && score2 > 0.95) {
    console.log('✓ 方向正确');
} else {
    console.log('✗ 方向有误！当前算法未利用轨道信息约束方向');
}
