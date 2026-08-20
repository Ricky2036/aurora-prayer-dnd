import * as htmlToImage from 'html-to-image';
import pptxgen from "pptxgenjs";

// --- Configuration Constants ---
const INCH_TO_PX = 192; // Assuming 1920px width = 10 inches
const DEFAULT_PADDING = 4;
const SHADOW_PADDING_MULTIPLIER = 1.5;
const SHADOW_MIN_PADDING = 64;

// --- Canvas Singleton for Color Extraction ---
let sharedColorContext = null;

/**
 * Lazily initializes and returns a shared canvas context to avoid heavy DOM creations
 * in loops when extracting hex colors from computed RGB/RGBA strings.
 */
const getSharedColorContext = () => {
  if (!sharedColorContext) {
    try {
      const canvas = document.createElement('canvas');
      canvas.width = 1;
      canvas.height = 1;
      sharedColorContext = canvas.getContext('2d', { willReadFrequently: true });
    } catch (e) {
      console.warn("Failed to create shared canvas context for color extraction.", e);
    }
  }
  return sharedColorContext;
};

/**
 * Extracts any CSS color string into a PPT-compatible Hex color.
 */
const extractHexColor = (cssColor) => {
  const ctx = getSharedColorContext();
  if (!ctx) return '000000'; // fallback
  
  try {
    // Fill white background to prevent translucent colors from causing transparent pixels
    ctx.fillStyle = '#FFFFFF';
    ctx.fillRect(0, 0, 1, 1);
    
    ctx.fillStyle = cssColor;
    ctx.fillRect(0, 0, 1, 1);
    
    const data = ctx.getImageData(0, 0, 1, 1).data;
    return ((1 << 24) + (data[0] << 16) + (data[1] << 8) + data[2])
      .toString(16)
      .slice(1)
      .toUpperCase();
  } catch (e) {
    return '000000';
  }
};

/**
 * Patches known CSS filter bugs for HTML-to-Image rendering
 */
const fixNodeFilters = (node) => {
  const elementsToFix = node.querySelectorAll('*');
  elementsToFix.forEach(el => {
      if (el.classList.contains('backdrop-blur-md') || el.classList.contains('backdrop-blur-xl')) {
          el.style.setProperty('backdrop-filter', 'none', 'important');
          el.style.setProperty('-webkit-backdrop-filter', 'none', 'important');
          
          if (el.classList.contains('bg-white/10') || el.classList.contains('bg-white/60')) {
              const opacity = el.classList.contains('bg-white/10') ? '0.15' : '0.90';
              el.style.backgroundColor = `rgba(255, 255, 255, ${opacity})`; 
          } else {
              el.style.backgroundColor = 'rgba(255, 255, 255, 0.95)'; 
          }
      }
  });

  // Remove box-shadow and transform from the root slide node for cleaner rendering
  node.style.setProperty('box-shadow', 'none', 'important');
  node.style.setProperty('transform', 'none', 'important');
};

/**
 * Extracts and prepares native PPTX text boxes from HTML text nodes.
 * Intelligently hides the original HTML text nodes to prepare for background capture.
 */
