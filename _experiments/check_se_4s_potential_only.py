import numpy as np
import matplotlib.pyplot as plt

# Se 4s Parameters from slater_basis.js
# Z = 34
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
Z = 34

def factorial(n):
    res = 1.0
    for i in range(1, n+1):
        res *= i
    return res

# Precompute Normalization Constants N_i
obs = []
for p in params:
    n, z, c = p["n"], p["z"], p["c"]
    N = np.sqrt( (2*z)**(2*n+1) / factorial(2*n) )
    obs.append( {"n": n, "z": z, "c": c, "N": N} )

def get_psi(r):
    psi = 0
    for o in obs:
        n, z, c, N = o["n"], o["z"], o["c"], o["N"]
        # term = r^(n-1) e^(-zr)
        term = (r**(n-1)) * np.exp(-z*r)
        psi += c * N * term
    return psi

# Grid - Same as before
r = np.linspace(0.001, 1.0, 1000) 
dr = r[1] - r[0]

E_cum = []
curr_E = 0

print("Calculating Potential-Only Cumulative Energy...")

for val in r:
    psi = get_psi(val)
    
    # Kinetic Energy T is force-set to 0
    rho_T = 0
    
    # Potential V = -Z/r
    rho_V = psi * (-Z/val) * psi
    
    # Energy Density (Radial)
    density_val = (rho_T + rho_V) * val * val
    curr_E += density_val * dr
    E_cum.append(curr_E)
    
print(f"Cumulative Energy at r={r[-1]}: {curr_E:.4f} Ha")
max_E = max(E_cum)
print(f"Max Cumulative Energy: {max_E:.6f} Ha")

if max_E <= 0:
    print("=> SUCCESS: No positive bump detected when Kinetic Energy is removed.")
else:
    print("=> FAILURE: Positive bump still exists (unexpected for Potential V = -Z/r).")

plt.figure()
plt.plot(r, E_cum, label='Se 4s Potential Only (V)')
plt.axhline(0, color='black', linewidth=1)
plt.title('Se 4s Cumulative Energy (Potential Only)')
plt.xlabel('r (a0)')
plt.ylabel('Cumulative E (Ha)')
plt.savefig('se_4s_potential_only.png')
