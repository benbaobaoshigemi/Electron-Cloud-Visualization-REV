"""
Definitive Test: Is E_loc(r) constant for He 1s (Koga basis)?

For a TRUE eigenstate: E_loc(r) = H*psi / psi = epsilon (constant everywhere)
For an APPROXIMATE wave function: E_loc(r) varies, especially near r=0

If E_loc diverges to +infinity near r=0, it proves the bump is a basis set artifact.
"""

import numpy as np
import matplotlib.pyplot as plt

# He 1s Parameters from slater_basis.js
Z = 2
epsilon = -0.9179556  # Koga orbital energy for He 1s

params = [
    {"n": 2, "z": 6.438865513242302, "c": 0.0008103},
    {"n": 1, "z": 3.385077039750975, "c": 0.0798826},
    {"n": 1, "z": 2.178370004614139, "c": 0.180161},
    {"n": 1, "z": 1.4553870053179185, "c": 0.7407925},
    {"n": 2, "z": 1.3552466748849417, "c": 0.0272015},
]

def factorial(n):
    res = 1.0
    for i in range(1, n+1):
        res *= i
    return res

# Precompute Normalization Constants
obs = []
for p in params:
    n, z, c = p["n"], p["z"], p["c"]
    N = np.sqrt( (2*z)**(2*n+1) / factorial(2*n) )
    obs.append( {"n": n, "z": z, "c": c, "N": N} )

def get_psi_and_derivatives(r):
    psi = 0
    dpsi = 0
    ddpsi = 0
    for o in obs:
        n, z, c, N = o["n"], o["z"], o["c"], o["N"]
        
        term = (r**(n-1)) * np.exp(-z*r)
        
        if n == 1:
            term_prime = -z * term
            term_double = z*z*term
        elif n == 2:
            term_prime = np.exp(-z*r) - z*term
            term_double = -2*z*np.exp(-z*r) + z*z*term
        else:
            term_prime = (n-1)*r**(n-2)*np.exp(-z*r) - z*term
            term_double = (n-1)*(n-2)*r**(n-3)*np.exp(-z*r) - 2*z*(n-1)*r**(n-2)*np.exp(-z*r) + z*z*term
            
        psi += c * N * term
        dpsi += c * N * term_prime
        ddpsi += c * N * term_double
        
    return psi, dpsi, ddpsi

# Compute E_loc(r) at various r values
r_values = np.logspace(-4, 1, 500)  # From r=0.0001 to r=10

E_loc_values = []

for r in r_values:
    psi, dpsi, ddpsi = get_psi_and_derivatives(r)
    
    # Laplacian in spherical coords (s orbital): nabla^2 psi = psi'' + (2/r) psi'
    laplacian_psi = ddpsi + (2.0/r) * dpsi
    
    # Kinetic: T*psi = -0.5 * nabla^2 psi
    T_psi = -0.5 * laplacian_psi
    
    # Potential: V*psi = (-Z/r) * psi
    V_psi = (-Z / r) * psi
    
    # Hamiltonian: H*psi = T*psi + V*psi
    H_psi = T_psi + V_psi
    
    # Local Energy: E_loc = H*psi / psi
    if abs(psi) > 1e-15:
        E_loc = H_psi / psi
    else:
        E_loc = np.nan
    
    E_loc_values.append(E_loc)

E_loc_values = np.array(E_loc_values)

# Analysis
print("=" * 60)
print("DEFINITIVE TEST: He 1s Local Energy E_loc(r)")
print("=" * 60)
print(f"Expected (eigenvalue): epsilon = {epsilon:.6f} Ha")
print()
print(f"E_loc at r=0.0001: {E_loc_values[0]:.4f} Ha")
print(f"E_loc at r=0.001:  {E_loc_values[np.argmin(np.abs(r_values - 0.001))]:.4f} Ha")
print(f"E_loc at r=0.01:   {E_loc_values[np.argmin(np.abs(r_values - 0.01))]:.4f} Ha")
print(f"E_loc at r=0.1:    {E_loc_values[np.argmin(np.abs(r_values - 0.1))]:.4f} Ha")
print(f"E_loc at r=1.0:    {E_loc_values[np.argmin(np.abs(r_values - 1.0))]:.4f} Ha")
print(f"E_loc at r=5.0:    {E_loc_values[np.argmin(np.abs(r_values - 5.0))]:.4f} Ha")
print()

# Check if E_loc is constant
std_E_loc = np.nanstd(E_loc_values)
mean_E_loc = np.nanmean(E_loc_values)
max_E_loc = np.nanmax(E_loc_values)
min_E_loc = np.nanmin(E_loc_values)

print(f"Mean E_loc: {mean_E_loc:.4f} Ha")
print(f"Std E_loc:  {std_E_loc:.4f} Ha")
print(f"Max E_loc:  {max_E_loc:.4f} Ha")
print(f"Min E_loc:  {min_E_loc:.4f} Ha")
print()

if max_E_loc > 0:
    print(">>> VERDICT: E_loc goes POSITIVE near r=0")
    print(">>> This PROVES the positive bump is a BASIS SET ARTIFACT")
    print(">>> The basis set OVER-BINDS near the nucleus (Cusp violation)")
else:
    print(">>> VERDICT: E_loc stays negative everywhere")
    print(">>> No cusp artifact detected")

# Plot
plt.figure(figsize=(10, 6))
plt.semilogx(r_values, E_loc_values, 'b-', linewidth=2, label='E_loc(r) from Koga basis')
plt.axhline(epsilon, color='r', linestyle='--', linewidth=2, label=f'Eigenvalue ε = {epsilon:.4f} Ha')
plt.axhline(0, color='k', linestyle='-', linewidth=1)
plt.xlabel('r (a₀)', fontsize=12)
plt.ylabel('E_loc(r) (Ha)', fontsize=12)
plt.title('He 1s Local Energy: Test for Eigenstate Property', fontsize=14)
plt.legend()
plt.grid(True, alpha=0.3)
plt.ylim(-5, max(5, max_E_loc * 1.2))
plt.savefig('he_1s_local_energy_test.png', dpi=150)
print("\nPlot saved to: he_1s_local_energy_test.png")
