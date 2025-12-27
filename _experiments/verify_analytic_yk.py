import numpy as np
from scipy.special import gamma, gammainc, gammaincc, factorial
from scipy.integrate import cumulative_trapezoid
import matplotlib.pyplot as plt

# 1. Physics Constants & Helpers
def sto_normalization(n, zeta):
    return (2 * zeta) ** n * np.sqrt(2 * zeta / float(factorial(2 * n)))

# 2. Analytic Math Components (To be ported to JS)
def lower_incomplete_gamma(s, x):
    # s is integer for STOs
    return gamma(s) * gammainc(s, x)

def upper_incomplete_gamma(s, x):
    # s is integer for STOs
    return gamma(s) * gammaincc(s, x)

def calculate_yk_analytic_term(na, za, nb, zb, k, r_grid):
    """
    Calculates Y^k(r) for a single pair of STO primitives:
    rho(r) = r^(na-1) * e^(-za*r) * r^(nb-1) * e^(-zb*r)
           = r^(N-2) * e^(-Z*r)
    where N = na + nb, Z = za + zb
    
    Y^k(r) = (1/r^(k+1)) * int_0^r s^k * rho(s) * s^2 ds  +  r^k * int_r^inf (1/s^(k+1)) * rho(s) * s^2 ds
    """
    N = na + nb
    Z_exp = za + zb
    
    # Inner Integral: int_0^r s^(k + N) * e^(-Z*s) ds
    # Let x = Z*s => ds = dx/Z
    # s = x/Z
    # Int = (1/Z)^(k+N+1) * lower_gamma(k+N+1, Z*r)
    inner_power = k + N + 1
    term1 = (1.0 / r_grid**(k+1)) * (1.0 / Z_exp**inner_power) * lower_incomplete_gamma(inner_power, Z_exp * r_grid)
    
    # Outer Integral: int_r^inf s^(N - k - 1) * e^(-Z*s) ds
    # Int = (1/Z)^(N-k) * upper_gamma(N-k, Z*r)
    outer_power = N - k
    if outer_power <= 0:
        # Singularity handling if needed, but for physical orbitals N >= 2, k <= 4 usually fine
        # For 1s-1s (n=1,1 => N=2), k=0 => outer_power=2. OK.
        print(f"Warning: Power <= 0 for outer integral. N={N}, k={k}")
        return np.zeros_like(r_grid)
        
    term2 = (r_grid**k) * (1.0 / Z_exp**outer_power) * upper_incomplete_gamma(outer_power, Z_exp * r_grid)
    
    return term1 + term2

# 3. Numerical Reference (From validate_final.py)
def compute_yk_numerical(rho_values, r, k=0):
    N = len(r)
    safe_r = np.where(r > 1e-20, r, 1e-20)
    
    # Inner: int_0^r rho(s) * s^k * s^2 ds  (rho includes s^2 ?) 
    # NO: definition of Yk is usually int rho(s) * ... 
    # Let's align defs.
    # Standard: Y^k(r) = r^{-(k+1)} int_0^r s^k rho(s) ds + r^k int_r^inf s^{-(k+1)} rho(s) ds
    # Where rho(s) is the radial charge density P^2(s). P(s) = rR(r).
    # So rho(s) ds is charge.
    
    integrand_inner = rho_values * r**k
    I_inner = np.zeros(N)
    I_inner[1:] = cumulative_trapezoid(integrand_inner, r)
    
    integrand_outer = rho_values / safe_r**(k+1)
    total_outer = np.trapezoid(integrand_outer, r)
    I_outer = np.zeros(N)
    I_outer[0] = total_outer
    I_outer[1:] = total_outer - cumulative_trapezoid(integrand_outer, r)
    
    return I_inner / safe_r**(k+1) + r**k * I_outer

# 4. Main Verification
def run_verification():
    print("Verifying Analytic Y^k Potential Implementation...")
    
    # Grid
    r = np.geomspace(1e-6, 50, 10000)
    
    # Test Case: Zn 3d orbital (Single STO term for simplicity)
    # n=3, zeta=8.0 (Approx for Zn 3d)
    n = 3
    zeta = 8.0
    N_norm = sto_normalization(n, zeta)
    
    # Orbital R(r)
    R = N_norm * r**(n-1) * np.exp(-zeta * r)
    
    # Density P^2(r) = (r R(r))^2 = r^2 * R^2
    # rho(r) for Yk integral usually implies P^2(r) if integrating dr
    # Let's check math: Coulomb J = integral P_a^2(1) (1/r12) P_b^2(2)
    # 1/r12 expansion gives Y^k.
    # So rho(s) should be P_a^2(s) = s^2 R_a^2(s).
    
    P_sq = (r * R)**2
    
    # A. Calculate Numerically
    print("Computing Numerical Y^0 (Coulomb)...")
    yk_num = compute_yk_numerical(P_sq, r, k=0)
    
    # B. Calculate Analytically
    # Input to analytic term: 
    # We have P^2 = r^2 * (r^(n-1) e^(-z r))^2 = r^2 * r^(2n-2) e^(-2z r) = r^(2n) e^(-2z r)
    # This corresponds to "squared" orbital params:
    # effective_n = 2*n (if input was r^(n-1))
    # Wait, the function `calculate_yk_analytic_term` takes `na, za, nb, zb` of the ORIGIN orbitals.
    # It assumes rho = (r^na-1 e^-za) * (r^nb-1 e^-zb) * r^2
    # yes, P^2 = R^2 * r^2.
    # So we pass (n, zeta, n, zeta).
    print("Computing Analytic Y^0 (Coulomb)...")
    # We need to account for coefficients. 
    # Here coeff is just N_norm * N_norm
    pref = N_norm * N_norm
    yk_ana = calculate_yk_analytic_term(n, zeta, n, zeta, 0, r) * pref
    
    # C. Compare
    diff = np.abs(yk_num - yk_ana)
    max_diff = np.max(diff)
    print(f"Max Difference: {max_diff:.2e}")
    
    # Assert
    if max_diff < 1e-4:
        print("SUCCESS: Analytic matches Numerical.")
    else:
        print("FAILURE: Divergence detected.")
        
    # Check Y^k with k=2 (Exchange-like term)
    print("\nComputing Analytic Y^2 (Exchange-like)...")
    yk_num_2 = compute_yk_numerical(P_sq, r, k=2)
    yk_ana_2 = calculate_yk_analytic_term(n, zeta, n, zeta, 2, r) * pref
    
    diff_2 = np.abs(yk_num_2 - yk_ana_2)
    max_diff_2 = np.max(diff_2)
    print(f"Max Difference (k=2): {max_diff_2:.2e}")

    if max_diff_2 < 1e-4:
        print("SUCCESS: Analytic (k=2) matches Numerical.")
    else:
        print("FAILURE: Divergence detected (k=2).")

if __name__ == "__main__":
    run_verification()
