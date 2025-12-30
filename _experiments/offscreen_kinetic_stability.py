"""Offscreen test: analytical kinetic density stability without dividing by R.

We compare two constructions on the same radial grid:
- Tdens_analytic(r) = -0.5 * r^2 * R(r) * LapR(r)
  where LapR = R'' + (2/r)R' - l(l+1)/r^2 * R
- Tdens_eps(r) = (epsilon - Veff(r)) * P(r)  with P(r)=r^2 R(r)^2

The first avoids the node singularity caused by dividing by R.

Run:
  python -m _experiments.offscreen_kinetic_stability
"""

from __future__ import annotations

import json
import math
import re
from pathlib import Path

import numpy as np

from _experiments.generate_production_cache import (
    ELECTRON_CONFIGS,
    evaluate_radial_R,
    parse_slater_basis,
    sto_normalization,
)


def load_vee_cache(path: Path) -> dict:
    text = path.read_text(encoding="utf-8")
    m = re.search(r"VeeCache\s*=", text)
    if not m:
        raise RuntimeError("VeeCache assignment not found")
    start = text.find("{", m.end())
    end = text.rfind("};")
    if start < 0 or end < 0 or end <= start:
        raise RuntimeError("VeeCache object not found")
    return json.loads(text[start : end + 1])


def eval_R_Rp_Rpp(basis_terms: list[dict], r: np.ndarray) -> tuple[np.ndarray, np.ndarray, np.ndarray]:
    R = np.zeros_like(r, dtype=np.float64)
    Rp = np.zeros_like(r, dtype=np.float64)
    Rpp = np.zeros_like(r, dtype=np.float64)

    for term in basis_terms:
        n = int(term["nStar"])
        zeta = float(term["zeta"])
        coeff = float(term["coeff"])
        N = sto_normalization(n, zeta)

        rn1 = np.power(r, n - 1)
        exp = np.exp(-zeta * r)
        chi = N * rn1 * exp

        rn2 = np.power(r, n - 2) if n >= 2 else np.power(r, -1)
        chip = N * (((n - 1) * rn2) - zeta * rn1) * exp

        rn3 = np.power(r, n - 3) if n >= 3 else np.power(r, -2)
        chipp = N * (((n - 1) * (n - 2) * rn3) - (2.0 * zeta * (n - 1) * rn2) + (zeta * zeta * rn1)) * exp

        R += coeff * chi
        Rp += coeff * chip
        Rpp += coeff * chipp

    return R, Rp, Rpp


def get_l(orb: str) -> int:
    return {"s": 0, "p": 1, "d": 2, "f": 3}[re.match(r"^\d+([spdf])$", orb).group(1)]


def quantiles(x: np.ndarray) -> dict:
    ax = np.abs(x)
    return {
        "p50": float(np.quantile(ax, 0.50)),
        "p90": float(np.quantile(ax, 0.90)),
        "p99": float(np.quantile(ax, 0.99)),
        "max": float(np.max(ax)),
    }


def main() -> None:
    repo_root = Path(__file__).resolve().parent.parent

    atom = "C"
    config = ELECTRON_CONFIGS[atom]
    Z = int(sum(config.values()))

    vee = load_vee_cache(repo_root / "vee_cache.js")
    r = np.array(vee["r_grid"], dtype=np.float64)

    basis = parse_slater_basis(str(repo_root / "slater_basis.js"))
    orbitals = basis[atom]["orbitals"]
    energies = basis[atom]["energies"]

    inspect = ["1s", "2s", "2p"]

    print("== Offscreen kinetic density stability ==")
    print(f"atom={atom}  Z={Z}  r_max={float(r[-1]):.6g}")

    for orb in inspect:
        eps = float(energies[orb])
        l = get_l(orb)

        R, Rp, Rpp = eval_R_Rp_Rpp(orbitals[orb], r)
        LapR = Rpp + (2.0 / r) * Rp - (float(l * (l + 1)) / (r * r)) * R

        # Stable analytical kinetic density (no division by R)
        Tdens_analytic = -0.5 * (r * r) * R * LapR

        # Epsilon-based density used by UI now
        Vee_orb = np.array(vee["atoms"][atom][orb], dtype=np.float64)
        Veff = (-float(Z) / r) + Vee_orb
        P = (r * r) * (R * R)
        Tdens_eps = (eps - Veff) * P

        diff = Tdens_eps - Tdens_analytic

        # Focus on region where probability is not negligible
        mask = P > (1e-8 * float(np.max(P)))
        q = quantiles(diff[mask])

        # Also report raw quantiles (includes deep-node/very-small-P regions)
        q_raw = quantiles(diff)

        print("\n---")
        print(f"orb={orb}  eps={eps:.6g}")
        print(f"|ΔTdens| quantiles (P-filtered): p50={q['p50']:.6g}  p90={q['p90']:.6g}  p99={q['p99']:.6g}  max={q['max']:.6g}")
        print(f"|ΔTdens| quantiles (raw)      : p50={q_raw['p50']:.6g}  p90={q_raw['p90']:.6g}  p99={q_raw['p99']:.6g}  max={q_raw['max']:.6g}")

        # Sanity: show that analytic form itself stays finite
        qa = quantiles(Tdens_analytic[mask])
        print(f"|Tdens_analytic| (P-filtered): p99={qa['p99']:.6g}  max={qa['max']:.6g}")


if __name__ == "__main__":
    main()
