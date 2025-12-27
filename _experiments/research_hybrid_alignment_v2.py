import numpy as np
from scipy.spatial.transform import Rotation as R
from scipy.optimize import minimize
import sys

# ==========================================
# 1. Physics Core: Real Spherical Harmonics
# ==========================================

def factorial(n):
    if n <= 1: return 1
    return n * factorial(n - 1)

def associated_legendre(l, m, x):
    import scipy.special
    return scipy.special.lpmv(m, l, x)

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
    if label == 'dz2': return real_ylm(2, 0, theta, phi)
    if label == 'dxz': return real_ylm(2, 1, theta, phi)
    if label == 'dyz': return real_ylm(2, -1, theta, phi)
    if label == 'dx2-y2': return real_ylm(2, 2, theta, phi)
    if label == 'dxy': return real_ylm(2, -2, theta, phi)
    raise ValueError(f"Unknown orbital: {label}")

# ==========================================
# 2. Geometry Generators
# ==========================================

def generate_linear(n=2):
    # N=2 Thomson -> Linear
    return np.array([[0,0,1], [0,0,-1]])

def generate_point(n=1):
    return np.array([[0,0,1]])

def generate_triangle(n=3):
    # Equilateral triangle in XY
    angles = [0, 2*np.pi/3, 4*np.pi/3]
    return np.array([[np.cos(a), np.sin(a), 0] for a in angles])

def generate_tetrahedral(n=4):
    # Standard tetrahedron
    points = [
        [1, 1, 1], [1, -1, -1], [-1, 1, -1], [-1, -1, 1]
    ]
    p = np.array(points)
    # Normalize
    norm = np.linalg.norm(p, axis=1, keepdims=True)
    return p / norm

def generate_tbp(n=5):
    return np.array([
        [0, 0, 1], [0, 0, -1],
        [1, 0, 0], [-0.5, np.sqrt(3)/2, 0], [-0.5, -np.sqrt(3)/2, 0]
    ])

def generate_octahedral(n=6):
    return np.array([
        [0, 0, 1], [0, 0, -1],
        [1, 0, 0], [-1, 0, 0],
        [0, 1, 0], [0, -1, 0]
    ])

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
    # Log product of sigmas
    score = np.sum(np.log(S + 1e-12))
    return -score

def optimize_alignment(initial_points, basis_labels):
    print(f"Aligning {len(initial_points)} points to basis: {basis_labels}")
    best_score = float('inf')
    best_rot = np.zeros(3)
    
    # Try more random starts for robustness
    for _ in range(20):
        seed_rot = R.random().as_rotvec()
        res = minimize(
            cost_function, 
            seed_rot, 
            args=(initial_points, basis_labels),
            method='BFGS' # or Nelder-Mead if gradient issues
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
        print(">> WARNING: Rank deficient. Basis cannot span the requested geometry.")
        if name in ["px+py", "pz+px"]:
            print(">> SUCCESS: Correctly identified non-hybridizing case.")
    else:
        print(">> STATUS: Full Rank. hybridization possible.")
        
    U, S, Vh = np.linalg.svd(mat_after)
    V = Vh.T
    coeffs = U @ V.T
    
    print("\n[Aligned Coefficients] (Rows=Hybrids, Cols=Basis):")
    def vec_str(v): return f"[{v[0]:.2f}, {v[1]:.2f}, {v[2]:.2f}]"
    
    for i in range(len(aligned_points)):
        row_str = "  ".join([f"{coeffs[i,j]:6.3f}" for j in range(len(basis_labels))])
        print(f"H{i+1} (Dir {vec_str(aligned_points[i])}): {row_str}")

if __name__ == "__main__":
    
    # 1. Pure pz
    analyze_case("Pure pz", generate_point, ['pz'])
    
    # 2. px + py (N=2 Linear)
    # Thomson N=2 -> Linear. Basis px, py -> 90 deg. Incompatible.
    analyze_case("px+py", generate_linear, ['px', 'py'])

    # 3. pz + px (N=2 Linear)
    # Thomson N=2 -> Linear. Basis pz, px -> 90 deg. Incompatible.
    analyze_case("pz+px", generate_linear, ['pz', 'px'])
    
    # 4. sp3
    analyze_case("sp3", generate_tetrahedral, ['s', 'pz', 'px', 'py'])
    
    # 5. sp3d
    analyze_case("sp3d", generate_tbp, ['s', 'pz', 'px', 'py', 'dz2'])

    # 6. sp3d2
    analyze_case("sp3d2", generate_octahedral, ['s', 'pz', 'px', 'py', 'dz2', 'dx2-y2'])
