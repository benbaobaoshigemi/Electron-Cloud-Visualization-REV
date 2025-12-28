// 从JS文件提取数据并输出为JSON文件（避免stdout过大）
const fs = require('fs');
const path = require('path');

// 为Node.js环境创建全局对象（让浏览器写法在Node中可用）
global.self = global;
global.window = global;

// 加载slater_basis.js / vee_cache.js（它们会写入全局变量 SlaterBasis / VeeCache）
eval(fs.readFileSync(path.join(__dirname, '..', 'slater_basis.js'), 'utf8'));
eval(fs.readFileSync(path.join(__dirname, '..', 'vee_cache.js'), 'utf8'));

// 提取K的4s数据
const atomType = 'K';
const orbital = '4s';

const data = {
    atom: {
        Z: SlaterBasis[atomType].Z,
        name: SlaterBasis[atomType].name,
        orbitals: {
            [orbital]: SlaterBasis[atomType].orbitals[orbital]
        }
    },
    vee: {
        r_grid: VeeCache.r_grid,
        values: VeeCache.atoms[atomType][orbital]
    }
};

const outPath = path.join(__dirname, 'k4s_data.json');
fs.writeFileSync(outPath, JSON.stringify(data));
console.log(outPath);
