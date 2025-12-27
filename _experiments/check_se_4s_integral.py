"""
Check actual integral of T + Vnuc for Se 4s to see how far it is from epsilon.
"""
import numpy as np

def factorial(n):
    res = 1.0
    for i in range(1, n+1): res *= i
    return res

se_4s_basis = [
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

for term in se_4s_basis:
    n = term["n"]
    z = term["z"]
    term["N"] = np.sqrt((2*z)**(2*n+1) / factorial(2*n))

r_vals = np.linspace(0.001, 50.0, 50000)
dr = r_vals[1] - r_vals[0]
cum_energy = 0
Z = 34

for r in r_vals:
    psi = 0
    dpsi = 0
    ddpsi = 0
    for o in se_4s_basis:
        n, z, c, N = o["n"], o["z"], o["c"], o["N"]
        term = (r**(n-1)) * np.exp(-z*r)
        if n==1:
            term_prime = -z*term
            term_double = z*z*term
        elif n==2:
            term_prime = np.exp(-z*r) - z*term
            term_double = -2*z*np.exp(-z*r) + z*z*term
        else:
             term_prime = (n-1)*r**(n-2)*np.exp(-z*r) - z*term
             term_double = ((n-1)*(n-2)*r**(n-3) - 2*z*(n-1)*r**(n-2) + z*z*r**(n-1)) * np.exp(-z*r)
        
        psi += c*N*term
        dpsi += c*N*term_prime
        ddpsi += c*N*term_double

    # T_loc = -0.5 (psi'' + 2/r psi') / psi
    # V_loc = -Z/r
    # density = psi^2 * (T_loc + V_loc) * r^2
    
    laplacian = ddpsi + 2.0/r * dpsi
    rho_T = -0.5 * laplacian * psi
    rho_V = psi * (-Z/r) * psi
    
    cum_energy += (rho_T + rho_V) * r * r * dr

print(f"Calculated Integral <T + Vnuc>: {cum_energy:.6f} Ha")
print(f"Target Epsilon: -0.837381 Ha")
