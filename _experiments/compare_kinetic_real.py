"""
Compare "Raw" (Basis Set) vs "Ideal" (Eigenstate) Kinetic Energy Density

User's Question: "Can I see the real kinetic energy bumps at nodes without the 'fat' (cusp artifact)?"
Our Hypothesis: The "bumps at nodes" in T_loc are ALSO artifacts. In the exact solution, T_loc = E - V is smooth.

This script compares two ways of computing Kinetic Energy Density for Se 4s:
1. Raw (Direct): rho_T = Psi * (-0.5 nabla^2) Psi * r^2
   - Contains Cusp Artifact (at r=0)
   - Contains Node Artifacts (spikes where Psi -> 0)
   
2. Ideal (Derived): rho_T = |Psi|^2 * (epsilon - V) * r^2
   - Uses the Koga Psi for probability distribution (which is accurate).
   - Uses the theoretical relation T_loc = epsilon - V (which is exact).
   - This represents the "True" kinetic energy distribution if the wavefunction were perfect.
"""

import numpy as np
import matplotlib.pyplot as plt

# Se 4s Parameters (Koga)
Z = 34
epsilon = -0.8373814  # Koga HF Eigenvalue

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

# Precompute N
for term in se_4s_basis:
    n = term["n"]
    z = term["z"]
    term["N"] = np.sqrt((2*z)**(2*n+1) / factorial(2*n))

def get_psi_derivatives(r):
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

# 1. Plot T_loc(r) vs Ideal T_loc(r)
r_vals = np.linspace(0.001, 2.0, 1000)
T_loc_raw = []
T_loc_ideal = []
V_vals = []

for r in r_vals:
    psi, dpsi, ddpsi = get_psi_derivatives(r)
    
    # Raw T_loc = (-1/2 * Laplacian Psi) / Psi
    # Laplacian radial = psi'' + 2/r psi'
    laplacian = ddpsi + 2.0/r * dpsi
    if abs(psi) > 1e-12:
        t_raw = -0.5 * laplacian / psi
    else:
        t_raw = np.nan # Node divergence
    
    # Ideal T_loc = E - V
    v_ideal = -Z/r
    t_ideal = epsilon - v_ideal # E = T + V => T = E - V
    
    T_loc_raw.append(t_raw)
    T_loc_ideal.append(t_ideal)
    V_vals.append(v_ideal)

# 2. Plot Energy Density: rho_T vs rho_T_ideal
rho_T_raw = []
rho_T_ideal = []

for i, r in enumerate(r_vals):
    psi, _, _ = get_psi_derivatives(r)
    prob_density = psi**2 * r**2 # |Psi|^2 r^2
    
    # Raw Density = T_loc_raw * prob
    # But calculate directly to avoid 0/0
    # rho_T = Psi * (-0.5 laplacian) * r^2
    _, dpsi, ddpsi = get_psi_derivatives(r)
    laplacian = ddpsi + 2.0/r * dpsi
    rho_raw = psi * (-0.5 * laplacian) * r**2
    rho_T_raw.append(rho_raw)
    
    # Ideal Density
    rho_ideal = prob_density * T_loc_ideal[i]
    rho_T_ideal.append(rho_ideal)

# PLOTTING
plt.figure(figsize=(12, 10))

# Subplot 1: Local Kinetic Energy T_loc(r)
plt.subplot(2, 1, 1)
plt.title("Local Kinetic Energy $T_{loc}(r)$: Basis Set Artifacts vs. Exact Physics")
plt.plot(r_vals, T_loc_raw, label="Raw (Basis Set): (-1/2 $\\nabla^2 \\Psi$) / $\\Psi$", color='red', linewidth=1)
plt.plot(r_vals, T_loc_ideal, label="Ideal (Physical): $\\epsilon - V(r)$", color='blue', linestyle='--', linewidth=2)
plt.ylim(-100, 500)
plt.ylabel("Energy (Ha)")
plt.xlabel("r (a.u.)")
plt.legend()
plt.grid(True, alpha=0.3)
plt.text(0.1, 400, "Note spikes at nodes ->", color='red')

# Subplot 2: Kinetic Energy Density rho_T(r)
plt.subplot(2, 1, 2)
plt.title("Kinetic Energy Density $\\rho_T(r)$: What you would see in a plot")
plt.plot(r_vals, rho_T_raw, label="Raw Density (Artifacts)", color='red', alpha=0.7)
plt.plot(r_vals, rho_T_ideal, label="Ideal Density (Smooth)", color='blue', linestyle='--')
plt.fill_between(r_vals, rho_T_ideal, color='blue', alpha=0.1)
plt.ylabel("Density (Ha/a.u.)")
plt.xlabel("r (a.u.)")
plt.legend()
plt.grid(True, alpha=0.3)

plt.tight_layout()
plt.savefig("_experiments/kinetic_comparison.png")
print("Plot generated: _experiments/kinetic_comparison.png")
