"""Comprehensive offscreen audit for FA+AK vs eigenvalue-subtraction kinetics.

What this does
- For each atom (H–Kr) and each orbital available in Koga SlaterBasis:
  - Build an FA-style Vee(r): Vee_FA = ((N-1)/N) * V_H[rho] + Vx_sigma[rho_sigma]
    using the same spherical Hartree solver + Slater Xα exchange as the production generator.
  - Compute analytical local kinetic t_AK(r) from STO derivatives, but ONLY on non-singular points
    (where probability density is non-negligible) and excluding a near-nucleus cutoff.
  - Compare against the eigenvalue subtraction form t_eps(r) = epsilon - Veff(r), with
    Veff(r) = -Z/r + Vee(r).

Outputs
- Writes `_experiments/audit_fa_ak.csv` with one row per (atom, orbital).
- Prints a compact summary (worst offenders + global quantiles).

Run
  python -m _experiments.comprehensive_fa_ak_audit

Important
- This is a diagnostic script; it does not modify any production JS or caches.
- Metrics are computed on "non-singular" points defined by a probability cutoff.
"""

from __future__ import annotations

import csv
import json
import math
import re
from dataclasses import dataclass
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
    sto_normalization,
)


@dataclass(frozen=True)
class AuditParams:
    r_core_min: float = 0.2
    prob_rel_cut: float = 1e-8
    alpha: float = 2.0 / 3.0


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


def get_l(orb: str) -> int:
    m = re.match(r"^\d+([spdf])$", orb)
    if not m:
        return 0
    return {"s": 0, "p": 1, "d": 2, "f": 3}[m.group(1)]


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


def weighted_rms(diff: np.ndarray, w: np.ndarray, x: np.ndarray) -> float:
    num = np.trapezoid(w * diff * diff, x)
    den = np.trapezoid(w, x)
    return float(math.sqrt(num / den)) if den > 0 else float("nan")


def audit_one_orbital(
    *,
    atom: str,
    orb: str,
    Z: int,
    r: np.ndarray,
    eps: float,
    Vee: np.ndarray,
    basis_terms: list[dict],
    params: AuditParams,
) -> dict:
    l = get_l(orb)
    R, Rp, Rpp = eval_R_Rp_Rpp(basis_terms, r)

    LapR = Rpp + (2.0 / r) * Rp - (float(l * (l + 1)) / (r * r)) * R
    P = (r * r) * (R * R)

    # Non-singular region mask: exclude near nucleus and near nodes/tail.
    Pmax = float(np.max(P))
    mask = (r >= params.r_core_min) & (P > (params.prob_rel_cut * Pmax))

    if not np.any(mask):
        return {
            "npts": 0,
            "max_abs": float("nan"),
            "r_at_max": float("nan"),
            "r_tail": float("nan"),
            "tail_abs": float("nan"),
            "rms_P": float("nan"),
            "mean_P": float("nan"),
            "p99_abs": float("nan"),
        }

    # Analytical local kinetic t_AK on mask (stable via Tdens/P)
    Tdens_analytic = -0.5 * (r * r) * R * LapR
    t_AK = np.zeros_like(r)
    t_AK[mask] = Tdens_analytic[mask] / P[mask]

    Veff = (-float(Z) / r) + Vee
    t_eps = eps - Veff

    d = (t_eps - t_AK)[mask]
    rr = r[mask]
    ww = P[mask]

    absd = np.abs(d)
    imax = int(np.argmax(absd))

    # Define a "convergence" probe at the largest r inside the non-singular mask.
    itail = int(np.argmax(rr))

    mean = float(np.trapezoid(ww * d, rr) / np.trapezoid(ww, rr))

    return {
        "npts": int(d.size),
        "max_abs": float(absd[imax]),
        "r_at_max": float(rr[imax]),
        "r_tail": float(rr[itail]),
        "tail_abs": float(absd[itail]),
        "rms_P": weighted_rms(d, ww, rr),
        "mean_P": mean,
        "p99_abs": float(np.quantile(absd, 0.99)),
    }


