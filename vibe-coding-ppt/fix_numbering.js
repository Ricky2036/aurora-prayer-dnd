const fs = require('fs');
const path = './src/data/reportData.js';

let content = fs.readFileSync(path, 'utf8');

// The file exports `export const reportData = [ ... ]`
// We need to parse it, modify it, and write it back.
// Since it contains JSX components (e.g. `<CheckIcon />`), we can't just JSON.parse it.
// We must use regex to replace the `id` and `index` properties sequentially!

// Better yet, let's just find all `"id": "slide_X"` and replace them with `"id": "slide_i"` sequentially.
let slideIdCounter = 1;
content = content.replace(/"id":\s*"slide_\d+"/g, () => `"id": "slide_${slideIdCounter++}"`);

// Now for `"index": X`, 
let slideIndexCounter = 0; // The templates use (index + 1), and array index is 0-based. But let's check what the first one is.
// Let's replace ONLY the "index" inside the data objects. It's usually `"index": X,`
// To be safe, we can match `"index": \d+,` but wait, what if there are other "index" properties?
// In the grep results, all `"index": X,` were for slides.
// But some slides might not have an index.
