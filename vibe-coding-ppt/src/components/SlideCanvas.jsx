import React, { useState, useEffect, useRef } from 'react';
import { useSlides } from '../context/SlideContext';
import { Copy, Trash2 } from 'lucide-react';

const SlideCanvas = ({ id, children }) => {
  const [scale, setScale] = useState(1);
  const [isMounted, setIsMounted] = useState(false);
  const wrapperRef = useRef(null);
  
  const { isEditMode, duplicateSlide, removeSlide, slides } = useSlides();
  const slideIndex = slides.findIndex(s => s.id === id);

  useEffect(() => {
    const updateScale = () => {
      if (wrapperRef.current) {
        const w = wrapperRef.current.clientWidth;
        const h = wrapperRef.current.clientHeight;
        setScale(Math.min(w / 1920, h / 1080));
        setIsMounted(true);
      }
    };
    
    updateScale();

    const resizeObserver = new ResizeObserver(() => {
      // Use requestAnimationFrame to avoid ResizeObserver loop limit exceeded errors during transitions
      window.requestAnimationFrame(() => {
        updateScale();
      });
    });

    if (wrapperRef.current) {
      resizeObserver.observe(wrapperRef.current);
    }

    return () => {
      resizeObserver.disconnect();
    };
  }, []);

  return (
    <div 
      className="w-full h-screen snap-center shrink-0 flex items-center justify-center overflow-hidden bg-transparent"
      ref={wrapperRef}
    >
      <div className="relative" style={{ width: 1920 * scale, height: 1080 * scale }}>
        <div 
          id={id}
          style={{ 
            width: 1920, 
            height: 1080, 
            transform: `scale(${scale})`, 
            transformOrigin: 'top left',
            position: 'absolute',
            top: 0,
            left: 0
          }}
        className={`export-slide relative bg-[#F8F9FF] flex flex-col shrink-0 overflow-hidden text-gray-800 shadow-[0_20px_50px_-12px_rgba(0,0,0,0.3)] transition-all duration-500 ease-[cubic-bezier(0.16,1,0.3,1)] ${isMounted ? 'opacity-100' : 'opacity-0'}`}
      >
        <div className="absolute top-0 right-0 w-[1400px] h-[1400px] translate-x-[300px] -translate-y-[400px] pointer-events-none" style={{ background: 'radial-gradient(50% 50% at 50% 50%, rgba(233,213,255,0.5) 0%, rgba(248,249,255,0) 100%)' }}></div>
        <div className="absolute bottom-0 left-0 w-[1400px] h-[1400px] -translate-x-[300px] translate-y-[400px] pointer-events-none" style={{ background: 'radial-gradient(50% 50% at 50% 50%, rgba(191,219,254,0.6) 0%, rgba(248,249,255,0) 100%)' }}></div>
        
        {children}
        </div>
        
        {/* Floating Toolbar in Edit Mode (Positioned relative to scaled slide) */}
        {isEditMode && slideIndex !== -1 && (
          <div className="absolute right-0 flex flex-row items-center gap-4 transition-opacity z-50 bg-black/40 backdrop-blur-xl border border-white/20 rounded-xl px-4 py-2 shadow-2xl" style={{ top: "max(-3.5rem, calc(50% - 50vh + 1rem))" }}>
            <button
              onClick={() => duplicateSlide(slideIndex)}
              className="text-white/70 hover:text-white transition-colors cursor-pointer outline-none focus:outline-none flex items-center justify-center"
              title="复制此页"
            >
              <Copy className="w-[18px] h-[18px] stroke-[1.5]" />
            </button>
            
            <div className="w-px h-[16px] border-r border-dashed border-white/30"></div>

            <button
              onClick={() => {
                if (confirm('确定要删除此页吗？')) {
                  removeSlide(slideIndex);
                }
              }}
              className="text-white/70 hover:text-red-400 transition-colors cursor-pointer outline-none focus:outline-none flex items-center justify-center"
              title="删除此页"
            >
              <Trash2 className="w-[18px] h-[18px] stroke-[1.5]" />
            </button>
          </div>
        )}
      </div>
    </div>
  );
};

export default SlideCanvas;
