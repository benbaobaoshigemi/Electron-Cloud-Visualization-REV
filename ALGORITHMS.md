# 核心算法技术文档 (v3.0 物理深度解析版)

本文档旨在提供对本项目物理引擎的**严格物理层级**解析。本文不仅描述算法实现，更侧重于揭示底层的物理近似、数学工具的选用依据以及系统边界。

**核心约定**：
*   所有计算均在**原子单位制 (Atomic Units, a.u.)** 下进行：$\hbar = m_e = e = 1 / 4\pi\epsilon_0 = 1$。
*   长度单位为玻尔半径 ($a_0$)，能量单位为 Hartree ($E_h$)。

---

## 1. 物理模型边界与局限性 (Critical Physics Limitations)

本项目并非全功能的量子化学计算软件（如 Gaussian 或 VASP），而是一个侧重于**实时可视化**的物理引擎。必须明确以下核心近似：

### 1.1 哈密顿量近似
我们求解的是**非相对论性、定核、定态薛定谔方程**：
$$ H = -\sum_i \frac{1}{2}\nabla_i^2 - \sum_i \frac{Z}{r_i} + \sum_{i<j} \frac{1}{|r_i - r_j|} $$

*   **非相对论近似 (Non-relativistic Limit)**：
    *   我们在 $Z \le 54$ (Xe) 范围内主要使用非相对论基组。
    *   **严重局限**：对于重元素（如 Au, Hg, U），内层电子速度接近光速，相对论效应（质量修正、Darwin 项）显著收缩 $s$ 轨道并扩张 $d/f$ 轨道。虽然代码库中包含 `Au_R` (Relativistic Gold) 等特定修正数据，但总体上**忽略了自旋-轨道耦合 (Spin-Orbit Coupling)** 导致能级分裂（如 $2p_{1/2}, 2p_{3/2}$ degeneracy breaking）。
*   **单电子近似 (Single Particle Approximation)**：
    *   我们展示的是 **Hartree-Fock (HF)** 意义下的单电子轨道。这意味着忽略了**电子关联能 (Electron Correlation Energy)**。因此，电子云形状是“平均场”下的结果，无法体现多体波函数的纠缠特性。

### 1.2 冻结核近似 (Frozen Core Approximation)
`slater_basis.js` 中的基组参数是针对**基态 (Ground State)** 原子优化的。
*   当用户可视化激发态（例如碳原子的 $5d$ 轨道）时，我们使用的是基态原子的内层电子屏蔽参数。
*   **误差分析**：这会引入显著误差，因为激发态电子感受到的有效核电荷 $Z_{eff}$ 与基态完全不同。可视化的高激发态仅具有定性的拓扑正确性，能量和半径可能有较大偏差。

---

## 2. 氢原子：解析解的数值稳定性

文件: `physics.js`

对于 $Z=1$ 系统，我们求解：
$$ -\frac{1}{2}\nabla^2\psi - \frac{1}{r}\psi = E\psi $$

### 2.1 广义拉盖尔多项式 (Generalized Laguerre Polynomials)
径向波函数 $R_{nl}(r) \propto e^{-\rho/2} \rho^l L_{n-l-1}^{2l+1}(\rho)$。

**物理惯例警告**：
数学界（如 Mathematica）与物理界（量子力学教材）对拉盖尔多项式的定义可能相差一个阶乘因子 $(n+l)!$。
*   本项目采用了**物理学家惯例**，确保归一化条件 $\int_0^\infty R_{nl}^2 r^2 dr = 1$ 严格成立。
*   **数值陷阱**：直接计算 $L_n^\alpha(x)$ 的封闭形式会在 $n>20$ 时溢出。我们实现了 **三项递推 (Three-Term Recurrence)** 算法：
    $$ (n+1)L_{n+1}^{(\alpha)}(x) = (2n+1+\alpha-x)L_n^{(\alpha)}(x) - (n+\alpha)L_{n-1}^{(\alpha)}(x) $$
    该算法在 $n=1\sim 100$ 范围内具有优异的数值稳定性。

### 2.2 实球谐函数 (Real Spherical Harmonics)
为了可视化轨道波瓣方向，我们只使用实形式 $Y_{lm}$。
**Condon-Shortley 相位**：
代码显式引入了 $(-1)^m$ 相位因子：
$$ Y_{lm} \propto (-1)^m \sqrt{\frac{(2l+1)}{4\pi} \frac{(l-m)!}{(l+m)!}} P_l^m(\cos\theta) e^{im\phi} $$
这确保了基组展开时的正负号与标准量子化学软件（如 Gaussian）一致，避免了 $p_x, p_y$ 混合时的符号混乱。

---

