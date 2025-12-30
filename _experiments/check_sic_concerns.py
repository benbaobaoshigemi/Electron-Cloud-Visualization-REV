"""Check SIC / Fermi-Amaldi-style concerns for the current VeeCache pipeline.

This script is intentionally *diagnostic* (not a production dependency).

It addresses three concerns raised in review:
1) Spherical-average safety: ensure the removed 1-electron density is radial-only
   and the cache does not encode m-dependent potentials.
2) Orthogonality: quantify overlaps between Koga STO radial orbitals (same l) to
   understand whether the *input* orbitals are orthonormal (they should be near-orthonormal).
   NOTE: In the current app we do NOT re-solve orbitals under Vee^(i), so any
   "different Hamiltonians => non-orthogonal eigenfunctions" issue is only a *potential* risk.
3) Energy/kinetic consistency: compare
      t_Δ(r) = -1/2 [R''/R + 2 R'/(r R) - l(l+1)/r^2]
   (local kinetic from Laplacian) with
      t_ε(r) = ε_HF - V_eff(r),   V_eff(r) = -Z/r + Vee^(i)(r)
   to quantify the mismatch when ε is taken from the Koga HF table.

Run (recommended):
    python -m _experiments.check_sic_concerns

Alternate:
    python _experiments\\check_sic_concerns.py

By default it checks Carbon (C) for 1s/2s/2p, and prints compact summaries.
"""

from __future__ import annotations

import json
import math
import re
from pathlib import Path

import numpy as np

# Reuse the production parser + radial evaluation conventions.
try:
    # When run as a module: `python -m _experiments.check_sic_concerns`
    from _experiments.generate_production_cache import (
        ELECTRON_CONFIGS,
        evaluate_radial_R,
        parse_slater_basis,
        sto_normalization,
    )
except ModuleNotFoundError:
    # When run as a file: `python _experiments\check_sic_concerns.py`
    from generate_production_cache import (
        ELECTRON_CONFIGS,
        evaluate_radial_R,
        parse_slater_basis,
        sto_normalization,
    )

PI = math.pi


def load_vee_cache(path: Path) -> dict:
    text = path.read_text(encoding="utf-8")
    m = re.search(r"VeeCache\s*=", text)
    if not m:
        raise RuntimeError("VeeCache assignment not found")
    start = text.find("{", m.end())
    if start < 0:
        raise RuntimeError("VeeCache '{' not found")
    end = text.rfind("};")
    if end < 0 or end <= start:
        raise RuntimeError("VeeCache '};' not found")
    return json.loads(text[start : end + 1])


def eval_R_Rp_Rpp(basis_terms: list[dict], r: np.ndarray) -> tuple[np.ndarray, np.ndarray, np.ndarray]:
    """Evaluate R, R', R'' for STO expansions (integer nStar)."""
    R = np.zeros_like(r, dtype=np.float64)
    Rp = np.zeros_like(r, dtype=np.float64)
    Rpp = np.zeros_like(r, dtype=np.float64)

    for term in basis_terms:
        n = int(term["nStar"])
        zeta = float(term["zeta"])
        coeff = float(term["coeff"])
        N = sto_normalization(n, zeta)

        # χ(r) = N r^{n-1} e^{-ζr}
        rn1 = np.power(r, n - 1)
        exp = np.exp(-zeta * r)
        chi = N * rn1 * exp

        # χ'(r) = N[(n-1) r^{n-2} - ζ r^{n-1}] e^{-ζr}
        if n >= 2:
            rn2 = np.power(r, n - 2)
        else:
            rn2 = np.power(r, -1)  # not used for n=1 in prefactor (n-1)=0

        chip = N * (((n - 1) * rn2) - zeta * rn1) * exp

        # χ''(r) = N[(n-1)(n-2) r^{n-3} - 2ζ(n-1) r^{n-2} + ζ^2 r^{n-1}] e^{-ζr}
        if n >= 3:
            rn3 = np.power(r, n - 3)
        else:
            rn3 = np.power(r, -2)  # not used when (n-1)(n-2)=0

        chipp = N * (((n - 1) * (n - 2) * rn3) - (2.0 * zeta * (n - 1) * rn2) + (zeta * zeta * rn1)) * exp

        R += coeff * chi
        Rp += coeff * chip
        Rpp += coeff * chipp

    return R, Rp, Rpp


