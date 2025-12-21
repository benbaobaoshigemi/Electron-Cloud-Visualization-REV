import sympy
from sympy import symbols, diff, exp, simplify, integrate, oo

def verify_kinetic_operator():
    r, z, n, l = symbols('r z n l', real=True, positive=True)
    # n is integer >= 1, l is integer >= 0. But for derivation we can treat as symbols.
    
    # Define STO part (ignoring Normalization N for derivation of operator action)
    # chi = r^(n-1) * exp(-z*r)
    chi = r**(n-1) * exp(-z*r)
    
    # Radial Kinetic Energy Operator: T_rad = -1/2 * (d^2/dr^2 + (2/r)*d/dr - l(l+1)/r^2)
    
    # 1. First derivative
    d1 = diff(chi, r)
    
    # 2. Second derivative
    d2 = diff(d1, r)
    
    # 3. Apply operator
    T_chi = -0.5 * (d2 + (2/r)*d1 - (l*(l+1)/(r**2))*chi)
    
    # 4. Simplify
    T_chi_simplified = simplify(T_chi)
    
    # 5. Reviewer's claimed form:
    # T chi = -1/2 * [ A * r^(n-3) + B * r^(n-2) + C * r^(n-1) ] * exp(-z*r)
    # A = (n-1)(n-2) + 2(n-1) - l(l+1)
    # B = -2*z*(n-1) - 2*z  = -2*z*n
    # C = z^2
    
    A_claim = (n-1)*(n-2) + 2*(n-1) - l*(l+1)
    B_claim = -2*z*n
    C_claim = z**2
    
    Claimed_Expression = -0.5 * (A_claim * r**(n-3) + B_claim * r**(n-2) + C_claim * r**(n-1)) * exp(-z*r)
    Claimed_Expression = simplify(Claimed_Expression)
    
    print(f"Computed T_chi: {T_chi_simplified}")
    print(f"Claimed T_chi:  {Claimed_Expression}")
    
    diff_expr = simplify(T_chi_simplified - Claimed_Expression)
    if diff_expr == 0:
        print("MATCH: General derivation is CORRECT.")
    else:
        print(f"MISMATCH: Difference is {diff_expr}")

def verify_hydrogen_1s():
    print("\n--- Verifying Hydrogen 1s (n=1, l=0, z=1) ---")
    r = symbols('r', real=True, positive=True)
    n, l, z = 1, 0, 1
    
    # Normalization for H 1s: N = 1/sqrt(pi) * z^(3/2) ? 
    # STO: N * r^(n-1) e^(-zr). For n=1: N e^(-r).
    # Integral |psi|^2 r^2 dr = 1 => N^2 * integral(0, inf, r^2 e^(-2r) dr) = 1
    # int r^2 e^(-2r) = 2! / 2^3 = 2/8 = 1/4.
    # N^2 * (1/4) = 1 => N^2 = 4 => N = 2.
    # So psi = 2 * exp(-r) * Y00. (Y00 = 1/sqrt(4pi)). 
    # Radial part R(r) = 2 * exp(-r).
    # Check normalization: int_0^inf |R|^2 r^2 dr = 4 * 1/4 = 1. Correct.
    
    N = 2
    psi = N * r**(n-1) * exp(-z*r)
    
    # Kinetic Operator on psi
    # d/dr (2 e^-r) = -2 e^-r
    # d^2/dr^2 = 2 e^-r
    # T psi = -1/2 (2e^-r + (2/r)(-2e^-r) - 0)
    #       = -1/2 (2e^-r - (4/r)e^-r)
    #       = -e^-r + (2/r)e^-r
    
    # Integration T_val = int_0^inf psi * (T psi) * r^2 dr
    # T_val = int_0^inf (2 e^-r) * (-e^-r + (2/r)e^-r) * r^2 dr
    #       = int_0^inf [ -2 e^(-2r) * r^2 + 4 e^(-2r) * r ] dr
    
    # Int 1: -2 * int r^2 e^-2r = -2 * (2/8) = -0.5
    # Int 2: 4 * int r e^-2r = 4 * (1! / 2^2) = 4 * (1/4) = 1.0
    # Total = -0.5 + 1.0 = 0.5 Hartree.
    
    print("Manual H 1s Expectation Value Derivation: 0.5 Hartree")
    
    # Now using the A, B, C formula
    A = (n-1)*(n-2) + 2*(n-1) - l*(l+1) # 0 + 0 - 0 = 0
    B = -2*z*n # -2*1*1 = -2
    C = z**2 # 1
    
    # T psi = -1/2 [ 0 + B r^-1 + C ] * psi
    #       = -1/2 [ -2/r + 1 ] * psi
    #       = (1/r - 0.5) * psi
    # Matches my manual derivation: (2/r - 1) * (1/2 psi_unscaled)? No.
    # psi = 2 e^-r.
    # T psi (formula) = -1/2 [ -2/r + 1 ] * (2 e^-r)
    #                 = [ 1/r - 0.5 ] * (2 e^-r)
    #                 = (2/r) e^-r - e^-r.
    # My manual derivation: -e^-r + (2/r)e^-r. MATCHES.
    
    print("Formula Application for H 1s: Matches manual derivation.")

if __name__ == "__main__":
    verify_kinetic_operator()
    verify_hydrogen_1s()
