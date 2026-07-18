const fs = require('fs');
const path = require('path');

const dirs = [
    path.join(__dirname, '設計図'),
    path.join(__dirname, 'antigravity')
];

function processDir(dirPath) {
    const files = fs.readdirSync(dirPath);
    for (const file of files) {
        const fullPath = path.join(dirPath, file);
        if (fs.statSync(fullPath).isDirectory()) {
            processDir(fullPath);
        } else if (fullPath.endsWith('.md') && !fullPath.includes('導入提案書')) {
            let content = fs.readFileSync(fullPath, 'utf8');
            let newContent = content.replace(/au\s*PAY/gi, 'AirPay');
            if (content !== newContent) {
                fs.writeFileSync(fullPath, newContent, 'utf8');
                console.log('Updated: ' + fullPath);
            }
        }
    }
}

dirs.forEach(processDir);
console.log('Done');
