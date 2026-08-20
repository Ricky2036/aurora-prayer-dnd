const PptxGenJS = require('pptxgenjs');
const pptx = new PptxGenJS();
const slide = pptx.addSlide();
slide.addText('Line 1\nLine 2', { x: 1, y: 1, w: 5, h: 2, lineSpacing: 24 });
slide.addText('Line 1\nLine 2', { x: 1, y: 4, w: 5, h: 2, lineSpacingMultiple: 1.5 });
pptx.writeFile({ fileName: 'test_spacing.pptx' }).then(() => console.log('Done'));