## 3. He-Kr 多电子解析：Koga-STO 基组引擎

文件: `slater_basis.js`, `physics.js`

对于多电子原子，解析解不存在。我们采用 **Roothaan-Hartree-Fock (RHF)** 方法的数值结果。

### 3.1 基组选择：Koga (1999)
代码库实现了 **Koga et al. (1999)** 发表的 "High-precision analytical limits of atomic Hartree-Fock calculations"。
*   **基函数类型**：Slater-Type Orbitals (STOs)。
    $$ \chi(r) = N r^{n-1} e^{-\zeta r} $$
*   **非相对论性**：Koga (1999) 的基组是基于**非相对论**哈密顿量优化的。虽然它们在总能量上达到了 Hartree-Fock 极限（误差 $10^{-9} E_h$），但对于重原子（如 Kr, Xe），忽略相对论效应会导致内层轨道半径偏大，能级偏高。
*   **展开式**：每个原子轨道表示为多个 Slater 函数的线性组合 (LCAO)：
    $$ R_{nl}(r) = \sum_{j=1}^{M} c_j \chi_j(r; n_j, \zeta_j) $$
    例如，碳原子的 $2p$ 轨道由 4 个不同的 STO 组合而成，以精确模拟径向节点的缺失和尾部衰减。

### 3.2 构型平均 (Configuration Averaging)
对于开壳层原子（Open-shell atoms，如 C, O），Hartree-Fock 轨道依赖于具体的 $L,S$ 耦合态。
*   **近似**：本项目使用了**构型平均 (Average of Configuration)** 的轨道参数。即我们不区分 $2p_x, 2p_y, 2p_z$ 在晶体场下的微小差异，认为它们是简并的。

---

## 4. 有效核电荷 $Z_{eff}$：从 $V_{ee}$ 反推

文件: `physics.js` -> `calculateZeff`

教科书通常只给出 Slater Rules 的常数 $Z_{eff}$。本项目实现了**空间分辨 (Spatially Resolved)** 的 $Z_{eff}(r)$。

### 4.1 理论定义
基于重构核势的思想，可以定义一个等效的核电荷 $Z_{eff}(r)$，使得该点的总势能 $V(r)$ 看起来像是一个类氢势：
$$ V(r) = -\frac{Z_{eff}(r)}{r} $$
代入总势能 $V(r) = -\frac{Z}{r} + V_{ee}(r)$：
$$ -\frac{Z_{eff}(r)}{r} = -\frac{Z}{r} + V_{ee}(r) \implies Z_{eff}(r) = Z - r \cdot V_{ee}(r) $$

### 4.2 电子-电子排斥势 $V_{ee}(r)$
这是 Hartree-Fock 方程中的库仑势 (Coulomb) 和交换势 (Exchange) 部分的球平均。
*   **预计算 (Pre-computation)**：由于计算 $V_{ee}$ 需要对所有被占轨道进行双重积分，极为耗时。我们采用了 Look-up Table (LUT) 策略，存储在 `VeeCache` 中。
*   **插值**：运行时通过二分查找 + 线性插值获取 $V_{ee}$。
*   **物理意义**：当 $r \to 0$，电子穿透到核附近，$r V_{ee} \to 0$，故 $Z_{eff} \to Z$（裸核）；当 $r \to \infty$，电子在该壳层之外，$Z_{eff} \to Z - (N-1)$（完全屏蔽）。

---

## 5. 能量图表计算：重构动能 (Reconstructed Kinetic Energy)

为了在前端绘制 $E(r), T(r), V(r)$ 曲线，我们必须处理数值导数的问题。

### 5.1 动能陷阱 (Kinetic Energy Pitfall)
通常动能算符是 $\hat{T} = -\frac{1}{2}\nabla^2$。对于 STO 基组，波函数在 $r=0$ 处有尖点（Cusp），导致二阶导数出现 Dirac $\delta$ 函数或剧烈震荡。直接数值微分会导致图表在原点附近充满噪声。

### 5.2 逆向重构法 (Reverse Reconstruction)
我们利用薛定谔方程作为恒等式：
$$ \hat{T}\psi + \hat{V}\psi = E_{orb}\psi \implies T_{local}(r) = E_{orb} - V_{total}(r) $$

*   $E_{orb}$：是 Koga 论文中给出的精确轨道本征值（Eigenvalues）。
*   $V_{total}(r)$：是解析计算的 $V_{nuc}$ 加上插值得到的 $V_{ee}$。
*   **优势**：这种方法从数学上保证了 $T(r)$ 的平滑性，完美规避了 Cusp 处的数值微分问题，且确保 $T+V$ 在任何位置都精确等于常数 $E_{orb}$。

---

