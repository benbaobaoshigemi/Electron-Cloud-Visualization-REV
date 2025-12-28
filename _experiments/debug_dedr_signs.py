#!/usr/bin/env python3
"""
调试势能密度符号问题
检查 dVnuc/dr 和 dE/dr 的符号是否合理
"""
import numpy as np
import math

def factorial(n):
    if n <= 1:
        return 1
    result = 1
    for i in range(2, n + 1):
        result *= i
    return result

def slater_radial_wavefunction(r, n, zeta, coeff):
    """Slater type orbital radial part"""
    n_int = int(round(n))
    N = (2 * zeta) ** n * math.sqrt(2 * zeta / factorial(2 * n_int))
    return coeff * N * r ** (n - 1) * math.exp(-zeta * r)

# Al 4s orbital from SlaterBasis
# Based on typical Slater basis parameters
n_star = 4.0
zeta = 1.82  # Approximate effective zeta for Al 4s
Z = 13  # Aluminum nuclear charge

# Test at a single point
r = 0.05  # Near nucleus (a0)

# Calculate radial wavefunction
R = slater_radial_wavefunction(r, n_star, zeta, 1.0)

# Calculate PDF
pdf = r * r * R * R

print(f"Testing at r = {r} a0")
print(f"Radial wavefunction R(r) = {R:.6e}")
print(f"PDF P(r) = r²R² = {pdf:.6e}")
print()

# Nuclear potential derivative (should be negative for attraction)
# dV_nuc/dr = -Z * r^(2n-1) * exp(-2ζr) * (prefactor)
# At r -> 0+, for n=4: r^7 -> 0, so dV_nuc/dr -> 0 from below (negative)
alpha = 2 * zeta
power = 2 * n_star - 1
dVnuc_dr = -Z * r ** power * math.exp(-alpha * r)

print(f"Nuclear attraction derivative:")
print(f"  dV_nuc/dr = -Z * r^{power} * exp(-{alpha}*r)")
print(f"  dV_nuc/dr = {dVnuc_dr:.6e} (should be ≤ 0)")
print()

# Electron-electron term (always positive - repulsion)
# Vee is typically positive, contributes positive term to dE/dr
Vee_pot = 2.0  # Hartree (假设值)
dVee_dr = pdf * Vee_pot

print(f"Electron-electron repulsion term:")
print(f"  Vee(r) ≈ {Vee_pot:.3f} Hartree")
print(f"  dVee/dr contribution = P(r) * Vee = {dVee_dr:.6e} (should be ≥ 0)")
print()

# Total energy density
dE_dr = dVnuc_dr + dVee_dr

print(f"Total energy density:")
print(f"  dE/dr = dV_nuc/dr + P(r)*Vee")
print(f"  dE/dr = {dVnuc_dr:.6e} + {dVee_dr:.6e}")
print(f"  dE/dr = {dE_dr:.6e}")
print()

# Check the decomposition logic in orbital.js
veeTerm = dE_dr - dVnuc_dr  # This should equal dVee_dr
veePerPDF = veeTerm / pdf if pdf > 1e-12 else 0

print(f"Decomposition check (orbital.js logic):")
print(f"  veeTerm = dE/dr - dV_nuc/dr = {veeTerm:.6e}")
print(f"  Expected: P(r) * Vee = {dVee_dr:.6e}")
print(f"  Match: {abs(veeTerm - dVee_dr) < 1e-10}")
print()
print(f"  veePerPDF = veeTerm / P(r) = {veePerPDF:.6e}")
print(f"  Expected: Vee = {Vee_pot:.6e}")
print(f"  Match: {abs(veePerPDF - Vee_pot) < 1e-3}")
print()

# Now check what happens with sampled PDF
sampledPDF = 0.8 * pdf  # Suppose sampling gives 80% of theory
expDEdr = dVnuc_dr + sampledPDF * veePerPDF

print(f"Sampled energy density:")
print(f"  sampledPDF = {sampledPDF:.6e} (80% of theory)")
print(f"  expDEdr = dV_nuc/dr + sampledPDF * veePerPDF")
print(f"  expDEdr = {dVnuc_dr:.6e} + {sampledPDF * veePerPDF:.6e}")
print(f"  expDEdr = {expDEdr:.6e}")
print()

# Check sign
if expDEdr > 0:
    print("⚠️  ERROR: expDEdr is POSITIVE! This is physically wrong!")
    print("   Potential energy density should always be ≤ 0")
    print()
    print("Diagnosis:")
    print(f"  Nuclear term: {dVnuc_dr:.6e} (negative, good)")
    print(f"  Electron term: {sampledPDF * veePerPDF:.6e} (positive)")
    if abs(sampledPDF * veePerPDF) > abs(dVnuc_dr):
        print(f"  ⚠️  Electron repulsion term overwhelms nuclear attraction!")
        print(f"     Ratio: {(sampledPDF * veePerPDF) / abs(dVnuc_dr):.2f}x")
else:
    print("✓ expDEdr is negative or zero (correct)")
