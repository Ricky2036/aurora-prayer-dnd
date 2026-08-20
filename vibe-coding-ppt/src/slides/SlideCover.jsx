import React from 'react';
import SlideCanvas from '../components/SlideCanvas';
import EditableText from '../components/EditableText';
import { useSlides } from '../context/SlideContext';

const SlideCover = ({ slideData, slideId }) => {
  const { updateSlideData } = useSlides();

  const handleUpdateGlobal = (key, value) => {
    updateSlideData(slideId, (prev) => ({
      ...prev,
      global: { ...prev.global, [key]: value }
    }));
  };


  const titleLength = slideData.global.title?.length || 0;
  const titleFontSize = titleLength > 20 ? 'text-[72px]' : titleLength > 12 ? 'text-[84px]' : 'text-[100px]';

  return (
    <SlideCanvas id={slideId}>
      <div 
        className={`absolute inset-0 ${slideData.style?.backgroundClass || 'bg-gradient-to-br from-[#c3dafe] via-[#e5e4ff] to-[#ead6ff]'} z-0`}
        style={slideData.style?.backgroundImage ? { backgroundImage: `url(${slideData.style.backgroundImage})`, backgroundSize: 'cover' } : {}}
      ></div>

      <div className="absolute top-[80px] right-[100px] z-10 flex justify-end pptx-layer text-right">
        <div className="pptx-text text-[64px] font-black text-gray-800 tracking-tighter leading-none z-10 text-right">
          TRANSSION
        </div>
      </div>

      <div className="w-full h-full relative z-10 flex flex-col justify-center items-start pl-[160px] pb-[80px]">
        <EditableText 
          value={slideData.global.title}
          onChange={(val) => handleUpdateGlobal('title', val)}
          tagName="h1"
          className={`pptx-text ${titleFontSize} font-black text-black leading-tight tracking-tighter mb-12 max-w-[1400px] pr-[200px] break-keep`}
        />



        <div className="text-[32px] text-gray-700 font-medium mt-12">
          <EditableText 
            tagName="div"
            allowHtml={true}
            value={slideData.global.coverSubtitlesHtml || `<p>目标市场: ${slideData.global.targetMarket}</p><p>对标版本: ${slideData.global.targetVersion}</p>`}
            onChange={(val) => handleUpdateGlobal('coverSubtitlesHtml', val)}
            className="pptx-text space-y-4"
          />
        </div>
      </div>

      <div className="absolute bottom-[200px] left-0 w-[15%] h-[40px] z-10 pptx-layer" style={{ backgroundColor: slideData.style?.accentColor || '#6F42E5' }}></div>
      <div className="absolute bottom-[240px] left-[15%] w-[35%] h-[40px] z-10 pptx-layer" style={{ backgroundColor: slideData.style?.accentColor || '#6F42E5' }}></div>
      <div className="absolute bottom-[280px] left-[50%] w-[50%] h-[40px] z-10 pptx-layer" style={{ backgroundColor: slideData.style?.accentColor || '#6F42E5' }}></div>

      <div className="absolute bottom-[220px] right-[100px] z-10 text-right">
        <div 
          className="pptx-text text-[40px] font-bold tracking-wide text-right"
          style={{ color: slideData.style?.accentColor || '#6F42E5' }}
        >
          Together we can
        </div>
      </div>

      <div className="absolute bottom-[40px] left-1/2 -translate-x-1/2 text-gray-400 text-[18px] tracking-widest z-10 flex items-center gap-2 pptx-text">
        内部公开 Copyright © TRANSSION HOLDINGS
      </div>
    </SlideCanvas>
  );
};

export default SlideCover;
