
// Mock window/self for physics-core.js
const globalScope = typeof global !== 'undefined' ? global : this;
globalScope.self = globalScope;
globalScope.window = globalScope;

// Load Physics Core directly using CommonJS require
// Since physics-core.js detects module.exports, it works natively in Node.
const core = require('../physics-core.js');

console.log("=== Physics Core Verification ===");

if (!core || !core.radialPDF) {
    console.error("Failed to load PhysicsCore!");
    process.exit(1);
}

// 1. Check H 1s at r=1
// R(r) = 2 * exp(-r)
// P(r) = r^2 * R^2 = 1 * 4 * exp(-2) = 4 * 0.135335 = 0.54134
const pdf_1s_1 = core.radialPDF(1, 0, 1.0, 1, 1, 'H');
console.log(`H 1s (r=1) PDF: Expected ~0.5413, Got: ${pdf_1s_1}`);

// 2. Check H 1s at r=0.01 (Near kernel)
// R(0.01) ~= 2 * exp(-0.01) ~= 2 * 0.99 = 1.98
// P(0.01) = 0.0001 * 1.98^2 ~= 0.000392
const pdf_1s_small = core.radialPDF(1, 0, 0.01, 1, 1, 'H');
console.log(`H 1s (r=0.01) PDF: Expected ~0.000392, Got: ${pdf_1s_small}`);

// 3. Integrate V(r) for H 1s
const rMin = 0.01;
// For user (log-log), rMax was 50
const rMax = 50.0;
const numLogBins = 300;
const logMin = Math.log10(rMin);
const logMax = Math.log10(rMax);
const logStep = (logMax - logMin) / numLogBins;

let cumV = 0;
for (let i = 0; i < numLogBins; i++) {
    // r at center of bin
    const logR = logMin + (i + 0.5) * logStep;
    const r = Math.pow(10, logR);

    // Bin width
    const rL = Math.pow(10, logMin + i * logStep);
    const rR = Math.pow(10, logMin + (i + 1) * logStep);
    const binWidth = rR - rL;

    // PDF
    const pdf = core.radialPDF(1, 0, r, 1, 1, 'H');

    // Potential Density P(r) * (-Z/r)
    const potDens = pdf * (-1.0 / r);

    cumV += potDens * binWidth;
}

console.log(`H 1s Integrated V(r=0.01->50): Expected ~-1.0, Got: ${cumV}`);
console.log(`Log10(|V|): ${Math.log10(Math.abs(cumV))}`);

// 4. Check Ti 4s (using simple STO)
globalScope.SlaterBasis = {
    "Ti": {
        "Z": 22,
        "orbitals": {
            "4s": [
                // Simplified Ti 4s mimics
                { "nStar": 4, "zeta": 1.2, "coeff": 1.0 }
            ]
        }
    }
};

const pdf_Ti4s = core.radialPDF(4, 0, 10.0, 22, 1, 'Ti');
console.log(`Ti 4s (Simple STO) PDF at r=10: ${pdf_Ti4s}`);

// Integ Ti 4s
let cumV_Ti = 0;
for (let i = 0; i < numLogBins; i++) {
    const logR = logMin + (i + 0.5) * logStep;
    const r = Math.pow(10, logR);

    const rL = Math.pow(10, logMin + i * logStep);
    const rR = Math.pow(10, logMin + (i + 1) * logStep);
    const binWidth = rR - rL;

    // Use Z=22
    const pdf = core.radialPDF(4, 0, r, 22, 1, 'Ti');
    const potDens = pdf * (-22.0 / r);
    cumV_Ti += potDens * binWidth;
}
console.log(`Ti 4s (Z=22) Integ V: ${cumV_Ti}`);
console.log(`Ti 4s Log10(|V|): ${Math.log10(Math.abs(cumV_Ti))}`);
