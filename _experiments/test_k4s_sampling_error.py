#!/usr/bin/env python3
"""
测试K(钾)4s轨道采样误差分布
运行10次采样，统计V(r)曲线的误差
"""
import numpy as np
import json
from pathlib import Path

try:
    import matplotlib.pyplot as plt
except Exception:
    plt = None

# ==================== 基础函数 ====================
def factorial(n):
    if n <= 1:
        return 1
    result = 1
    for i in range(2, n + 1):
        result *= i
    return result

def load_data_from_js():
    """使用Node.js从JS文件提取K 4s所需数据（写入JSON文件后读取）。"""
    import subprocess

    script_dir = Path(__file__).parent
    extract_script = script_dir / 'extract_k4s_data.js'
    out_json = script_dir / 'k4s_data.json'

    print("  使用Node.js提取数据...")

    try:
        result = subprocess.run(
            ['node', str(extract_script)],
            capture_output=True,
            text=True,
            check=True,
            cwd=script_dir
        )

        out_path = result.stdout.strip() or str(out_json)
        out_path = Path(out_path)
        if not out_path.exists():
            # 兜底：按默认路径读取
            out_path = out_json

        with open(out_path, 'r', encoding='utf-8') as f:
            data = json.load(f)

        atom_data = data['atom']
        vee_cache = (np.array(data['vee']['r_grid'], dtype=np.float64), np.array(data['vee']['values'], dtype=np.float64))

        return atom_data, vee_cache

    except subprocess.CalledProcessError as e:
        print(f"Node.js执行失败: {e.stderr}")
        raise
    except FileNotFoundError:
        print("错误: 未找到Node.js，请确保已安装Node.js")
        raise

def load_slater_basis(atom_type='K'):
    """已废弃，使用load_data_from_js代替"""
    pass

def load_vee_cache(atom_type='K', orbital='4s'):
    """已废弃，使用load_data_from_js代替"""
    pass

def interpolate_vee(r, r_grid, vee_values):
    """线性插值Vee值"""
    if r <= r_grid[0]:
        return vee_values[0]
    if r >= r_grid[-1]:
        return vee_values[-1]
    
    # 二分查找
    idx = np.searchsorted(r_grid, r)
    if idx == 0:
        return vee_values[0]
    
    # 线性插值
    r0, r1 = r_grid[idx-1], r_grid[idx]
    v0, v1 = vee_values[idx-1], vee_values[idx]
    t = (r - r0) / (r1 - r0)
    return v0 * (1 - t) + v1 * t

def radial_wavefunction(r, basis_terms):
    """计算Slater径向波函数 R(r)"""
    R = 0.0
    for term in basis_terms:
        n = term['nStar']
        zeta = term['zeta']
        coeff = term['coeff']
        n_int = int(round(n))
        N = (2 * zeta) ** n * np.sqrt(2 * zeta / factorial(2 * n_int))
        R += coeff * N * r ** (n - 1) * np.exp(-zeta * r)
    return R

def radial_pdf(r, basis_terms):
    """计算径向概率密度 P(r) = r² |R(r)|²"""
    if r <= 0:
        return 0.0
    R = radial_wavefunction(r, basis_terms)
    return r * r * R * R