def local_kinetic_from_laplacian(R: np.ndarray, Rp: np.ndarray, Rpp: np.ndarray, l: int, r: np.ndarray) -> np.ndarray:
    """t_Δ(r) for ψ = R(r) Y_lm(θ,φ)."""
    # t = -1/2 * (R''/R + 2 R'/(r R) - l(l+1)/r^2)
    with np.errstate(divide="ignore", invalid="ignore"):
        t = -0.5 * ((Rpp / R) + (2.0 * Rp / (r * R)) - (float(l * (l + 1)) / (r * r)))
    return t


def weighted_rms(x: np.ndarray, w: np.ndarray, r: np.ndarray) -> float:
    num = np.trapezoid(w * x * x, r)
    den = np.trapezoid(w, r)
    return float(math.sqrt(num / den)) if den > 0 else float("nan")


def overlap_integral(Ra: np.ndarray, Rb: np.ndarray, r: np.ndarray) -> float:
    return float(np.trapezoid(Ra * Rb * (r * r), r))


def check_spherical_average_signals(cache_obj: dict, atom: str) -> list[str]:
    msgs: list[str] = []

    atoms = cache_obj.get("atoms", {})
    a = atoms.get(atom)
    if a is None:
        return [f"[FAIL] VeeCache has no atom '{atom}'"]

    # If the cache contains only subshell keys (e.g. '2p') and not m-resolved keys,
    # the stored Vee is necessarily spherical (radial-only).
    keys = list(a.keys())
    m_like = [k for k in keys if re.search(r"[xyz]$|_m|m=", k)]
    if m_like:
        msgs.append(f"[WARN] Found m-like orbital keys: {m_like[:6]}")
    else:
        msgs.append("[OK] Cache keys are subshell-style (no m-resolved potentials found)")

    # Verify generator uses spherical average 1/(4π) by simple source scan.
    gen_src = Path("_experiments/generate_production_cache.py").read_text(encoding="utf-8")
    if "contrib = R2 / (4.0 * PI)" in gen_src and "Ylm" not in gen_src:
        msgs.append("[OK] Generator constructs densities with spherical average 1/(4π) (radial-only)")
    else:
        msgs.append("[WARN] Could not confidently confirm spherical-average construction from source scan")

    return msgs


