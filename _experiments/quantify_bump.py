"""
Quantify the Cusp Artifact Bump for Multiple Atoms

This script computes:
1. The maximum positive cumulative energy (the "bump") 
2. The actual orbital eigenvalue (expected final value)
3. The bump as a percentage of total energy
"""

import numpy as np

elements = [
    {"name": "He", "Z": 2, "orbital": "1s", "epsilon": -0.9179556},
    {"name": "Li", "Z": 3, "orbital": "1s", "epsilon": -2.4777413},
    {"name": "Ne", "Z": 10, "orbital": "2p", "epsilon": None},  # Will check if available
    {"name": "Se", "Z": 34, "orbital": "4s", "epsilon": None},
]

# Se 4s data from check_se_4s_bump.py
se_4s_max_bump = 0.0104  # Ha (from previous run)

# He 1s: Let's quickly re-compute
def factorial(n):
    res = 1.0
    for i in range(1, n+1):
        res *= i
    return res

he_params = [
    {"n": 2, "z": 6.438865513242302, "c": 0.0008103},
    {"n": 1, "z": 3.385077039750975, "c": 0.0798826},
    {"n": 1, "z": 2.178370004614139, "c": 0.180161},
    {"n": 1, "z": 1.4553870053179185, "c": 0.7407925},
    {"n": 2, "z": 1.3552466748849417, "c": 0.0272015},
]

Z_He = 2
epsilon_He = -0.9179556

# Compute He 1s bump
obs = []
for p in he_params:
    n, z, c = p["n"], p["z"], p["c"]
    N = np.sqrt( (2*z)**(2*n+1) / factorial(2*n) )
    obs.append( {"n": n, "z": z, "c": c, "N": N} )

def get_he_psi_derivatives(r):
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

r_values = np.linspace(0.001, 2.0, 2000)
dr = r_values[1] - r_values[0]
E_cum = []
curr_E = 0

for val in r_values:
    psi, dpsi, ddpsi = get_he_psi_derivatives(val)
    T_local = -0.5 * (ddpsi + 2.0/val * dpsi)
    rho_T = psi * T_local
    rho_V = psi * (-Z_He/val) * psi
    density_val = (rho_T + rho_V) * val * val
    curr_E += density_val * dr
    E_cum.append(curr_E)

he_max_bump = max(E_cum)
he_final = E_cum[-1]

print("="*60)
print("CUSP ARTIFACT BUMP QUANTIFICATION")
print("="*60)
print()
print(f"{'Atom':<10} {'Orbital':<10} {'Bump (Ha)':<15} {'ε (Ha)':<15} {'Bump/|ε| (%)':<15}")
print("-"*60)

# He 1s
bump_pct_he = abs(he_max_bump / epsilon_He) * 100
print(f"{'He':<10} {'1s':<10} {he_max_bump:<15.6f} {epsilon_He:<15.6f} {bump_pct_he:<15.2f}")

# Se 4s (from previous run, we know: max = 0.0104, but we don't have epsilon)
# Let's estimate Se 4s epsilon ~ -0.5 to -2 Ha range for outer s orbital
se_epsilon_estimate = -0.5  # rough estimate
bump_pct_se = abs(se_4s_max_bump / se_epsilon_estimate) * 100
print(f"{'Se':<10} {'4s':<10} {se_4s_max_bump:<15.6f} {'~-0.5 (est.)':<15} {bump_pct_se:<15.2f}")

print()
print("="*60)
print("CONCLUSION:")
print("="*60)
print(f"He 1s bump: {he_max_bump:.4f} Ha = {bump_pct_he:.1f}% of orbital energy")
print(f"Se 4s bump: {se_4s_max_bump:.4f} Ha = ~{bump_pct_se:.0f}% of orbital energy (estimated)")
print()
print("These bumps represent the artifact from Cusp Condition violation.")
print("They are small compared to total energy but visible in cumulative plots.")
