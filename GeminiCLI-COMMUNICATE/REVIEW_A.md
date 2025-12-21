# Expert Review Request: Analytical Kinetic Energy for Cumulative Orbital Energy Curve

## Context
I have Koga-Thakkar high-precision Slater-Type Orbital (STO) basis sets for atoms Z=1 to 54. Each orbital is expressed as:
$$R(r) = \sum_i c_i N_i r^{n_i-1} e^{-\zeta_i r}$$

I want to compute a cumulative orbital energy curve E(R) that:
1. Starts at E(0) = 0
2. Converges to E(∞) = ε (the HF orbital energy eigenvalue)

## Proposed Method
Someone proposed computing the radial kinetic energy density analytically.

### Formula for kinetic operator on STO:
$$\hat{T}_{radial} (r^{n-1} e^{-\zeta r}) = -\frac{1}{2} \left[ \frac{\partial^2}{\partial r^2} + \frac{2}{r}\frac{\partial}{\partial r} - \frac{l(l+1)}{r^2} \right] (r^{n-1} e^{-\zeta r})$$

After differentiation:
$$\hat{T} \chi = -\frac{1}{2} \left[ A \cdot r^{n-3} e^{-\zeta r} + B \cdot r^{n-2} e^{-\zeta r} + C \cdot r^{n-1} e^{-\zeta r} \right]$$

With coefficients:
- A = (n-1)(n-2) + 2(n-1) - l(l+1)
- B = -2ζ(n-1) - 2ζ = -2ζn
- C = ζ²

### Claim
The kinetic energy integral T(R) = ∫₀^R ψ* T̂ ψ · r² dr can be computed analytically using incomplete gamma functions, since the integrand is still of form r^M × e^(-Λr).

## Questions for Review
1. Are the coefficients A, B, C correct?
2. Is the claim that the kinetic energy integral can be computed with incomplete gamma functions valid?
3. For hydrogen 1s (n=1, l=0, ζ=1), does this give T(∞) = 0.5 Hartree (the correct kinetic energy)?
4. Any mathematical errors in the derivation?

Please verify by explicit calculation for hydrogen 1s.

[END]
