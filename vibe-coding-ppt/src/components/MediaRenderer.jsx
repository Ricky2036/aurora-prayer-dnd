import React, { useRef, useEffect, useState } from 'react';
import DynamicIcon from './DynamicIcon';
import EditableText from './EditableText';

const ReplaceOverlay = ({ media, onUpdateMediaUrl }) => {
  if (!onUpdateMediaUrl) return null;
  return (
    <>
      <label className="replace-overlay absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[56px] h-[56px] bg-black/40 hover:bg-black/60 backdrop-blur-xl rounded-full flex items-center justify-center cursor-pointer opacity-0 group-hover/media:opacity-100 transition-all duration-300 z-50 hover:scale-105 shadow-lg">
        <input 
          type="file" 
          multiple
          accept="image/*,video/*" 
          className="hidden" 
          onChange={(e) => {
            const files = Array.from(e.target.files);
            if (files.length > 0 && onUpdateMediaUrl) {
              const processFile = async (file) => {
                const blobUrl = URL.createObjectURL(file);
                let w = 16, h = 9;
                
                if (file.type.startsWith('image/')) {
                  const img = new Image();
                  await new Promise(r => {
                    img.onload = () => { w = img.naturalWidth; h = img.naturalHeight; r(); };
                    img.src = blobUrl;
                  });
                } else if (file.type.startsWith('video/')) {
                  const vid = document.createElement('video');
                  await new Promise(r => {
                    vid.onloadedmetadata = () => { w = vid.videoWidth; h = vid.videoHeight; r(); };
                    vid.src = blobUrl;
                  });
                }
                
                const ext = file.name.split('.').pop() || (file.type.startsWith('video/') ? 'mp4' : 'jpg');
                const safeName = `${Date.now()}_${Math.random().toString(36).substring(7)}.${ext}`;
                
                try {
                  const res = await fetch(`/api/upload?name=${encodeURIComponent(safeName)}`, {
                    method: 'POST',
                    body: file
                  });
                  const data = await res.json();
                  if (data.url) {
                    return { url: data.url, w, h, type: file.type.startsWith('video/') ? 'video' : 'image' };
                  }
                } catch (e) {
                  console.error('Upload failed, falling back to blob URL', e);
                }
                
                return { url: blobUrl, w, h, type: file.type.startsWith('video/') ? 'video' : 'image' };
              };
              Promise.all(files.map(processFile)).then(results => {
                onUpdateMediaUrl(media.globalIdx, results);
              });
            }
          }}
        />
        <DynamicIcon name="ImagePlus" className="w-[24px] h-[24px] text-white" />
      </label>

      <button 
        className="absolute top-[16px] right-[16px] w-[32px] h-[32px] bg-black/40 hover:bg-red-500/80 backdrop-blur-xl rounded-full flex items-center justify-center cursor-pointer opacity-0 group-hover/media:opacity-100 transition-all duration-300 z-50 hover:scale-105 shadow-lg"
        onClick={(e) => {
          e.preventDefault();
          e.stopPropagation();
          onUpdateMediaUrl(media.globalIdx, []); // empty array to clear/delete
        }}
      >
        <DynamicIcon name="Trash2" className="w-[16px] h-[16px] text-white" />
      </button>
    </>
  );
};

