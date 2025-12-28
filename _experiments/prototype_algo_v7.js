
const assert = require('assert');

// ==================== MOCKED HELPERS ====================

const TWO_PI = 2 * Math.PI;
const eps = 1e-6;

function factorial(n) {
    if (n <= 1) return 1;
    let r = 1;
    for (let i = 2; i <= n; i++) r *= i;
    return r;
}

function associatedLegendre(l, m, x) {
    if (m < 0 || m > l) return 0;
    let pmm = 1.0;
    if (m > 0) {
        const somx2 = Math.sqrt((1.0 - x) * (1.0 + x));
        let fact = 1.0;
        for (let i = 1; i <= m; i++) {
            pmm *= -fact * somx2;
            fact += 2.0;
        }
    }
    if (l === m) return pmm;
    let pmmp1 = x * (2 * m + 1) * pmm;
    if (l === m + 1) return pmmp1;
    for (let ll = m + 2; ll <= l; ll++) {
        const pll = (x * (2 * ll - 1) * pmmp1 - (ll + m - 1) * pmm) / (ll - m);
        pmm = pmmp1;
        pmmp1 = pll;
    }
    return pmmp1;
}

function Ylm_complex(l, m, theta, phi) {
    const mm = Math.abs(m);
    const Plm = associatedLegendre(l, mm, Math.cos(theta));
    const N = Math.sqrt(((2 * l + 1) / (4 * Math.PI)) * (factorial(l - mm) / factorial(l + mm)));
    const base = N * Plm;
    if (m === 0) return { re: base, im: 0 };
    const cos_mphi = Math.cos(mm * phi), sin_mphi = Math.sin(mm * phi);
    if (m > 0) return { re: base * cos_mphi, im: base * sin_mphi };
    const sign = (mm % 2) ? -1 : 1;
    return { re: sign * base * cos_mphi, im: -sign * base * sin_mphi };
}

function realYlm_value(l, m, type, theta, phi) {
    if (m === 0) return Ylm_complex(l, 0, theta, phi).re;
    const mm = Math.abs(m);
    const y = Ylm_complex(l, mm, theta, phi);
    const csPhaseCorrection = (mm % 2 === 1) ? -1 : 1;
    if (type === 'c' || type === 'cos') return csPhaseCorrection * Math.SQRT2 * y.re;
    return csPhaseCorrection * Math.SQRT2 * y.im;
}

function computeOrbitalPeakDirection(l, m, t) {
    if (l === 0) return null;
    let maxVal = -Infinity, bestT = 0, bestP = 0;
    for (let theta = 0.05; theta < Math.PI; theta += 0.1) {
        for (let phi = 0; phi < TWO_PI; phi += 0.1) {
            const val = realYlm_value(l, m, t, theta, phi);
            if (val > maxVal) { maxVal = val; bestT = theta; bestP = phi; }
        }
    }
    // Refine
    for (let theta = Math.max(0.01, bestT - 0.15); theta < Math.min(Math.PI - 0.01, bestT + 0.15); theta += 0.02) {
        for (let phi = bestP - 0.15; phi < bestP + 0.15; phi += 0.02) {
            const val = realYlm_value(l, m, t, theta, phi);
            if (val > maxVal) { maxVal = val; bestT = theta; bestP = phi; }
        }
    }
    return [Math.sin(bestT) * Math.cos(bestP), Math.sin(bestT) * Math.sin(bestP), Math.cos(bestT)];
}

function optimizeThomson(n) {
    if (n <= 1) return [[0, 0, 1]];
    let points = [];
    const gr = (1 + Math.sqrt(5)) / 2;
    for (let i = 0; i < n; i++) {
        const y = 1 - (i / (n - 1)) * 2, rad = Math.sqrt(1 - y * y), t = TWO_PI * i / gr;
        points.push([Math.cos(t) * rad, y, Math.sin(t) * rad]);
    }
    for (let iter = 0; iter < 50; iter++) { // Reduced iter for prototype
        const grad = points.map(() => [0, 0, 0]);
        for (let i = 0; i < n; i++) {
            for (let j = i + 1; j < n; j++) {
                const dx = points[i][0] - points[j][0], dy = points[i][1] - points[j][1], dz = points[i][2] - points[j][2];
                const d2 = dx * dx + dy * dy + dz * dz, d3 = d2 * Math.sqrt(d2) + 1e-10;
                grad[i][0] -= dx / d3; grad[i][1] -= dy / d3; grad[i][2] -= dz / d3;
                grad[j][0] += dx / d3; grad[j][1] += dy / d3; grad[j][2] += dz / d3;
            }
        }
        for (let i = 0; i < n; i++) {
            points[i][0] -= 0.1 * grad[i][0]; points[i][1] -= 0.1 * grad[i][1]; points[i][2] -= 0.1 * grad[i][2];
            const norm = Math.sqrt(points[i][0] ** 2 + points[i][1] ** 2 + points[i][2] ** 2);
            points[i] = [points[i][0] / norm, points[i][1] / norm, points[i][2] / norm];
        }
    }
    return points;
}

