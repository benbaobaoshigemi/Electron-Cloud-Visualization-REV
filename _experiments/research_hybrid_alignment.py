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
    # Simplified standard implementation (or use scipy.special.lpmv)
    # Here using scipy for reliability
    import scipy.special
    return scipy.special.lpmv(m, l, x)

def real_ylm(l, m, theta, phi):
    # Standard Real Spherical Harmonics
    # m > 0: cos, m < 0: sin
    # Note: Physics.js uses a custom (l, m, t) signature. 
    # Here we map standard (l, m) to that logic or implement directly.
    
    # Physics.js conventions:
    # m=0 -> 1/sqrt(2pi) * N * P(l,0) (real)
    # m>0, t='c' -> 1/sqrt(pi) * N * P(l,m) * cos(m*phi)
    # m>0, t='s' -> 1/sqrt(pi) * N * P(l,m) * sin(m*phi)
    
    # Let's use standard normalization Y_lm
    # Y_lm = N * P_lm(cos theta) * e^(im phi)
    # Real form:
    # Y_{l0} = Y_{l0}
    # Y_{lm} = 1/sqrt(2) (Y_lm + (-1)^m Y_l-m)  (cosine)
    # Y_{l-m} = 1/i sqrt(2) (Y_lm - (-1)^m Y_l-m) (sine)
    
    # For this optimization, exact phase factors usually don't matter as much as shape
    # providing we are consistent.
    
    import scipy.special
    Y = scipy.special.sph_harm(m, l, phi, theta) # Note: scipy takes (m, n, phi, theta)
    
    if m == 0:
        return np.real(Y)
    elif m > 0:
        return np.sqrt(2) * np.real(Y) * ((-1)**m) # Condon-Shortley phase might differ
    else:
        return np.sqrt(2) * np.imag(scipy.special.sph_harm(-m, l, phi, theta)) * ((-1)**m)

def get_basis_func(label, theta, phi):
    # Map 's', 'pz', 'dz2' etc. to (l, m)
    # Using alignment: z is up.
    if label == 's': return real_ylm(0, 0, theta, phi)
    
    # P orbitals
    if label == 'pz': return real_ylm(1, 0, theta, phi)
    if label == 'px': return real_ylm(1, 1, theta, phi) # sin(theta)cos(phi)
    if label == 'py': return real_ylm(1, -1, theta, phi) # sin(theta)sin(phi)
    
    # D orbitals
    if label == 'dz2': return real_ylm(2, 0, theta, phi)
    if label == 'dxz': return real_ylm(2, 1, theta, phi)
    if label == 'dyz': return real_ylm(2, -1, theta, phi)
    if label == 'dx2-y2': return real_ylm(2, 2, theta, phi)
    if label == 'dxy': return real_ylm(2, -2, theta, phi)
    
    raise ValueError(f"Unknown orbital: {label}")

# ==========================================
# 2. Geometry Generators
# ==========================================

def generate_tbp():
    # Standard Trigonal Bipyramidal (unrotated)
    # Axial: +/- Z
    # Equatorial: Triangle in XY plane
    points = [
        [0, 0, 1],
        [0, 0, -1],
        [1, 0, 0],
        [-0.5, np.sqrt(3)/2, 0],
        [-0.5, -np.sqrt(3)/2, 0]
    ]
    return np.array(points)

def generate_octahedral():
    points = [
        [0, 0, 1], [0, 0, -1],
        [1, 0, 0], [-1, 0, 0],
        [0, 1, 0], [0, -1, 0]
    ]
    return np.array(points)

def random_rotate(points):
    rot = R.random()
    return rot.apply(points), rot

# ==========================================
# 3. Optimization Logic
# ==========================================

def build_matrix(points, basis_labels):
    # Construct matrix A where A_ij = Basis_j(Point_i)
    N = len(points)
    M = len(basis_labels)
    mat = np.zeros((N, M))
    
    for i in range(N):
        x, y, z = points[i]
        r = np.linalg.norm([x,y,z])
        theta = np.arccos(z/r) if r > 1e-9 else 0
        phi = np.arctan2(y, x)
        
        for j in range(M):
            mat[i, j] = get_basis_func(basis_labels[j], theta, phi)
            
    return mat