def calculate_theory_curves(atom_data, orbital='4s', centers=None, vee_cache=None):
    """
    计算理论曲线
    返回: r_values, dVnuc_dr, Vee, dEdr_theory, V_theory
    """
    Z = atom_data['Z']
    basis_terms = atom_data['orbitals'][orbital]
    
    if centers is None:
        raise ValueError("centers 不能为空")

    r_values = np.array(centers, dtype=np.float64)
    num_points = len(r_values)
    
    # 计算dV_nuc/dr和Vee
    dVnuc_dr = np.zeros(num_points)
    Vee_values = np.zeros(num_points)
    
    for i, r in enumerate(r_values):
        # 核势能导数: dV_nuc/dr = -Z * sum(c_i * c_j * N_i * N_j * r^(n_i+n_j-1) * exp(-alpha*r))
        for ti in basis_terms:
            ni = ti['nStar']
            zi = ti['zeta']
            ci = ti['coeff']
            ni_int = int(round(ni))
            Ni = (2 * zi) ** ni * np.sqrt(2 * zi / factorial(2 * ni_int))
            
            for tj in basis_terms:
                nj = tj['nStar']
                zj = tj['zeta']
                cj = tj['coeff']
                nj_int = int(round(nj))
                Nj = (2 * zj) ** nj * np.sqrt(2 * zj / factorial(2 * nj_int))
                
                alpha = zi + zj
                power = ni + nj - 1
                pref = ci * cj * Ni * Nj
                
                dVnuc_dr[i] += -Z * pref * r ** power * np.exp(-alpha * r)
        
        # Vee从缓存插值（理论值）
        if vee_cache is not None:
            Vee_values[i] = interpolate_vee(r, vee_cache[0], vee_cache[1])
    
    # 计算理论PDF
    theory_pdf = np.array([radial_pdf(r, basis_terms) for r in r_values])
    
    # 理论能量密度: dE/dr = dV_nuc/dr + P(r) * Vee(r)
    dEdr_theory = dVnuc_dr + theory_pdf * Vee_values
    
    # 累积积分（矩形法）
    V_theory = np.zeros(num_points, dtype=np.float64)
    cumE = 0.0
    dr_const = r_values[1] - r_values[0] if num_points > 1 else 0.0
    for i in range(num_points):
        # 与前端一致：用固定bin宽度dr（第一个bin也用dr）
        cumE += dEdr_theory[i] * dr_const
        V_theory[i] = cumE
    
    return r_values, dVnuc_dr, Vee_values, theory_pdf, dEdr_theory, V_theory

def build_inverse_cdf_sampler(basis_terms, r_max, fine_points=20000):
    """构建逆CDF采样器：一次预计算，多次快速采样。"""
    r = np.linspace(0.0, r_max, fine_points, dtype=np.float64)
    pdf = np.array([radial_pdf(x, basis_terms) for x in r], dtype=np.float64)
    dr = r[1] - r[0]

    cdf = np.cumsum(pdf) * dr
    if cdf[-1] <= 0:
        raise ValueError("CDF归一化失败：总概率为0")
    cdf /= cdf[-1]

    def sample(n):
        u = np.random.random(n)
        # 线性插值反演
        return np.interp(u, cdf, r)

    return sample

def calculate_sampled_curve(samples, centers, dVnuc_dr, Vee_values, theory_pdf, theory_dEdr):
    """
    计算采样曲线
    使用公式: dE/dr_sampled = dV_nuc/dr + P_sampled(r) * Vee(r)
    """
    num_bins = len(centers)
    centers = np.array(centers, dtype=np.float64)
    dr = centers[1] - centers[0] if num_bins > 1 else 0.0
    r_min = max(0.0, centers[0] - 0.5 * dr)
    r_max = centers[-1] + 0.5 * dr
    edges = np.linspace(r_min, r_max, num_bins + 1)

    # 创建直方图（density=True确保∫pdf dr = 1）
    hist, _ = np.histogram(samples, bins=edges, density=True)
    sampled_pdf = hist.astype(np.float64)
    
    # 计算采样能量密度
    dEdr_sampled = np.zeros(num_bins, dtype=np.float64)
    pdfThreshold = 1e-6

    for i in range(num_bins):
        # 与前端一致：PDF极小时直接回退到理论dE/dr（避免数值放大/毛刺）
        if theory_pdf[i] < pdfThreshold:
            dEdr_sampled[i] = theory_dEdr[i]
        else:
            dEdr_sampled[i] = dVnuc_dr[i] + sampled_pdf[i] * Vee_values[i]
    
    # 累积积分（矩形法）
    V_sampled = np.zeros(num_bins, dtype=np.float64)
    cumE = 0.0
    for i in range(num_bins):
        cumE += dEdr_sampled[i] * dr
        V_sampled[i] = cumE
    
    return V_sampled, sampled_pdf

