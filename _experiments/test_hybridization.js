const PhysicsCore = require('../physics-core.js');

const {
    getHybridCoefficients,
    orbitalParamsFromKey,
    realYlm_value
} = PhysicsCore;

// Helper: Convert Cartesian -> Spherical
function cart2sph(x, y, z) {
    const r = Math.sqrt(x * x + y * y + z * z);
    if (r === 0) return { r: 0, theta: 0, phi: 0 };
    const theta = Math.acos(z / r);
    const phi = Math.atan2(y, x);
    return { r, theta, phi };
}

// Helper: Find max direction for a hybrid orbital
function findMaxDirection(coeffs, paramsList) {
    let maxVal = -1;
    let maxDir = [0, 0, 1];

    // Simple grid search
    const steps = 50;
    for (let i = 0; i < steps; i++) {
        const theta = Math.PI * i / (steps - 1);
        for (let j = 0; j < steps * 2; j++) {
            const phi = 2 * Math.PI * j / (steps * 2 - 1);

            // Calculate hybrid wavefunction value at this direction (r is irrelevant for angular, taking r=1 part of Ylm)
            let val = 0;
            for (let k = 0; k < paramsList.length; k++) {
                const p = paramsList[k];
                val += coeffs[k] * realYlm_value(p.angKey.l, p.angKey.m, p.angKey.t, theta, phi);
            }

            const absVal = Math.abs(val);
            if (absVal > maxVal) {
                maxVal = absVal;
                maxDir = [
                    Math.sin(theta) * Math.cos(phi),
                    Math.sin(theta) * Math.sin(phi),
                    Math.cos(theta)
                ];
            }
        }
    }
    return maxDir;
}

function printVec(v) {
    return `[${v[0].toFixed(3)}, ${v[1].toFixed(3)}, ${v[2].toFixed(3)}]`;
}

function runTest(name, keys) {
    console.log(`\n=== Test Case: ${name} ===`);
    console.log(`Input Orbitals: ${keys.join(', ')}`);

    const params = keys.map(k => {
        const p = orbitalParamsFromKey(k);
        if (!p) console.error(`Failed to parse key: ${k}`);
        return p;
    });

    const mat = getHybridCoefficients(params);

    // Print Matrix
    console.log("Coefficient Matrix (Rows = Hybrid Orbitals, Cols = Input Orbitals):");
    params.forEach((p, i) => process.stdout.write(`\t${keys[i]}`));
    console.log();

    mat.forEach((row, i) => {
        process.stdout.write(`H${i + 1}:\t`);
        row.forEach(c => process.stdout.write(`${c.toFixed(3)}\t`));

        // Composition Analysis
        const s_char = row.reduce((acc, c, idx) => acc + (params[idx].l === 0 ? c * c : 0), 0);
        const p_char = row.reduce((acc, c, idx) => acc + (params[idx].l === 1 ? c * c : 0), 0);
        const d_char = row.reduce((acc, c, idx) => acc + (params[idx].l === 2 ? c * c : 0), 0);

        // Find Direction
        const dir = findMaxDirection(row, params);

        console.log(`| Dir: ${printVec(dir)} | s: ${(s_char * 100).toFixed(1)}% p: ${(p_char * 100).toFixed(1)}% d: ${(d_char * 100).toFixed(1)}%`);
    });
}

// 1. Pure pz
runTest("Pure pz", ['2pz']);

// 2. pz + px
runTest("pz + px", ['2pz', '2px']);

// 3. sp3
runTest("sp3", ['2s', '2pz', '2px', '2py']);

// 4. sp3d
runTest("sp3d", ['3s', '3pz', '3px', '3py', '3dz2']);

// 5. sp3d2
runTest("sp3d2", ['3s', '3pz', '3px', '3py', '3dx2-y2', '3dz2']);