def cost_function(rot_vec, original_points, basis_labels):
    # 1. Apply rotation
    r = R.from_rotvec(rot_vec)
    rotated_points = r.apply(original_points)
    
    # 2. Build matrix
    mat = build_matrix(rotated_points, basis_labels)
    
    # 3. Calculate "Alignment Score"
    # We want the matrix to be full rank and well-conditioned.
    # Maximize |det(Mat)| (if square) or product of singular values.
    
    # SVD
    U, S, Vh = np.linalg.svd(mat)
    
    # Cost = -product(S)  (maximize volume)
    # Adding a small epsilon to avoid log(0) if really bad
    score = np.sum(np.log(S + 1e-9))
    return -score

def optimize_alignment(initial_points, basis_labels):
    print(f"Aligning {len(initial_points)} points to basis: {basis_labels}")
    
    # Initial guessing
    best_score = float('inf')
    best_rot = np.zeros(3)
    
    # Try multiple random starts to avoid local minima
    for _ in range(10):
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
# 4. Analysis and Printing
# ==========================================

def analyze_case(name, points_gen, basis_labels):
    print(f"\n{'='*40}")
    print(f"CASE: {name}")
    print(f"{'='*40}")
    
    # 1. Start with a RANDOM rotation to simulate Thomson output
    base_points = points_gen()
    points, _ = random_rotate(base_points)
    
    print("\n[Before Alignment] Matrix Singular Values:")
    mat_before = build_matrix(points, basis_labels)
    _, S_before, _ = np.linalg.svd(mat_before)
    print(np.round(S_before, 4))
    print(f"Det/Vol Index: {np.prod(S_before):.4e}")
    
    # 2. Optimize
    aligned_points = optimize_alignment(points, basis_labels)
    
    print("\n[After Alignment] Matrix Singular Values:")
    mat_after = build_matrix(aligned_points, basis_labels)
    _, S_after, _ = np.linalg.svd(mat_after)
    print(np.round(S_after, 4))
    print(f"Det/Vol Index: {np.prod(S_after):.4e}")
    
    # 3. Show Hybrid Coefficients (SVD approach used in Physics.js)
    # A = U S V^T -> Coeffs = U V^T ? No, Physics.js does:
    # { U, S, V } = jacobiSVD(A)
    # result = matMul(U, matTranspose(V));
    # This is calculating the "Symmetric Orthogonalization" (Loewdin) approximately? 
    # Actually U * V^T is the unitary part of the polar decomposition of A.
    # Ideally A should be unitary if perfectly matched.
    
    U, S, Vh = np.linalg.svd(mat_after)
    # numpy svd returns Vh = V.T, so V = Vh.T
    V = Vh.T
    coeffs = U @ V.T # U * V^T, same as Physics.js logic
    
    print("\n[Aligned Coefficients] (Rows=Hybrids, Cols=Basis):")
    # Identify axis
    def vec_str(v): return f"[{v[0]:.2f}, {v[1]:.2f}, {v[2]:.2f}]"
    
    for i in range(len(aligned_points)):
        row_str = "  ".join([f"{coeffs[i,j]:6.3f}" for j in range(len(basis_labels))])
        print(f"H{i+1} (Dir {vec_str(aligned_points[i])}): {row_str}")
        
        # Check d-orbital content
        # Check if high d-character correlates with Axial positions (usually largest z)
        
    return aligned_points, coeffs


# ==========================================
# Main Execution
# ==========================================

if __name__ == "__main__":
    
    # Case 1: sp3d (TBP)
    # Basis: s, pz, px, py, dz2
    # Note order matters for visualization comparison
    basis_sp3d = ['s', 'pz', 'px', 'py', 'dz2']
    analyze_case("sp3d", generate_tbp, basis_sp3d)
    
    # Case 2: sp3d2 (Octahedral)
    # Basis: s, pz, px, py, dz2, dx2-y2
    basis_sp3d2 = ['s', 'pz', 'px', 'py', 'dz2', 'dx2-y2']
    analyze_case("sp3d2", generate_octahedral, basis_sp3d2)
