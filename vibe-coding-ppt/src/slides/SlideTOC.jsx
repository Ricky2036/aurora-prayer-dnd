import React from 'react';
import SlideCanvas from '../components/SlideCanvas';
import EditableText from '../components/EditableText';
import { useSlides } from '../context/SlideContext';

const SlideTOC = ({ slideData, slideId }) => {
  const { updateSlideData } = useSlides();

  const handleUpdateToc = (index, value) => {
    updateSlideData(slideId, (prev) => {
      const newToc = [...prev.toc];
      newToc[index] = { ...newToc[index], title: value };
      return { ...prev, toc: newToc };
    });
  };

  const handleUpdateHeader = (field, value) => {
    updateSlideData(slideId, (prev) => ({
      ...prev,
      header: { ...prev.header, [field]: value }
    }));
  };

  return (
    <SlideCanvas id={slideId}>
      <div className="w-full h-full flex pptx-layer">
        
        {/* Left Side: Soft Title Area (50% width) */}
        <div className="w-[50%] h-full bg-gradient-to-br from-indigo-50 via-purple-50 to-blue-50 flex flex-col items-center justify-center relative overflow-hidden pptx-layer shrink-0">
          {/* Soft decorative background elements */}
          <div className="absolute top-0 left-0 w-full h-full bg-[url('https://www.transparenttextures.com/patterns/cubes.png')] opacity-[0.03]"></div>
          <div className="absolute -top-[200px] -left-[200px] w-[600px] h-[600px] bg-purple-400/10 rounded-full blur-[80px]"></div>
          <div className="absolute -bottom-[200px] -right-[200px] w-[600px] h-[600px] bg-blue-400/10 rounded-full blur-[80px]"></div>
          
          <EditableText 
            tagName="h2"
            value={slideData.header?.title || "目 录"}
            onChange={(val) => handleUpdateHeader('title', val)}
            className="pptx-text text-[110px] font-black text-indigo-950 tracking-[0.2em] relative z-10 drop-shadow-sm"
          />
          <EditableText 
            tagName="h3"
            value={slideData.header?.subtitle || "Contents"}
            onChange={(val) => handleUpdateHeader('subtitle', val)}
            className="pptx-text text-[36px] font-bold text-indigo-300 mt-[24px] tracking-[0.3em] uppercase relative z-10"
          />
        </div>
        
        {/* Right Side: Light Theme List Area (45% width) */}
        <div className="flex-1 h-full bg-white flex flex-col justify-center items-center pptx-layer relative border-l border-gray-100">
          <div className="flex flex-col pptx-layer relative z-10 w-fit max-w-[90%]" style={{ gap: slideData.toc.length > 5 ? '32px' : slideData.toc.length > 4 ? '48px' : '72px' }}>
            
            {slideData.toc.slice(0, 8).map((item, index) => {
              const colors = ['text-purple-400', 'text-purple-500', 'text-blue-500', 'text-blue-400'];
              const colorClass = colors[index % colors.length];
              const textSize = slideData.toc.length > 5 ? 'text-[40px]' : slideData.toc.length > 4 ? 'text-[48px]' : 'text-[56px]';
              const numSize = slideData.toc.length > 5 ? 'text-[48px]' : slideData.toc.length > 4 ? 'text-[56px]' : 'text-[64px]';
              
              return (
                <div key={index} className="flex items-center gap-[48px] pptx-layer">
                  <span className={`pptx-text ${numSize} font-black ${colorClass} italic w-[80px] text-right shrink-0`}>
                    {String(index + 1).padStart(2, '0')}
                  </span>
                  <EditableText 
                    value={item.title}
                    onChange={(val) => handleUpdateToc(index, val)}
                    className={`pptx-text ${textSize} font-bold text-gray-800 tracking-wide whitespace-nowrap`}
                  />
                </div>
              );
            })}
            
          </div>
        </div>

      </div>
    </SlideCanvas>
  );
};

export default SlideTOC;