function quatFromVectors(from, to) {
    const dot = from[0] * to[0] + from[1] * to[1] + from[2] * to[2];
    if (dot > 0.9999) return [1, 0, 0, 0];
    if (dot < -0.9999) {
        let axis = [0, 1, 0];
        if (Math.abs(from[1]) > 0.9) axis = [1, 0, 0];
        const s = Math.sin(Math.PI / 2);
        return [0, axis[0] * s, axis[1] * s, axis[2] * s]; // 180 deg
    }
    const cross = [
        from[1] * to[2] - from[2] * to[1],
        from[2] * to[0] - from[0] * to[2],
        from[0] * to[1] - from[1] * to[0]
    ];
    const s = Math.sqrt((1 + dot) * 2);
    const invs = 1 / s;
    return [0.5 * s, cross[0] * invs, cross[1] * invs, cross[2] * invs];
}

function quatRotateVector(q, v) {
    const ix = q[3] * v[0] + q[1] * v[2] - q[2] * v[1];
    const iy = q[3] * v[1] + q[2] * v[0] - q[0] * v[2];
    const iz = q[3] * v[2] + q[0] * v[1] - q[1] * v[0];
    const iw = -q[0] * v[0] - q[1] * v[1] - q[2] * v[2];
    return [
        ix * q[3] + iw * -q[0] + iy * -q[2] - iz * -q[1],
        iy * q[3] + iw * -q[1] + iz * -q[0] - ix * -q[2],
        iz * q[3] + iw * -q[2] + ix * -q[1] - iy * -q[0]
    ];
}

function quatMultiply(a, b) {
    return [
        a[0] * b[0] - a[1] * b[1] - a[2] * b[2] - a[3] * b[3],
        a[0] * b[1] + a[1] * b[0] + a[2] * b[3] - a[3] * b[2],
        a[0] * b[2] - a[1] * b[3] + a[2] * b[0] + a[3] * b[1],
        a[0] * b[3] + a[1] * b[2] - a[2] * b[1] + a[3] * b[0]
    ];
}

// ==================== NEW ALGORITHM v7.0 ====================

function generateConstrainedDirections_v7(orbitalParams) {
    const n = orbitalParams.length;
    const hasS = orbitalParams.some(p => p.l === 0);

    // 1. Anchors
    const anchors = [];
    for (const p of orbitalParams) {
        const dir = computeOrbitalPeakDirection(p.angKey.l, p.angKey.m, p.angKey.t);
        if (dir) anchors.push(dir);
    }

    // CASE A: No s-orbital
    if (!hasS) {
        if (anchors.length === 0) return [[0, 0, 1]];
        // Use anchors directly
        return JSON.parse(JSON.stringify(anchors));
    }

    // CASE B: Has s-orbital -> Thomson + Global Search
    let points = optimizeThomson(n);
    if (anchors.length === 0) return points;

    let bestScore = -Infinity;
    let bestR = [1, 0, 0, 0];

    const fullAnchors = [];
    anchors.forEach(a => {
        fullAnchors.push(a);
        fullAnchors.push([-a[0], -a[1], -a[2]]);
    });

    for (let i = 0; i < n; i++) {
        const P = points[i];
        for (const A of fullAnchors) {
            const qBase = quatFromVectors(P, A);

            // Search rotation around axis A
            for (let angle = 0; angle < TWO_PI; angle += 0.2) { // Coarse step
                const half = angle / 2;
                const s = Math.sin(half);
                const qRot = [Math.cos(half), A[0] * s, A[1] * s, A[2] * s];
                const q = quatMultiply(qRot, qBase);

                const rotated = points.map(pt => quatRotateVector(q, pt));

                let score = 0;
                for (const rp of rotated) {
                    let maxDot = 0;
                    for (const fa of fullAnchors) {
                        const d = rp[0] * fa[0] + rp[1] * fa[1] + rp[2] * fa[2];
                        if (d > maxDot) maxDot = d;
                    }
                    score += Math.pow(maxDot, 4);
                }

                if (score > bestScore) {
                    bestScore = score;
                    bestR = q;
                }
            }
        }
    }

    return points.map(p => quatRotateVector(bestR, p));
}

