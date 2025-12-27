# -*- coding: utf-8 -*-
"""
Full Verification: Recurrence-Based Gamma Optimization
Compares Y^k computed with Recurrence vs. Direct scipy calls.
Target: 0 Failures across all 1980 primitives (H-Kr).
"""
import numpy as np
from scipy.special import gamma as scipy_gamma, gammainc, gammaincc, factorial
import json, re
from pathlib import Path

# ==================== 1. DIRECT GAMMA (Reference) ====================

def lower_gamma_direct(s, x):
    return scipy_gamma(s) * gammainc(s, x)

def upper_gamma_direct(s, x):
    return scipy_gamma(s) * gammaincc(s, x)

# ==================== 2. RECURRENCE GAMMA (Optimized) ====================

def lower_gamma_recurrence(s_target, x):
    """
    Compute lower incomplete gamma using recurrence:
    gamma(s+1, x) = s * gamma(s, x) - x^s * e^-x
    Base: gamma(1, x) = 1 - e^-x
    """
    if s_target < 1:
        raise ValueError(f"s_target must be >= 1, got {s_target}")
    
    exp_neg_x = np.exp(-x)
    val = 1.0 - exp_neg_x  # gamma(1, x)
    current_s = 1
    
    while current_s < s_target:
        # gamma(s+1) = s * gamma(s) - x^s * e^-x
        val = current_s * val - np.power(x, current_s) * exp_neg_x
        current_s += 1
    
    return val

def upper_gamma_recurrence(s_target, x):
    """
    Compute upper incomplete gamma using recurrence:
    Gamma(s+1, x) = s * Gamma(s, x) + x^s * e^-x
    Base: Gamma(1, x) = e^-x
    """
    if s_target < 1:
        raise ValueError(f"s_target must be >= 1, got {s_target}")
    
    exp_neg_x = np.exp(-x)
    val = exp_neg_x  # Gamma(1, x)
    current_s = 1
    
    while current_s < s_target:
        # Gamma(s+1) = s * Gamma(s) + x^s * e^-x
        val = current_s * val + np.power(x, current_s) * exp_neg_x
        current_s += 1
    
    return val

# ==================== 3. Yk CALCULATION ====================

def sto_normalization(n, zeta):
    return (2 * zeta) ** n * np.sqrt(2 * zeta / float(factorial(2 * n)))

def calculate_yk_direct(n, zeta, k, r_grid):
    """Y^k using scipy gamma functions (REFERENCE)"""
    N_norm = sto_normalization(n, zeta)
    pref = N_norm * N_norm
    
    na, za, nb, zb = n, zeta, n, zeta
    N_power = na + nb
    Z_exp = za + zb
    
    inner_power = k + N_power + 1
    term1 = (1.0 / np.power(r_grid, k+1)) * (1.0 / Z_exp**inner_power) * lower_gamma_direct(inner_power, Z_exp * r_grid)
    
    outer_power = N_power - k
    term2 = np.power(r_grid, k) * (1.0 / Z_exp**outer_power) * upper_gamma_direct(outer_power, Z_exp * r_grid)
    
    return pref * (term1 + term2)

def calculate_yk_recurrence(n, zeta, k, r_grid):
    """Y^k using recurrence gamma functions (OPTIMIZED)"""
    N_norm = sto_normalization(n, zeta)
    pref = N_norm * N_norm
    
    na, za, nb, zb = n, zeta, n, zeta
    N_power = na + nb
    Z_exp = za + zb
    
    inner_power = k + N_power + 1
    term1 = (1.0 / np.power(r_grid, k+1)) * (1.0 / Z_exp**inner_power) * lower_gamma_recurrence(inner_power, Z_exp * r_grid)
    
    outer_power = N_power - k
    term2 = np.power(r_grid, k) * (1.0 / Z_exp**outer_power) * upper_gamma_recurrence(outer_power, Z_exp * r_grid)
    
    return pref * (term1 + term2)

# ==================== 4. DATA LOADER ====================

