import json
import re
from pathlib import Path

import numpy as np


def load_vee_cache(path: Path) -> dict:
    text = path.read_text(encoding="utf-8")
    # Support patterns like:
    #   window.VeeCache = {...};
    #   (typeof self !== 'undefined' ? self : window).VeeCache = {...};
    m = re.search(r"VeeCache\s*=", text)
    if not m:
        raise RuntimeError("VeeCache assignment not found in file")

    start = text.find("{", m.end())
    if start < 0:
        raise RuntimeError("VeeCache object literal start '{' not found")

    # The cache is JSON-compatible; it ends with '};'. Grab the last matching '};'.
    end = text.rfind("};")
    if end < 0 or end <= start:
        raise RuntimeError("VeeCache object literal end '};' not found")

    return json.loads(text[start:end + 1])


def nearest_index(x: np.ndarray, target: float) -> int:
    return int(np.argmin(np.abs(x - target)))


def main() -> None:
    obj = load_vee_cache(Path("vee_cache.js"))
    r = np.array(obj["r_grid"], dtype=np.float64)

    atoms = obj.get("atoms", {})
    c = atoms.get("C")
    if c is None:
        raise SystemExit(f"No 'C' in cache. Available keys sample: {list(atoms)[:10]}")

    preferred = [k for k in ["1s", "2s", "2p"] if k in c]
    if not preferred:
        preferred = list(c.keys())[:3]

    print(f"Selected atom=C; orbitals checked={preferred}")
    print(f"r_grid: len={len(r)} min={r[0]:.3g} max={r[-1]:.3g}")

    Z = 6.0
    sample_r = [0.2, 0.5, 1.0, 1.5, 1.7, 2.0, 3.0, 5.0, 8.0, 10.0, 20.0, 30.0, 50.0]

    for orbital_key in preferred:
        v = np.array(c[orbital_key], dtype=np.float64)
        zeff = Z - r * v

        dz = np.diff(zeff)
        window = 200
        plateau = None
        if len(dz) > window:
            abs_dz = np.abs(dz)
            for i in range(len(abs_dz) - window):
                if np.max(abs_dz[i : i + window]) < 1e-10:
                    plateau = i
                    break

        d2 = np.diff(zeff, n=2)
        kink_i = int(np.argmax(np.abs(d2))) if len(d2) else None

        print("\n---")
        print(f"orbital={orbital_key}  Zeff[min,max]=[{zeff.min():.6g}, {zeff.max():.6g}]")
        if plateau is not None:
            print(f"plateau idx={plateau} r≈{r[plateau]:.6g} Zeff≈{zeff[plateau]:.6g}")
        else:
            print("plateau: none (tolerance)")

        if kink_i is not None:
            j = kink_i + 1
            print(f"max curvature idx={j} r≈{r[j]:.6g} Zeff≈{zeff[j]:.6g} d2≈{d2[kink_i]:.3g}")

        for target in sample_r:
            j = nearest_index(r, target)
            print(f"r≈{r[j]:.6g}  Vee≈{v[j]:.6g}  Zeff≈{zeff[j]:.6g}")


if __name__ == "__main__":
    main()
