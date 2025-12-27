/**
 * 离屏测试：杂化轨道系数算法验证
 * 
 * 验证 getHybridCoefficients 对于各种轨道组合的输出是否正确
 * 
 * 运行方式：node _experiments/test_hybrid_coefficients.js
 */

// 模拟 physics-core.js 的核心函数

const A0 = 1.0;
const TWO_PI = 2 * Math.PI;

// ==================== 1. 实球谐函数 ====================
function realYlm_value(l, m, t, theta, phi) {
    const sinT = Math.sin(theta), cosT = Math.cos(theta);
    const sqrt = Math.sqrt, cos = Math.cos, sin = Math.sin;

    // s 轨道
    if (l === 0) return sqrt(1 / (4 * Math.PI));

    // p 轨道
    if (l === 1) {
        const norm = sqrt(3 / (4 * Math.PI));
        if (m === 0) return norm * cosT;           // pz
        if (m === 1 && t === 'c') return norm * sinT * cos(phi);  // px
        if (m === 1 && t === 's') return norm * sinT * sin(phi);  // py
    }

    // d 轨道
    if (l === 2) {
        if (m === 0) return sqrt(5 / (16 * Math.PI)) * (3 * cosT * cosT - 1);  // dz2
        if (m === 1 && t === 'c') return sqrt(15 / (4 * Math.PI)) * sinT * cosT * cos(phi);  // dxz
        if (m === 1 && t === 's') return sqrt(15 / (4 * Math.PI)) * sinT * cosT * sin(phi);  // dyz
        if (m === 2 && t === 'c') return sqrt(15 / (16 * Math.PI)) * sinT * sinT * cos(2 * phi);  // dx2-y2
        if (m === 2 && t === 's') return sqrt(15 / (16 * Math.PI)) * sinT * sinT * sin(2 * phi);  // dxy
    }

    return 0;
}

// ==================== 2. 矩阵运算 ====================
function matTranspose(M) {
    const rows = M.length, cols = M[0].length;
    const T = [];
    for (let j = 0; j < cols; j++) {
        T[j] = [];
        for (let i = 0; i < rows; i++) T[j][i] = M[i][j];
    }
    return T;
}

function matMul(A, B) {
    const m = A.length, n = B[0].length, k = B.length;
    const C = [];
    for (let i = 0; i < m; i++) {
        C[i] = [];
        for (let j = 0; j < n; j++) {
            let s = 0;
            for (let p = 0; p < k; p++) s += A[i][p] * B[p][j];
            C[i][j] = s;
        }
    }
    return C;
}

function jacobiSVD(A, maxIter = 100) {
    const m = A.length, n = A[0].length;
    const U = A.map(row => [...row]);
    const V = [];
    for (let i = 0; i < n; i++) {
        V[i] = [];
        for (let j = 0; j < n; j++) V[i][j] = i === j ? 1 : 0;
    }

    for (let iter = 0; iter < maxIter; iter++) {
        let maxOff = 0;
        for (let i = 0; i < n; i++) {
            for (let j = i + 1; j < n; j++) {
                let a = 0, b = 0, c = 0;
                for (let k = 0; k < m; k++) {
                    a += U[k][i] * U[k][i];
                    b += U[k][j] * U[k][j];
                    c += U[k][i] * U[k][j];
                }
                maxOff = Math.max(maxOff, Math.abs(c));
                if (Math.abs(c) < 1e-12) continue;
                const zeta = (b - a) / (2 * c);
                const t = Math.sign(zeta) / (Math.abs(zeta) + Math.sqrt(1 + zeta * zeta));
                const cs = 1 / Math.sqrt(1 + t * t), sn = cs * t;
                for (let k = 0; k < m; k++) {
                    const ui = U[k][i], uj = U[k][j];
                    U[k][i] = cs * ui - sn * uj;
                    U[k][j] = sn * ui + cs * uj;
                }
                for (let k = 0; k < n; k++) {
                    const vi = V[k][i], vj = V[k][j];
                    V[k][i] = cs * vi - sn * vj;
                    V[k][j] = sn * vi + cs * vj;
                }
            }
        }
        if (maxOff < 1e-12) break;
    }

    const sigma = [];
    for (let j = 0; j < n; j++) {
        let s = 0;
        for (let i = 0; i < m; i++) s += U[i][j] * U[i][j];
        sigma[j] = Math.sqrt(s);
        if (sigma[j] > 1e-12) {
            for (let i = 0; i < m; i++) U[i][j] /= sigma[j];
        }
    }
    return { U, sigma, V };
}

