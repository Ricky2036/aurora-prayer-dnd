const fs = require('fs');
const path = './src/data/reportData.js';

let lines = fs.readFileSync(path, 'utf8').split('\n');

let slideCounter = 1;
let indexCounter = 1; // wait, what was the first index? slide_6 had index 5. So it was array index (0-based) of the slide in the full array!

// Let's just track the global array index!
let currentArrayIndex = -1; // Before first slide

for (let i = 0; i < lines.length; i++) {
  if (lines[i].includes('"id": "slide_')) {
    currentArrayIndex++;
    lines[i] = lines[i].replace(/"id":\s*"slide_\d+"/, `"id": "slide_${currentArrayIndex + 1}"`);
  }
  
  if (lines[i].match(/"index":\s*\d+,/)) {
    // Replace with the current array index!
    lines[i] = lines[i].replace(/"index":\s*\d+/, `"index": ${currentArrayIndex}`);
  }
}

fs.writeFileSync(path, lines.join('\n'), 'utf8');
console.log('Fixed numbering!');
