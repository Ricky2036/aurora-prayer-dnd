const pptxgen = require('pptxgenjs');
const pptx = new pptxgen();
const slide = pptx.addSlide();
slide.addText('Test');
pptx.write('arraybuffer').then(buffer => console.log('Buffer length:', buffer.byteLength)).catch(e => console.error(e));
