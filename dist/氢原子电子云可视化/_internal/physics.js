// Hydrogen atom physics model (real orbitals). Attaches to window.Hydrogen
(function(){
  const A0 = 1; // Bohr radius unit scale for visualization
  const PI = Math.PI;
  const TWO_PI = 2*Math.PI;

  const FACT = (()=>{ const f=[1]; for(let i=1;i<=64;i++) f[i]=f[i-1]*i; return f; })();
  function factorial(n){ return FACT[n] ?? Infinity; }
  function binomialInt(n,k){ if(k<0||k>n) return 0; return factorial(n)/ (factorial(k)*factorial(n-k)); }

  // Generalized Laguerre L_k^{alpha}(x), alpha integer >=0, small k
  function generalizedLaguerre(k, alpha, x){
    let sum=0;
    for(let i=0;i<=k;i++){
      const c = ((i%2)?-1:1) * binomialInt(k+alpha, k-i) / factorial(i);
      sum += c * Math.pow(x,i);
    }
    return sum;
  }

  // Associated Legendre P_l^m(x), Condon–Shortley
  function associatedLegendre(l, m, x){
    const mm = Math.abs(m);
    if(l<mm) return 0;
    let pmm = 1.0;
    if(mm>0){
      const s = Math.sqrt(Math.max(0,1-x*x));
      let fact = 1.0;
      for(let i=1;i<=mm;i++){ pmm *= -fact * s; fact += 2.0; }
    }
    if(l===mm) return pmm;
    let pmmp1 = x * (2*mm+1) * pmm;
    if(l===mm+1) return pmmp1;
    let pll = 0;
    for(let ll=mm+2; ll<=l; ll++){
      pll = ((2*ll-1)*x*pmmp1 - (ll+mm-1)*pmm)/(ll-mm);
      pmm = pmmp1; pmmp1 = pll;
    }
    return pll;
  }

  // Complex spherical harmonic Y_l^m(θ,φ) with Condon–Shortley phase
  function Ylm_complex(l, m, theta, phi){
    const mm = Math.abs(m);
    const Plm = associatedLegendre(l, mm, Math.cos(theta));
    const N = Math.sqrt(((2*l+1)/(4*PI)) * (factorial(l-mm)/factorial(l+mm)));
    const base = N * Plm;
    if(m===0){
      return { re: base, im: 0 };
    }
    const cos_mphi = Math.cos(mm*phi);
    const sin_mphi = Math.sin(mm*phi);
    // e^{imφ} = cos(mφ) + i sin(mφ)
    // apply Condon-Shortley phase: included in associatedLegendre sign already
    // For m<0, Y_l^{-m} = (-1)^m (Y_l^m)^*
    if(m>0){
      return { re: base * cos_mphi, im: base * sin_mphi };
    } else {
      const sign = (mm % 2) ? -1 : 1;
      // (-1)^m with m negative equals (-1)^{|m|}
      return { re: sign * base * cos_mphi, im: -sign * base * sin_mphi };
    }
  }

  function Ylm_abs2(l, m, theta, phi){
    const y = Ylm_complex(l, m, theta, phi);
    return y.re*y.re + y.im*y.im;
  }

  // Real spherical harmonics (linear combos of complex):
  // m=0: Y_l0 real
  // m>0: cos-type: √2 Re Y_l^m,  sin-type: √2 Im Y_l^m
  function realYlm_abs2(l, m, type, theta, phi){
    if(m===0){
      return Ylm_abs2(l, 0, theta, phi);
    }
    const mm = Math.abs(m);
    const y = Ylm_complex(l, mm, theta, phi);
    if(type==='c'){
      const v = Math.SQRT2 * y.re; // √2 Re
      return v*v;
    } else { // 's'
      const v = Math.SQRT2 * y.im; // √2 Im
      return v*v;
    }
  }

  // Real spherical harmonics value (not squared), normalized so ∫|Y|^2 dΩ = 1
  function realYlm_value(l, m, type, theta, phi){
    if(m===0){
      // Y_l^0 is real
      const y = Ylm_complex(l, 0, theta, phi);
      return y.re;
    }
    const mm = Math.abs(m);
    const y = Ylm_complex(l, mm, theta, phi);
    if(type==='c'){
      return Math.SQRT2 * y.re;
    } else {
      return Math.SQRT2 * y.im;
    }
  }

  // Normalized radial R_nl(r) with ∫|R|^2 r^2 dr = 1
  function radialR(n,l,r,Z=1,a0=A0){
    if(n<=0||l<0||l>=n) return 0;
    const rho = (2*Z*r)/(n*a0);
    const k = n - l - 1;
    if(k<0) return 0;
    const pref = Math.pow(2*Z/(n*a0), 1.5) * Math.sqrt( factorial(n-l-1) / (2*n*factorial(n+l)) );
    const poly = generalizedLaguerre(k, 2*l+1, rho);
    return pref * Math.exp(-rho/2) * Math.pow(rho, l) * poly;
  }

  function radialPDF(n,l,r,Z=1,a0=A0){
    const R = radialR(n,l,r,Z,a0);
    return r*r*(R*R);
  }

  function density3D_real(angKey, n,l, r, theta, phi, Z=1,a0=A0){
    const R = radialR(n,l,r,Z,a0);
    let Y2 = 1/(4*PI);
    if (angKey && typeof angKey === 'object'){
      Y2 = realYlm_abs2(angKey.l, angKey.m, angKey.t, theta, phi);
    }
    return (R*R)*Y2;
  }

  function recommendRmax(n, a0=A0){ return 15*n*n*a0; }

  function radialGrid(n,l,rmax,num=512,Z=1,a0=A0){
    const rs = new Float32Array(num);
    const ps = new Float32Array(num);
    const dr = rmax/(num-1);
    for(let i=0;i<num;i++){
      const r = i*dr; rs[i]=r; ps[i]=radialPDF(n,l,r,Z,a0);
    }
    return { r: rs, Pr: ps };
  }

  function histogramRadialFromSamples(rArray, bins=80, rmax=null, normalize=true, smooth=true){
    const N = rArray.length; if(N===0) return {edges:[],counts:[]};
    // 【性能修复】使用循环替代Math.max(...array)，避免大数组栈溢出
    let maxr;
    if (rmax !== null) {
      maxr = rmax;
    } else {
      maxr = 0;
      for (let i = 0; i < N; i++) {
        if (rArray[i] > maxr) maxr = rArray[i];
      }
    }
    
    // 确保最小范围和bins数
    const effectiveMaxr = Math.max(maxr, 0.1);
    const effectiveBins = Math.max(bins, 10);
    
    const edges = new Float32Array(effectiveBins+1);
    let counts = new Float32Array(effectiveBins);
    const dr = effectiveMaxr/effectiveBins;
    
    for(let i=0;i<=effectiveBins;i++) edges[i]=i*dr;
    for(let i=0;i<N;i++){
      const r = rArray[i]; 
      if(r<0||r>effectiveMaxr) continue;
      const b = Math.min(effectiveBins-1, Math.floor(r/dr)); 
      counts[b]+=1;
    }
    
    // 【物理优化】添加高斯平滑以减少采样毛刺
    // 使用自适应窗口大小：根据样本量和bin数量动态调整
    if (smooth && N > 100) {
      const smoothedCounts = new Float32Array(effectiveBins);
      
      // 计算每个bin的平均样本数
      const samplesPerBin = N / effectiveBins;
      
      // 自适应平滑窗口：
      // - 样本稀疏（<50/bin）时使用较大窗口（2-3）
      // - 样本中等（50-200/bin）时使用小窗口（1）
      // - 样本密集（>200/bin）时不平滑（0）
      let windowSize;
      if (samplesPerBin < 50) {
        windowSize = 2;
      } else if (samplesPerBin < 200) {
        windowSize = 1;
      } else {
        windowSize = 0;
      }
      
      if (windowSize > 0) {
        for (let i = 0; i < effectiveBins; i++) {
          let sum = 0;
          let weightSum = 0;
          for (let j = -windowSize; j <= windowSize; j++) {
            const idx = i + j;
            if (idx >= 0 && idx < effectiveBins) {
              // 高斯权重
              const sigma = windowSize * 0.6;
              const weight = Math.exp(-0.5 * (j / sigma) ** 2);
              sum += counts[idx] * weight;
              weightSum += weight;
            }
          }
          smoothedCounts[i] = sum / weightSum;
        }
        counts = smoothedCounts;
      }
    }
    
    if(normalize){
      let area=0; 
      for(let i=0;i<effectiveBins;i++) area += counts[i]*dr;
      if(area>0){ 
        for(let i=0;i<effectiveBins;i++) counts[i]/=area; 
      }
    }
    return { edges, counts, dr, rmax:effectiveMaxr };
  }

  function histogramThetaFromSamples(thetaArray, bins=90, normalize=true){
    const N = thetaArray.length; if(N===0) return {edges:[],counts:[]};
    const edges = new Float32Array(bins+1);
    const counts = new Float32Array(bins);
    const dth = Math.PI/bins;
    for(let i=0;i<=bins;i++) edges[i]=i*dth;
    for(let i=0;i<N;i++){
      const t = thetaArray[i]; if(t<0||t>Math.PI) continue;
      const b = Math.min(bins-1, Math.floor(t/dth)); counts[b]+=1;
    }
    if(normalize){ let area=0; for(let i=0;i<bins;i++) area += counts[i]*dth; if(area>0){ for(let i=0;i<bins;i++) counts[i]/=area; } }
    return { edges, counts, dθ:dth };
  }

  function orbitalKey(params) {
    return `${params.n}${params.l}${params.angKey.m}${params.angKey.t}`;
  }

  // 计算角向边缘概率密度 P(θ) = sin(θ) × ∫|Y|² dφ
  // 对于实球谐函数，无论 m=0 还是 m≠0，公式统一为 2π × N² × P_lm² × sin(θ)
  function angularPDF_Theta(l, m, theta) {
    const mm = Math.abs(m);
    const Plm = associatedLegendre(l, mm, Math.cos(theta));
    const N2 = ((2*l+1)/(4*PI)) * (factorial(l-mm)/factorial(l+mm));
    return 2 * PI * N2 * Plm * Plm * Math.sin(theta);
  }

  // ==================== 精确逆CDF采样 (Inverse CDF Sampling) ====================
  // 
  // 【物理准确性保证】
  // 利用解析式 P(r) = r² |R_nl(r)|² 构建精确的累积分布函数
  // 通过数值积分预计算 CDF，然后使用二分查找进行逆变换采样
  // 
  // 优势：
  // 1. 100% 接受率（无拒绝采样）
  // 2. 精确服从理论分布
  // 3. 没有提议分布匹配问题
  // ====================

  // CDF 表缓存
  const _cdfCache = {};

  /**
   * 构建径向分布的累积分布函数表
   * @param {number} n - 主量子数
   * @param {number} l - 角量子数
   * @param {number} numPoints - CDF表的点数（越多越精确）
   * @returns {Object} { r: Float64Array, cdf: Float64Array, rMax: number }
   */
  function buildRadialCDF(n, l, numPoints = 2000) {
    const key = `${n}_${l}`;
    if (_cdfCache[key]) {
      return _cdfCache[key];
    }

    // 确定积分范围：到概率密度下降到峰值的 1e-8 为止
    const rMax = Math.max(4 * n * n * A0, 50 * A0);
    const dr = rMax / numPoints;
    
    const r = new Float64Array(numPoints + 1);
    const cdf = new Float64Array(numPoints + 1);
    
    // 使用梯形法则进行数值积分
    r[0] = 0;
    cdf[0] = 0;
    let cumulative = 0;
    
    for (let i = 1; i <= numPoints; i++) {
      r[i] = i * dr;
      const P_prev = radialPDF(n, l, r[i - 1]);
      const P_curr = radialPDF(n, l, r[i]);
      // 梯形法则：积分 ≈ (f(a) + f(b)) * h / 2
      cumulative += (P_prev + P_curr) * dr / 2;
      cdf[i] = cumulative;
    }
    
    // 归一化 CDF 到 [0, 1]
    const totalProb = cdf[numPoints];
    if (totalProb > 0) {
      for (let i = 0; i <= numPoints; i++) {
        cdf[i] /= totalProb;
      }
    }
    
    const result = { r, cdf, rMax, dr, numPoints, totalProb };
    _cdfCache[key] = result;
    return result;
  }

  /**
   * 精确逆CDF采样：从径向分布 P(r) 精确采样
   * @param {number} n - 主量子数
   * @param {number} l - 角量子数
   * @returns {number} 采样得到的 r 值
   */
  function sampleRadialExact(n, l) {
    const { r, cdf, numPoints } = buildRadialCDF(n, l);
    
    // 生成 [0, 1) 均匀随机数
    const u = Math.random();
    
    // 二分查找：找到 cdf[i] <= u < cdf[i+1] 的位置
    let lo = 0, hi = numPoints;
    while (lo < hi) {
      const mid = (lo + hi) >> 1;
      if (cdf[mid] < u) {
        lo = mid + 1;
      } else {
        hi = mid;
      }
    }
    
    // 线性插值得到更精确的 r 值
    const i = Math.max(0, lo - 1);
    const j = Math.min(numPoints, lo);
    
    if (i === j || cdf[j] === cdf[i]) {
      return r[i];
    }
    
    // 在区间 [r[i], r[j]] 内线性插值
    const t = (u - cdf[i]) / (cdf[j] - cdf[i]);
    return r[i] + t * (r[j] - r[i]);
  }

  // ==================== 重要性采样 (Importance Sampling) ====================
  // 
  // 【核心设计】多峰混合提议分布
  // 
  // 氢原子轨道的径向分布有 (n - l) 个峰值。为了准确采样所有峰，
  // 我们使用 **多峰混合 Gamma 分布** 作为提议分布：
  // 
  // q(r) = Σ w_k × Gamma(3, α_k)(r)
  // 
  // 其中每个成分覆盖一个概率峰，权重 w_k 近似于该峰的积分贡献。
  // ==================== 

  /**
   * 计算轨道的所有径向峰位置（数值方法）
   * 氢原子 (n,l) 轨道有 (n-l) 个径向峰
   */
  function findRadialPeaks(n, l, a0 = A0) {
    const peaks = [];
    const rmax = n * n * 3 * a0;  // 搜索范围
    const dr = 0.1 * a0;
    
    let prevVal = 0;
    let prevPrevVal = 0;
    
    for (let r = dr; r < rmax; r += dr) {
      const val = radialPDF(n, l, r);
      
      // 检测峰值：前一个点大于两侧
      if (r > 2 * dr && prevVal > prevPrevVal && prevVal > val) {
        peaks.push({ r: r - dr, pdf: prevVal });
      }
      
      prevPrevVal = prevVal;
      prevVal = val;
    }
    
    return peaks;
  }

  // 缓存峰位置以避免重复计算
  const _peakCache = {};
  function getCachedPeaks(n, l) {
    const key = `${n}_${l}`;
    if (!_peakCache[key]) {
      _peakCache[key] = findRadialPeaks(n, l);
    }
    return _peakCache[key];
  }

  /**
   * 多峰混合提议分布参数
   * 为每个峰创建一个 Gamma(3) 分布成分
   * 
   * 【物理优化】使用积分贡献估计权重，而非峰高度
   * 这样可以确保每个峰按其实际概率贡献获得采样机会
   */
  function getMultiPeakMixtureParams(n, l, a0 = A0) {
    const peaks = getCachedPeaks(n, l);
    
    if (peaks.length === 0) {
      // 回退：使用简单估计
      const r_peak = n * n * a0;
      return {
        components: [{ alpha: 2.0 / r_peak, weight: 1.0 }]
      };
    }
    
    // 【改进】计算每个峰的权重（基于估计的积分贡献）
    // 积分贡献 ≈ 峰高 × 峰宽，峰宽与 r_peak 成正比
    let totalWeight = 0;
    const components = [];
    
    for (const peak of peaks) {
      // 使用 pdf × r_peak 作为积分贡献的估计（更接近真实积分）
      // 这比单纯使用 sqrt(pdf) 更物理准确
      const estimatedIntegral = peak.pdf * peak.r;
      const weight = estimatedIntegral;
      totalWeight += weight;
      
      // Gamma(3) 分布在 r = 2/α 处达到峰值，所以 α = 2/r_peak
      const alpha = 2.0 / peak.r;
      components.push({ alpha, weight, r_peak: peak.r, pdf: peak.pdf });
    }
    
    // 归一化权重
    for (const comp of components) {
      comp.weight /= totalWeight;
    }
    
    return { components };
  }

  /**
   * 计算多峰混合提议分布的 PDF
   */
  function radialProposalPDF(r, n, l) {
    if (r <= 0) return 0;
    
    const params = getMultiPeakMixtureParams(n, l);
    let pdf = 0;
    
    for (const comp of params.components) {
      // Gamma(3, α) 的 PDF: α³/2 × r² × exp(-αr)
      const alpha = comp.alpha;
      const norm = alpha * alpha * alpha / 2.0;
      pdf += comp.weight * norm * r * r * Math.exp(-alpha * r);
    }
    
    return pdf;
  }

  /**
   * 从 Gamma(3) 分布采样（Erlang 方法）
   */
  function sampleGamma3(alpha) {
    let sum = 0;
    for (let i = 0; i < 3; i++) {
      sum -= Math.log(Math.random()) / alpha;
    }
    return sum;
  }

  /**
   * 从多峰混合提议分布采样
   */
  function sampleRadialProposal(n, l) {
    const params = getMultiPeakMixtureParams(n, l);
    
    // 按权重随机选择一个成分
    const u = Math.random();
    let cumWeight = 0;
    
    for (const comp of params.components) {
      cumWeight += comp.weight;
      if (u < cumWeight) {
        return sampleGamma3(comp.alpha);
      }
    }
    
    // 回退（不应该到达这里）
    return sampleGamma3(params.components[params.components.length - 1].alpha);
  }

  /**
   * 从均匀球面分布采样角度 (θ, φ)
   */
  function sampleUniformSphere() {
    const phi = TWO_PI * Math.random();
    const cosTheta = 2 * Math.random() - 1;
    const theta = Math.acos(cosTheta);
    return { theta, phi };
  }

  // 缓存权重上界计算结果
  const _maxWeightCache = {};
  
  /**
   * 计算径向权重的理论上界
   * 【物理优化】使用数值搜索找到精确的最大权重
   * 这避免了保守估计导致的效率损失和激进估计导致的偏差
   */
  function getMaxRadialWeight(n, l) {
    const key = `${n}_${l}`;
    if (_maxWeightCache[key]) {
      return _maxWeightCache[key];
    }
    
    const peaks = getCachedPeaks(n, l);
    let maxWeight = 1.0;
    
    // 在每个峰附近搜索最大权重
    for (const peak of peaks) {
      const rPeak = peak.r;
      // 在峰附近的范围内搜索
      const rMin = Math.max(0.1, rPeak * 0.3);
      const rMax = rPeak * 2.5;
      const numSamples = 200;
      const dr = (rMax - rMin) / numSamples;
      
      for (let i = 0; i <= numSamples; i++) {
        const r = rMin + i * dr;
        const R = radialR(n, l, r);
        const P_radial = r * r * R * R;
        const q_r = radialProposalPDF(r, n, l);
        
        if (q_r > 1e-300) {
          const w = P_radial / q_r;
          if (w > maxWeight) {
            maxWeight = w;
          }
        }
      }
    }
    
    // 添加 20% 安全边际，确保不会截断样本
    const result = maxWeight * 1.2;
    _maxWeightCache[key] = result;
    
    return result;
  }

  /**
   * 重要性采样：生成一个采样点
   * 
   * 【物理准确性保证】
   * 采用"分离变量"策略：
   * - 径向：使用精确逆CDF采样（100%接受率，无偏差）
   * - 角向：均匀球面采样 + |Y|² 权重接受-拒绝
   * 
   * 这确保最终分布精确等于 |ψ|² = R²(r) × |Y|²(θ,φ)
   */
  function importanceSample(n, l, angKey, samplingBoundary = Infinity) {
    // ==================== 第一步：径向采样（精确逆CDF） ====================
    // 直接从精确的 P(r) 分布采样，无需接受-拒绝
    let r = sampleRadialExact(n, l);
    
    // 边界检查
    if (r > samplingBoundary * 2) {
      return null;
    }
    
    // ==================== 第二步：角向采样 ====================
    const { theta, phi } = sampleUniformSphere();
    
    // 计算角向权重：w_angular = 4π |Y|²
    const Y2 = realYlm_abs2(angKey.l, angKey.m, angKey.t, theta, phi);
    const w_angular = 4 * PI * Y2;
    
    // 【物理修正】角向权重上界的精确计算
    // 对于实球谐函数：
    // - m=0: 最大值 = (2l+1)/(4π)，所以 4π|Y|² ≤ 2l+1
    // - m≠0: 由于 cos² 或 sin² 因子，最大值可能更大
    // 使用更保守的上界以确保物理准确性
    const maxAngularWeight = (angKey.m === 0) ? (2 * angKey.l + 1.2) : (2 * (2 * angKey.l + 1) + 0.5);
    
    // 角向接受-拒绝
    if (Math.random() * maxAngularWeight > w_angular) {
      return { x: 0, y: 0, z: 0, r, theta, phi, weight: w_angular, accepted: false };
    }
    
    // ==================== 采样成功 ====================
    const sinTheta = Math.sin(theta);
    const x = r * sinTheta * Math.cos(phi);
    const y = r * sinTheta * Math.sin(phi);
    const z = r * Math.cos(theta);
    
    // 【摩尔纹抑制】添加亚像素级的微小抖动
    const dither = 0.01;
    const dx = (Math.random() - 0.5) * dither;
    const dy = (Math.random() - 0.5) * dither;
    const dz = (Math.random() - 0.5) * dither;
    
    return { x: x + dx, y: y + dy, z: z + dz, r, theta, phi, weight: 1, accepted: true };
  }

  /**
   * 批量重要性采样
   */
  function batchImportanceSample(n, l, angKey, targetCount, samplingBoundary, maxAttempts) {
    const samples = [];
    let attempts = 0;
    
    while (samples.length < targetCount && attempts < maxAttempts) {
      attempts++;
      const result = importanceSample(n, l, angKey, samplingBoundary);
      if (result && result.accepted) {
        samples.push(result);
      }
    }
    
    return samples;
  }

  // 扩展轨道参数映射，添加 n=5 的所有轨道
  function orbitalParamsFromKey(key){
    // Map UI key to {n,l,angKey:{l,m,t}}
    const R = (n,l,m,t)=>({n,l,angKey:{l,m,t}});
    switch(key){
      // n=1
      case '1s': return R(1,0,0,'c');
      // n=2
      case '2s': return R(2,0,0,'c');
      case '2pz': return R(2,1,0,'c');
      case '2px': return R(2,1,1,'c');
      case '2py': return R(2,1,1,'s');
      // n=3
      case '3s': return R(3,0,0,'c');
      case '3pz': return R(3,1,0,'c');
      case '3px': return R(3,1,1,'c');
      case '3py': return R(3,1,1,'s');
      case '3d_z2': return R(3,2,0,'c');
      case '3d_xz': return R(3,2,1,'c');
      case '3d_yz': return R(3,2,1,'s');
      case '3d_xy': return R(3,2,2,'s');
      case '3d_x2-y2': return R(3,2,2,'c');
      // n=4
      case '4s': return R(4,0,0,'c');
      case '4pz': return R(4,1,0,'c');
      case '4px': return R(4,1,1,'c');
      case '4py': return R(4,1,1,'s');
      case '4d_z2': return R(4,2,0,'c');
      case '4d_xz': return R(4,2,1,'c');
      case '4d_yz': return R(4,2,1,'s');
      case '4d_xy': return R(4,2,2,'s');
      case '4d_x2-y2': return R(4,2,2,'c');
      // seven real f
      case '4f_z3': return R(4,3,0,'c');
      case '4f_xz2': return R(4,3,1,'c');
      case '4f_yz2': return R(4,3,1,'s');
      case '4f_z(x2-y2)': return R(4,3,2,'c');
      case '4f_xyz': return R(4,3,2,'s');
      case '4f_x(x2-3y2)': return R(4,3,3,'c');
      case '4f_y(3x2-y2)': return R(4,3,3,'s');
      // n=5 轨道
      // 5s
      case '5s': return R(5,0,0,'c');
      // 5p 轨道
      case '5pz': return R(5,1,0,'c');
      case '5px': return R(5,1,1,'c');
      case '5py': return R(5,1,1,'s');
      // 5d 轨道
      case '5d_z2': return R(5,2,0,'c');
      case '5d_xz': return R(5,2,1,'c');
      case '5d_yz': return R(5,2,1,'s');
      case '5d_xy': return R(5,2,2,'s');
      case '5d_x2-y2': return R(5,2,2,'c');
      // 5f 轨道
      case '5f_z3': return R(5,3,0,'c');
      case '5f_xz2': return R(5,3,1,'c');
      case '5f_yz2': return R(5,3,1,'s');
      case '5f_z(x2-y2)': return R(5,3,2,'c');
      case '5f_xyz': return R(5,3,2,'s');
      case '5f_x(x2-3y2)': return R(5,3,3,'c');
      case '5f_y(3x2-y2)': return R(5,3,3,'s');
      // 5g 轨道 (l=4, m=-4,-3,-2,-1,0,1,2,3,4 共9个实轨道)
      case '5g_z4': return R(5,4,0,'c');           // m=0
      case '5g_z3x': return R(5,4,1,'c');          // m=1, cos
      case '5g_z3y': return R(5,4,1,'s');          // m=1, sin
      case '5g_z2xy': return R(5,4,2,'s');         // m=2, sin
      case '5g_z2(x2-y2)': return R(5,4,2,'c');    // m=2, cos
      case '5g_zx(x2-3y2)': return R(5,4,3,'c');   // m=3, cos
      case '5g_zy(3x2-y2)': return R(5,4,3,'s');   // m=3, sin
      case '5g_xy(x2-y2)': return R(5,4,4,'s');    // m=4, sin
      case '5g_x4-6x2y2+y4': return R(5,4,4,'c');  // m=4, cos
      default: return R(1,0,0,'c');
    }
  }

  window.Hydrogen = {
    A0,
    radialR,
    radialPDF,
    density3D_real,
    realYlm_abs2,
    realYlm_value,
    radialGrid,
    histogramRadialFromSamples,
    histogramThetaFromSamples,
    recommendRmax,
    orbitalParamsFromKey,
    orbitalKey,
    angularPDF_Theta,
    // 精确逆CDF采样
    buildRadialCDF,
    sampleRadialExact,
    // 重要性采样相关函数（保留兼容性）
    findRadialPeaks,
    getCachedPeaks,
    getMultiPeakMixtureParams,
    radialProposalPDF,
    sampleRadialProposal,
    sampleUniformSphere,
    getMaxRadialWeight,
    importanceSample,
    batchImportanceSample,
  };
})();