// ==================== 3. Thomson 优化 ====================
function optimizeThomson(n, maxIter = 200, lr = 0.1) {
    if (n <= 1) return [[0, 0, 1]];
    let points = [];
    const gr = (1 + Math.sqrt(5)) / 2;
    for (let i = 0; i < n; i++) {
        const y = 1 - (i / (n - 1)) * 2, rad = Math.sqrt(1 - y * y), t = TWO_PI * i / gr;
        points.push([Math.cos(t) * rad, y, Math.sin(t) * rad]);
    }
    for (let iter = 0; iter < maxIter; iter++) {
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
            points[i][0] -= lr * grad[i][0]; points[i][1] -= lr * grad[i][1]; points[i][2] -= lr * grad[i][2];
            const norm = Math.sqrt(points[i][0] ** 2 + points[i][1] ** 2 + points[i][2] ** 2);
            points[i] = [points[i][0] / norm, points[i][1] / norm, points[i][2] / norm];
        }
        if (iter % 50 === 0) lr *= 0.8;
    }
    return points;
}

// ==================== 4. 轨道峰值方向（当前实现） ====================
function getOrbitalPeakDirection(orbitalParam) {
    const { l, m, t } = orbitalParam.angKey;

    if (l === 0) return [0, 0, 1];        // s -> z 轴

    if (l === 1) {
        if (m === 0) return [0, 0, 1];        // pz -> z 轴
        if (m === 1 && t === 'c') return [1, 0, 0];  // px -> x 轴
        if (m === 1 && t === 's') return [0, 1, 0];  // py -> y 轴
    }

    if (l === 2) {
        if (m === 0) return [0, 0, 1];        // dz2 -> z 轴
        if (m === 1 && t === 'c') return [1, 0, 1];  // dxz -> xz 平面
        if (m === 1 && t === 's') return [0, 1, 1];  // dyz -> yz 平面
        if (m === 2 && t === 'c') return [1, 1, 0];  // dx2-y2 -> xy 平面
        if (m === 2 && t === 's') return [1, 1, 0];  // dxy -> xy 平面
    }

    return [0, 0, 1];
}

// 从给定初始方向开始进行 Thomson 优化
function optimizeThomsonFromInitial(initialPoints, maxIter = 200, lr = 0.1) {
    const n = initialPoints.length;
    if (n <= 1) return initialPoints.map(p => [...p]);

    let points = initialPoints.map(p => {
        const norm = Math.sqrt(p[0] ** 2 + p[1] ** 2 + p[2] ** 2) || 1;
        return [p[0] / norm, p[1] / norm, p[2] / norm];
    });

    for (let iter = 0; iter < maxIter; iter++) {
        const grad = points.map(() => [0, 0, 0]);
        for (let i = 0; i < n; i++) {
            for (let j = i + 1; j < n; j++) {
                const dx = points[i][0] - points[j][0];
                const dy = points[i][1] - points[j][1];
                const dz = points[i][2] - points[j][2];
                const d2 = dx * dx + dy * dy + dz * dz;
                const d3 = d2 * Math.sqrt(d2) + 1e-10;
                grad[i][0] -= dx / d3; grad[i][1] -= dy / d3; grad[i][2] -= dz / d3;
                grad[j][0] += dx / d3; grad[j][1] += dy / d3; grad[j][2] += dz / d3;
            }
        }
        for (let i = 0; i < n; i++) {
            points[i][0] -= lr * grad[i][0];
            points[i][1] -= lr * grad[i][1];
            points[i][2] -= lr * grad[i][2];
            const norm = Math.sqrt(points[i][0] ** 2 + points[i][1] ** 2 + points[i][2] ** 2);
            points[i] = [points[i][0] / norm, points[i][1] / norm, points[i][2] / norm];
        }
        if (iter % 50 === 0) lr *= 0.8;
    }
    return points;
}

// ==================== 5. 杂化系数计算（当前实现） ====================
function sortOrbitalsForHybridization(paramsList) {
    return [...paramsList].sort((a, b) => {
        if (a.l !== b.l) return a.l - b.l;
        if (a.n !== b.n) return a.n - b.n;
        const score = p => {
            if (p.l === 1) return (p.angKey.m === 1 && p.angKey.t === 'c') ? 1 : (p.angKey.m === 1 && p.angKey.t === 's' ? 2 : 3);
            if (p.l === 2) return (p.angKey.m === 2 && p.angKey.t === 'c') ? 1 : (p.angKey.m === 0 ? 2 : 3 + p.angKey.m);
            return 0;
        };
        return score(a) - score(b);
    });
}

