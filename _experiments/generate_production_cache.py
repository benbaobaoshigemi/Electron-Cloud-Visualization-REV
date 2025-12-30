"""PRODUCTION: Generate Vee(r) cache (H–Kr)

This generator builds a *local, spherically averaged* electron–electron potential
for visualization using a standard, literature-backed model:

  1) Build spin densities ρ↑(r), ρ↓(r) from the provided Koga STO orbitals (SlaterBasis)
  2) Hartree term V_H(r) from spherical Poisson solution (two 1D integrals)
  3) Slater Xα exchange potential V_x^σ(r) ∝ -α ρ_σ(r)^{1/3}
  4) Latter tail correction to enforce the correct asymptote for neutral atoms

This is a theoretically grounded visualization construction (standard equations +
standard approximations) and replaces the legacy global spin-scaling heuristic.
"""

from __future__ import annotations

import json
import math
import os
import re
from pathlib import Path

import numpy as np

PI = math.pi


def _factorial_int(n: int) -> int:
    return math.factorial(int(n))


def sto_normalization(n: int, zeta: float) -> float:
    """Normalize R(r) = N r^{n-1} e^{-ζ r} with ∫|R|^2 r^2 dr = 1."""
    return (2.0 * zeta) ** (n + 0.5) / math.sqrt(float(_factorial_int(2 * n)))


def evaluate_radial_R(basis_terms: list[dict], r_grid: np.ndarray) -> np.ndarray:
    """Evaluate radial function R(r) from STO expansion terms."""
    r = r_grid
    R = np.zeros_like(r, dtype=np.float64)
    for term in basis_terms:
        n = int(term["nStar"])
        zeta = float(term["zeta"])
        coeff = float(term["coeff"])
        N = sto_normalization(n, zeta)
        R += coeff * (N * np.power(r, n - 1) * np.exp(-zeta * r))
    return R


def cumulative_trapezoid(y: np.ndarray, x: np.ndarray) -> np.ndarray:
    """Cumulative trapezoid integral from x[0] to x[i]."""
    out = np.zeros_like(y, dtype=np.float64)
    dx = np.diff(x)
    out[1:] = np.cumsum(0.5 * (y[1:] + y[:-1]) * dx)
    return out


def reverse_cumulative_trapezoid(y: np.ndarray, x: np.ndarray) -> np.ndarray:
    """Tail integral ∫_x[i]^{x[-1]} y(t) dt using trapezoids."""
    out = np.zeros_like(y, dtype=np.float64)
    dx = np.diff(x)
    # out[i] = out[i+1] + 0.5*(y[i]+y[i+1])*(x[i+1]-x[i])
    for i in range(len(y) - 2, -1, -1):
        out[i] = out[i + 1] + 0.5 * (y[i] + y[i + 1]) * dx[i]
    return out


def compute_hartree_potential(r_grid: np.ndarray, rho_tot: np.ndarray) -> np.ndarray:
    """Spherical Hartree potential from 3D density rho_tot(r).

    V_H(r) = (1/r) ∫_0^r 4π t^2 ρ(t) dt + ∫_r^∞ 4π t ρ(t) dt
    """
    r = r_grid
    f_inner = 4.0 * PI * (r * r) * rho_tot
    f_outer = 4.0 * PI * r * rho_tot
    inner = cumulative_trapezoid(f_inner, r)
    outer = reverse_cumulative_trapezoid(f_outer, r)
    Vh = inner / r + outer
    return Vh


def compute_slater_xalpha_exchange(rho_sigma: np.ndarray, alpha: float) -> np.ndarray:
    """Slater Xα exchange potential (spin channel)."""
    rho = np.maximum(rho_sigma, 0.0)
    # avoid 0^(1/3) noise
    eps = 1e-40
    rho_safe = np.maximum(rho, eps)
    return -(3.0 / 2.0) * alpha * np.power((3.0 / PI) * rho_safe, 1.0 / 3.0)


def get_l(orb_name: str) -> int:
    if "s" in orb_name:
        return 0
    if "p" in orb_name:
        return 1
    if "d" in orb_name:
        return 2
    return 0


def hund_spin_split(orb_name: str, n_occupancy: int) -> tuple[int, int]:
    """Hund's rule high-spin split within a subshell capacity."""
    l = get_l(orb_name)
    capacity = 2 * (2 * l + 1)
    half_cap = capacity // 2
    n_up = min(n_occupancy, half_cap)
    n_dn = max(0, n_occupancy - half_cap)
    return int(n_up), int(n_dn)

