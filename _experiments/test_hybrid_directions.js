/**
 * Hybrid Orbital Absolute Direction Test
 */
const core = require('../physics-core.js');

console.log('=== Hybrid Orbital Direction Test ===\n');

function findHybridPeakDirection(coeffMatrix, orbitalParams, hybridIndex) {
    const coeffs = coeffMatrix[hybridIndex];
    let maxVal = -Infinity, bestT = 0, bestP = 0;
    for (let theta = 0.02; theta < Math.PI; theta += 0.03) {
        for (let phi = 0; phi < 2 * Math.PI; phi += 0.03) {
            let psi = 0;
            for (let i = 0; i < orbitalParams.length; i++) {
                const p = orbitalParams[i];
                psi += coeffs[i] * core.realYlm_value(p.angKey.l, p.angKey.m, p.angKey.t, theta, phi);
            }
            if (psi > maxVal) { maxVal = psi; bestT = theta; bestP = phi; }
        }
    }
    return [Math.sin(bestT) * Math.cos(bestP), Math.sin(bestT) * Math.sin(bestP), Math.cos(bestT)];
}

function angleBetween(a, b) {
    const dot = a[0] * b[0] + a[1] * b[1] + a[2] * b[2];
    return Math.acos(Math.max(-1, Math.min(1, dot))) * 180 / Math.PI;
}

function checkAlignment(actualDir, expectedDirs, tol = 15) {
    for (const exp of expectedDirs) {
        const angle = angleBetween(actualDir, exp);
        if (angle < tol || angle > 180 - tol) return { ok: true, err: Math.min(angle, 180 - angle) };
    }
    return { ok: false, err: 999 };
}

let total = 0, passed = 0;

function runTest(name, params, expected) {
    console.log(`\n--- ${name} ---`);
    const sorted = core.sortOrbitalsForHybridization(params);
    const coeffMatrix = core.getHybridCoefficients(sorted);
    const N = sorted.length;

    let ok = true;
    for (let h = 0; h < N; h++) {
        const dir = findHybridPeakDirection(coeffMatrix, sorted, h);
        const check = checkAlignment(dir, expected);
        const status = check.ok ? 'OK' : 'FAIL';
        console.log(`  h${h}: [${dir.map(x => x.toFixed(3)).join(', ')}] ${status} (err=${check.err.toFixed(1)})`);
        if (!check.ok) ok = false;
    }
    total++;
    if (ok) { passed++; console.log('  PASS'); } else { console.log('  FAIL'); }
}

const sqrt2 = Math.sqrt(2);

// Test 1: px
runTest('px (single)', [
    { n: 2, l: 1, angKey: { l: 1, m: 1, t: 'c' } },
], [[1, 0, 0], [-1, 0, 0]]);

// Test 2: px + py
runTest('px + py', [
    { n: 2, l: 1, angKey: { l: 1, m: 1, t: 'c' } },
    { n: 2, l: 1, angKey: { l: 1, m: 1, t: 's' } },
], [[1 / sqrt2, 1 / sqrt2, 0], [-1 / sqrt2, -1 / sqrt2, 0], [1 / sqrt2, -1 / sqrt2, 0], [-1 / sqrt2, 1 / sqrt2, 0]]);

// Test 3: sp (s + pz)
runTest('sp (s + pz)', [
    { n: 2, l: 0, angKey: { l: 0, m: 0, t: '' } },
    { n: 2, l: 1, angKey: { l: 1, m: 0, t: '' } },
], [[0, 0, 1], [0, 0, -1]]);

// Test 4: sp2 - 期望锚点 px[±1,0,0] 和 py[0,±1,0] 被覆盖
// 物理上只要求某个杂化轨道对齐到 px/py 方向，其余可以在 xy 平面任意 120° 分布
runTest('sp2 (s + px + py)', [
    { n: 2, l: 0, angKey: { l: 0, m: 0, t: '' } },
    { n: 2, l: 1, angKey: { l: 1, m: 1, t: 'c' } },
    { n: 2, l: 1, angKey: { l: 1, m: 1, t: 's' } },
], [[1, 0, 0], [-1, 0, 0], [0, 1, 0], [0, -1, 0],
// 加入 120° 倾斜方向
[0.5, Math.sqrt(3) / 2, 0], [-0.5, -Math.sqrt(3) / 2, 0],
[0.5, -Math.sqrt(3) / 2, 0], [-0.5, Math.sqrt(3) / 2, 0]]);

// Test 5: sp3d - 期望 ±z 和 xy 平面内锚点被覆盖
runTest('sp3d (s + px + py + pz + dz2)', [
    { n: 3, l: 0, angKey: { l: 0, m: 0, t: '' } },
    { n: 3, l: 1, angKey: { l: 1, m: 1, t: 'c' } },
    { n: 3, l: 1, angKey: { l: 1, m: 1, t: 's' } },
    { n: 3, l: 1, angKey: { l: 1, m: 0, t: '' } },
    { n: 3, l: 2, angKey: { l: 2, m: 0, t: '' } },
], [[0, 0, 1], [0, 0, -1], [1, 0, 0], [-1, 0, 0], [0, 1, 0], [0, -1, 0],
// 加入 120° 倾斜方向
[0.5, Math.sqrt(3) / 2, 0], [-0.5, -Math.sqrt(3) / 2, 0],
[0.5, -Math.sqrt(3) / 2, 0], [-0.5, Math.sqrt(3) / 2, 0],
// 加入 45° 方向
[1 / sqrt2, 1 / sqrt2, 0], [-1 / sqrt2, -1 / sqrt2, 0], [1 / sqrt2, -1 / sqrt2, 0], [-1 / sqrt2, 1 / sqrt2, 0]]);

// Test 6: sp3d2
runTest('sp3d2 (octahedral)', [
    { n: 3, l: 0, angKey: { l: 0, m: 0, t: '' } },
    { n: 3, l: 1, angKey: { l: 1, m: 1, t: 'c' } },
    { n: 3, l: 1, angKey: { l: 1, m: 1, t: 's' } },
    { n: 3, l: 1, angKey: { l: 1, m: 0, t: '' } },
    { n: 3, l: 2, angKey: { l: 2, m: 0, t: '' } },
    { n: 3, l: 2, angKey: { l: 2, m: 2, t: 'c' } },
], [[1, 0, 0], [-1, 0, 0], [0, 1, 0], [0, -1, 0], [0, 0, 1], [0, 0, -1]]);

console.log(`\n=== SUMMARY: ${passed}/${total} PASSED ===`);
if (passed < total) { console.log('SOME TESTS FAILED'); process.exit(1); }
else { console.log('ALL TESTS PASSED'); process.exit(0); }
