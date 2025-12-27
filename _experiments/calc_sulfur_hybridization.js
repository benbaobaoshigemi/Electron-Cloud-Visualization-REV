const PhysicsCore = require('../physics-core.js');

// Define Sulfur sp3d2 basis (SF6 context)
// 3s, 3px, 3py, 3pz, 3dz2, 3dx2-y2
const sulfurOrbitals = [
    { n: 3, l: 0, angKey: { l: 0, m: 0, t: 'c' }, label: '3s' },
    { n: 3, l: 1, angKey: { l: 1, m: 0, t: 'c' }, label: '3pz' },
    { n: 3, l: 1, angKey: { l: 1, m: 1, t: 'c' }, label: '3px' },
    { n: 3, l: 1, angKey: { l: 1, m: 1, t: 's' }, label: '3py' },
    { n: 3, l: 2, angKey: { l: 2, m: 0, t: 'c' }, label: '3dz2' },
    { n: 3, l: 2, angKey: { l: 2, m: 2, t: 'c' }, label: '3dx2-y2' } // Standard Octahedral set
];

console.log("=== Calculating Hybridization for Sulfur (sp3d2) ===");
console.log("Basis Set:", sulfurOrbitals.map(o => o.label).join(', '));

// 1. Get Coefficients (using new Adaptive Alignment)
const coeffs = PhysicsCore.getHybridCoefficients(sulfurOrbitals);

// 2. Analyze each hybrid orbital
console.log("\n[Hybrid Orbital Analysis]");
console.log("H_i\t%s\t%p\t%d\tIndex(p/s)\tIndex(d/s)\tSum");
console.log("-".repeat(80));

let totalS = 0;

coeffs.forEach((row, i) => {
    // Row is [c_s, c_pz, c_px, c_py, c_dz2, c_dx2y2] (Order depends on sorting in physics-core)
    // We need to map coeffs back to labels. 
    // physics-core sorts input params. We need to know the sorted order.
    // However, we can just sum based on l values.

    // Re-sort to match physics-core internal sorting for consistent index mapping
    // But wait, getHybridCoefficients returns a matrix where columns correspond to the SORTED orbitals.
    // We should call sortOrbitalsForHybridization to warn the user or just match l.

    const sortedParams = PhysicsCore.sortOrbitalsForHybridization(sulfurOrbitals);

    let sComp = 0;
    let pComp = 0;
    let dComp = 0;

    row.forEach((Val, colIdx) => {
        const p = sortedParams[colIdx];
        const contribution = Val * Val;
        if (p.l === 0) sComp += contribution;
        if (p.l === 1) pComp += contribution;
        if (p.l === 2) dComp += contribution;
    });

    const total = sComp + pComp + dComp;
    const sPct = (sComp * 100).toFixed(2) + "%";
    const pPct = (pComp * 100).toFixed(2) + "%";
    const dPct = (dComp * 100).toFixed(2) + "%";

    // Hybridization Index lambda where sp^lambda
    const lambdaP = sComp > 1e-6 ? (pComp / sComp).toFixed(2) : "inf";
    const lambdaD = sComp > 1e-6 ? (dComp / sComp).toFixed(2) : "inf";

    console.log(`H${i + 1}\t${sPct}\t${pPct}\t${dPct}\t${lambdaP}\t\t${lambdaD}\t\t${total.toFixed(4)}`);

    totalS += sComp;
});

console.log("-".repeat(80));
console.log(`Average s-character: ${(totalS / 6 * 100).toFixed(2)}% (Expected: 16.67%)`);
console.log(`\nConclusion: S is sp^3d^2 hybridized.`);
