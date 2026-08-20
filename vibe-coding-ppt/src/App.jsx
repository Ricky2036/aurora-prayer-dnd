import React, { useState, useRef, useEffect } from 'react';
import { Loader2, Check, ChevronsDown, Presentation as PptIcon, Image as ImageIcon, Save, ChevronRight, ChevronLeft, X, MonitorPlay, PenTool, Layers } from 'lucide-react';
import pptxgen from "pptxgenjs";
import JSZip from 'jszip';
import { captureSlideHybrid } from './utils/exportPptx';
import { SlideProvider, useSlides } from './context/SlideContext';
import SlideWrapper from './components/SlideWrapper';

// Static Slides
import SlideCover from './slides/SlideCover';
import SlideTOC from './slides/SlideTOC';
import SlideBackground from './slides/SlideBackground';
import SlideAnalysisTarget from './slides/SlideAnalysisTarget';
import SlidePublicOpinion from './slides/SlidePublicOpinion';
import SlideSummary from './slides/SlideSummary';
import TemplateAreaAnalysisLeading from './slides/TemplateAreaAnalysisLeading';
import TemplateAreaAnalysisLagging from './slides/TemplateAreaAnalysisLagging';

const AppContent = () => {
  const [currentSlide, setCurrentSlide] = useState(() => {
    const saved = sessionStorage.getItem('ppt_current_slide');
    return saved ? parseInt(saved, 10) : 1;
  });

  useEffect(() => {
    sessionStorage.setItem('ppt_current_slide', currentSlide.toString());
  }, [currentSlide]);

  useEffect(() => {
    if (containerRef.current && currentSlide > 1) {
      setTimeout(() => {
        if (containerRef.current) {
          const slideElements = containerRef.current.querySelectorAll('.slide-container-node');
          const targetElement = slideElements[currentSlide - 1];
          if (targetElement) {
            // Temporarily disable smooth scroll to snap instantly
            const originalBehavior = containerRef.current.style.scrollBehavior;
            containerRef.current.style.scrollBehavior = 'auto';
            targetElement.scrollIntoView({ behavior: 'instant', block: 'start' });
            // Restore after a short delay
            setTimeout(() => {
              if (containerRef.current) containerRef.current.style.scrollBehavior = originalBehavior;
            }, 50);
          }
        }
      }, 150);
    }
  }, []);

  const [exportState, setExportState] = useState({ single: 'idle', pptx: 'idle', pptxSingle: 'idle' });
  const [isPanelExpanded, setIsPanelExpanded] = useState(true);
  const containerRef = useRef(null);
  
  const { slides, isEditMode, setIsEditMode, saveSlides, removeSlide } = useSlides();
  const totalSlides = slides.length;

  const [isFullscreen, setIsFullscreen] = useState(false);
  const [fsCurrentSlide, setFsCurrentSlide] = useState(1);
  
  const fsCurrentSlideRef = useRef(fsCurrentSlide);
  useEffect(() => {
    fsCurrentSlideRef.current = fsCurrentSlide;
  }, [fsCurrentSlide]);

  const toggleFullscreen = () => {
    if (!isFullscreen) {
      setFsCurrentSlide(currentSlide);
      setIsFullscreen(true);
      document.documentElement.requestFullscreen().catch(err => {
        console.error("Error attempting to enable fullscreen:", err);
      });
    } else {
      setIsFullscreen(false);
      setCurrentSlide(fsCurrentSlideRef.current);
      if (containerRef.current) {
        const targetScroll = (fsCurrentSlideRef.current - 1) * containerRef.current.clientHeight;
        containerRef.current.scrollTo({ top: targetScroll, behavior: 'auto' });
      }
      if (document.fullscreenElement) {
        document.exitFullscreen();
      }
    }
  };

  useEffect(() => {
    const handleKeyDown = (e) => {
      if (!isFullscreen) return;
      if (e.key === 'ArrowRight' || e.key === 'ArrowDown') {
        if (fsCurrentSlide < totalSlides) {
          setFsCurrentSlide(prev => prev + 1);
        } else {
          toggleFullscreen();
        }
      } else if (e.key === 'ArrowLeft' || e.key === 'ArrowUp') {
        if (fsCurrentSlide > 1) {
          setFsCurrentSlide(prev => prev - 1);
        }
      } else if (e.key === 'Escape') {
        if (isFullscreen) {
           setIsFullscreen(false);
           setCurrentSlide(fsCurrentSlideRef.current);
           if (containerRef.current) {
             const targetScroll = (fsCurrentSlideRef.current - 1) * containerRef.current.clientHeight;
             containerRef.current.scrollTo({ top: targetScroll, behavior: 'auto' });
           }
        }
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isFullscreen, fsCurrentSlide, totalSlides]);

  useEffect(() => {
    const handleFullscreenChange = () => {
      if (!document.fullscreenElement) {
        setIsFullscreen(false);
        setCurrentSlide(fsCurrentSlideRef.current);
        if (containerRef.current) {
          const targetScroll = (fsCurrentSlideRef.current - 1) * containerRef.current.clientHeight;
          containerRef.current.scrollTo({ top: targetScroll, behavior: 'auto' });
        }
      }
    };
    document.addEventListener('fullscreenchange', handleFullscreenChange);
    return () => document.removeEventListener('fullscreenchange', handleFullscreenChange);
  }, []);

  const processPptxBufferAndDownload = async (buffer, fileName) => {
    try {
      const zip = await JSZip.loadAsync(buffer);
      const slideFiles = Object.keys(zip.files).filter(name => name.startsWith('ppt/slides/slide') && name.endsWith('.xml'));

      for (const slideFile of slideFiles) {
        let xmlStr = await zip.file(slideFile).async("string");
        const parser = new DOMParser();
        const xmlDoc = parser.parseFromString(xmlStr, "application/xml");
        
        let modified = false;
        const pics = xmlDoc.getElementsByTagName("p:pic");
        
        for (let i = 0; i < pics.length; i++) {
          const pic = pics[i];
          const videoFile = pic.getElementsByTagName("a:videoFile")[0];
          if (videoFile) {
            const ext = pic.getElementsByTagName("a:ext")[0];
            if (ext) {
              const cx = parseInt(ext.getAttribute("cx") || "0", 10);
              const cy = parseInt(ext.getAttribute("cy") || "0", 10);
              if (cx > 0 && cy > 0) {
                const minDim = Math.min(cx, cy);
                const targetRadiusEmu = 228600;
                let adjValue = Math.round((targetRadiusEmu / minDim) * 100000);
                if (adjValue > 50000) adjValue = 50000;
                
                const prstGeom = pic.getElementsByTagName("a:prstGeom")[0];
                if (prstGeom) {
                  prstGeom.setAttribute("prst", "roundRect");
                  const existingAvLst = prstGeom.getElementsByTagName("a:avLst")[0];
                  if (existingAvLst) {
                    prstGeom.removeChild(existingAvLst);
                  }
                  
                  const aNs = prstGeom.namespaceURI || "http://schemas.openxmlformats.org/drawingml/2006/main";
                  const avLst = xmlDoc.createElementNS(aNs, "a:avLst");
                  const gd = xmlDoc.createElementNS(aNs, "a:gd");
                  gd.setAttribute("name", "adj");
                  gd.setAttribute("fmla", `val ${adjValue}`);
                  avLst.appendChild(gd);
                  prstGeom.appendChild(avLst);
                  modified = true;
                }
              }
            }
          }
        }
        
        if (modified) {
          const serializer = new XMLSerializer();
          const newXmlStr = serializer.serializeToString(xmlDoc);
          zip.file(slideFile, newXmlStr);
        }
      }

      const blob = await zip.generateAsync({ type: 'blob', mimeType: 'application/vnd.openxmlformats-officedocument.presentationml.presentation' });
      const url = URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = url;
      link.download = fileName;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      URL.revokeObjectURL(url);
    } catch (e) {
      console.error("Error modifying PPTX XML:", e);
      throw e;
    }
  };

  useEffect(() => {
    if (!containerRef.current) return;
    
    const observer = new IntersectionObserver(
      (entries) => {
        entries.forEach((entry) => {
          if (entry.isIntersecting) {
            const indexStr = entry.target.getAttribute('data-slide-index');
            if (indexStr !== null) {
              setCurrentSlide(parseInt(indexStr, 10) + 1);
            }
          }
        });
      },
      {
        root: containerRef.current,
        threshold: 0.5,
      }
    );

    const slideElements = containerRef.current.querySelectorAll('.slide-container-node');
    slideElements.forEach((el) => observer.observe(el));

    return () => observer.disconnect();
  }, [totalSlides]);

  const exportSingleImage = async () => {
    const wasEditing = isEditMode;
    if (wasEditing) setIsEditMode(false);
    
    setExportState(prev => ({ ...prev, single: 'loading' }));
    
    setTimeout(async () => {
      const dataUrl = await captureSlideHybrid(currentSlide, null);
      if (dataUrl) {
        const link = document.createElement('a');
        link.download = `slide-${currentSlide}.png`;
        link.href = dataUrl;
        link.click();
        setExportState(prev => ({ ...prev, single: 'success' }));
        setTimeout(() => setExportState(prev => ({ ...prev, single: 'idle' })), 2000);
      } else {
        setExportState(prev => ({ ...prev, single: 'idle' }));
      }
      if (wasEditing) setIsEditMode(true);
    }, 150);
  };

  const exportToPptx = async () => {
    const wasEditing = isEditMode;
    if (wasEditing) setIsEditMode(false);
    
    setExportState(prev => ({ ...prev, pptx: 'loading' }));
    
    setTimeout(async () => {
      try {
        const pptx = new pptxgen();
        pptx.layout = 'LAYOUT_16x9'; 

        for (let i = 1; i <= totalSlides; i++) {
          if (containerRef.current) {
             const targetScroll = (i - 1) * containerRef.current.clientHeight;
             const originalBehavior = containerRef.current.style.scrollBehavior;
             containerRef.current.style.scrollBehavior = 'auto'; // Disable smooth scroll for instant snap
             containerRef.current.scrollTop = targetScroll;
             await new Promise(r => setTimeout(r, 100)); 
             containerRef.current.style.scrollBehavior = originalBehavior;
          }
          await captureSlideHybrid(i, pptx);
        }
        
        const buffer = await pptx.write('arraybuffer');
        await processPptxBufferAndDownload(buffer, 'vivo_Competitiveness_Analysis.pptx');
        setExportState(prev => ({ ...prev, pptx: 'success' }));
      } catch (e) {
        console.error(e);
        alert('导出PPT失败，请检查控制台报错');
        setExportState(prev => ({ ...prev, pptx: 'idle' }));
      } finally {
        setTimeout(() => setExportState(prev => ({ ...prev, pptx: 'idle' })), 2000);
        if (wasEditing) setIsEditMode(true);
      }
    }, 150);
  };

  const exportCurrentPptx = async () => {
    const wasEditing = isEditMode;
    if (wasEditing) setIsEditMode(false);
    
    setExportState(prev => ({ ...prev, pptxSingle: 'loading' }));
    
    setTimeout(async () => {
      try {
        const pptx = new pptxgen();
        pptx.layout = 'LAYOUT_16x9'; 

        await captureSlideHybrid(currentSlide, pptx);
        
        const buffer = await pptx.write('arraybuffer');
        await processPptxBufferAndDownload(buffer, `Slide_${currentSlide}_Export.pptx`);
        setExportState(prev => ({ ...prev, pptxSingle: 'success' }));
      } catch (e) {
        console.error(e);
        alert('导出单页PPT失败，请检查控制台报错');
        setExportState(prev => ({ ...prev, pptxSingle: 'idle' }));
      } finally {
        setTimeout(() => setExportState(prev => ({ ...prev, pptxSingle: 'idle' })), 2000);
        if (wasEditing) setIsEditMode(true);
      }
    }, 150);
  };

  const renderSlideComponent = (slide, index) => {
    const props = { slideData: slide.data, slideId: slide.id };
    switch (slide.type) {
      case 'SlideCover': return <SlideCover {...props} />;
      case 'SlideTOC': return <SlideTOC {...props} />;
      case 'SlideBackground': return <SlideBackground {...props} />;
      case 'SlideAnalysisTarget': return <SlideAnalysisTarget {...props} />;
      case 'SlidePublicOpinion': return <SlidePublicOpinion {...props} />;
      case 'SlideSummary': return <SlideSummary {...props} />;
      case 'TemplateAreaAnalysisLeading': return <TemplateAreaAnalysisLeading {...props} />;
      case 'TemplateAreaAnalysisLagging': return <TemplateAreaAnalysisLagging {...props} />;
      default: return <div>Unknown Slide Type</div>;
    }
  };

  return (
    <div className="flex h-screen w-full bg-black overflow-hidden font-sans relative">
      
      {/* Control Panel (Floating Island Dark Mode) */}
      <div 
        className={`absolute right-6 top-6 bottom-6 bg-white/5 backdrop-blur-2xl shadow-2xl z-50 flex flex-col border border-white/10 rounded-3xl transition-all duration-500 ease-[cubic-bezier(0.16,1,0.3,1)] overflow-hidden ${isPanelExpanded ? 'w-[260px]' : 'w-[80px]'}`}
      >
        {/* Header / Toggle & Pagination (Height matches footer) */}
        <div className={`flex items-center p-0 border-b border-white/[0.05] shrink-0 h-[80px] transition-all duration-300 ${isPanelExpanded ? 'pl-8 justify-start' : 'justify-center'}`}>
          <div className="w-6 flex justify-center shrink-0">
            <button 
              onClick={() => setIsPanelExpanded(!isPanelExpanded)}
              className="w-5 h-5 flex items-center justify-center bg-transparent text-white/70 hover:text-white transition-all duration-300 cursor-pointer outline-none focus:outline-none"
              title={isPanelExpanded ? "收起面板" : "展开面板"}
            >
              <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeLinecap="round" strokeLinejoin="round" className="w-5 h-5 stroke-[1.5]">
                <circle cx="12" cy="12" r="10" />
                {isPanelExpanded ? <path d="m10 8 4 4-4 4" /> : <path d="m14 16-4-4 4-4" />}
              </svg>
            </button>
          </div>
          <div className={`ml-4 flex items-center gap-1 transition-opacity duration-300 whitespace-nowrap ${isPanelExpanded ? 'opacity-100' : 'opacity-0 hidden'}`}>
             <span className="text-base font-light text-blue-400">{currentSlide}</span>
             <span className="text-base font-light text-gray-500">/ {totalSlides}</span>
          </div>
        </div>

        <div className="flex flex-col flex-1 overflow-y-auto overflow-x-hidden custom-scrollbar">
          
          {/* Middle Operations (Vertically Centered) */}
          <div className="space-y-0 py-4 flex-1 flex flex-col items-center justify-center">
            
            {/* Play Button */}
            <button 
              onClick={toggleFullscreen}
              className={`w-full py-4 bg-transparent hover:bg-white/10 text-white/70 hover:text-white rounded-none font-light flex items-center transition-all duration-300 cursor-pointer outline-none focus:outline-none relative overflow-hidden group ${isPanelExpanded ? 'pl-8 pr-4 justify-start' : 'px-0 justify-center'}`}
              title="全屏演示"
            >
              <div className="absolute inset-0 bg-gradient-to-r from-blue-400/0 via-white/5 to-blue-400/0 -translate-x-[150%] group-hover:animate-[shimmer_2s_infinite]"></div>
              <div className="w-6 flex justify-center shrink-0 relative z-10">
                <MonitorPlay className="w-5 h-5 stroke-[1.5]" />
              </div>
              {isPanelExpanded && <span className="ml-4 relative z-10 tracking-wide text-sm font-light">全屏演示</span>}
            </button>

            {/* Dashed line */}
            <div className={`border-t border-dashed border-white/[0.08] my-0 transition-all duration-300 ${isPanelExpanded ? 'w-[calc(100%-4rem)]' : 'w-8'}`} />
            
            {/* Edit Button */}
            <button 
              onClick={async () => {
                if (isEditMode) {
                  await saveSlides();
                  setIsEditMode(false);
                } else {
                  setIsEditMode(true);
                }
              }}
              className={`w-full py-4 rounded-none font-light flex items-center transition-all duration-300 cursor-pointer outline-none focus:outline-none bg-transparent hover:bg-white/10 ${isEditMode ? 'text-amber-400 hover:text-amber-300' : 'text-white/70 hover:text-white'} ${isPanelExpanded ? 'pl-8 pr-4 justify-start' : 'px-0 justify-center'}`}
              title={isEditMode ? '保存退出' : '编辑文稿'}
            >
              <div className="w-6 flex justify-center shrink-0">
                {isEditMode ? <Save className="w-5 h-5 stroke-[1.5]" /> : <PenTool className="w-5 h-5 stroke-[1.5]" />}
              </div>
              {isPanelExpanded && <span className="ml-4 text-sm font-light">{isEditMode ? '保存退出' : '编辑文稿'}</span>}
            </button>


            {/* Dashed line */}
            <div className={`border-t border-dashed border-white/[0.08] my-0 transition-all duration-300 ${isPanelExpanded ? 'w-[calc(100%-4rem)]' : 'w-8'}`} />

            {/* Export Buttons */}
            <div className="w-full flex flex-col items-center">
                <button 
                onClick={exportSingleImage}
                disabled={exportState.single === 'loading'}
                className={`w-full py-4 bg-transparent hover:bg-white/10 text-white/70 rounded-none font-light flex items-center transition-all duration-300 cursor-pointer outline-none focus:outline-none hover:text-white disabled:opacity-50 disabled:cursor-not-allowed ${isPanelExpanded ? 'pl-8 pr-4 justify-start' : 'px-0 justify-center'}`}
                title="导出截图"
                >
                <div className="w-6 flex justify-center shrink-0">
                  {exportState.single === 'loading' ? <Loader2 className="w-5 h-5 animate-spin text-blue-400 stroke-[1.5]" /> : 
                  exportState.single === 'success' ? <Check className="w-5 h-5 text-emerald-400 stroke-[1.5]" /> : <ImageIcon className="w-5 h-5 stroke-[1.5]" />}
                </div>
                {isPanelExpanded && <span className="ml-4 text-sm font-light">{exportState.single === 'loading' ? '导出中...' : exportState.single === 'success' ? '成功' : '导出截图'}</span>}
                </button>

                {/* Dashed line */}
                <div className={`border-t border-dashed border-white/[0.08] my-0 transition-all duration-300 ${isPanelExpanded ? 'w-[calc(100%-4rem)]' : 'w-8'}`} />

                <button 
                onClick={exportCurrentPptx}
                disabled={exportState.pptxSingle === 'loading'}
                className={`w-full py-4 bg-transparent hover:bg-white/10 text-white/70 rounded-none font-light flex items-center transition-all duration-300 cursor-pointer outline-none focus:outline-none hover:text-white disabled:opacity-50 disabled:cursor-not-allowed ${isPanelExpanded ? 'pl-8 pr-4 justify-start' : 'px-0 justify-center'}`}
                title="导出本页"
                >
                <div className="w-6 flex justify-center shrink-0">
                  {exportState.pptxSingle === 'loading' ? <Loader2 className="w-5 h-5 animate-spin text-teal-400 stroke-[1.5]" /> : 
                  exportState.pptxSingle === 'success' ? <Check className="w-5 h-5 text-emerald-400 stroke-[1.5]" /> : <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeLinecap="round" strokeLinejoin="round" className="w-5 h-5 stroke-[1.5]"><path d="M2 3h20"/><rect x="3" y="3" width="18" height="14" rx="2"/><path d="M12 17v4"/><path d="M8 21h8"/><path d="M11 8.5L12 7.5V13"/></svg>}
                </div>
                {isPanelExpanded && <span className="ml-4 text-sm font-light">{exportState.pptxSingle === 'loading' ? '导出中...' : exportState.pptxSingle === 'success' ? '成功' : '导出本页'}</span>}
                </button>

                {/* Dashed line */}
                <div className={`border-t border-dashed border-white/[0.08] my-0 transition-all duration-300 ${isPanelExpanded ? 'w-[calc(100%-4rem)]' : 'w-8'}`} />

                <button 
                onClick={exportToPptx}
                disabled={exportState.pptx === 'loading'}
                className={`w-full py-4 bg-transparent hover:bg-white/10 text-white/70 rounded-none font-light flex items-center transition-all duration-300 cursor-pointer outline-none focus:outline-none hover:text-white disabled:opacity-50 disabled:cursor-not-allowed ${isPanelExpanded ? 'pl-8 pr-4 justify-start' : 'px-0 justify-center'}`}
                title="导出全部"
                >
                <div className="w-6 flex justify-center shrink-0">
                  {exportState.pptx === 'loading' ? <Loader2 className="w-5 h-5 animate-spin text-indigo-400 stroke-[1.5]" /> : 
                  exportState.pptx === 'success' ? <Check className="w-5 h-5 text-emerald-400 stroke-[1.5]" /> : <PptIcon className="w-5 h-5 stroke-[1.5]" />}
                </div>
                {isPanelExpanded && <span className="ml-4 text-sm font-light">{exportState.pptx === 'loading' ? '导出中...' : exportState.pptx === 'success' ? '成功' : '导出全部'}</span>}
                </button>
            </div>
            
            {exportState.pptx === 'loading' && isPanelExpanded && (
              <p className="text-[11px] text-gray-400 font-light text-center mt-2 animate-pulse">
                正在打包导出，请勿刷新页面
              </p>
            )}
          </div>

          {/* Footer (Matches Header Height: h-[80px]) */}
          <div className="flex flex-col items-center justify-center shrink-0 h-[80px] bg-transparent border-t border-white/[0.05] text-xs text-gray-500">
              <ChevronsDown className={`w-4 h-4 animate-bounce text-gray-500 ${isPanelExpanded ? 'mb-1' : ''}`} />
              <p className={`font-light tracking-wide transition-opacity duration-300 ${isPanelExpanded ? 'opacity-100' : 'opacity-0 hidden'}`}>向下滚动页面浏览</p>
              {isEditMode && <p className={`font-light text-amber-500/80 mt-1 transition-opacity duration-300 ${isPanelExpanded ? 'opacity-100' : 'opacity-0 hidden'}`}>双击文字进入修改模式</p>}
          </div>
        </div>
      </div>

      {/* Main Slides Container */}
      <div 
        ref={containerRef}
        className="h-screen overflow-y-auto snap-y snap-mandatory transition-all duration-500 ease-[cubic-bezier(0.16,1,0.3,1)] px-[24px] lg:px-[32px] hide-scrollbar"
        style={{ 
          width: isPanelExpanded ? 'calc(100vw - 284px)' : 'calc(100vw - 104px)',
          scrollBehavior: 'smooth' 
        }}
      >
        <div className="w-full space-y-[24px] py-[24px]">
          {slides.map((slide, index) => (
            <SlideWrapper key={slide.id} index={index} slideId={slide.id}>
              {renderSlideComponent(slide, index)}
            </SlideWrapper>
          ))}
        </div>
      </div>

      {/* Fullscreen Overlay */}
      {isFullscreen && (
        <div 
          className="fixed inset-0 z-[100] bg-black flex items-center justify-center select-none overflow-hidden"
          onClick={() => {
            if (fsCurrentSlide < totalSlides) {
              setFsCurrentSlide(prev => prev + 1);
            } else {
              toggleFullscreen();
            }
          }}
        >
           {/* Render the current slide. SlideCanvas naturally scales it to fit the parent. */}
           <div 
             className="w-full h-full block"
             onClick={(e) => { 
                e.stopPropagation(); 
                if (fsCurrentSlide < totalSlides) setFsCurrentSlide(p => p + 1);
                else toggleFullscreen();
             }} 
           >
              {slides[fsCurrentSlide - 1] && renderSlideComponent(slides[fsCurrentSlide - 1], fsCurrentSlide - 1)}
           </div>
           
           <div className="absolute bottom-8 left-0 right-0 flex justify-center pointer-events-none opacity-40 z-[101]">
              <span className="text-white text-sm font-bold tracking-widest">{fsCurrentSlide} / {totalSlides}</span>
           </div>
        </div>
      )}

    </div>
  );
};

const App = () => {
  return (
    <SlideProvider>
      <AppContent />
    </SlideProvider>
  );
};

export default App;