function generateConstrainedDirections_NEW(orbitalParams) {
    const n = orbitalParams.length;
    if (n <= 1) {
        return [getOrbitalPeakDirection(orbitalParams[0])];
    }

    // 获取 Fibonacci 均匀分布作为基础
    const fibDirs = getFibonacciDirections(n);

    // 收集非 s 轨道的峰值方向（有明确方向性的轨道）
    const nonS_orbitals = orbitalParams.filter(p => p.angKey.l !== 0);
    const nonS_peaks = nonS_orbitals.map(p => getOrbitalPeakDirection(p));

    // 构建初始方向：对于每个非 s 轨道，替换最近的未使用的 Fibonacci 方向
    const initialDirs = [...fibDirs];
    const usedIndices = new Set();

    for (const peak of nonS_peaks) {
        // 找到最近的未使用的 Fibonacci 方向
        let bestIdx = -1;
        let bestDot = -Infinity;
        for (let i = 0; i < n; i++) {
            if (usedIndices.has(i)) continue;
            const dot = peak[0] * fibDirs[i][0] + peak[1] * fibDirs[i][1] + peak[2] * fibDirs[i][2];
            if (dot > bestDot) {
                bestDot = dot;
                bestIdx = i;
            }
        }
        if (bestIdx >= 0) {
            // 用峰值方向替换
            const norm = Math.sqrt(peak[0] ** 2 + peak[1] ** 2 + peak[2] ** 2);
            initialDirs[bestIdx] = [peak[0] / norm, peak[1] / norm, peak[2] / norm];
            usedIndices.add(bestIdx);
        }
    }

    return optimizeThomsonFromInitial(initialDirs);
}

// 生成 N 个 Fibonacci 球面均匀分布的方向
function getFibonacciDirections(n) {
    if (n <= 1) return [[0, 0, 1]];
    const gr = (1 + Math.sqrt(5)) / 2;
    const dirs = [];
    for (let i = 0; i < n; i++) {
        const y = 1 - (i / (n - 1)) * 2;
        const rad = Math.sqrt(1 - y * y);
        const t = TWO_PI * i / gr;
        dirs.push([Math.cos(t) * rad, y, Math.sin(t) * rad]);
    }
    return dirs;
}

function generateConstrainedDirections_OLD(orbitalParams) {
    return optimizeThomson(orbitalParams.length);
}

function buildDirectionMatrix(directions, orbitalParams) {
    return directions.map(d => {
        const norm = Math.sqrt(d[0] ** 2 + d[1] ** 2 + d[2] ** 2);
        const x = d[0] / norm, y = d[1] / norm, z = d[2] / norm;
        const theta = Math.acos(Math.max(-1, Math.min(1, z)));
        const phi = Math.atan2(y, x);
        return orbitalParams.map(p => {
            const { l, m, t } = p.angKey;
            return realYlm_value(l, m, t, theta, phi);
        });
    });
}

function getHybridCoefficients(orbitalParams, useNewMethod = true) {
    const sorted = sortOrbitalsForHybridization(orbitalParams);
    const directions = useNewMethod ?
        generateConstrainedDirections_NEW(sorted) :
        generateConstrainedDirections_OLD(sorted);
    const A = buildDirectionMatrix(directions, sorted);
    const { U, V } = jacobiSVD(A);
    return matMul(U, matTranspose(V));
}

// ==================== 6. 轨道参数定义 ====================
function orbitalParamsFromKey(key) {
    const R = (n, l, m, t) => ({ n, l, angKey: { l, m, t } });
    switch (key) {
        case '2s': return R(2, 0, 0, 'c');
        case '2pz': return R(2, 1, 0, 'c');
        case '2px': return R(2, 1, 1, 'c');
        case '2py': return R(2, 1, 1, 's');
        case '3s': return R(3, 0, 0, 'c');
        case '3pz': return R(3, 1, 0, 'c');
        case '3px': return R(3, 1, 1, 'c');
        case '3py': return R(3, 1, 1, 's');
        case '3d_z2': return R(3, 2, 0, 'c');
        case '3d_xz': return R(3, 2, 1, 'c');
        case '3d_yz': return R(3, 2, 1, 's');
        case '3d_xy': return R(3, 2, 2, 's');
        case '3d_x2-y2': return R(3, 2, 2, 'c');
        default: return null;
    }
}