const extractTextData = (clonedNode, parentRect) => {
  const textData = [];
  const textNodes = clonedNode.querySelectorAll('.pptx-text');
  
  textNodes.forEach(node => {
    const rect = node.getBoundingClientRect();
    const computedStyle = window.getComputedStyle(node);
    
    const fontSizePx = parseFloat(computedStyle.fontSize);
    let lineHeightPx = fontSizePx * 1.2; // default fallback
    if (computedStyle.lineHeight !== 'normal') {
        lineHeightPx = parseFloat(computedStyle.lineHeight);
    }
    
    const valign = node.dataset.valign || 'top';
    const halfLeading = lineHeightPx > fontSizePx ? (lineHeightPx - fontSizePx) / 2 : 0;
    
    // PowerPoint natively adds an internal padding above CJK fonts. We subtract this empirical padding.
    const pptxBuiltInPadding = fontSizePx * 0.15;
    const yOffset = valign !== 'middle' ? halfLeading - pptxBuiltInPadding : 0;

    // Detect if text is multiline to intelligently calculate spacing and bounding box redundancy
    const isMultiLine = rect.height > (fontSizePx * 1.8);
    const lineSpacingMultiple = isMultiLine ? ((lineHeightPx / fontSizePx) / 1.33) : undefined;

    let rectW = (rect.width / INCH_TO_PX);
    let rectX = (rect.left - parentRect.left) / INCH_TO_PX;
    const rectY = (rect.top - parentRect.top + yOffset) / INCH_TO_PX;
    const h = (rect.height / INCH_TO_PX);
    
    let align = node.dataset.align;
    if (!align) {
       align = 'left';
       if (computedStyle.textAlign === 'center') align = 'center';
       if (computedStyle.textAlign === 'right') align = 'right';
    }

    // Add width redundancy to prevent accidental wrapping in PPT
    const widthBuffer = isMultiLine ? (5 / INCH_TO_PX) : (100 / INCH_TO_PX);

    if (align === 'right') {
        rectX -= widthBuffer; 
        rectW += widthBuffer;
    } else if (align === 'center') {
        rectX -= widthBuffer / 2;
        rectW += widthBuffer;
    } else {
        rectW += widthBuffer;
    }

    const fontSizePt = parseFloat(computedStyle.fontSize) * 0.375;
    const colorHex = extractHexColor(computedStyle.color);
    const isBold = parseInt(computedStyle.fontWeight, 10) >= 600 || computedStyle.fontWeight === 'bold';

    textData.push({
       text: node.innerText || node.textContent,
       x: rectX, y: rectY, w: rectW, h,
       fontSize: fontSizePt,
       color: colorHex,
       bold: isBold,
       align,
       valign,
       isMultiLine,
       lineSpacingMultiple
    });

    // Hide text nodes so they don't appear in the background image
    node.style.setProperty('opacity', '0', 'important');
  });
  
  return textData;
};

/**
 * Calculates dynamic safe margins for a layer to prevent its shadows or filters from being clipped.
 */
const calculateDynamicPadding = (layerNode) => {
    let dynamicPadding = DEFAULT_PADDING;
    const computedLayerStyle = window.getComputedStyle(layerNode);
    const layerClassName = layerNode.getAttribute('class') || '';
    
    // Helper to extract maximum pixel value from a CSS string (e.g. boxShadow or filter)
    const extractMaxPx = (cssValue) => {
        if (!cssValue || cssValue === 'none') return 0;
        const matches = cssValue.match(/(-?\d+\.?\d*)px/g);
        if (!matches) return 0;
        return Math.max(...matches.map(m => Math.abs(parseFloat(m))));
    };

    // 1. Check Tailwind class name fallback (crucial for environments where computedStyle lags)
    if (layerClassName.includes('shadow')) {
        dynamicPadding = SHADOW_MIN_PADDING;
        const shadowMatch = layerClassName.match(/shadow-\[([^\]]+)\]/);
        if (shadowMatch) {
            const pxMatches = shadowMatch[1].match(/(\d+)(?:\.\d+)?px/g);
            if (pxMatches) {
                const maxClassPx = Math.max(...pxMatches.map(m => parseFloat(m)));
                dynamicPadding = Math.max(dynamicPadding, Math.ceil(maxClassPx * SHADOW_PADDING_MULTIPLIER) + DEFAULT_PADDING);
            }
        }
    }
    
    // 2. Parse computed box-shadow
    const boxShadowMax = extractMaxPx(computedLayerStyle.boxShadow);
    if (boxShadowMax > 0) {
        dynamicPadding = Math.max(dynamicPadding, Math.ceil(boxShadowMax * SHADOW_PADDING_MULTIPLIER) + DEFAULT_PADDING);
    }
    
    // 3. Parse computed drop-shadow filter
    if (computedLayerStyle.filter && computedLayerStyle.filter.includes('drop-shadow')) {
        const filterMax = extractMaxPx(computedLayerStyle.filter);
        if (filterMax > 0) {
            dynamicPadding = Math.max(dynamicPadding, Math.ceil(filterMax * SHADOW_PADDING_MULTIPLIER) + DEFAULT_PADDING);
        }
    }
    
    return dynamicPadding;
};