def parse_slater_basis(filepath):
    content = Path(filepath).read_text(encoding='utf-8')
    marker = 'globalScope.SlaterBasis = '
    start_idx = content.find(marker)
    if start_idx == -1:
        raise ValueError("Could not find SlaterBasis assignment")
    
    json_start = start_idx + len(marker)
    
    depth = 0
    json_end = -1
    for i, c in enumerate(content[json_start:]):
        if c == '{': depth += 1
        elif c == '}': 
            depth -= 1
            if depth == 0: 
                json_end = json_start + i + 1
                break
    
    if json_end == -1:
        raise ValueError("Could not find end of JSON object")
        
    json_str = content[json_start:json_end]
    json_str = re.sub(r'//.*', '', json_str)
    json_str = re.sub(r',(\s*[}\]])', r'\1', json_str)
    
    return json.loads(json_str)

# ==================== 5. MAIN HARNESS ====================

def run_comprehensive_test():
    print("="*70)
    print("FULL VERIFICATION: RECURRENCE-BASED GAMMA OPTIMIZATION")
    print("="*70)
    
    basis_path = "../slater_basis.js"
    if not Path(basis_path).exists():
        basis_path = "slater_basis.js"
        if not Path(basis_path).exists():
            print(f"Error: Could not find slater_basis.js")
            return

    data = parse_slater_basis(basis_path)
    
    elements = ["H", "He", "Li", "Be", "B", "C", "N", "O", "F", "Ne",
                "Na", "Mg", "Al", "Si", "P", "S", "Cl", "Ar",
                "K", "Ca", "Sc", "Ti", "V", "Cr", "Mn", "Fe", "Co", "Ni", "Cu", "Zn",
                "Ga", "Ge", "As", "Se", "Br", "Kr"]
                
    # High res grid
    r_grid = np.geomspace(1e-6, 50, 50000)
    
    total_primitives = 0
    failed_primitives = 0
    max_error_global = 0.0
    
    print(f"{'Atom':<5} {'Orbital':<8} {'Term':<5} {'n':<3} {'zeta':<8} {'k=0':<12} {'k=2':<12} {'MaxErr':<12} Status")
    print("-" * 90)
    
    for atom in elements:
        if atom not in data: continue
        atom_data = data[atom]
        if 'orbitals' not in atom_data: continue
        
        for orb_name, primitives in atom_data['orbitals'].items():
            test_ks = [0]
            if 'p' in orb_name: test_ks = [0, 2]
            if 'd' in orb_name: test_ks = [0, 2, 4]
            
            for idx, p in enumerate(primitives):
                n = p['nStar']
                zeta = p['zeta']
                total_primitives += 1
                
                local_max_err = 0.0
                err_strs = []
                
                for k in test_ks:
                    # Direct (Reference)
                    yk_direct = calculate_yk_direct(n, zeta, k, r_grid)
                    
                    # Recurrence (Optimized)
                    yk_recur = calculate_yk_recurrence(n, zeta, k, r_grid)
                    
                    diff = np.abs(yk_direct - yk_recur)
                    
                    # Physical region only
                    valid_mask = (r_grid > 1e-4) & (r_grid < 10.0)
                    if np.sum(valid_mask) > 0:
                        max_diff = np.max(diff[valid_mask])
                    else:
                        max_diff = 0.0
                    
                    local_max_err = max(local_max_err, max_diff)
                    max_error_global = max(max_error_global, max_diff)
                    err_strs.append(f"{max_diff:.1e}")
                
                status = "PASS"
                if local_max_err > 1.5e-4:
                    status = "FAIL"
                    failed_primitives += 1
                
                k0_err = err_strs[0]
                k2_err = err_strs[1] if len(err_strs) > 1 else "-"
                max_err_str = f"{local_max_err:.1e}"
                
                print(f"{atom:<5} {orb_name:<8} {idx:<5} {n:<3} {zeta:<8.2f} {k0_err:<12} {k2_err:<12} {max_err_str:<12} {status}")
                
    print("="*70)
    print(f"SUMMARY: Tested {total_primitives} primitives across {len(elements)} elements.")
    print(f"Global Max Error: {max_error_global:.2e}")
    print(f"Failures: {failed_primitives}")
    
    if failed_primitives == 0:
        print("VERDICT: RECURRENCE OPTIMIZATION VERIFIED. SAFE TO IMPLEMENT.")
    else:
        print("VERDICT: RECURRENCE FAILURE. DO NOT USE.")

if __name__ == "__main__":
    run_comprehensive_test()