// ==================== 7. 测试用例 ====================
function runTests() {
    console.log('='.repeat(60));
    console.log('杂化轨道系数算法离屏测试');
    console.log('='.repeat(60));

    const testCases = [
        { name: 'sp (2s + 2px)', orbitals: ['2s', '2px'] },
        { name: 'sp2 (2s + 2px + 2py)', orbitals: ['2s', '2px', '2py'] },
        { name: 'sp3 (2s + 2px + 2py + 2pz)', orbitals: ['2s', '2px', '2py', '2pz'] },
        { name: 'sp3d (3s + 3px + 3py + 3pz + 3d_z2)', orbitals: ['3s', '3px', '3py', '3pz', '3d_z2'] },
        { name: '2px only', orbitals: ['2px'] },
        { name: '2px + 2py (orthogonal p)', orbitals: ['2px', '2py'] },
    ];

    for (const tc of testCases) {
        console.log('\n' + '-'.repeat(50));
        console.log(`测试: ${tc.name}`);
        console.log('-'.repeat(50));

        const params = tc.orbitals.map(k => orbitalParamsFromKey(k));
        const sorted = sortOrbitalsForHybridization(params);

        console.log('轨道顺序:', sorted.map(p => `n=${p.n},l=${p.l},m=${p.angKey.m},t=${p.angKey.t}`).join(' | '));

        // 新方法
        const dirsNew = generateConstrainedDirections_NEW(sorted);
        console.log('\n新方法方向:');
        dirsNew.forEach((d, i) => console.log(`  Dir ${i}: [${d.map(x => x.toFixed(4)).join(', ')}]`));

        const coeffsNew = getHybridCoefficients(params, true);
        console.log('\n新方法系数矩阵:');
        coeffsNew.forEach((row, i) => console.log(`  Hybrid ${i}: [${row.map(x => x.toFixed(4)).join(', ')}]`));

        // 验证：检查每行是否有非零系数
        let hasZeroRow = false;
        for (let i = 0; i < coeffsNew.length; i++) {
            const rowSum = coeffsNew[i].reduce((s, x) => s + Math.abs(x), 0);
            if (rowSum < 0.01) {
                console.log(`  ⚠️ 警告: 第 ${i} 行系数接近零!`);
                hasZeroRow = true;
            }
        }

        // 验证：检查每列是否有非零系数（即每个轨道是否被使用）
        let hasZeroCol = false;
        for (let j = 0; j < sorted.length; j++) {
            const colSum = coeffsNew.reduce((s, row) => s + Math.abs(row[j]), 0);
            if (colSum < 0.01) {
                console.log(`  ⚠️ 警告: 第 ${j} 列系数接近零（轨道未被使用）!`);
                hasZeroCol = true;
            }
        }

        // 验证：正交性检查 (C * C^T 应该是单位矩阵)
        const CT = matTranspose(coeffsNew);
        const CCT = matMul(coeffsNew, CT);
        console.log('\n正交性检查 (C·C^T):');
        let orthogonalityOK = true;
        for (let i = 0; i < CCT.length; i++) {
            const expected = CCT[i].map((_, j) => i === j ? 1 : 0);
            const diff = CCT[i].map((x, j) => Math.abs(x - expected[j]));
            const maxDiff = Math.max(...diff);
            if (maxDiff > 0.01) {
                orthogonalityOK = false;
            }
            console.log(`  Row ${i}: [${CCT[i].map(x => x.toFixed(4)).join(', ')}]`);
        }

        if (!hasZeroRow && !hasZeroCol && orthogonalityOK) {
            console.log('\n✅ 测试通过');
        } else {
            console.log('\n❌ 测试失败');
        }

        // 旧方法对比
        console.log('\n--- 旧方法对比 ---');
        const dirsOld = generateConstrainedDirections_OLD(sorted);
        console.log('旧方法方向:');
        dirsOld.forEach((d, i) => console.log(`  Dir ${i}: [${d.map(x => x.toFixed(4)).join(', ')}]`));

        const coeffsOld = getHybridCoefficients(params, false);
        console.log('旧方法系数矩阵:');
        coeffsOld.forEach((row, i) => console.log(`  Hybrid ${i}: [${row.map(x => x.toFixed(4)).join(', ')}]`));
    }

    console.log('\n' + '='.repeat(60));
    console.log('测试完成');
    console.log('='.repeat(60));
}

runTests();
