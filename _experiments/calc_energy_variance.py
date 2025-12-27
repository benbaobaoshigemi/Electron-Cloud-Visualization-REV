"""
Calculate Energy Variance for Se 4s

The "error" of the assumption T_loc = epsilon - V is exactly the deviation of the local energy E_loc(r) from the eigenvalue epsilon.
We quantify this using the Energy Variance:
sigma^2 = <(H - epsilon)^2> = Integral |E_loc(r) - epsilon|^2 * |Psi|^2 * r^2 dr

This gives a global measure of "how much this wavefunction fails to be an eigenstate".
"""

import numpy as np

# Se 4s Parameters
Z = 34
epsilon = -0.8373814 

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

def factorial(n):
    res = 1.0
    for i in range(1, n+1): res *= i
    return res

for term in se_4s_basis:
    n = term["n"]
    z = term["z"]
    term["N"] = np.sqrt((2*z)**(2*n+1) / factorial(2*n))

def get_vals(r):
    psi = 0
    dpsi = 0
    ddpsi = 0
    for o in se_4s_basis:
        n, z, c, N = o["n"], o["z"], o["c"], o["N"]
        term = (r**(n-1)) * np.exp(-z*r)
        
        if n == 1:
            term_prime = -z * term
            term_double = z*z * term
        elif n == 2:
            term_prime = np.exp(-z*r) - z * term
            term_double = -2*z*np.exp(-z*r) + z*z*term
        else:
            term_prime = (n-1)*r**(n-2)*np.exp(-z*r) - z*term
            term_double = ((n-1)*(n-2)*r**(n-3) - 2*z*(n-1)*r**(n-2) + z*z*r**(n-1)) * np.exp(-z*r)
            
        psi += c * N * term
        dpsi += c * N * term_prime
        ddpsi += c * N * term_double
    return psi, dpsi, ddpsi

# Integration grid
r_vals = np.linspace(0.0001, 10.0, 100000)
dr = r_vals[1] - r_vals[0]

variance_sum = 0
norm_sum = 0
local_errors = []

for r in r_vals:
    psi, dpsi, ddpsi = get_vals(r)
    
    # E_loc calculation
    # H Psi = (-1/2 nabla^2 - Z/r) Psi
    # nabla^2 = d^2/dr^2 + 2/r d/dr
    laplacian = ddpsi + 2.0/r * dpsi
    
    # To avoid dividing by zero at nodes, we multiply by Psi^2 first?
    # Variance = Integral ( (H-E) Psi )^2 dr
    # (H-E) Psi = -1/2 laplacian - Z/r Psi - epsilon Psi
    
    H_psi = -0.5 * laplacian - (Z/r) * psi
    diff = H_psi - epsilon * psi
    
    # Integrand is |diff|^2 * r^2
    integrand = (diff)**2 * r**2
    
    variance_sum += integrand * dr
    norm_sum += psi**2 * r**2 * dr
    
    # Store local error density for analysis
    # E_loc deviation weighed by density
    if abs(psi) > 1e-10:
        e_loc = H_psi / psi
        local_errors.append(abs(e_loc - epsilon))

variance = variance_sum / norm_sum
sigma = np.sqrt(variance)

print("="*60)
print("Se 4s Energy Variance Analysis")
print("="*60)
print(f"Orbital Energy (epsilon): {epsilon:.6f} Ha")
print(f"Energy Variance (sigma^2): {variance:.6f} Ha^2")
print(f"Standard Deviation (sigma): {sigma:.6f} Ha")
print(f"Relative Error (sigma/|epsilon|): {sigma/abs(epsilon)*100:.2f}%")
print()
print("Interpretation:")
print(f"The assumption 'T = epsilon - V' has a global RMS error of {sigma:.4f} Ha.")
print("This represents the 'average' deviation of the local energy from the constant eigenvalue.")
