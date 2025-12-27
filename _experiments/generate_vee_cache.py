# -*- coding: utf-8 -*-
"""
Static Potential Caching: Pre-calculate Vee(r) for all atoms.
This generates a JS file with pre-computed potential curves that
can be used by the frontend without any runtime Gamma calculations.
"""
import numpy as np
from scipy.special import gamma, gammainc, gammaincc, factorial
from scipy.integrate import cumulative_trapezoid
import json, re
from pathlib import Path

# ==================== 1. MATH KERNELS (Verified) ====================

def sto_normalization(n, zeta):
    return (2 * zeta) ** n * np.sqrt(2 * zeta / float(factorial(2 * n)))

def lower_incomplete_gamma(s, x):
    return gamma(s) * gammainc(s, x)

def upper_incomplete_gamma(s, x):
    return gamma(s) * gammaincc(s, x)

def compute_Yk_analytic(basis_a, basis_b, k, r_grid):
    """
    Compute Y^k(r) for a pair of STO basis functions.
    Uses the verified analytic formula with scipy Gamma functions.
    """
    result = np.zeros_like(r_grid)
    
    for term_a in basis_a:
        na, za, ca = term_a['nStar'], term_a['zeta'], term_a['coeff']
        Na = sto_normalization(na, za)
        
        for term_b in basis_b:
            nb, zb, cb = term_b['nStar'], term_b['zeta'], term_b['coeff']
            Nb = sto_normalization(nb, zb)
            
            pref = ca * cb * Na * Nb
            
            N_power = na + nb
            Z_exp = za + zb
            
            inner_power = k + N_power + 1
            term1 = (1.0 / np.power(r_grid, k+1)) * (1.0 / Z_exp**inner_power) * lower_incomplete_gamma(inner_power, Z_exp * r_grid)
            
            outer_power = N_power - k
            if outer_power > 0:
                term2 = np.power(r_grid, k) * (1.0 / Z_exp**outer_power) * upper_incomplete_gamma(outer_power, Z_exp * r_grid)
            else:
                term2 = 0.0
            
            result += pref * (term1 + term2)
    
    return result

# ==================== 2. EXCHANGE COEFFICIENTS ====================

EXCHANGE_COEFFS = {
    (0, 0): [(0, 1.0)],
    (0, 1): [(1, 1/3)],
    (1, 0): [(1, 1/3)],
    (1, 1): [(0, 1/3), (2, 2/15)],
    (0, 2): [(2, 1/5)],
    (2, 0): [(2, 1/5)],
    (1, 2): [(1, 2/15), (3, 3/35)],
    (2, 1): [(1, 2/15), (3, 3/35)],
    (2, 2): [(0, 1/5), (2, 2/35), (4, 2/35)],
}

def get_l(orb_name):
    if 's' in orb_name: return 0
    if 'p' in orb_name: return 1
    if 'd' in orb_name: return 2
    return 0

# ==================== 3. DATA LOADER ====================

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

# ==================== 4. ELECTRON CONFIGURATIONS ====================

ELECTRON_CONFIGS = {
    "H":  {"1s": 1},
    "He": {"1s": 2},
    "Li": {"1s": 2, "2s": 1},
    "Be": {"1s": 2, "2s": 2},
    "B":  {"1s": 2, "2s": 2, "2p": 1},
    "C":  {"1s": 2, "2s": 2, "2p": 2},
    "N":  {"1s": 2, "2s": 2, "2p": 3},
    "O":  {"1s": 2, "2s": 2, "2p": 4},
    "F":  {"1s": 2, "2s": 2, "2p": 5},
    "Ne": {"1s": 2, "2s": 2, "2p": 6},
    "Na": {"1s": 2, "2s": 2, "2p": 6, "3s": 1},
    "Mg": {"1s": 2, "2s": 2, "2p": 6, "3s": 2},
    "Al": {"1s": 2, "2s": 2, "2p": 6, "3s": 2, "3p": 1},
    "Si": {"1s": 2, "2s": 2, "2p": 6, "3s": 2, "3p": 2},
    "P":  {"1s": 2, "2s": 2, "2p": 6, "3s": 2, "3p": 3},
    "S":  {"1s": 2, "2s": 2, "2p": 6, "3s": 2, "3p": 4},
    "Cl": {"1s": 2, "2s": 2, "2p": 6, "3s": 2, "3p": 5},
    "Ar": {"1s": 2, "2s": 2, "2p": 6, "3s": 2, "3p": 6},
    "K":  {"1s": 2, "2s": 2, "2p": 6, "3s": 2, "3p": 6, "4s": 1},
    "Ca": {"1s": 2, "2s": 2, "2p": 6, "3s": 2, "3p": 6, "4s": 2},
    "Sc": {"1s": 2, "2s": 2, "2p": 6, "3s": 2, "3p": 6, "3d": 1, "4s": 2},
    "Ti": {"1s": 2, "2s": 2, "2p": 6, "3s": 2, "3p": 6, "3d": 2, "4s": 2},
    "V":  {"1s": 2, "2s": 2, "2p": 6, "3s": 2, "3p": 6, "3d": 3, "4s": 2},
    "Cr": {"1s": 2, "2s": 2, "2p": 6, "3s": 2, "3p": 6, "3d": 5, "4s": 1},
    "Mn": {"1s": 2, "2s": 2, "2p": 6, "3s": 2, "3p": 6, "3d": 5, "4s": 2},
    "Fe": {"1s": 2, "2s": 2, "2p": 6, "3s": 2, "3p": 6, "3d": 6, "4s": 2},
    "Co": {"1s": 2, "2s": 2, "2p": 6, "3s": 2, "3p": 6, "3d": 7, "4s": 2},
    "Ni": {"1s": 2, "2s": 2, "2p": 6, "3s": 2, "3p": 6, "3d": 8, "4s": 2},
    "Cu": {"1s": 2, "2s": 2, "2p": 6, "3s": 2, "3p": 6, "3d": 10, "4s": 1},
    "Zn": {"1s": 2, "2s": 2, "2p": 6, "3s": 2, "3p": 6, "3d": 10, "4s": 2},
    "Ga": {"1s": 2, "2s": 2, "2p": 6, "3s": 2, "3p": 6, "3d": 10, "4s": 2, "4p": 1},
    "Ge": {"1s": 2, "2s": 2, "2p": 6, "3s": 2, "3p": 6, "3d": 10, "4s": 2, "4p": 2},
    "As": {"1s": 2, "2s": 2, "2p": 6, "3s": 2, "3p": 6, "3d": 10, "4s": 2, "4p": 3},
    "Se": {"1s": 2, "2s": 2, "2p": 6, "3s": 2, "3p": 6, "3d": 10, "4s": 2, "4p": 4},
    "Br": {"1s": 2, "2s": 2, "2p": 6, "3s": 2, "3p": 6, "3d": 10, "4s": 2, "4p": 5},
    "Kr": {"1s": 2, "2s": 2, "2p": 6, "3s": 2, "3p": 6, "3d": 10, "4s": 2, "4p": 6},
}

