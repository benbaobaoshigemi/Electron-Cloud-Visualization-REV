/**
 * Clementi-Roetti STO 基组数据表
 * 
 * 参考文献: E. Clementi and C. Roetti, 
 *           Atomic Data and Nuclear Data Tables 14, 177-478 (1974)
 * 
 * 每个原子轨道展开为多个 STO 基函数的线性组合:
 *   φ_nl(r) = Σ c_i × r^(n*_i - 1) × exp(-ζ_i × r) × Y_lm(θ,φ)
 * 
 * 其中:
 *   - c_i: 展开系数 (coeff)
 *   - n*_i: 有效主量子数 (nStar)
 *   - ζ_i (zeta): 轨道指数 (Bohr^-1)
 * 
 * 【复用说明】
 * 与现有氢原子算法的关系:
 *   1. 径向波函数: 需要新函数 slaterRadialR()，替代 radialR()
 *   2. 球谐函数: 完全复用 realYlm_value()，Y_lm 不变
 *   3. 杂化系数: 完全复用 getHybridCoefficients()
 *   4. 采样算法: 完全复用拒绝采样/重要性采样框架
 *   5. 密度计算: 结构复用 |ψ|² = |R(r)|² × |Y_lm|²
 */

window.SlaterBasis = {
    // 版本信息
    version: '1.0',
    reference: 'Clementi-Roetti (1974)',

    // ==================== 第1周期 ====================

    // 氢 (Z=1) - 解析解，作为参考
    'H': {
        Z: 1,
        name: 'Hydrogen',
        groundState: '1s¹',
        orbitals: {
            '1s': [
                { nStar: 1, zeta: 1.0000, coeff: 1.0000 }
            ]
        }
    },

    // 氦 (Z=2)
    'He': {
        Z: 2,
        name: 'Helium',
        groundState: '1s²',
        orbitals: {
            '1s': [
                { nStar: 1, zeta: 1.6875, coeff: 1.0000 }
            ]
        }
    },

    // ==================== 第2周期 ====================

    // 锂 (Z=3)
    'Li': {
        Z: 3,
        name: 'Lithium',
        groundState: '1s²2s¹',
        orbitals: {
            '1s': [
                { nStar: 1, zeta: 2.6906, coeff: 1.0000 }
            ],
            '2s': [
                { nStar: 1, zeta: 2.6906, coeff: -0.0522 },
                { nStar: 2, zeta: 0.6396, coeff: 1.0318 }
            ]
        }
    },

    // 铍 (Z=4)
    'Be': {
        Z: 4,
        name: 'Beryllium',
        groundState: '1s²2s²',
        orbitals: {
            '1s': [
                { nStar: 1, zeta: 3.6848, coeff: 1.0000 }
            ],
            '2s': [
                { nStar: 1, zeta: 3.6848, coeff: -0.0744 },
                { nStar: 2, zeta: 0.9560, coeff: 1.0342 }
            ]
        }
    },

    // 硼 (Z=5)
    'B': {
        Z: 5,
        name: 'Boron',
        groundState: '1s²2s²2p¹',
        orbitals: {
            '1s': [
                { nStar: 1, zeta: 4.6795, coeff: 1.0000 }
            ],
            '2s': [
                { nStar: 1, zeta: 4.6795, coeff: -0.0970 },
                { nStar: 2, zeta: 1.2107, coeff: 1.0407 }
            ],
            '2p': [
                { nStar: 2, zeta: 1.0234, coeff: 1.0000 }
            ]
        }
    },

    // 碳 (Z=6) - 重点元素
    'C': {
        Z: 6,
        name: 'Carbon',
        groundState: '1s²2s²2p²',
        orbitals: {
            '1s': [
                { nStar: 1, zeta: 5.6727, coeff: 0.1575 },
                { nStar: 1, zeta: 3.6360, coeff: 0.8527 }
            ],
            '2s': [
                { nStar: 1, zeta: 5.6727, coeff: -0.0387 },
                { nStar: 1, zeta: 3.6360, coeff: -0.0803 },
                { nStar: 2, zeta: 1.4293, coeff: 0.5765 },
                { nStar: 2, zeta: 0.6233, coeff: 0.5139 }
            ],
            '2p': [
                { nStar: 2, zeta: 1.4617, coeff: 0.4867 },
                { nStar: 2, zeta: 0.6239, coeff: 0.5927 }
            ]
        }
    },

    // 氮 (Z=7) - 重点元素
    'N': {
        Z: 7,
        name: 'Nitrogen',
        groundState: '1s²2s²2p³',
        orbitals: {
            '1s': [
                { nStar: 1, zeta: 6.6651, coeff: 0.1470 },
                { nStar: 1, zeta: 4.3168, coeff: 0.8620 }
            ],
            '2s': [
                { nStar: 1, zeta: 6.6651, coeff: -0.0349 },
                { nStar: 1, zeta: 4.3168, coeff: -0.0748 },
                { nStar: 2, zeta: 1.7816, coeff: 0.5700 },
                { nStar: 2, zeta: 0.7855, coeff: 0.5196 }
            ],
            '2p': [
                { nStar: 2, zeta: 1.9170, coeff: 0.4653 },
                { nStar: 2, zeta: 0.8108, coeff: 0.6077 }
            ]
        }
    },

    // 氧 (Z=8) - 重点元素
    'O': {
        Z: 8,
        name: 'Oxygen',
        groundState: '1s²2s²2p⁴',
        orbitals: {
            '1s': [
                { nStar: 1, zeta: 7.6579, coeff: 0.1396 },
                { nStar: 1, zeta: 4.9922, coeff: 0.8687 }
            ],
            '2s': [
                { nStar: 1, zeta: 7.6579, coeff: -0.0325 },
                { nStar: 1, zeta: 4.9922, coeff: -0.0702 },
                { nStar: 2, zeta: 2.1406, coeff: 0.5612 },
                { nStar: 2, zeta: 0.9528, coeff: 0.5251 }
            ],
            '2p': [
                { nStar: 2, zeta: 2.3683, coeff: 0.4492 },
                { nStar: 2, zeta: 0.9997, coeff: 0.6188 }
            ]
        }
    },

    // 氟 (Z=9)
    'F': {
        Z: 9,
        name: 'Fluorine',
        groundState: '1s²2s²2p⁵',
        orbitals: {
            '1s': [
                { nStar: 1, zeta: 8.6501, coeff: 0.1339 },
                { nStar: 1, zeta: 5.6675, coeff: 0.8736 }
            ],
            '2s': [
                { nStar: 1, zeta: 8.6501, coeff: -0.0307 },
                { nStar: 1, zeta: 5.6675, coeff: -0.0662 },
                { nStar: 2, zeta: 2.5050, coeff: 0.5536 },
                { nStar: 2, zeta: 1.1221, coeff: 0.5296 }
            ],
            '2p': [
                { nStar: 2, zeta: 2.8252, coeff: 0.4373 },
                { nStar: 2, zeta: 1.1912, coeff: 0.6269 }
            ]
        }
    },

    // 氖 (Z=10)
    'Ne': {
        Z: 10,
        name: 'Neon',
        groundState: '1s²2s²2p⁶',
        orbitals: {
            '1s': [
                { nStar: 1, zeta: 9.6421, coeff: 0.1293 },
                { nStar: 1, zeta: 6.3421, coeff: 0.8774 }
            ],
            '2s': [
                { nStar: 1, zeta: 9.6421, coeff: -0.0292 },
                { nStar: 1, zeta: 6.3421, coeff: -0.0629 },
                { nStar: 2, zeta: 2.8731, coeff: 0.5470 },
                { nStar: 2, zeta: 1.2934, coeff: 0.5333 }
            ],
            '2p': [
                { nStar: 2, zeta: 3.2857, coeff: 0.4279 },
                { nStar: 2, zeta: 1.3839, coeff: 0.6330 }
            ]
        }
    }
};

/**
 * 获取指定原子的可用轨道列表
 */
window.SlaterBasis.getAvailableOrbitals = function (atomSymbol) {
    const atom = this[atomSymbol];
    if (!atom) return [];
    return Object.keys(atom.orbitals);
};

/**
 * 获取基组参数
 */
window.SlaterBasis.getBasis = function (atomSymbol, orbitalKey) {
    const atom = this[atomSymbol];
    if (!atom || !atom.orbitals[orbitalKey]) return null;
    return atom.orbitals[orbitalKey];
};

/**
 * 获取所有可用原子列表
 */
window.SlaterBasis.getAtomList = function () {
    const list = [];
    for (const key in this) {
        if (typeof this[key] === 'object' && this[key].Z) {
            list.push({
                symbol: key,
                Z: this[key].Z,
                name: this[key].name,
                groundState: this[key].groundState
            });
        }
    }
    return list.sort((a, b) => a.Z - b.Z);
};

console.log('SlaterBasis 数据表加载完成，包含元素:',
    window.SlaterBasis.getAtomList().map(a => a.symbol).join(', '));
