"""
Visualize the Local Energy Error Profile for Se 4s

This script plots E_loc(r) and its deviation from the true eigenvalue epsilon.
It reveals the "Error Landscape" of the basis set.
"""

import numpy as np
import matplotlib.pyplot as plt

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

# Generate Plot Data
r_vals = np.linspace(0.001, 2.0, 2000)
e_loc_vals = []
psi_vals = []

for r in r_vals:
    psi, dpsi, ddpsi = get_vals(r)
    laplacian = ddpsi + 2.0/r * dpsi
    
    # H Psi / Psi
    if abs(psi) > 1e-12:
        e_loc = (-0.5 * laplacian - (Z/r) * psi) / psi
    else:
        e_loc = np.nan
        
    e_loc_vals.append(e_loc)
    psi_vals.append(psi)

# PLOTTING
plt.figure(figsize=(10, 8))

# 1. Local Energy Deviation
plt.subplot(2, 1, 1)
plt.title("Local Energy $E_{loc}(r)$ vs. True Eigenvalue $\\epsilon$")
plt.plot(r_vals, e_loc_vals, label="$E_{loc}(r)$ (Calculated)", color='red', linewidth=1)
plt.axhline(y=epsilon, color='green', linestyle='--', label="True $\\epsilon$ (Ideal)", linewidth=2)

# Set strict y-limits to see the structure (ignore +/- infinity spikes)
plt.ylim(-100, 100) 
plt.ylabel("Local Energy (Ha)")
# plt.xlabel("r (a.u.)")
plt.legend()
plt.grid(True, alpha=0.3)
plt.text(0.05, 80, "Cusp Error ->", color='red')

# Add arrows pointing to node discrepancies
for i, y in enumerate(e_loc_vals):
    if abs(y) > 80 and r_vals[i] > 0.1:
         # plt.text(r_vals[i], 50, "Node", color='red', ha='center')
         pass

# 2. Wavefunction for reference
plt.subplot(2, 1, 2)
plt.title("Wavefunction $\\Psi(r)$ (Shows Nodes)")
plt.plot(r_vals, psi_vals, color='blue', label="$\\Psi(r)$")
plt.axhline(0, color='black', linewidth=0.5)
plt.xlabel("r (a.u.)")
plt.ylabel("Amplitude")
plt.grid(True, alpha=0.3)
plt.legend()

plt.tight_layout()
plt.savefig("_experiments/local_energy_error_profile.png")
print("Plot generated: _experiments/local_energy_error_profile.png")