/**
 * Isolates and captures all designated PPTX layers as independent images.
 */
const captureIndependentLayers = async (clonedNode, parentRect) => {
    const layersData = [];
    const layerNodes = Array.from(clonedNode.querySelectorAll('.pptx-layer'));
    
    for (const layerNode of layerNodes) {
       // Temporarily hide nested layers to prevent duplicate stamping on the parent layer
       const nestedLayers = layerNode.querySelectorAll('.pptx-layer');
       nestedLayers.forEach(n => n.style.setProperty('opacity', '0', 'important'));

       const layerRect = layerNode.getBoundingClientRect();
       const PADDING = calculateDynamicPadding(layerNode);
       
       const x = (layerRect.left - parentRect.left - PADDING) / INCH_TO_PX;
       const y = (layerRect.top - parentRect.top - PADDING) / INCH_TO_PX;
       const w = (layerRect.width + PADDING * 2) / INCH_TO_PX;
       const h = (layerRect.height + PADDING * 2) / INCH_TO_PX;

       try {
          const layerDataUrl = await htmlToImage.toPng(layerNode, {
            quality: 1,
            pixelRatio: 1,
            width: layerRect.width + PADDING * 2,
            height: layerRect.height + PADDING * 2,
            style: {
              transform: `translate(${PADDING}px, ${PADDING}px)`,
              margin: '0',
              width: `${layerRect.width}px`,
              height: `${layerRect.height}px`,
              position: 'relative',
              top: '0',
              left: '0',
              bottom: 'auto',
              right: 'auto',
              opacity: '1' // Force visibility during capture
            }
          });
          layersData.push({ dataUrl: layerDataUrl, x, y, w, h });
       } catch(e) {
          console.error("Layer capture failed:", e);
       } finally {
          // Restore visibility for nested layers
          nestedLayers.forEach(n => {
              n.style.opacity = n.dataset.originalLayerOpacity || '';
          });
       }
    }

    // Hide all processed layers before capturing the final base background
    layerNodes.forEach(n => n.style.setProperty('opacity', '0', 'important'));
    
    return layersData;
};

/**
 * Generates OPAQUE video covers (background-filled corners) and corner masks
 * from the fully composited slide background (base + card layers).
 * This ensures covers have NO transparent corners and masks match exactly.
 */