def calculate_errors(V_theory, V_sampled, r_grid):
    """
    计算误差统计
    """
    # 绝对误差
    abs_error = np.abs(V_sampled - V_theory)
    
    # 相对误差（避免除以接近零的值）
    rel_error = np.zeros_like(abs_error)
    mask = np.abs(V_theory) > 1e-3
    rel_error[mask] = abs_error[mask] / np.abs(V_theory[mask]) * 100  # 百分比
    
    # 找到关键点的误差
    # 1. 最大|V|位置
    idx_max_V = np.argmax(np.abs(V_theory))
    
    # 2. r=2 a0附近
    idx_r2 = np.argmin(np.abs(r_grid - 2.0))
    
    # 3. r=5 a0附近
    idx_r5 = np.argmin(np.abs(r_grid - 5.0))
    
    # 4. 最后一个点 (r=40)
    idx_last = -1
    
    return {
        'max_abs_error': np.max(abs_error),
        'mean_abs_error': np.mean(abs_error),
        'max_rel_error': np.max(rel_error[mask]) if np.any(mask) else 0,
        'mean_rel_error': np.mean(rel_error[mask]) if np.any(mask) else 0,
        'error_at_max_V': abs_error[idx_max_V],
        'error_at_r2': abs_error[idx_r2],
        'error_at_r5': abs_error[idx_r5],
        'error_at_last': abs_error[idx_last],
        'V_theory_at_max': V_theory[idx_max_V],
        'V_sampled_at_max': V_sampled[idx_max_V],
        'V_theory_at_last': V_theory[idx_last],
        'V_sampled_at_last': V_sampled[idx_last],
    }

# ==================== 主测试函数 ====================
def run_single_test(atom_data, vee_cache, num_samples=100000):
    """运行单次测试"""
    orbital = '4s'
    basis_terms = atom_data['orbitals'][orbital]
    
    # 固定到与前端类似的网格与范围
    r_max = 40.0
    num_bins = 400
    dr = r_max / num_bins
    centers = (np.arange(num_bins, dtype=np.float64) + 0.5) * dr

    # 计算理论曲线（在centers上）
    r_grid, dVnuc_dr, Vee_values, theory_pdf, dEdr_theory, V_theory = calculate_theory_curves(
        atom_data, orbital, centers=centers, vee_cache=vee_cache
    )

    # 逆CDF采样（一次构建，多次复用由调用方传入；这里临时构建用于单次）
    sampler = build_inverse_cdf_sampler(basis_terms, r_max=r_max, fine_points=20000)
    samples = sampler(num_samples)

    # 计算采样曲线
    V_sampled, sampled_pdf = calculate_sampled_curve(samples, r_grid, dVnuc_dr, Vee_values, theory_pdf, dEdr_theory)
    
    # 计算误差
    errors = calculate_errors(V_theory, V_sampled, r_grid)
    
    return errors, r_grid, V_theory, V_sampled

