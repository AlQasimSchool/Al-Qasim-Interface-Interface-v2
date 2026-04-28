
const fs = require('fs');
const content = fs.readFileSync('scout-app-v3.js', 'utf8');
const lines = content.split('\n');

let braceCount = 0;
lines.forEach((line, i) => {
    const openBraces = (line.match(/\{/g) || []).length;
    const closeBraces = (line.match(/\}/g) || []).length;
    braceCount += openBraces - closeBraces;
    if (line.includes('return') && braceCount === 0) {
        console.log(`Potential illegal return at line ${i + 1}: ${line.trim()}`);
    }
});
