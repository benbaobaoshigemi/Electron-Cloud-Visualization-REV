/**
 * Hybrid Orbital Absolute Direction Test (v9.0 Final Verification)
 */
const core = require('../physics-core.js');

console.log('=== Hybrid Orbital Direction Test (v9.0) ===\n');

function findHybridPeakDirection(coeffMatrix, orbitalParams, hybridIndex) {
    const coeffs = coeffMatrix[hybridIndex];
    let maxVal = -Infinity, bestT = 0, bestP = 0;
    // 粗搜索 + 细搜索
    for (let theta = 0.05; theta < Math.PI; theta += 0.2) {
        for (let phi = 0; phi < 2 * Math.PI; phi += 0.2) {
            let psi = 0;
            for (let i = 0; i < orbitalParams.length; i++) {
                const p = orbitalParams[i];
                psi += coeffs[i] * core.realYlm_value(p.angKey.l, p.angKey.m, p.angKey.t, theta, phi);
            }
            if (psi > maxVal) { maxVal = psi; bestT = theta; bestP = phi; }
        }
    }
    // Fine search around peak
    const range = 0.3;
    const step = 0.05;
    for (let t = Math.max(0, bestT - range); t < Math.min(Math.PI, bestT + range); t += step) {
        for (let p = bestP - range; p < bestP + range; p += step) {
            let psi = 0;
            for (let i = 0; i < orbitalParams.length; i++) {
                const param = orbitalParams[i];
                psi += coeffs[i] * core.realYlm_value(param.angKey.l, param.angKey.m, param.angKey.t, t, p);
            }
            if (psi > maxVal) { maxVal = psi; bestT = t; bestP = p; }
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
        const check = checkAlignment(dir, expected, 20); // 20度宽容度，因为混合轨道形状可能偏离轴
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
    { l: 1, angKey: { l: 1, m: 1, t: 'c' } } // px
], [
    [1, 0, 0]
]);

// Test 2: px + py (Orthogonal, 90 deg)
runTest('px + py', [
    { l: 1, angKey: { l: 1, m: 1, t: 'c' } }, // px
    { l: 1, angKey: { l: 1, m: 1, t: 's' } }  // py
], [
    [1, 0, 0], [0, 1, 0], [-1, 0, 0], [0, -1, 0] // Accept any orthogonal on x/y axes
]);

// Test 3: sp (Linear, z-axis per algorithm preference or relative)
// Algorithm usually aligns to Z for linear if possible, or just checks 180 separation
// We provide Z-axis vectors as expectation
runTest('sp (s + pz)', [
    { l: 0, angKey: { l: 0, m: 0, t: 'c' } }, // 2s
    { l: 1, angKey: { l: 1, m: 0, t: 'c' } }  // 2pz
], [
    [0, 0, 1], [0, 0, -1]
]);

// Test 4: sp2 (Trigonal Planar)
// Expectation: xy plane, 120 deg apart.
// Vectors: [1,0,0], [-0.5, 0.866, 0], [-0.5, -0.866, 0] are standard
runTest('sp2 (s + px + py)', [
    { l: 0, angKey: { l: 0, m: 0, t: 'c' } }, // 2s
    { l: 1, angKey: { l: 1, m: 1, t: 'c' } }, // 2px
    { l: 1, angKey: { l: 1, m: 1, t: 's' } }  // 2py
], [
    [1, 0, 0], [-0.5, 0.866, 0], [-0.5, -0.866, 0],
    [-1, 0, 0], [0.5, -0.866, 0], [0.5, 0.866, 0] // And inverses
]);

// Test 5: sp3 (Tetrahedral)
// Vectors: [1,1,1] direction family
runTest('sp3 (s + px + py + pz)', [
    { l: 0, angKey: { l: 0, m: 0, t: 'c' } }, // 2s
    { l: 1, angKey: { l: 1, m: 1, t: 'c' } }, // 2px
    { l: 1, angKey: { l: 1, m: 1, t: 's' } }, // 2py
    { l: 1, angKey: { l: 1, m: 0, t: 'c' } }  // 2pz
], [
    [1 / Math.sqrt(3), 1 / Math.sqrt(3), 1 / Math.sqrt(3)],
    [1 / Math.sqrt(3), -1 / Math.sqrt(3), -1 / Math.sqrt(3)],
    [-1 / Math.sqrt(3), 1 / Math.sqrt(3), -1 / Math.sqrt(3)],
    [-1 / Math.sqrt(3), -1 / Math.sqrt(3), 1 / Math.sqrt(3)]
]);

// Test 6: sp3d2 (Octahedral)
runTest('sp3d2 (octahedral)', [
    { l: 0, angKey: { l: 0, m: 0, t: 'c' } }, // 3s
    { l: 1, angKey: { l: 1, m: 1, t: 'c' } }, // 3px
    { l: 1, angKey: { l: 1, m: 1, t: 's' } }, // 3py
    { l: 1, angKey: { l: 1, m: 0, t: 'c' } }, // 3pz
    { l: 2, angKey: { l: 2, m: 0, t: 'c' } }, // 3dz2
    { l: 2, angKey: { l: 2, m: 2, t: 'c' } }  // 3dx2-y2
], [
    [0, 0, 1], [0, 0, -1],
    [1, 0, 0], [-1, 0, 0],
    [0, 1, 0], [0, -1, 0]
]);

console.log(`\n=== SUMMARY: ${passed}/${total} PASSED ===`);