def main() -> None:
    def _env_float(name: str, default: float) -> float:
        s = str(os.environ.get(name, "")).strip()
        if not s:
            return float(default)
        try:
            return float(s)
        except ValueError:
            return float(default)

    import os

    params = AuditParams(
        r_core_min=_env_float("AUDIT_R_CORE_MIN", AuditParams.r_core_min),
        prob_rel_cut=_env_float("AUDIT_PROB_REL_CUT", AuditParams.prob_rel_cut),
        alpha=_env_float("AUDIT_ALPHA", AuditParams.alpha),
    )

    repo_root = Path(__file__).resolve().parent.parent
    vee_cache = load_vee_cache(repo_root / "vee_cache.js")
    r = np.array(vee_cache["r_grid"], dtype=np.float64)

    basis_all = parse_slater_basis(str(repo_root / "slater_basis.js"))

    out_path = repo_root / "_experiments" / "audit_fa_ak.csv"

    rows: list[dict] = []

    atoms = [a for a in ELECTRON_CONFIGS.keys() if a in basis_all]

    for atom in atoms:
        config = ELECTRON_CONFIGS[atom]
        Z = int(sum(config.values()))
        N = Z

        atom_data = basis_all[atom]
        orbitals = atom_data.get("orbitals", {})
        energies = atom_data.get("energies", {})

        # Build densities for FA potential
        rho_up = np.zeros_like(r)
        rho_dn = np.zeros_like(r)
        occ_spin: dict[str, tuple[int, int]] = {}

        for orb_name, n_occ in config.items():
            if orb_name not in orbitals:
                continue
            Rocc = evaluate_radial_R(orbitals[orb_name], r)
            contrib = (Rocc * Rocc) / (4.0 * PI)
            n_up, n_dn = hund_spin_split(orb_name, int(n_occ))
            occ_spin[orb_name] = (n_up, n_dn)
            rho_up += float(n_up) * contrib
            rho_dn += float(n_dn) * contrib

        rho_tot = rho_up + rho_dn
        Vh_std = compute_hartree_potential(r, rho_tot)
        fa_factor = 0.0 if N <= 1 else float(N - 1) / float(N)
        Vh_fa = Vh_std * fa_factor

        Vx_up = compute_slater_xalpha_exchange(rho_up, params.alpha)
        Vx_dn = compute_slater_xalpha_exchange(rho_dn, params.alpha)

        # For the audit we define FA Vee using spin-up channel by default.
        Vee_fa_up = Vh_fa + Vx_up
        Zeff_fa = float(Z) - r * Vee_fa_up
        Zeff_fa_tail_err = float(abs(Zeff_fa[-1] - 1.0))

        # Evaluate all orbitals present in basis ("全轨道")
        for orb, basis_terms in orbitals.items():
            eps = energies.get(orb)
            if eps is None:
                continue
            eps_f = float(eps)

            # Cached Vee exists only for occupied orbitals in vee_cache.js
            cached_atom = vee_cache.get("atoms", {}).get(atom, {})
            Vee_cached = cached_atom.get(orb)

            # Compare AK vs eps-Veff with FA potential
            m_fa = audit_one_orbital(
                atom=atom,
                orb=orb,
                Z=Z,
                r=r,
                eps=eps_f,
                Vee=Vee_fa_up,
                basis_terms=basis_terms,
                params=params,
            )

            # Compare AK vs eps-Veff with cached potential (if present)
            m_cache = None
            Zeff_cache_tail_err = float("nan")
            if Vee_cached is not None:
                Vee_cached_arr = np.array(Vee_cached, dtype=np.float64)
                Zeff_cache = float(Z) - r * Vee_cached_arr
                Zeff_cache_tail_err = float(abs(Zeff_cache[-1] - 1.0))
                m_cache = audit_one_orbital(
                    atom=atom,
                    orb=orb,
                    Z=Z,
                    r=r,
                    eps=eps_f,
                    Vee=Vee_cached_arr,
                    basis_terms=basis_terms,
                    params=params,
                )

            row = {
                "atom": atom,
                "orbital": orb,
                "Z": Z,
                "epsilon": eps_f,
                "npts": m_fa["npts"],
                "r_core_min": params.r_core_min,
                "prob_rel_cut": params.prob_rel_cut,
                "alpha": params.alpha,
                # FA metrics (AK vs eps-V)
                "fa_max_abs": m_fa["max_abs"],
                "fa_r_at_max": m_fa["r_at_max"],
                "fa_tail_abs": m_fa["tail_abs"],
                "fa_r_tail": m_fa["r_tail"],
                "fa_rms_P": m_fa["rms_P"],
                "fa_mean_P": m_fa["mean_P"],
                "fa_p99_abs": m_fa["p99_abs"],
                "fa_Zeff_tail_err": Zeff_fa_tail_err,
                # Cached metrics (AK vs eps-V)
                "cache_present": 1 if Vee_cached is not None else 0,
                "cache_max_abs": (m_cache["max_abs"] if m_cache is not None else float("nan")),
                "cache_r_at_max": (m_cache["r_at_max"] if m_cache is not None else float("nan")),
                "cache_tail_abs": (m_cache["tail_abs"] if m_cache is not None else float("nan")),
                "cache_r_tail": (m_cache["r_tail"] if m_cache is not None else float("nan")),
                "cache_rms_P": (m_cache["rms_P"] if m_cache is not None else float("nan")),
                "cache_mean_P": (m_cache["mean_P"] if m_cache is not None else float("nan")),
                "cache_p99_abs": (m_cache["p99_abs"] if m_cache is not None else float("nan")),
                "cache_Zeff_tail_err": Zeff_cache_tail_err,
            }
            rows.append(row)

    # Write CSV
    fieldnames = list(rows[0].keys()) if rows else []
    out_path.parent.mkdir(parents=True, exist_ok=True)
    with out_path.open("w", newline="", encoding="utf-8") as f:
        w = csv.DictWriter(f, fieldnames=fieldnames)
        w.writeheader()
        for row in rows:
            w.writerow(row)

    # Print compact summary
    def _top(rows_in: list[dict], key: str, n: int = 15) -> list[dict]:
        rr = [r for r in rows_in if isinstance(r.get(key), (int, float)) and math.isfinite(float(r.get(key)))]
        rr.sort(key=lambda x: float(x[key]), reverse=True)
        return rr[:n]

    fa_top = _top(rows, "fa_max_abs", 12)
    cache_top = _top([r for r in rows if r.get("cache_present") == 1], "cache_max_abs", 12)

    print("== Comprehensive FA+AK audit ==")
    print(f"rows={len(rows)}  out={out_path}")
    print(f"params: r_core_min={params.r_core_min}  prob_rel_cut={params.prob_rel_cut}  alpha={params.alpha}")

    print("\n-- Worst FA (max |t_eps - t_AK| on non-singular points) --")
    for r0 in fa_top:
        print(
            f"{r0['atom']:>2} {r0['orbital']:<3}  "
            f"max={r0['fa_max_abs']:.6g} @r={r0['fa_r_at_max']:.4g}  "
            f"tail={r0['fa_tail_abs']:.6g} @r={r0['fa_r_tail']:.4g}  "
            f"rmsP={r0['fa_rms_P']:.6g}"
        )

    print("\n-- Worst cached (occupied orbitals only) --")
    for r0 in cache_top:
        print(
            f"{r0['atom']:>2} {r0['orbital']:<3}  "
            f"max={r0['cache_max_abs']:.6g} @r={r0['cache_r_at_max']:.4g}  "
            f"tail={r0['cache_tail_abs']:.6g} @r={r0['cache_r_tail']:.4g}  "
            f"rmsP={r0['cache_rms_P']:.6g}"
        )

    # Global quantiles
    fa_vals = np.array([float(r["fa_max_abs"]) for r in rows if math.isfinite(float(r["fa_max_abs"]))], dtype=np.float64)
    cache_vals = np.array([float(r["cache_max_abs"]) for r in rows if math.isfinite(float(r["cache_max_abs"]))], dtype=np.float64)

    def _q(arr: np.ndarray) -> str:
        if arr.size == 0:
            return "(none)"
        return f"p50={np.quantile(arr,0.5):.6g}  p90={np.quantile(arr,0.9):.6g}  p99={np.quantile(arr,0.99):.6g}  max={np.max(arr):.6g}"

    print("\n-- Global max-abs diff quantiles --")
    print("FA    : " + _q(fa_vals))
    print("cached: " + _q(cache_vals))


if __name__ == "__main__":
    main()
