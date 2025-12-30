"""Offscreen test: compare current SIC-style cached Vee vs a Fermi-Amaldi (FA) Hartree scaling.

Goal:
- Quantify whether FA produces smooth Zeff curves without early plateau/kinks.
- No production code changes; does not write vee_cache.js.

Run:
  python -m _experiments.offscreen_fa_test

Notes:
- Uses the same Koga STO basis (slater_basis.js).
- Uses the same Hartree solver + Slater Xα exchange as generator.
- FA applies factor (N-1)/N to the *Hartree* term only.
- Exchange is kept as Slater Xα in the test-electron spin channel.
- Tail is reported; this test does NOT force Latter clamping.
"""

from __future__ import annotations

import json
import math
import re
from pathlib import Path

import numpy as np

from _experiments.generate_production_cache import (
    ELECTRON_CONFIGS,
    PI,
    compute_hartree_potential,
    compute_slater_xalpha_exchange,
    evaluate_radial_R,
    hund_spin_split,
    parse_slater_basis,
)


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


def zeff_metrics(r: np.ndarray, Z: int, Vee: np.ndarray) -> dict:
    Zeff = float(Z) - r * Vee

    # "Tail reach": first radius where Zeff within 1% of 1 and stays within 2% afterwards.
    within1 = np.abs(Zeff - 1.0) <= 0.01
    within2 = np.abs(Zeff - 1.0) <= 0.02

    # suffix condition: from i to end all within2
    suffix_all_within2 = np.flip(np.minimum.accumulate(np.flip(within2.astype(np.int8)))) == 1
    candidates = np.where(within1 & suffix_all_within2)[0]
    r_reach = float(r[candidates[0]]) if candidates.size else float("nan")

    # simple kink metric: max absolute second finite difference of Zeff vs log r
    x = np.log(r)
    d1 = np.gradient(Zeff, x)
    d2 = np.gradient(d1, x)
    kink = float(np.max(np.abs(d2)))

    def sample(target: float) -> float:
        j = int(np.argmin(np.abs(r - target)))
        return float(Zeff[j])

    return {
        "r_reach": r_reach,
        "kink": kink,
        "Zeff@1.7": sample(1.7),
        "Zeff@20": sample(20.0),
        "Zeff@rmax": float(Zeff[-1]),
    }


def main() -> None:
    repo_root = Path(__file__).resolve().parent.parent

    atom = "C"
    config = ELECTRON_CONFIGS[atom]
    Z = int(sum(config.values()))
    N = Z

    vee_cache = load_vee_cache(repo_root / "vee_cache.js")
    r = np.array(vee_cache["r_grid"], dtype=np.float64)

    basis_all = parse_slater_basis(str(repo_root / "slater_basis.js"))
    orbitals = basis_all[atom]["orbitals"]

    alpha = 2.0 / 3.0

    # Build spin densities (spherical average)
    rho_up = np.zeros_like(r)
    rho_dn = np.zeros_like(r)
    occ_spin: dict[str, tuple[int, int]] = {}
    one_e_contrib: dict[str, np.ndarray] = {}

    for orb_name, n_occ in config.items():
        R = evaluate_radial_R(orbitals[orb_name], r)
        contrib = (R * R) / (4.0 * PI)
        one_e_contrib[orb_name] = contrib
        n_up, n_dn = hund_spin_split(orb_name, int(n_occ))
        occ_spin[orb_name] = (n_up, n_dn)
        rho_up += float(n_up) * contrib
        rho_dn += float(n_dn) * contrib

    rho_tot = rho_up + rho_dn

    # Standard Hartree from N-electron density
    Vh_std = compute_hartree_potential(r, rho_tot)

    # Fermi-Amaldi scaling factor
    fa_factor = 0.0 if N <= 1 else float(N - 1) / float(N)
    Vh_fa = Vh_std * fa_factor

    # Exchange per spin channel (short-range)
    Vx_up = compute_slater_xalpha_exchange(rho_up, alpha)
    Vx_dn = compute_slater_xalpha_exchange(rho_dn, alpha)

    inspect = [k for k in ["1s", "2s", "2p"] if k in config]

    print("== Offscreen FA vs Cached(SIC-style) ==")
    print(f"atom={atom}  Z={Z}  N={N}  alpha={alpha}  r_max={float(r[-1]):.6g}")
    print(f"FA factor (N-1)/N = {fa_factor:.6g}")

    for orb in inspect:
        n_up, n_dn = occ_spin[orb]
        test_spin_up = n_up > 0
        Vx = Vx_up if test_spin_up else Vx_dn

        Vee_fa = Vh_fa + Vx
        Vee_cached = np.array(vee_cache["atoms"][atom][orb], dtype=np.float64)

        m_fa = zeff_metrics(r, Z, Vee_fa)
        m_cache = zeff_metrics(r, Z, Vee_cached)

        print("\n---")
        print(f"orbital={orb}  testSpin={'up' if test_spin_up else 'dn'}")
        print(
            "cached: "
            f"Zeff@1.7={m_cache['Zeff@1.7']:.6g}  "
            f"Zeff@20={m_cache['Zeff@20']:.6g}  "
            f"Zeff@rmax={m_cache['Zeff@rmax']:.6g}  "
            f"r_reach≈{m_cache['r_reach']:.6g}  "
            f"kink={m_cache['kink']:.6g}"
        )
        print(
            "FA    : "
            f"Zeff@1.7={m_fa['Zeff@1.7']:.6g}  "
            f"Zeff@20={m_fa['Zeff@20']:.6g}  "
            f"Zeff@rmax={m_fa['Zeff@rmax']:.6g}  "
            f"r_reach≈{m_fa['r_reach']:.6g}  "
            f"kink={m_fa['kink']:.6g}"
        )

    # Tail sanity for FA (should approach 1)
    print("\n== FA tail sanity ==")
    for orb in inspect:
        n_up, _ = occ_spin[orb]
        Vx = Vx_up if n_up > 0 else Vx_dn
        Vee_fa = Vh_fa + Vx
        Zeff = float(Z) - r * Vee_fa
        j = int(np.argmin(np.abs(r - 20.0)))
        print(f"{orb}: Zeff(r≈{float(r[j]):.6g})≈{float(Zeff[j]):.6g}  Zeff(r_max)≈{float(Zeff[-1]):.6g}")


if __name__ == "__main__":
    main()