// ==================== TESTS ====================

function angleDiff(a, b) {
    const dot = a[0] * b[0] + a[1] * b[1] + a[2] * b[2];
    return Math.acos(Math.max(-1, Math.min(1, dot))) * 180 / Math.PI;
}

console.log('=== TEST v7.0 Algorithm ===\n');

// 1. px + py (No S)
console.log('--- px + py ---');
const pxpy = [
    { angKey: { l: 1, m: 1, t: 'c' } }, // x
    { angKey: { l: 1, m: 1, t: 's' } }  // y
];
const dirs1 = generateConstrainedDirections_v7(pxpy);
console.log('Directions:', dirs1.map(d => `[${d.map(x => x.toFixed(2))}]`).join(', '));
const angle1 = angleDiff(dirs1[0], dirs1[1]);
console.log(`Angle: ${angle1.toFixed(1)}° (Expect 90.0°)`); // Anchors x & y are 90 deg.
if (Math.abs(angle1 - 90) < 1) console.log('PASS'); else console.log('FAIL');


// 2. sp3 (Has S)
console.log('\n--- sp3 (s + px + py + pz) ---');
const sp3 = [
    { l: 0, angKey: { l: 0 } },
    { l: 1, angKey: { l: 1, m: 1, t: 'c' } },
    { l: 1, angKey: { l: 1, m: 1, t: 's' } },
    { l: 1, angKey: { l: 1, m: 0, t: '' } },
];
const dirs2 = generateConstrainedDirections_v7(sp3);
console.log('Directions:', dirs2.map(d => `[${d.map(x => x.toFixed(2))}]`).join(', '));

// Check relative angles
let minAng = 180, maxAng = 0;
for (let i = 0; i < 4; i++) for (let j = i + 1; j < 4; j++) {
    const a = angleDiff(dirs2[i], dirs2[j]);
    if (a < minAng) minAng = a;
    if (a > maxAng) maxAng = a;
}
console.log(`Angles range: ${minAng.toFixed(1)}° - ${maxAng.toFixed(1)}° (Expect ~109.5°)`);

// Check absolute absolute alignment
// Does any direction match x, y, or z?
const axes = [[1, 0, 0], [0, 1, 0], [0, 0, 1]];
let maxAlignment = 0;
for (const d of dirs2) {
    for (const ax of axes) {
        const ddot = Math.abs(d[0] * ax[0] + d[1] * ax[1] + d[2] * ax[2]);
        if (ddot > maxAlignment) maxAlignment = ddot;
    }
}
console.log(`Max alignment with XYZ axes: ${maxAlignment.toFixed(3)}`);
if (maxAlignment > 0.99) console.log('Strategy: ALIGNED TO AXIS (Good)');
else console.log('Strategy: CUBE CORNERS (Acceptable but maybe not preferred?)');

// 3. sp2
console.log('\n--- sp2 (s + px + py) ---');
const sp2 = [
    { l: 0, angKey: { l: 0 } },
    { l: 1, angKey: { l: 1, m: 1, t: 'c' } },
    { l: 1, angKey: { l: 1, m: 1, t: 's' } },
];
const dirs3 = generateConstrainedDirections_v7(sp2);
console.log('Directions:', dirs3.map(d => `[${d.map(x => x.toFixed(2))}]`).join(', '));
// Should align with x and y
let maxAlSp2 = 0;
for (const d of dirs3) {
    if (Math.abs(d[0]) > maxAlSp2) maxAlSp2 = Math.abs(d[0]);
}
console.log(`Max X alignment: ${maxAlSp2.toFixed(3)}`);
