
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
# R_i = N_i * r^(n-1) * exp(-z*r)
# Int(R_i^2 r^2) = 1 => N_i^2 * Int(r^(2n) exp(-2z*r)) = 1
# Int = (2n)! / (2z)^(2n+1)
# N_i = sqrt( (2z)^(2n+1) / (2n)! )
obs = []
for p in params:
    n, z, c = p["n"], p["z"], p["c"]
    N = np.sqrt( (2*z)**(2*n+1) / factorial(2*n) )
    obs.append( {"n": n, "z": z, "c": c, "N": N} )

def get_psi_derivatives(r):
    psi = 0
    dpsi = 0
    ddpsi = 0
    for o in obs:
        n, z, c, N = o["n"], o["z"], o["c"], o["N"]
        # term = r^(n-1) e^(-zr)
        term = (r**(n-1)) * np.exp(-z*r)
        
        # d/dr term
        # (n-1)r^(n-2)e - z r^(n-1)e
        if n == 1:
            term_prime = -z * term
        else:
            term_prime = (n-1)*r**(n-2)*np.exp(-z*r) - z*term
            
        # d2/dr2 term
        # d/dr [ (n-1)r^(n-2)e - z r^(n-1)e ]
        # = (n-1)(n-2)r^(n-3)e - z(n-1)r^(n-2)e - z[(n-1)r^(n-2)e - z r^(n-1)e]
        if n == 1:
            term_double = z*z*term
        elif n == 2:
            # (n-1)=1, (n-2)=0
            # term' = e - zre
            # term'' = -ze - (ze - z^2re) = -2ze + z^2re
            term_double = -2*z*np.exp(-z*r) + z*z*term
        else:
            term_double = (n-1)*(n-2)*r**(n-3)*np.exp(-z*r) - 2*z*(n-1)*r**(n-2)*np.exp(-z*r) + z*z*term
            
        psi += c * N * term
        dpsi += c * N * term_prime
        ddpsi += c * N * term_double
        
    return psi, dpsi, ddpsi

# Grid
r = np.linspace(0.001, 1.0, 1000) # zoom in on core
dr = r[1] - r[0]

E_cum = []
curr_E = 0

for val in r:
    psi, dpsi, ddpsi = get_psi_derivatives(val)
    
    # Laplacian T = -0.5 * (psi'' + 2/r psi')
    # T_density = psi * T_op * psi
    # But wait, we need Integral( psi * T * psi * r^2 )
    # So density rho_T = psi * (-0.5 * (ddpsi + 2/val*dpsi))
    
    T_local = -0.5 * (ddpsi + 2.0/val * dpsi)
    rho_T = psi * T_local
    
    # Potential V = -Z/r
    # rho_V = psi * (-Z/val) * psi
    rho_V = psi * (-Z/val) * psi
    
    # Energy Density (Radial) = (rho_T + rho_V) * r^2
    # But wait, integral is Int( (T+V) * r^2 )
    # So we plot the Accumulation of this weighted density.
    
    density_val = (rho_T + rho_V) * val * val
    curr_E += density_val * dr
    E_cum.append(curr_E)
    
print(f"Cumulative Energy at r={r[-1]}: {curr_E:.4f} Ha")
print(f"Max Cumulative Energy: {max(E_cum):.4f} Ha")

plt.figure()
plt.plot(r, E_cum, label='Se 4s Cumulative Energy (Koga Basis)')
plt.axhline(0, color='black', linewidth=1)
plt.title('Se 4s Energy Accumulation (Checking for Bumps)')
plt.xlabel('r (a0)')
plt.ylabel('Cumulative E (Ha)')
plt.savefig('se_4s_check.png')