const generateVideoCoversAndMasks = async (videosData, baseDataUrl, layersData) => {
    const covers = []; // parallel array to videosData
    const masks = [];
    if (!videosData || videosData.length === 0) return { covers, masks };

    try {
        // Create a 1920x1080 compositing canvas with base + all card layers
        const compCanvas = document.createElement('canvas');
        compCanvas.width = 1920;
        compCanvas.height = 1080;
        const compCtx = compCanvas.getContext('2d');

        // Draw base slide background
        const baseImg = new Image();
        await new Promise((resolve, reject) => {
            baseImg.onload = resolve;
            baseImg.onerror = reject;
            baseImg.src = baseDataUrl;
        });
        compCtx.drawImage(baseImg, 0, 0, 1920, 1080);

        // Draw all card layers on top to get the complete background behind videos
        for (const layer of layersData) {
            if (!layer.dataUrl) continue;
            const layerImg = new Image();
            await new Promise((resolve, reject) => {
                layerImg.onload = resolve;
                layerImg.onerror = reject;
                layerImg.src = layer.dataUrl;
            });
            const layerX = layer.x * INCH_TO_PX;
            const layerY = layer.y * INCH_TO_PX;
            const layerW = layer.w * INCH_TO_PX;
            const layerH = layer.h * INCH_TO_PX;
            compCtx.drawImage(layerImg, layerX, layerY, layerW, layerH);
        }

        // For each video, generate an opaque cover AND corner masks
        for (let vi = 0; vi < videosData.length; vi++) {
            const video = videosData[vi];
            const R_px = video.borderRadius || 24;
            const R_in = R_px / INCH_TO_PX;
            const pxW = video.w * INCH_TO_PX;
            const pxH = video.h * INCH_TO_PX;
            const pxX = video.x * INCH_TO_PX;
            const pxY = video.y * INCH_TO_PX;

            // === COVER: background-filled corners (100% opaque, no transparency anywhere) ===
            let coverBase64 = null;
            try {
                const canvas = document.createElement('canvas');
                const scale = 2;
                canvas.width = pxW * scale;
                canvas.height = pxH * scale;
                const ctx = canvas.getContext('2d');
                ctx.scale(scale, scale);

                // FIRST: Fill entire canvas with the REAL background from composited slide
                ctx.drawImage(compCanvas, pxX, pxY, pxW, pxH, 0, 0, pxW, pxH);

                // THEN: Draw the video frame ON TOP, clipped to rounded rect
                if (video.sourceVideo) {
                    ctx.save();
                    ctx.beginPath();
                    ctx.moveTo(R_px, 0);
                    ctx.lineTo(pxW - R_px, 0);
                    ctx.quadraticCurveTo(pxW, 0, pxW, R_px);
                    ctx.lineTo(pxW, pxH - R_px);
                    ctx.quadraticCurveTo(pxW, pxH, pxW - R_px, pxH);
                    ctx.lineTo(R_px, pxH);
                    ctx.quadraticCurveTo(0, pxH, 0, pxH - R_px);
                    ctx.lineTo(0, R_px);
                    ctx.quadraticCurveTo(0, 0, R_px, 0);
                    ctx.closePath();
                    ctx.clip();
                    ctx.drawImage(video.sourceVideo, 0, 0, pxW, pxH);
                    ctx.restore();
                }

                coverBase64 = canvas.toDataURL('image/png');
            } catch (e) {
                console.warn('Failed to generate opaque video cover:', e);
            }
            covers.push(coverBase64);
        }
    } catch (e) {
        console.error("Failed to generate video covers:", e);
    }
    return { covers };
};

/**
 * Extracts native video elements to be embedded in the PPTX.
 * Does NOT generate covers (that happens later after background compositing).
 * Stores sourceVideo reference for later frame capture.
 */
const extractVideoData = (clonedNode, parentRect, sourceNode) => {
    const videoData = [];
    const clonedVideos = clonedNode.querySelectorAll('video');
    const sourceVideos = sourceNode ? sourceNode.querySelectorAll('video') : [];
    
    clonedVideos.forEach((node, index) => {
        const sourceVideo = sourceVideos[index];
        const rect = node.getBoundingClientRect();
        
        let url = node.src || node.currentSrc;
        if (url && url.startsWith('/')) {
            url = window.location.origin + url;
        }

        const x = (rect.left - parentRect.left) / INCH_TO_PX;
        const y = (rect.top - parentRect.top) / INCH_TO_PX;
        const w = rect.width / INCH_TO_PX;
        const h = rect.height / INCH_TO_PX;
        
        // Extract border radius dynamically
        const compStyle = window.getComputedStyle(node);
        const br = parseFloat(compStyle.borderRadius) || 24;
        
        if (url) {
            videoData.push({ url, x, y, w, h, borderRadius: br, sourceVideo: sourceVideo || null });
        }
        
        // Hide the video element so html-to-image doesn't capture it as an artifact
        node.style.setProperty('opacity', '0', 'important');
    });
    
    return videoData;
};