## 6. 核心采样算法 (Sampling Algorithms)

这是本项目实现“百万级点云”实时生成的关键。

### 6.1 径向：精确逆 CDF (Exact Inverse CDF)
对于径向分布函数 $P(r) = r^2 |R(r)|^2$，我们拒绝使用效率低下的 Metropolis-Hastings。
*   **实现**：
    1.  预计算 CDF: $F(r) = \int_0^r P(t) dt$（4000 个采样点，梯形积分）。
    2.  逆变换：生成均匀随机数 $\xi \in [0,1]$，求解 $F(r) = \xi$。
*   **精度保证**：由于 CDF 是单调递增的，二分查找 (Binary Search) 保证了 $O(\log N)$ 的时间复杂度。由于 $P(r)$ 是平滑函数，线性插值带来的误差远小于像素分辨率。
*   **无拒绝 (Rejection-Free)**：此步骤效率为 100%。

### 6.2 角向：局部拒绝采样 (Local Rejection)
角向分布 $|Y_{lm}(\theta, \phi)|^2$ 比较复杂，且难以构建 2D 逆 CDF。
*   **策略**：我们在单位球面上均匀布点，但按概率拒绝。
*   **优化**：由于 $Y_{lm}$ 的最大值 $M_{max}$ 已知（或容易估算），接受率通常在 30%-50% 之间，远高于全局 3D 采样的 <1%。

### 6.3 摩尔纹 (Moiré Patterns) 与抖动 (Dithering)
*   **现象**：由于逆 CDF 表的离散性（4000点），在生成数百万个粒子时，径向会出现肉眼可见的同心圆环（离散化伪影）。
*   **解决方案**：在最终坐标上叠加幅度为 $0.01 a_0$ 的高斯噪声（Dithering）。这是一种计算机图形学中的 Anti-aliasing 技术，物理上对应于海森堡测不准原理的微扰，但在视觉上有效消除了人工纹理。

---

## 7. 等值面提取：Marching Cubes 算法

文件: `marching_cubes.js`, `isosurface-worker.js`

### 7.1 并行计算架构
为了不阻塞 UI 线程（保持拖拽旋转流畅），等值面计算完全卸载到 Web Worker。
*   **Transferable Objects**：主线程与 Worker 之间传输大量顶点数据时，使用 `ArrayBuffer` 的所有权转移（Transfer），实现零拷贝 (Zero-copy) 通信。

### 7.2 连通域分离 (Connected Component Analysis)
这是正确渲染 $p, d, f$ 轨道相位的关键。
*   **问题**：$2p_z$ 轨道由正瓣（上）和负瓣（下）组成。Marching Cubes 输出的是一堆无序三角形。
*   **算法**：
    1.  建立三角形邻接图。
    2.  执行广度优先搜索 (BFS) 或并查集 (Union-Find) 将网格分离为独立的连通子网格。
    3.  对每个子网格，计算其几何中心的波函数值 $\psi$。
    4.  若 $\psi > 0$ 染蓝色，$\psi < 0$ 染红色。
*   **鲁棒性**：该算法能自动处理任意复杂的轨道形状（如 $d_{z^2}$ 的环形瓣），无需硬编码几何规则。

---

## 8. 杂化轨道自适应对齐 (Adaptive Hybridization Alignment)

为了解决随机生成的几何构型 (Thomson Points) 与各向异性基组（如 $d_{z^2}$）的不对齐问题，我们引入了**四元数旋转优化器**。

### 8.1 核心原理
算法寻找一个最佳旋转 $q$，使得基组在几何构型上的投影矩阵 $A$ 的体积最大化：
$$ J(q) = \sum \log(\sigma_k(A(q))) $$
其中 $\sigma_k$ 是投影矩阵的奇异值。最大化这些奇异值的对数和等价于最大化投影体积（det值），确保几何构型与基组最匹配。

### 8.2 优势
- **sp3d (TBP)**: 自动将轴向对齐到 Z 轴，使 $d_{z^2}$ 正确参与轴向成键。
- **sp3d2 (Oct)**: 自动对齐 XYZ 轴，实现轨道成分的完美解耦。
- **通用性**: 支持任意 $s, p, d$ 轨道的组合，无需硬编码。
- **鲁棒性**: 能够检测并处理“线性相关”或“不兼容”的杂化请求（此时体积 $\det \to 0$）。

### 8.3 实现细节
- **优化算法**: Random Restart Hill Climbing (20 次重启，每次 50 步迭代)。
- **数学库**: 内置微型四元数库 (`physics-core.js`)。
- **性能**: 计算量极小，通常在 <5ms 内收敛。

---
*文档生成规范：基于 v3.0 物理引擎代码审计*
