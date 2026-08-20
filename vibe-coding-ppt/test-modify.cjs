const pptxgen = require('pptxgenjs');
const JSZip = require('jszip');

async function test() {
    const pptx = new pptxgen();
    const slide = pptx.addSlide();
    slide.addMedia({ type: 'video', path: 'dummy.mp4', x: 1, y: 1, w: 4, h: 3, rounding: true });
    
    const buffer = await pptx.write('arraybuffer');
    const zip = await JSZip.loadAsync(buffer);
    
    for (const [filename, zipEntry] of Object.entries(zip.files)) {
        if (filename.startsWith('ppt/slides/slide') && filename.endsWith('.xml')) {
            let xmlStr = await zipEntry.async('string');
            if (xmlStr.includes('<a:videoFile')) {
                const blocks = xmlStr.split(/<p:pic(?=[^>]*>)/);
                let modifiedXml = blocks[0];
                for (let i = 1; i < blocks.length; i++) {
                    let block = blocks[i];
                    if (block.includes('<a:videoFile')) {
                        block = block.replace('<a:prstGeom prst="rect"><a:avLst/></a:prstGeom>', '<a:prstGeom prst="roundRect"><a:avLst><a:gd name="adj" fmla="val 16667"/></a:avLst></a:prstGeom>');
                    }
                    modifiedXml += '<p:pic' + block;
                }
                zip.file(filename, modifiedXml);
            }
        }
    }
    
    const finalBuffer = await zip.generateAsync({ type: 'nodebuffer' });
    const fs = require('fs');
    fs.writeFileSync('test-round.pptx', finalBuffer);
    console.log('Modified PPTX written');
}
test();