/**
 * 混合模式导出截图和PPTX的核心主引擎
 * @param {number} index 当前幻灯片索引
 * @param {object} pptxInstance pptxgen 实例，如果为 null 则只返回截图 dataUrl
 * @returns {Promise<string|null>} 截图 dataUrl 或 null
 */
export const captureSlideHybrid = async (index, pptxInstance = null) => {
  const slides = document.querySelectorAll('.export-slide');
  const sourceNode = slides[index - 1];
  if (!sourceNode) return null;

  // Mount an invisible rendering container
  const exportContainer = document.createElement('div');
  exportContainer.style.position = 'fixed';
  exportContainer.style.top = '0';
  exportContainer.style.left = '0';
  exportContainer.style.transform = 'translate(-200vw, -200vh)'; 
  exportContainer.style.width = '1920px';
  exportContainer.style.height = '1080px';
  exportContainer.style.zIndex = '-9999';
  exportContainer.style.transformOrigin = 'top left';
  
  document.body.appendChild(exportContainer);

  const clonedNode = sourceNode.cloneNode(true);
  exportContainer.appendChild(clonedNode);

  fixNodeFilters(clonedNode);

  let textData = [];
  let layersData = [];
  let videosData = [];

  if (pptxInstance) {
    const parentRect = clonedNode.getBoundingClientRect();
    
    // Phase 1: Extract Text
    textData = extractTextData(clonedNode, parentRect);
    // Phase 2: Extract Native Videos
    videosData = extractVideoData(clonedNode, parentRect, sourceNode);
    // Phase 3: Extract Independent Images
    layersData = await captureIndependentLayers(clonedNode, parentRect);
  }

  try {
    await new Promise(r => setTimeout(r, 50)); // Allow DOM changes to settle

    // Phase 3.5: Capture the remaining clean base background
    const baseDataUrl = await htmlToImage.toPng(clonedNode, {
      quality: 1,
      pixelRatio: 1, 
      width: 1920,
      height: 1080,
    });

    if (pptxInstance) {
      // Phase 4: Generate opaque covers from composited background + card layers
      const { covers } = await generateVideoCoversAndMasks(videosData, baseDataUrl, layersData);

      const slide = pptxInstance.addSlide();
      
      // Stamp Base Background
      slide.addImage({ data: baseDataUrl, x: 0, y: 0, w: 10, h: 5.625 });
      
      // Stamp Independent UI Layers
      layersData.forEach(layer => {
         if (layer.dataUrl) {
           slide.addImage({ data: layer.dataUrl, x: layer.x, y: layer.y, w: layer.w, h: layer.h });
         }
      });

      // Overlay Native Videos (with opaque background-filled covers)
      videosData.forEach((item, idx) => {
         if (item.url) {
           const mediaOpts = { type: 'video', path: item.url, x: item.x, y: item.y, w: item.w, h: item.h };
           if (covers[idx]) mediaOpts.cover = covers[idx];
           slide.addMedia(mediaOpts);
         }
      });

      // Overlay Editable Text
      textData.forEach(item => {
         if (!item.text.trim()) return;
         slide.addText(item.text, {
             x: item.x,
             y: item.y, 
             w: item.w,  
             h: item.h,
             fontSize: item.fontSize,
             color: item.color,
             bold: item.bold,
             align: item.align,
             valign: item.valign,
             margin: [0, 0, 0, 0],
             wrap: true,
             lineSpacingMultiple: item.lineSpacingMultiple,
             fontFace: 'PingFang SC' // Use macOS system PingFang font
         });
      });
    }

    document.body.removeChild(exportContainer);
    return baseDataUrl;
  } catch (e) {
    console.error(e);
    if (exportContainer.parentNode === document.body) {
      document.body.removeChild(exportContainer);
    }
    return null;
  }
};
