import numpy as np
from scipy.special import gamma, gammainc
import time

def lower_gamma_direct(s, x):
    return gamma(s) * gammainc(s, x)

def lower_gamma_recurrence(s, x):
    # Base case: s=1
    # gamma(1, x) = 1 - e^-x
    # Recursive step: gamma(s+1, x) = s * gamma(s, x) - x^s * e^-x
    
    val = 1.0 - np.exp(-x) # gamma(1, x)
    current_s = 1
    
    while current_s < s:
        # gamma(s+1) = s * gamma(s) - x^s * e^-x
        val = current_s * val - (x**current_s) * np.exp(-x)
        current_s += 1
        
    return val

def run_test():
    print("Testing Gamma Recurrence Optimization...")
    
    s_target = 10
    x_val = 5.0
    
    # Direct
    t0 = time.time()
    res_direct = lower_gamma_direct(s_target, x_val)
    t1 = time.time()
    
    # Recurrence
    # Note: iterating from s=1 to 10
    t2 = time.time()
    res_recur = lower_gamma_recurrence(s_target, x_val)
    t3 = time.time()
    
    print(f"Direct: {res_direct:.6f} (Time: {t1-t0:.6f})")
    print(f"Recur:  {res_recur:.6f}  (Time: {t3-t2:.6f})")
    
    diff = abs(res_direct - res_recur)
    print(f"Diff: {diff:.2e}")
    
    if diff < 1e-10:
        print("PASS: Recurrence is stable.")
    else:
        print("FAIL: Recurrence diverged.")

if __name__ == "__main__":
    run_test()