def main():
    print("=" * 60)
    print("K(钾) 4s轨道采样误差测试")
    print("=" * 60)
    
    # 加载数据
    print("\n加载Slater基组和Vee缓存...")
    atom_data, vee_cache = load_data_from_js()
    print(f"原子序数 Z = {atom_data['Z']}")
    
    # 运行10次测试
    num_tests = 10
    num_samples = 50000  # 与前端MAX_POINTS一致
    
    print(f"\n运行 {num_tests} 次测试，每次 {num_samples} 个样本...")
    
    all_errors = []
    for i in range(num_tests):
        print(f"\n测试 {i+1}/{num_tests}...", end=' ')
        errors, r_grid, V_theory, V_sampled = run_single_test(atom_data, vee_cache, num_samples)
        all_errors.append(errors)
        print(f"最大绝对误差: {errors['max_abs_error']:.6f} Ha")
    
    # 统计结果
    print("\n" + "=" * 60)
    print("误差统计 (10次运行)")
    print("=" * 60)
    
    metrics = [
        ('最大绝对误差 (Ha)', 'max_abs_error'),
        ('平均绝对误差 (Ha)', 'mean_abs_error'),
        ('最大相对误差 (%)', 'max_rel_error'),
        ('平均相对误差 (%)', 'mean_rel_error'),
        ('V最大值处误差 (Ha)', 'error_at_max_V'),
        ('r=2 a0处误差 (Ha)', 'error_at_r2'),
        ('r=5 a0处误差 (Ha)', 'error_at_r5'),
        ('最远处 (r=40) 误差 (Ha)', 'error_at_last'),
    ]
    
    for name, key in metrics:
        values = [e[key] for e in all_errors]
        mean = np.mean(values)
        std = np.std(values)
        min_val = np.min(values)
        max_val = np.max(values)
        print(f"\n{name}:")
        print(f"  均值: {mean:.6e} ± {std:.6e}")
        print(f"  范围: [{min_val:.6e}, {max_val:.6e}]")
    
    # 显示理论V(r)的典型值
    print("\n" + "=" * 60)
    print("理论V(r)典型值参考")
    print("=" * 60)
    V_ref = all_errors[0]['V_theory_at_max']
    print(f"V(r)最小值（最负）: {V_ref:.6f} Ha")
    
    # 绘图
    # 保存原始数据
    out_csv = Path(__file__).parent / 'k4s_sampling_error_runs.csv'
    with open(out_csv, 'w', encoding='utf-8') as f:
        keys = list(all_errors[0].keys())
        f.write(','.join(keys) + '\n')
        for e in all_errors:
            f.write(','.join(str(e[k]) for k in keys) + '\n')
    print(f"\n已保存每次运行指标: {out_csv}")

    # 可选绘图（如果matplotlib可用）
    if plt is not None:
        print("\n生成对比图...")
        fig, axes = plt.subplots(2, 2, figsize=(14, 10))

        # 使用最后一次测试的数据
        _, r_grid, V_theory, V_sampled = run_single_test(atom_data, vee_cache, num_samples)

        # 图1: V(r)曲线对比
        ax = axes[0, 0]
        ax.plot(r_grid, V_theory, 'g-', label='理论', linewidth=2)
        ax.plot(r_grid, V_sampled, 'r--', label='采样', linewidth=1.5, alpha=0.8)
        ax.set_xlabel('r (a₀)')
        ax.set_ylabel('V(r) (Hartree)')
        ax.set_title('K 4s累积势能对比')
        ax.legend()
        ax.grid(True, alpha=0.3)

        # 图2: 绝对误差
        ax = axes[0, 1]
        abs_err = np.abs(V_sampled - V_theory)
        ax.plot(r_grid, abs_err, 'b-', linewidth=1.5)
        ax.set_xlabel('r (a₀)')
        ax.set_ylabel('|V_sampled - V_theory| (Hartree)')
        ax.set_title('绝对误差')
        ax.grid(True, alpha=0.3)
        ax.set_yscale('log')

        # 图3: 相对误差
        ax = axes[1, 0]
        mask = np.abs(V_theory) > 1e-3
        rel_err = np.zeros_like(V_theory)
        rel_err[mask] = np.abs(V_sampled[mask] - V_theory[mask]) / np.abs(V_theory[mask]) * 100
        ax.plot(r_grid[mask], rel_err[mask], 'purple', linewidth=1.5)
        ax.set_xlabel('r (a₀)')
        ax.set_ylabel('相对误差 (%)')
        ax.set_title('相对误差')
        ax.grid(True, alpha=0.3)
        ax.set_yscale('log')

        # 图4: 误差分布直方图（所有测试）
        ax = axes[1, 1]
        max_errors = [e['max_abs_error'] for e in all_errors]
        mean_errors = [e['mean_abs_error'] for e in all_errors]
        ax.hist(max_errors, bins=10, alpha=0.7, label='最大误差', color='red')
        ax.hist(mean_errors, bins=10, alpha=0.7, label='平均误差', color='blue')
        ax.set_xlabel('误差 (Hartree)')
        ax.set_ylabel('频次')
        ax.set_title('10次测试的误差分布')
        ax.legend()
        ax.grid(True, alpha=0.3)

        plt.tight_layout()
        output_file = Path(__file__).parent / 'k4s_sampling_error_analysis.png'
        plt.savefig(output_file, dpi=150, bbox_inches='tight')
        print(f"图表已保存: {output_file}")
    else:
        print("\n未安装matplotlib，跳过绘图。")
    
    print("\n测试完成！")

if __name__ == '__main__':
    main()
