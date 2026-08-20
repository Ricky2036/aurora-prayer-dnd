const pptxgen = require('pptxgenjs');
const pptx = new pptxgen();
const slide = pptx.addSlide();
slide.addMedia({ type: 'video', path: 'dummy.mp4', x: 1, y: 1, w: 4, h: 3, rounding: true });
pptx.writeFile({ fileName: 'test.pptx' }).then(() => console.log('Done'));
