import json
import re
from pathlib import Path


def load_vee_cache(js_path: Path) -> dict:
    text = js_path.read_text(encoding="utf-8")
    m = re.search(r"VeeCache\s*=\s*(\{.*\})\s*;\s*$", text, re.S)
    if not m:
        raise RuntimeError("Failed to locate VeeCache JSON payload")
    return json.loads(m.group(1))


def main() -> None:
    repo_root = Path(__file__).resolve().parent.parent
    js_path = repo_root / "vee_cache.js"
    data = load_vee_cache(js_path)

    # Spot-check: He has N=2 -> tail should satisfy Vee(r) ~ (N-1)/r = 1/r
    rg = data["r_grid"]
    vals = data["atoms"]["He"]["1s"]

    print("He(1s) tail check")
    idxs = [-1, -2, -5, -10, -20, -32]
    for idx in idxs:
        r = rg[idx]
        v = vals[idx]
        print(f"  idx {idx:>4}: r={r:.6g}  v={v:.6g}  v*r={v*r:.6g}")


if __name__ == "__main__":
    main()
