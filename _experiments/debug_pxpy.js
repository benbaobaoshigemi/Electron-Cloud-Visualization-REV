const fs = require('fs');
const path = require('path');

// Load PhysicsCore using require
const PC = require('../physics-core.js');

console.log('--- Debug: computeOrbitalPeakDirection ---');

const dirPx = PC.computeOrbitalPeakDirection(1, 1, 'c'); // px
console.log('px (l=1,m=1,c):', dirPx.map(x => x.toFixed(3)));

const dirPy = PC.computeOrbitalPeakDirection(1, 1, 's'); // py
console.log('py (l=1,m=1,s):', dirPy.map(x => x.toFixed(3)));

const dirPz = PC.computeOrbitalPeakDirection(1, 0, 'c'); // pz
console.log('pz (l=1,m=0,c):', dirPz.map(x => x.toFixed(3)));

console.log('\n--- Debug: Thomson N=2 Check ---');
const thomsonPoints = PC.optimizeThomson(2);
console.log('Thomson N=2:', JSON.stringify(thomsonPoints, null, 2));

// Construct A for px, py
const orbitalParams = [
    { angKey: { l: 1, m: 1, t: 'c' } },
    { angKey: { l: 1, m: 1, t: 's' } }
];

const A = [];
for (let i = 0; i < 2; i++) {
    const p = thomsonPoints[i];
    const theta = Math.acos(p[2]);
    const phi = Math.atan2(p[1], p[0]);
    const row = orbitalParams.map(param =>
        PC.realYlm_value(param.angKey.l, param.angKey.m, param.angKey.t, theta, phi)
    );
    A.push(row);
}
console.log('Matrix A:', JSON.stringify(A));

const { S } = PC.jacobiSVD(A);
console.log('Singular Values (Unsorted):', S);
const minS = Math.min(...S);
console.log('Min Singular Value:', minS);
const isCompatible = minS > 1e-4;
console.log('Is Compatible?', isCompatible);
