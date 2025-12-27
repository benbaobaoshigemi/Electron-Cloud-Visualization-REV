import numpy as np
from scipy.spatial.transform import Rotation as R
from scipy.optimize import minimize
import sys

# ==========================================
# 1. Physics Core (Reuse)
# ==========================================

def factorial(n):
    if n <= 1: return 1
    return n * factorial(n - 1)

def real_ylm(l, m, theta, phi):
    import scipy.special
    Y = scipy.special.sph_harm(m, l, phi, theta)
    if m == 0:
        return np.real(Y)
    elif m > 0:
        return np.sqrt(2) * np.real(Y) * ((-1)**m)
    else:
        return np.sqrt(2) * np.imag(scipy.special.sph_harm(-m, l, phi, theta)) * ((-1)**m)

def get_basis_func(label, theta, phi):
    if label == 's': return real_ylm(0, 0, theta, phi)
    if label == 'pz': return real_ylm(1, 0, theta, phi)
    if label == 'px': return real_ylm(1, 1, theta, phi)
    if label == 'py': return real_ylm(1, -1, theta, phi)
    raise ValueError(f"Unknown orbital: {label}")

# ==========================================
# 2. Geometry Generators
# ==========================================

def generate_linear(n=2):
    # Standard Thomson linear is Z-aligned
    return np.array([[0,0,1], [0,0,-1]])

def generate_point(n=1):
    return np.array([[0,0,1]])

def random_rotate(points):
    rot = R.random()
    return rot.apply(points), rot

# ==========================================
# 3. Optimization Logic
# ==========================================

def build_matrix(points, basis_labels):
    N = len(points)
    M = len(basis_labels)
    mat = np.zeros((N, M))
    for i in range(N):
        x, y, z = points[i]
        r = np.linalg.norm([x,y,z])
        theta = np.arccos(min(1, max(-1, z/r))) if r > 1e-9 else 0
        phi = np.arctan2(y, x)
        for j in range(M):
            mat[i, j] = get_basis_func(basis_labels[j], theta, phi)
    return mat

def cost_function(rot_vec, original_points, basis_labels):
    r = R.from_rotvec(rot_vec)
    rotated_points = r.apply(original_points)
    mat = build_matrix(rotated_points, basis_labels)
    U, S, Vh = np.linalg.svd(mat)
    score = np.sum(np.log(S + 1e-12))
    return -score

def optimize_alignment(initial_points, basis_labels):
    print(f"Aligning {len(initial_points)} points to basis: {basis_labels}")
    best_score = float('inf')
    best_rot = np.zeros(3)
    
    # Try multiple random starts
    for _ in range(20):
        seed_rot = R.random().as_rotvec()
        res = minimize(
            cost_function, 
            seed_rot, 
            args=(initial_points, basis_labels),
            method='BFGS'
        )
        if res.fun < best_score:
            best_score = res.fun
            best_rot = res.x
            
    return R.from_rotvec(best_rot).apply(initial_points)

# ==========================================
# 4. Analysis
# ==========================================

def analyze_case(name, points_gen, basis_labels):
    print(f"\n{'='*40}")
    print(f"CASE: {name}")
    print(f"{'='*40}")
    
    # Start with random rotation
    base_points = points_gen()
    points, _ = random_rotate(base_points)
    
    # Optimize
    aligned_points = optimize_alignment(points, basis_labels)
    
    mat_after = build_matrix(aligned_points, basis_labels)
    _, S_after, _ = np.linalg.svd(mat_after)
    
    det_vol = np.prod(S_after)
    print(f"\nOptimized Singular Values: {np.round(S_after, 4)}")
    print(f"Vol Index (Det): {det_vol:.4e}")
    
    # Rank check
    rank = np.sum(S_after > 1e-4)
    print(f"Effective Rank: {rank} / {len(basis_labels)}")
    
    if rank < len(basis_labels):
        print(">> WARNING: Rank deficient.")
    else:
        print(">> STATUS: Full Rank.")
        
    U, S, Vh = np.linalg.svd(mat_after)
    V = Vh.T
    coeffs = U @ V.T
    
    print("\n[Aligned Coefficients] (Rows=Hybrids, Cols=Basis):")
    def vec_str(v): return f"[{v[0]:.2f}, {v[1]:.2f}, {v[2]:.2f}]"
    
    for i in range(len(aligned_points)):
        row_str = "  ".join([f"{coeffs[i,j]:6.3f}" for j in range(len(basis_labels))])
        print(f"H{i+1} (Dir {vec_str(aligned_points[i])}): {row_str}")

if __name__ == "__main__":
    
    # 1. Pure s
    # N=1. Basis 's'.
    # Should work regardless of rotation.
    analyze_case("Pure s", generate_point, ['s'])
    
    # 2. Cross-shell sp (s + px)
    # Thomson N=2 -> Linear (usually Z-axis).
    # Basis: 's', 'px'. 'px' requires X-axis.
    # The optimization SHOULD rotate the Z-axis Thomson points to the X-axis.
    analyze_case("Cross-shell sp (s + px)", generate_linear, ['s', 'px'])
