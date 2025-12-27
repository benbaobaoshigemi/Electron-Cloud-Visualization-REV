import numpy as np
from verify_analytic_yk_full import calculate_yk_analytic_term, compute_yk_numerical

def run_debug_kr3d():
    print("DEBUG: Investigating 'Kr 3d 0' Failure")
    
    n = 3
    zeta = 33.87
    k = 4
    
    # Use same grid as full test
    r = np.geomspace(1e-6, 50, 50000)
    
    ana = calculate_yk_analytic_term(n, zeta, k, r)
    num = compute_yk_numerical(n, zeta, k, r)
    
    diff = np.abs(ana - num)
    
    # Filter r > 1e-4
    mask = r > 1e-4
    r_masked = r[mask]
    diff_masked = diff[mask]
    ana_masked = ana[mask]
    num_masked = num[mask]
    
    max_idx = np.argmax(diff_masked)
    max_err = diff_masked[max_idx]
    r_err = r_masked[max_idx]
    
    print(f"Max Error: {max_err:.2e} at r = {r_err:.2e}")
    print(f"Analytic Val: {ana_masked[max_idx]:.5e}")
    print(f"Numerical Val: {num_masked[max_idx]:.5e}")
    
    # Check neighborhood
    print("\nNeighborhood:")
    for i in range(max_idx - 5, max_idx + 6):
        if 0 <= i < len(r_masked):
            print(f"r={r_masked[i]:.2e}  Ana={ana_masked[i]:.5e}  Num={num_masked[i]:.5e}  Diff={diff_masked[i]:.2e}")

    # Check Factorial scaling
    # n=3, 2n=6. factorial(2n) = 720. OK.
    # N=sto_normalization(3, 33.87).
    # N^2 = (2z)^6 * (2z/720) ~ (67)^6 * 0.1 ~ 1e11 * 0.1 ~ 1e10?
    # zeta ~ 34. 2zeta=68.
    # 68^6 is huge.
    # Maybe floating point precision issue with huge normalization factor?
    # 68^6 = 1.5e11.
    # r^4 term is small.
    # We are multiplying HUGE * tiny.
    # Python float64 has 15 digits.
    # If values are 1e11, we have error 1e-4. Precision is 1e-4/1e11 = 1e-15.
    # This suggests it IS just machine precision noise being amplified by the HUGE Normalization constant.
    
if __name__ == "__main__":
    run_debug_kr3d()
