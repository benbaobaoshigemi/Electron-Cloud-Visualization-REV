// 验证 sp² 输出的几何正确性
const h0 = [0.248, 0.969, -0.009];
const h1 = [-0.969, -0.246, -0.009];
const h2 = [0.702, -0.713, -0.009];

function angle(a, b) {
    const dot = a[0] * b[0] + a[1] * b[1] + a[2] * b[2];
    return Math.acos(Math.max(-1, Math.min(1, dot))) * 180 / Math.PI;
}

console.log('sp2 output angles:');
console.log(`  h0-h1: ${angle(h0, h1).toFixed(1)}°`);
console.log(`  h0-h2: ${angle(h0, h2).toFixed(1)}°`);
console.log(`  h1-h2: ${angle(h1, h2).toFixed(1)}°`);
console.log('Expected: all ~120°');

// 与期望 120° 方向的对比
const expected = [
    [1, 0, 0],
    [Math.cos(2 * Math.PI / 3), Math.sin(2 * Math.PI / 3), 0],
    [Math.cos(4 * Math.PI / 3), Math.sin(4 * Math.PI / 3), 0]
];
console.log('\nExpected 120 deg dirs:');
expected.forEach((e, i) => console.log(`  e${i}: [${e.map(x => x.toFixed(3)).join(', ')}]`));

// h0 与哪个 expected 最接近？
console.log('\nAlignment to expected:');
for (let i = 0; i < 3; i++) {
    const h = [h0, h1, h2][i];
    for (let j = 0; j < 3; j++) {
        console.log(`  h${i}-e${j}: ${angle(h, expected[j]).toFixed(1)}°`);
    }
}