const MediaRenderer = ({ mediaList: rawMediaList, defaultIcon, placeholderLabel, onUpdateLabel, onUpdateMediaCaption, onUpdateMediaUrl }) => {
  const mediaList = React.useMemo(() => {
    return rawMediaList ? rawMediaList.map((m, i) => ({ ...m, globalIdx: i })) : [];
  }, [rawMediaList]);
  
  const containerRef = useRef(null);
  const [layoutDims, setLayoutDims] = useState([]); // array of { w, h, flexRow: boolean } for each group
  const layoutDimsRef = useRef(layoutDims);
  layoutDimsRef.current = layoutDims;

  const isVideo = (media) => {
    return media.type === 'video' || (media.url && (media.url.endsWith('.mp4') || media.url.endsWith('.mov') || media.url.endsWith('.avi')));
  };

  const groupedMedia = [];
  const hasExplicitGroups = mediaList.some(m => m.groupId !== undefined);

  // Determine isLandscape for grouping fallback
  let isLandscape = false;
  if (mediaList[0] && mediaList[0].w && mediaList[0].h) {
    const avgRatio = mediaList.reduce((acc, m) => acc + (m.w / m.h), 0) / mediaList.length;
    isLandscape = avgRatio > 1.2;
  }
  if (mediaList.length === 3) {
    isLandscape = false;
  }

  if (hasExplicitGroups) {
    const groups = new Map();
    mediaList.forEach((m, idx) => {
      const gid = m.groupId ?? ('ungrouped_' + idx);
      if (!groups.has(gid)) groups.set(gid, []);
      groups.get(gid).push(m);
    });
    groups.forEach(val => groupedMedia.push(val));
  } else if (mediaList.length === 3 && !isLandscape) {
    const isW = (m) => (m.w || 9) / (m.h || 16) > 1.2;
    const w0 = isW(mediaList[0]);
    const w1 = isW(mediaList[1]);
    const w2 = isW(mediaList[2]);

    if (w0 && w1) {
      groupedMedia.push([mediaList[0], mediaList[1]]);
      groupedMedia.push([mediaList[2]]);
    } else if (w1 && w2) {
      groupedMedia.push([mediaList[0]]);
      groupedMedia.push([mediaList[1], mediaList[2]]);
    } else {
      groupedMedia.push([mediaList[0], mediaList[1]]);
      groupedMedia.push([mediaList[2]]);
    }
  } else {
    let chunkSize = 1;
    if (!isLandscape && mediaList.length % 2 === 0) {
      chunkSize = 2; 
    }
    for (let i = 0; i < mediaList.length; i += chunkSize) {
      groupedMedia.push(mediaList.slice(i, i + chunkSize));
    }
  }

  const groupARs = groupedMedia.map(group => {
    const isGroupLandscape = group[0] && ((group[0].w || 9) / (group[0].h || 16) > 1.2);
    if (isGroupLandscape && group.length > 1) {
       let invAR = 0;
       group.forEach(m => {
         const ar = (m.w || 9) / (m.h || 16);
         invAR += 1 / ar;
       });
       return { ar: 1 / invAR, isLandscape: true };
    } else {
       let groupAR = 0;
       group.forEach(m => {
         const ar = (m.w || 9) / (m.h || 16);
         groupAR += ar;
       });
       return { ar: groupAR, isLandscape: false };
    }
  });

  const getRowDistributions = (N) => {
      const dists = [];
      for (let r = 1; r <= N; r++) {
         const rowCounts = [];
         const base = Math.floor(N / r);
         const rem = N % r;
         for (let i = 0; i < r; i++) {
             rowCounts.push(base + (i < rem ? 1 : 0));
         }
         dists.push(rowCounts);
      }
      return dists;
  };

  useEffect(() => {
    if (!containerRef.current || !mediaList || mediaList.length === 0) return;
    
    const calculate = () => {
      const W_avail = containerRef.current.offsetWidth;
      const H_avail = containerRef.current.offsetHeight;
      
      if (W_avail < 50 || H_avail < 50) return; 

      const n = groupedMedia.length;
      const GAP = 16;
      const P = 16; // 8px padding * 2

      let bestConfig = null;
      let minDiff = Infinity;

      // Try different row configurations
      for (let rows = 1; rows <= n; rows++) {
          // Distribute cards evenly
          const dist = new Array(rows).fill(Math.floor(n / rows));
          for (let i = 0; i < n % rows; i++) dist[i]++;

          let totalInnerH = 0;
          let blockIndex = 0;
          const rowInnerHeights = [];

          for (let r = 0; r < rows; r++) {
              const count = dist[r];
              let sumAR = 0;
              for (let j = 0; j < count; j++) {
                  sumAR += groupARs[blockIndex + j].ar;
              }
              const gapSpace = (count - 1) * GAP;
              const paddingSpace = count * P;
              const InnerW_for_cards = Math.max(10, W_avail - gapSpace - paddingSpace);
              
              const InnerH_row = sumAR > 0 ? InnerW_for_cards / sumAR : 100;
              rowInnerHeights.push(InnerH_row);
              totalInnerH += InnerH_row;
              blockIndex += count;
          }

          const totalRequiredH = totalInnerH + rows * P + (rows - 1) * GAP;

          let scale = 1.0;
          if (totalRequiredH > H_avail) {
             const availForInner = H_avail - rows * P - (rows - 1) * GAP;
             scale = availForInner > 0 ? availForInner / totalInnerH : 0.1;
          }

          // Target ideal card aspect ratio is 16:9 (approx 1.77)
          let maxDeviation = 0;
          blockIndex = 0;
          for (let r = 0; r < rows; r++) {
              const count = dist[r];
              const h_inner = rowInnerHeights[r] * scale;
              for (let j = 0; j < count; j++) {
                  const ar = groupARs[blockIndex + j].ar;
                  const w_inner = h_inner * ar;
                  const cardAR = w_inner / h_inner;
                  maxDeviation = Math.max(maxDeviation, Math.abs(cardAR - 1.77));
              }
              blockIndex += count;
          }

          const diff = maxDeviation;
          if (diff < minDiff) {
              minDiff = diff;
              bestConfig = { dist, rowInnerHeights, scale };
          }
      }

      const dims = [];
      if (bestConfig) {
          let blockIndex = 0;
          bestConfig.dist.forEach((count, r) => {
              const h_inner = bestConfig.rowInnerHeights[r] * bestConfig.scale;
              // Add a small safe margin to avoid float rounding scrollbars
              const h_inner_safe = Math.floor(h_inner * 0.98); 
              for (let j = 0; j < count; j++) {
                  const ar = groupARs[blockIndex].ar;
                  const w_inner = h_inner_safe * ar;
                  dims.push({ w: Math.floor(w_inner + P), h: Math.floor(h_inner_safe + P) });
                  blockIndex++;
              }
          });
          if (JSON.stringify(dims) !== JSON.stringify(layoutDimsRef.current)) {
            setLayoutDims(dims);
          }
      }
    };
    
    calculate();
    
    const observer = new ResizeObserver(calculate);
    observer.observe(containerRef.current);
    return () => observer.disconnect();
  }, [mediaList]);

  if (!mediaList || mediaList.length === 0) {
    return (
      <div className="w-full h-full flex flex-col justify-start items-center gap-[8px]">
        <div className="pptx-layer flex flex-row gap-[8px] bg-gray-50/50 rounded-[32px] shadow-[0_24px_48px_-12px_rgba(0,0,0,0.12)] backdrop-blur-md p-[8px] overflow-hidden w-full min-h-0" style={{ height: "100%" }}>
          <div className="relative flex-1 min-w-0 flex items-center justify-center">
            <label className="cursor-pointer w-full h-full bg-gray-50 rounded-[24px] border-[2px] border-dashed border-gray-300 flex flex-col items-center justify-center shrink-0 pptx-layer hover:bg-gray-100 transition-colors relative group">
              <input 
                type="file" 
                multiple
                accept="image/*,video/*" 
                className="hidden" 
                onChange={(e) => {
                  const files = Array.from(e.target.files);
                  if (files.length > 0 && onUpdateMediaUrl) {
                    const processFile = async (file) => {
                      const blobUrl = URL.createObjectURL(file);
                      let w = 16, h = 9;
                      
                      if (file.type.startsWith('image/')) {
                        const img = new Image();
                        await new Promise(r => {
                          img.onload = () => { w = img.naturalWidth; h = img.naturalHeight; r(); };
                          img.src = blobUrl;
                        });
                      } else if (file.type.startsWith('video/')) {
                        const vid = document.createElement('video');
                        await new Promise(r => {
                          vid.onloadedmetadata = () => { w = vid.videoWidth; h = vid.videoHeight; r(); };
                          vid.src = blobUrl;
                        });
                      }
                      
                      const ext = file.name.split('.').pop() || (file.type.startsWith('video/') ? 'mp4' : 'jpg');
                      const safeName = `${Date.now()}_${Math.random().toString(36).substring(7)}.${ext}`;
                      
                      try {
                        const res = await fetch(`/api/upload?name=${encodeURIComponent(safeName)}`, {
                          method: 'POST',
                          body: file
                        });
                        const data = await res.json();
                        if (data.url) {
                          return { url: data.url, w, h, type: file.type.startsWith('video/') ? 'video' : 'image' };
                        }
                      } catch (e) {
                        console.error('Upload failed, falling back to blob URL', e);
                      }
                      
                      return { url: blobUrl, w, h, type: file.type.startsWith('video/') ? 'video' : 'image' };
                    };
                    Promise.all(files.map(processFile)).then(results => {
                      onUpdateMediaUrl(0, results); // 0 because it's the first group
                    });
                  }
                }}
              />
              <div className="text-center flex flex-col items-center" onClick={(e) => e.stopPropagation()}>
                <DynamicIcon name="ImagePlus" className="w-[48px] h-[48px] text-gray-400 mb-[16px] group-hover:text-gray-500 transition-colors" />
                <EditableText 
                  tagName="span"
                  value={placeholderLabel || "点击上传视觉素材"}
                  onChange={onUpdateLabel}
                  className="pptx-text text-[20px] font-medium text-gray-500 group-hover:text-gray-600 transition-colors"
                />
              </div>
            </label>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="relative w-full h-full min-h-0 flex-1">
      <div ref={containerRef} className="absolute inset-0 pointer-events-none" />
      
      <div className="absolute inset-0 flex flex-row flex-wrap justify-center content-center items-start gap-[16px] min-h-0">
        {groupedMedia.map((group, groupIdx) => {
          const gAR = groupARs[groupIdx];
          const dim = layoutDims[groupIdx] || { w: 100, h: 100 };
          const cardStyle = { width: `${dim.w}px`, height: `${dim.h}px` };

          return (
          <div key={groupIdx} className="flex-initial flex flex-col justify-start items-center gap-[8px]" style={{ width: cardStyle.width }}>
          
          {/* Card containing the images */}
            <div 
              className={`pptx-layer flex ${gAR.isLandscape ? 'flex-col' : 'flex-row'} gap-[8px] bg-gray-50/50 rounded-[32px] shadow-[0_24px_48px_-12px_rgba(0,0,0,0.12)] backdrop-blur-md p-[8px] overflow-hidden w-full min-h-0`} 
              style={{ height: cardStyle.height }}>
            {group.map((media, idx) => {
              const mAR = (media.w || 9) / (media.h || 16);
              const itemFlex = (gAR.isLandscape ? (1 / mAR) : mAR) * 100;
              const innerRounded = "rounded-[24px]";

              return (
              <div key={idx} className="relative flex-1 min-w-0 flex items-center justify-center">
                {isVideo(media) ? (
                  <div className={`relative w-full h-full ${innerRounded} overflow-hidden group/media pptx-layer bg-black/5`}>
                    <video 
                      src={media.url} 
                      autoPlay 
                      loop 
                      muted 
                      playsInline 
                      className="w-full h-full object-cover scale-[1.01]"
                    />
                    <ReplaceOverlay media={media} onUpdateMediaUrl={onUpdateMediaUrl} />
                  </div>
                ) : media.url ? (
                  <div className={`pptx-layer w-full h-full ${innerRounded} overflow-hidden relative bg-black/5 group/media`}>
                    <div 
                      className="absolute inset-0 w-full h-full bg-cover bg-center opacity-40 blur-2xl scale-110 pointer-events-none" 
                      style={{ backgroundImage: `url(${media.url})` }}
                    ></div>
                    <img 
                      src={media.url} 
                      alt={`media-${idx}`} 
                      className="absolute inset-0 w-full h-full object-cover scale-[1.01] pointer-events-none" 
                    />
                    <ReplaceOverlay media={media} onUpdateMediaUrl={onUpdateMediaUrl} />
                  </div>
                ) : (
                  <label className={`cursor-pointer pptx-layer w-full h-full ${innerRounded} bg-gray-50 flex flex-col items-center justify-center ${group.length > 1 ? 'border-2 border-dashed border-gray-300' : ''} hover:bg-gray-100 transition-colors group relative`}>
                    <input 
                      type="file" 
                      multiple
                      accept="image/*,video/*" 
                      className="hidden" 
                      onChange={(e) => {
                        const files = Array.from(e.target.files);
                        if (files.length > 0 && onUpdateMediaUrl) {
                          const processFile = async (file) => {
                            const blobUrl = URL.createObjectURL(file);
                            let w = 16, h = 9;
                            
                            if (file.type.startsWith('image/')) {
                              const img = new Image();
                              await new Promise(r => {
                                img.onload = () => { w = img.naturalWidth; h = img.naturalHeight; r(); };
                                img.src = blobUrl;
                              });
                            } else if (file.type.startsWith('video/')) {
                              const vid = document.createElement('video');
                              await new Promise(r => {
                                vid.onloadedmetadata = () => { w = vid.videoWidth; h = vid.videoHeight; r(); };
                                vid.src = blobUrl;
                              });
                            }
                            
                            const ext = file.name.split('.').pop() || (file.type.startsWith('video/') ? 'mp4' : 'jpg');
                            const safeName = `${Date.now()}_${Math.random().toString(36).substring(7)}.${ext}`;
                            
                            try {
                              const res = await fetch(`/api/upload?name=${encodeURIComponent(safeName)}`, {
                                method: 'POST',
                                body: file
                              });
                              const data = await res.json();
                              if (data.url) {
                                return { url: data.url, w, h, type: file.type.startsWith('video/') ? 'video' : 'image' };
                              }
                            } catch (e) {
                              console.error('Upload failed, falling back to blob URL', e);
                            }
                            
                            return { url: blobUrl, w, h, type: file.type.startsWith('video/') ? 'video' : 'image' };
                          };
                          Promise.all(files.map(processFile)).then(results => {
                            onUpdateMediaUrl(media.globalIdx, results);
                          });
                        }
                      }}
                    />
                    <DynamicIcon name="ImagePlus" className="w-[48px] h-[48px] text-gray-400 mb-[16px] group-hover:text-gray-500 transition-colors" />
                    <span className="text-gray-500 font-medium text-[20px] pptx-text group-hover:text-gray-600 transition-colors">点击浏览插入图片/视频</span>
                  </label>
                )}
              </div>
            )})}
          </div>

          {/* Captions placed OUTSIDE the card */}
          {group.some(m => m.caption) && (
            <div className={`shrink-0 flex ${gAR.isLandscape ? 'flex-col' : 'flex-row'} gap-[8px] px-[8px] w-full`}>
              {group.filter(m => !!m.caption).length === 1 && !gAR.isLandscape && hasExplicitGroups ? (
                <div className="flex items-start justify-center text-center w-full min-w-0">
                  <EditableText 
                    tagName="div"
                    allowHtml={true}
                    value={group.find(m => !!m.caption).caption}
                    onChange={(newCaption) => {
                      const theMedia = group.find(m => !!m.caption);
                      if (onUpdateMediaCaption) onUpdateMediaCaption(theMedia.globalIdx, newCaption);
                    }}
                    className="pptx-text text-[18px] font-normal text-gray-700 leading-tight block whitespace-pre-wrap w-full break-words min-w-0"
                  />
                </div>
              ) : (
                group.map((media, idx) => {
                   if (gAR.isLandscape && !media.caption) return null; 

                   const mAR = (media.w || 9) / (media.h || 16);
                   const itemFlex = mAR * 100; 
                   const captionStyle = gAR.isLandscape ? { width: '100%' } : { flex: itemFlex };
                   
                   return (
                  <div key={idx} className="flex items-start justify-center text-center min-w-0" style={captionStyle}>
                    {media.caption ? (
                      <EditableText 
                        tagName="div"
                        allowHtml={true}
                        value={media.caption}
                        onChange={(newCaption) => onUpdateMediaCaption && onUpdateMediaCaption(media.globalIdx, newCaption)}
                        className="pptx-text text-[18px] font-normal text-gray-700 leading-tight block whitespace-pre-wrap w-full break-words min-w-0"
                      />
                    ) : <div className="w-full" />}
                  </div>
                )})
              )}
            </div>
          )}
        </div>
        )})}
      </div>
    </div>
  );
};

export default MediaRenderer;