def parse_slater_basis(filepath):
    content = Path(filepath).read_text(encoding='utf-8')
    marker = 'globalScope.SlaterBasis = '
    start_idx = content.find(marker)
    json_start = start_idx + len(marker)
    depth = 0
    json_end = -1
    for i, c in enumerate(content[json_start:]):
        if c == '{': depth += 1
        elif c == '}': 
            depth -= 1
            if depth == 0: json_end = json_start + i + 1; break
    json_str = content[json_start:json_end]
    json_str = re.sub(r'//.*', '', json_str)
    json_str = re.sub(r',(\s*[}\]])', r'\1', json_str)
    return json.loads(json_str)

# Full H-Kr configs
ELECTRON_CONFIGS = {
    "H":  {"1s": 1}, "He": {"1s": 2},
    "Li": {"1s": 2, "2s": 1}, "Be": {"1s": 2, "2s": 2},
    "B":  {"1s": 2, "2s": 2, "2p": 1}, "C":  {"1s": 2, "2s": 2, "2p": 2},
    "N":  {"1s": 2, "2s": 2, "2p": 3}, "O":  {"1s": 2, "2s": 2, "2p": 4},
    "F":  {"1s": 2, "2s": 2, "2p": 5}, "Ne": {"1s": 2, "2s": 2, "2p": 6},
    "Na": {"1s": 2, "2s": 2, "2p": 6, "3s": 1}, "Mg": {"1s": 2, "2s": 2, "2p": 6, "3s": 2},
    "Al": {"1s": 2, "2s": 2, "2p": 6, "3s": 2, "3p": 1}, "Si": {"1s": 2, "2s": 2, "2p": 6, "3s": 2, "3p": 2},
    "P":  {"1s": 2, "2s": 2, "2p": 6, "3s": 2, "3p": 3}, "S":  {"1s": 2, "2s": 2, "2p": 6, "3s": 2, "3p": 4},
    "Cl": {"1s": 2, "2s": 2, "2p": 6, "3s": 2, "3p": 5}, "Ar": {"1s": 2, "2s": 2, "2p": 6, "3s": 2, "3p": 6},
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

def generate_vee_cache_xalpha(atom_symbol: str, basis_data: dict, config: dict, r_grid: np.ndarray, alpha: float) -> dict:
    """Generate VeeCache entries for a single atom using Hartree + Slater Xα exchange + Latter tail.

    Notes:
    - We build total and spin densities using Hund's-rule high-spin allocation per subshell.
    - The resulting potential is *local*; we still store values per orbital key to keep the
      frontend cache format compatible.
    """
    orbitals = basis_data["orbitals"]
    cache: dict[str, list[float]] = {}

    n_total = int(sum(config.values()))
    if n_total <= 1:
        # One-electron systems: Vee should be zero (no e-e repulsion).
        for target_orb in orbitals.keys():
            if target_orb in config:
                cache[target_orb] = [0.0 for _ in range(len(r_grid))]
        return cache

    # Build densities (spherical average) and keep per-subshell 1-electron contributions
    # so we can remove the target electron (reduce self-interaction) for Vee^(i).
    rho_up = np.zeros_like(r_grid, dtype=np.float64)
    rho_dn = np.zeros_like(r_grid, dtype=np.float64)
    one_e_contrib: dict[str, np.ndarray] = {}
    occ_spin: dict[str, tuple[int, int]] = {}

    for orb_name, n_occ in config.items():
        if orb_name not in orbitals:
            continue
        R = evaluate_radial_R(orbitals[orb_name], r_grid)
        R2 = R * R
        n_up, n_dn = hund_spin_split(orb_name, int(n_occ))
        occ_spin[orb_name] = (int(n_up), int(n_dn))

        # Spherical average of |Ψ|^2: <|Y_lm|^2> = 1/(4π)
        contrib = R2 / (4.0 * PI)
        one_e_contrib[orb_name] = contrib
        rho_up += float(n_up) * contrib
        rho_dn += float(n_dn) * contrib

    rho_tot = rho_up + rho_dn
    Vh_tot = compute_hartree_potential(r_grid, rho_tot)
    Vx_up_tot = compute_slater_xalpha_exchange(rho_up, alpha)
    Vx_dn_tot = compute_slater_xalpha_exchange(rho_dn, alpha)

    # Latter tail target for neutral atoms: Vee -> (N-1)/r
    a_tail = max(0, n_total - 1)
    latter_limit = (float(a_tail) / r_grid)

    def _smoothstep(t: np.ndarray) -> np.ndarray:
        t = np.clip(t, 0.0, 1.0)
        return t * t * (3.0 - 2.0 * t)

    for target_orb, target_basis in orbitals.items():
        if target_orb not in config:
            continue
        n_occ = int(config[target_orb])
        # Determine the spin channel of the "test" electron for this subshell.
        # For open shells we follow the Hund split; for closed shells either choice is equivalent.
        n_up, n_dn = occ_spin.get(target_orb, hund_spin_split(target_orb, n_occ))
        test_spin_up = n_up > 0

        # Remove one electron from the target subshell to reduce self-interaction in Vee^(i).
        # This is a pragmatic visualization fix: it prevents an unphysical early Z_eff -> 1 plateau.
        contrib_1e = one_e_contrib.get(target_orb)
        if contrib_1e is None:
            Vh_other = Vh_tot
            Vx_other = Vx_up_tot if test_spin_up else Vx_dn_tot
        else:
            rho_up_other = rho_up.copy()
            rho_dn_other = rho_dn.copy()
            if test_spin_up:
                rho_up_other -= contrib_1e
            else:
                rho_dn_other -= contrib_1e
            rho_up_other = np.clip(rho_up_other, 0.0, None)
            rho_dn_other = np.clip(rho_dn_other, 0.0, None)
            rho_tot_other = rho_up_other + rho_dn_other

            Vh_other = compute_hartree_potential(r_grid, rho_tot_other)
            Vx_other = compute_slater_xalpha_exchange(rho_up_other, alpha) if test_spin_up else compute_slater_xalpha_exchange(rho_dn_other, alpha)

        Vee_raw = Vh_other + Vx_other

        # Latter tail correction (smooth blend): enforce Vee -> (N-1)/r only where needed.
        Vee_clamped = np.minimum(Vee_raw, latter_limit)
        mask = Vee_raw > latter_limit
        if np.any(mask):
            i0 = int(np.argmax(mask))
            blend_before = 24
            blend_after = 96
            blend_start = max(0, i0 - blend_before)
            blend_end = min(len(r_grid), i0 + blend_after)

            Vee = Vee_raw.copy()
            denom = float(r_grid[blend_end - 1] - r_grid[blend_start]) if blend_end - 1 > blend_start else 1.0
            t = (r_grid[blend_start:blend_end] - r_grid[blend_start]) / denom
            w = _smoothstep(t)
            Vee[blend_start:blend_end] = (1.0 - w) * Vee_raw[blend_start:blend_end] + w * Vee_clamped[blend_start:blend_end]
            Vee[blend_end:] = Vee_clamped[blend_end:]
        else:
            Vee = Vee_raw

        # Ensure the far tail is exactly (N-1)/r on the last part of the grid
        tail_count = min(64, len(r_grid))
        tail_start = len(r_grid) - tail_count
        Vee[tail_start:] = latter_limit[tail_start:]

        cache[target_orb] = [float(x) for x in Vee]

    return cache

def generate_full_cache():
    print("Generating Full Vee Cache for H-Kr (HFS / Slater Xα + Latter)...")

    repo_root = Path(__file__).resolve().parent.parent
    
    basis_path = repo_root / "slater_basis.js"
    data = parse_slater_basis(str(basis_path))
    
    # Log-spaced grid for cache lookup.
    # Extend r_max generously to avoid runtime extrapolation artifacts in plotted ranges.
    r_grid = np.geomspace(1e-4, 200.0, 700)

    # Exchange parameter α:
    # - 1.0  : Slater / Herman-Skillman style
    # - 2/3  : Kohn-Sham / Gáspár value from uniform electron gas
    # - ~0.7 : empirically optimized Xα (optional)
    alpha = float(os.environ.get("XALPHA", "0.6666666666666666"))
    
    full_cache = {
        "r_grid": r_grid.tolist(),
        "atoms": {}
    }
    
    elements = list(ELECTRON_CONFIGS.keys())
    
    for i, atom in enumerate(elements):
        if atom not in data:
            print(f"  [SKIP] {atom}: Not in basis")
            continue
            
        cache = generate_vee_cache_xalpha(atom, data[atom], ELECTRON_CONFIGS[atom], r_grid, alpha)
        full_cache["atoms"][atom] = cache
        print(f"  [{i+1}/{len(elements)}] {atom}: {len(cache)} orbitals")
    
    # Export as JS file
    output_path = repo_root / "vee_cache.js"
    
    js_content = f"""// Auto-generated Vee(r) cache (HFS / Slater Xα + Latter tail)
// Generated by _experiments/generate_production_cache.py
// Contains pre-computed local electron-electron potentials for H-Kr
// XALPHA={alpha}

(typeof self !== 'undefined' ? self : window).VeeCache = {json.dumps(full_cache, indent=2)};
"""
    
    output_path.write_text(js_content, encoding='utf-8')
    
    file_size = output_path.stat().st_size / 1024
    print(f"\nExported to: {output_path.absolute()}")
    print(f"File size: {file_size:.1f} KB")
    print("DONE!")

if __name__ == "__main__":
    generate_full_cache()
