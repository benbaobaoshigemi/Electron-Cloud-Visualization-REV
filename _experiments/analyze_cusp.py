import numpy as np

def factorial(n):
    res = 1.0
    for i in range(1, n+1):
        res *= i
    return res

# Se 4s Parameters
params = [
    {"n": 1, "z": 60.55616252128344, "c": 0.0054869},
    {"n": 3, "z": 44.41843090615977, "c": -0.0064574},
    {"n": 1, "z": 37.00642761297731, "c": -0.0461073},
    {"n": 4, "z": 25.28375467861017, "c": 0.0105428},
    {"n": 2, "z": 15.010902639359854, "c": 0.1407371},
    {"n": 3, "z": 14.995816988315903, "c": 0.1126788},
    {"n": 3, "z": 6.9394751375754, "c": -0.0101153},
    {"n": 2, "z": 5.746581303902227, "c": -0.1833988},
    {"n": 2, "z": 4.20849384574779, "c": -0.6121357},
    {"n": 2, "z": 2.1246440401627105, "c": 0.5140505},
    {"n": 2, "z": 1.5035568003823674, "c": 0.7311799},
    {"n": 1, "z": 0.9564933595050447, "c": 0.0642519}
]

Z_nucleus = 34.0

# 1. Calculate Psi(0) and Psi'(0)
# Only n=1 terms contribute to Psi(0) (as r^(1-1) = 1) and Psi'(0) (linear term in exp)
# n > 1 terms are 0 at r=0.
# Actually, for n=2, term is r*exp(-zr), derivative is exp(-zr) - ... -> 1 at 0.
# Wait, term ~ r^(n-1).
# n=1: term = e^(-zr). val(0)=1. deriv(0)=-z.
# n=2: term = r e^(-zr). val(0)=0. deriv(0)=1*1 - 0 = 1.
# n>2: term = r^(n-1)... val(0)=0. deriv(0)=0.

psi_0 = 0
dpsi_0 = 0

print("Contributions to Psi(0) and Psi'(0):")

for p in params:
    n, z, c = p["n"], p["z"], p["c"]
    # Normalization
    N = np.sqrt( (2*z)**(2*n+1) / factorial(2*n) )
    
    val = 0
    grad = 0
    
    if n == 1:
        val = N
        grad = -z * N
    elif n == 2:
        val = 0
        grad = N # d/dr (N r e^-zr) = N(e - zre) -> N at 0
    else:
        val = 0
        grad = 0
        
    psi_contribution = c * val
    dpsi_contribution = c * grad
    
    psi_0 += psi_contribution
    dpsi_0 += dpsi_contribution
    
    if abs(psi_contribution) > 1e-5 or abs(dpsi_contribution) > 1e-5:
        print(f"n={n}, z={z:.2f}, c={c:.4f} -> psi={psi_contribution:.4f}, dpsi={dpsi_contribution:.4f}")

print("-" * 30)
print(f"Total Psi(0)  = {psi_0:.6f}")
print(f"Total Psi'(0) = {dpsi_0:.6f}")

if abs(psi_0) < 1e-9:
    print("Psi(0) is zero (p/d/f orbital?), no cusp analysis needed.")
else:
    # Cusp Condition: Psi'(0) / Psi(0) = -Z_cusp
    Z_cusp = -dpsi_0 / psi_0
    print(f"Effective Cusp Z = {Z_cusp:.6f}")
    print(f"Actual Nucleus Z = {Z_nucleus}")
    
    diff = Z_cusp - Z_nucleus
    print(f"Difference (Cusp - Actual) = {diff:.6f}")
    
    if diff > 1.0:
        print("=> SIGNIFICANT OVER-BINDING at core (Basis steeper than nucleus)")
        print("=> Expect POSITIVE Energy Density Bump near r=0")
        
        # Estimate bump magnitude
        # Rho_T_loc = -0.5 * (psi'' + 2/r psi') / psi
        # Near 0, psi ~ A exp(-Z_c r)
        # psi' ~ -Z_c psi
        # psi'' ~ Z_c^2 psi
        # T_loc ~ -0.5 * (Z_c^2 - 2 Z_c / r) = Z_c/r - Z_c^2/2
        # V_loc = -Z_n / r
        # E_loc = (Z_c - Z_n)/r - Z_c^2/2
        # If Z_c > Z_n, E_loc -> +Infinity as 1/r
        print(f"Expected Divergence: ({Z_cusp:.2f} - {Z_nucleus})/r = {diff:.2f}/r")
    else:
        print("=> Cusp is well-behaved.")