def main() -> None:
    atom = "C"
    repo_root = Path(__file__).resolve().parent.parent

    vee = load_vee_cache(repo_root / "vee_cache.js")
    basis = parse_slater_basis(str(repo_root / "slater_basis.js"))

    if atom not in vee.get("atoms", {}):
        raise SystemExit(f"Atom {atom} not in vee_cache.js")
    if atom not in basis:
        raise SystemExit(f"Atom {atom} not in slater_basis.js")

    print("== Concern 1: Spherical-average safety ==")
    for line in check_spherical_average_signals(vee, atom):
        print(line)

    config = ELECTRON_CONFIGS[atom]
    Z = int(sum(config.values()))  # neutral atoms
    r_grid = np.array(vee["r_grid"], dtype=np.float64)

    # Pick orbitals to inspect
    inspect = [k for k in ["1s", "2s", "2p"] if k in vee["atoms"][atom]]
    if not inspect:
        inspect = list(vee["atoms"][atom].keys())[:3]

    print("\n== Concern 2: Orthogonality of input orbitals (radial overlaps) ==")
    orbitals = basis[atom]["orbitals"]

    # Group by l
    groups: dict[int, list[str]] = {}
    for key in orbitals.keys():
        m = re.match(r"^(\d+)([spdf])$", key)
        if not m:
            continue
        l = {"s": 0, "p": 1, "d": 2, "f": 3}[m.group(2)]
        groups.setdefault(l, []).append(key)

    # Check overlaps within same l for the lowest few n (to keep output readable)
    for l, keys in sorted(groups.items()):
        keys_sorted = sorted(keys, key=lambda k: int(re.match(r"^(\d+)", k).group(1)))
        keys_sorted = keys_sorted[:5]
        if len(keys_sorted) < 2:
            continue

        Rs = {k: evaluate_radial_R(orbitals[k], r_grid) for k in keys_sorted}
        # Normalize check
        norms = {k: overlap_integral(Rs[k], Rs[k], r_grid) for k in keys_sorted}
        max_off = 0.0
        worst_pair = None
        for i in range(len(keys_sorted)):
            for j in range(i + 1, len(keys_sorted)):
                oi = overlap_integral(Rs[keys_sorted[i]], Rs[keys_sorted[j]], r_grid)
                if abs(oi) > max_off:
                    max_off = abs(oi)
                    worst_pair = (keys_sorted[i], keys_sorted[j], oi)

        print(f"l={l} keys={keys_sorted}")
        print("  norms (∫R^2 r^2 dr): " + ", ".join([f"{k}={norms[k]:.6g}" for k in keys_sorted]))
        if worst_pair is not None:
            a, b, oi = worst_pair
            print(f"  max |overlap| among these: |<{a}|{b}>|={abs(oi):.3g} (value={oi:.3g})")

    print("\n== Concern 3: Energy / kinetic consistency (t_Δ vs ε - V_eff) ==")
    energies = basis[atom].get("energies", {})

    for orb in inspect:
        if orb not in orbitals:
            print(f"[SKIP] {orb}: not in basis orbitals")
            continue
        if orb not in energies:
            print(f"[SKIP] {orb}: no epsilon in basis energies")
            continue

        eps = float(energies[orb])
        l = {"s": 0, "p": 1, "d": 2, "f": 3}[re.match(r"^\d+([spdf])$", orb).group(1)]

        R, Rp, Rpp = eval_R_Rp_Rpp(orbitals[orb], r_grid)
        t_lap = local_kinetic_from_laplacian(R, Rp, Rpp, l, r_grid)

        Vee = np.array(vee["atoms"][atom][orb], dtype=np.float64)
        Vnuc = -float(Z) / r_grid
        Veff = Vnuc + Vee
        t_eps = eps - Veff

        # weight by radial probability density P(r) = r^2 R(r)^2
        P = (r_grid * r_grid) * (R * R)

        # Avoid r->0 blowups in summary by focusing on region where P is non-negligible.
        # Use points where P > 1e-6 * max(P).
        mask = P > (1e-6 * float(np.max(P)))
        if not np.any(mask):
            print(f"[WARN] {orb}: P mask empty")
            continue

        r = r_grid[mask]
        Pm = P[mask]
        d = (t_eps - t_lap)[mask]

        rms = weighted_rms(d, Pm, r)
        mean = float(np.trapezoid(Pm * d, r) / np.trapezoid(Pm, r))
        p99 = float(np.quantile(np.abs(d), 0.99))

        # Also report a few sample radii around 2, 5, 10 a0 (nearest points)
        def sample(target: float) -> tuple[float, float, float]:
            j = int(np.argmin(np.abs(r_grid - target)))
            return float(r_grid[j]), float(t_lap[j]), float(t_eps[j])

        s2 = sample(2.0)
        s5 = sample(5.0)
        s10 = sample(10.0)

        print("\n---")
        print(f"orbital={orb}  epsilon(HF)={eps:.6g}  Z={Z}")
        print(f"RMS_P(|t_eps - t_lap|) = {rms:.6g} Hartree")
        print(f"mean_P(t_eps - t_lap)  = {mean:.6g} Hartree")
        print(f"p99(|t_eps - t_lap|)   = {p99:.6g} Hartree")
        print(f"samples: r={s2[0]:.3g}  t_lap={s2[1]:.6g}  t_eps={s2[2]:.6g}")
        print(f"         r={s5[0]:.3g}  t_lap={s5[1]:.6g}  t_eps={s5[2]:.6g}")
        print(f"         r={s10[0]:.3g} t_lap={s10[1]:.6g}  t_eps={s10[2]:.6g}")

    print("\n== Tail sanity (Zeff -> 1) ==")
    for orb in inspect:
        Vee = np.array(vee["atoms"][atom][orb], dtype=np.float64)
        Zeff = float(Z) - r_grid * Vee
        j = int(np.argmin(np.abs(r_grid - 20.0)))
        print(f"{orb}: Zeff(r≈{r_grid[j]:.3g})≈{Zeff[j]:.6g}  Zeff(r_max={r_grid[-1]:.3g})≈{Zeff[-1]:.6g}")


if __name__ == "__main__":
    main()