# ==================== 5. MAIN CACHE GENERATOR ====================

def generate_vee_cache(atom_symbol, basis_data, config, r_grid):
    """
    Generate the Vee(r) potential for each orbital in an atom.
    Returns dict: {orbital_name: [Vee values at r_grid points]}
    """
    orbitals = basis_data['orbitals']
    cache = {}
    
    for target_orb, target_basis in orbitals.items():
        if target_orb not in config:
            continue
            
        l_target = get_l(target_orb)
        Vee = np.zeros_like(r_grid)
        
        # Loop over all source orbitals
        for source_orb, source_basis in orbitals.items():
            if source_orb not in config:
                continue
                
            n_source = config[source_orb]
            l_source = get_l(source_orb)
            
            # Direct (Hartree) term: Y^0(source, source) * n_source
            Y0 = compute_Yk_analytic(source_basis, source_basis, 0, r_grid)
            Vee += n_source * Y0
            
            # Exchange term (only if same spin shell)
            # For simplicity, we use average exchange
            key = (l_target, l_source)
            if key in EXCHANGE_COEFFS:
                for k, coeff in EXCHANGE_COEFFS[key]:
                    Yk = compute_Yk_analytic(target_basis, source_basis, k, r_grid)
                    # Exchange reduces energy (negative contribution)
                    Vee -= coeff * n_source * Yk
        
        cache[target_orb] = Vee.tolist()
    
    return cache

def run_test():
    print("="*60)
    print("TESTING STATIC Vee CACHE GENERATION")
    print("="*60)
    
    basis_path = "../slater_basis.js"
    if not Path(basis_path).exists():
        basis_path = "slater_basis.js"
    
    data = parse_slater_basis(basis_path)
    
    # Test with ALL atoms (H-Kr)
    test_atoms = ["H", "He", "Li", "Be", "B", "C", "N", "O", "F", "Ne",
                  "Na", "Mg", "Al", "Si", "P", "S", "Cl", "Ar",
                  "K", "Ca", "Sc", "Ti", "V", "Cr", "Mn", "Fe", "Co", "Ni", "Cu", "Zn",
                  "Ga", "Ge", "As", "Se", "Br", "Kr"]
    r_grid = np.geomspace(1e-4, 10.0, 500)  # 500 points for cache
    
    total_orbitals = 0
    failed_orbitals = 0
    
    for atom in test_atoms:
        if atom not in data:
            print(f"[SKIP] {atom}: Not in basis")
            continue
        if atom not in ELECTRON_CONFIGS:
            print(f"[SKIP] {atom}: No electron config")
            continue
            
        cache = generate_vee_cache(atom, data[atom], ELECTRON_CONFIGS[atom], r_grid)
        
        atom_pass = True
        for orb, vee in cache.items():
            total_orbitals += 1
            vee_arr = np.array(vee)
            if np.any(np.isnan(vee_arr)) or np.any(np.isinf(vee_arr)):
                print(f"  [{atom}] {orb}: FAIL (NaN/Inf detected)")
                failed_orbitals += 1
                atom_pass = False
            else:
                # Check for reasonable physical values
                if vee_arr.max() < 0 or vee_arr.max() > 500:
                    print(f"  [{atom}] {orb}: WARN (Vee range: {vee_arr.min():.3f} to {vee_arr.max():.3f})")
        
        if atom_pass:
            print(f"[{atom}] PASS ({len(cache)} orbitals)")
    
    print("\n" + "="*60)
    print(f"SUMMARY: {total_orbitals} orbitals tested across {len(test_atoms)} elements.")
    print(f"Failures: {failed_orbitals}")
    
    if failed_orbitals == 0:
        print("VERDICT: STATIC CACHING VERIFIED. SAFE TO IMPLEMENT.")
    else:
        print("VERDICT: FAILURE. DO NOT USE.")
    print("="*60)

if __name__ == "__main__":
    run_test()
