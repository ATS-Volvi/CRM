const fs = require('fs');
const path = require('path');

function walk(dir) {
    let results = [];
    const list = fs.readdirSync(dir);
    list.forEach(file => {
        file = path.resolve(dir, file);
        const stat = fs.statSync(file);
        if (stat && stat.isDirectory()) {
            results = results.concat(walk(file));
        } else if (file.endsWith('.tsx')) {
            results.push(file);
        }
    });
    return results;
}

const files = walk(path.join(__dirname, 'frontend/src'));
files.forEach(file => {
    const content = fs.readFileSync(file, 'utf-8');
    const lines = content.split('\n');
    
    let inButton = false;
    let buttonBuf = [];
    
    console.log(`\n--- ${path.basename(file)} ---`);
    for (let i=0; i<lines.length; i++) {
        const line = lines[i];
        if (line.includes('<button') || line.includes('<Link')) {
            // grab the line and a couple lines after to catch onClick
            console.log(`L${i+1}: ${line.trim()}`);
            if (i+1 < lines.length) console.log(`  ${lines[i+1].trim()}`);
            if (i+2 < lines.length) console.log(`  ${lines[i+2].trim()}`);
        }
    }
});
