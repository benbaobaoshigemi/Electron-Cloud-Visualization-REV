
import numpy as np
import matplotlib.pyplot as plt

def hydrogen_1s(r, Z=1.0):
    # psi = 1/sqrt(pi) * Z^1.5 * exp(-Zr)
    return (1/np.sqrt(np.pi)) * (Z**1.5) * np.exp(-Z*r)

def d_hydrogen_1s(r, Z=1.0):
    # d/dr psi = -Z * psi
    return -Z * hydrogen_1s(r, Z)

def laplacian_form(r, Z=1.0):
    # T_L = -1/2 psi * nabla^2 psi
    # nabla^2 psi = (1/r^2) d/dr (r^2 d/dr psi)
    #             = (1/r^2) d/dr (r^2 * (-Z * psi))
    #             = (1/r^2) * (-Z) * (2r*psi + r^2*(-Z*psi))
    #             = (1/r^2) * (-Z) * (2r - Z r^2) * psi
    #             = (-2Z/r + Z^2) * psi
    # T_L = -1/2 * psi * [ (-2Z/r + Z^2) * psi ]
    #     = (Z/r - Z^2/2) * psi^2
    psi = hydrogen_1s(r, Z)
    return (Z/r - 0.5*Z**2) * psi**2

def gradient_form(r, Z=1.0):
    # T_G = 1/2 |nabla psi|^2
    # nabla psi = d/dr psi * r_hat
    # |nabla psi|^2 = (d/dr psi)^2
    d_psi = d_hydrogen_1s(r, Z)
    return 0.5 * d_psi**2

def potential_energy(r, Z=1.0):
    psi = hydrogen_1s(r, Z)
    return (-Z/r) * psi**2

r = np.linspace(0.01, 5, 500)
T_L = laplacian_form(r)
T_G = gradient_form(r)
V = potential_energy(r)

E_density_L = T_L + V
E_density_G = T_G + V

# Integrate to check total energy
dr = r[1] - r[0]
E_total_L = np.sum(E_density_L * 4 * np.pi * r**2) * dr
E_total_G = np.sum(E_density_G * 4 * np.pi * r**2) * dr

print(f"Total Energy (Laplacian): {E_total_L:.4f} Ha")
print(f"Total Energy (Gradient): {E_total_G:.4f} Ha")

# Check for positive regions in cumulative sum
cumulative_L = np.cumsum(E_density_L * 4 * np.pi * r**2 * dr)
cumulative_G = np.cumsum(E_density_G * 4 * np.pi * r**2 * dr)

# Plot
plt.figure(figsize=(10, 6))
plt.plot(r, cumulative_L, label='Cumulative E (Laplacian Form)')
plt.plot(r, cumulative_G, label='Cumulative E (Gradient Form)')
plt.axhline(-0.5, color='gray', linestyle='--')
plt.axhline(0, color='black', linewidth=0.5)
plt.xlabel('r (a0)')
plt.ylabel('Cumulative Energy (Ha)')
plt.title('Hydrogen 1s Cumulative Energy: Laplacian vs Gradient Kinetic Energy')
plt.legend()
plt.grid(True)
plt.savefig('energy_density_comparison.png')
