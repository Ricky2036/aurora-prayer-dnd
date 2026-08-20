import React from 'react';
import SlideCanvas from '../components/SlideCanvas';
import SlideHeader from '../components/SlideHeader';
import EditableText from '../components/EditableText';
import DynamicIcon from '../components/DynamicIcon';
import MediaRenderer from '../components/MediaRenderer';
import { useSlides } from '../context/SlideContext';

const TemplateAreaAnalysisLeading = ({ slideData, slideId }) => {
  const getFlexRatios = (mediaList) => {
    if (!mediaList || mediaList.length === 0) return { mediaFlex: 1, textFlex: 1 };
    if (mediaList.length === 1 && mediaList[0].type === 'component') return { mediaFlex: 2, textFlex: 1 };
    return { mediaFlex: 1, textFlex: 1 };
  };
  const { updateSlideData } = useSlides();
  const { area, index, global } = slideData;
  const { name, leading } = area;
  const areaNumber = (index + 1).toString().padStart(2, '0');

  const handleUpdateLeading = (idx, field, value) => {
    updateSlideData(slideId, (prev) => {
      const newLeading = [...(prev.area.leading || [])];
      newLeading[idx] = { ...newLeading[idx], [field]: value };
      return {
        ...prev,
        area: { ...prev.area, leading: newLeading }
      };
    });
  };

  const handleUpdateName = (value) => {
    updateSlideData(slideId, (prev) => ({
      ...prev,
      area: { ...prev.area, name: value }
    }));
  };

  const handleUpdateLabels = (field, value) => {
    updateSlideData(slideId, (prev) => ({
      ...prev,
      labels: { ...prev.labels, [field]: value }
    }));
  };

  const handleUpdateMediaCaption = (mediaIndex, newCaption) => {
    updateSlideData(slideId, (prev) => {
      const newMedia = [...(prev.style?.leadingMedia || [])];
      if (newMedia[mediaIndex]) {
        newMedia[mediaIndex] = { ...newMedia[mediaIndex], caption: newCaption };
      }
      return {
        ...prev,
        style: { ...prev.style, leadingMedia: newMedia }
      };
    });
  };

  const handleUpdateMediaUrl = (mediaIndex, newUrl, w, h, type) => {
    updateSlideData(slideId, (prev) => {
      const newMedia = [...(prev.style?.leadingMedia || [])];
      
      if (Array.isArray(newUrl)) {
        newMedia.splice(mediaIndex, 1, ...newUrl);
      } else {
        if (newMedia[mediaIndex]) {
          newMedia[mediaIndex] = { ...newMedia[mediaIndex], url: newUrl };
          if (w && h) {
            newMedia[mediaIndex].w = w;
            newMedia[mediaIndex].h = h;
          }
          if (type) {
            newMedia[mediaIndex].type = type;
          }
        }
      }
      
      return {
        ...prev,
        style: { ...prev.style, leadingMedia: newMedia }
      };
    }, true);
  };

  const { mediaFlex, textFlex } = getFlexRatios(slideData.style?.leadingMedia);
  return (
    <SlideCanvas id={slideId}>
      <div className="w-full h-full pt-[80px] px-[60px] pb-[80px] relative z-10 flex flex-col box-border">
        <SlideHeader 
          title={slideData.labels?.headerTitle || `${areaNumber} ${name}`}
          subtitle={slideData.labels?.headerSubtitle || "Details"}
          onChangeTitle={(val) => handleUpdateLabels('headerTitle', val)}
          onChangeSubtitle={(val) => handleUpdateLabels('headerSubtitle', val)}
        />
        
        <div className="flex-1 mt-[20px] flex gap-[32px] min-h-0">
          <div 
            className="min-w-0 flex min-h-0 justify-center items-stretch"
            style={{ flex: mediaFlex }}
          >
            <MediaRenderer 
                mediaList={slideData.style?.leadingMedia}
                defaultIcon={slideData.style?.leadingIcon}
                placeholderLabel={slideData.labels?.visualPlaceholder}
                onUpdateLabel={(val) => handleUpdateLabels('visualPlaceholder', val)}
                onUpdateMediaCaption={handleUpdateMediaCaption}
                onUpdateMediaUrl={handleUpdateMediaUrl}
              />
          </div>
          
          <div className="flex flex-col gap-[32px] min-h-0 min-w-0 justify-center" style={{ flex: textFlex }}>
            {leading && leading.length > 0 ? leading.map((item, idx) => (
               <div key={idx} className="flex flex-col gap-[12px]">
                 <div className="flex items-center gap-[16px]">
                   <svg viewBox="0 0 24 24" width="28" height="28" className="shrink-0 pptx-layer text-blue-500" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                     <circle cx="12" cy="12" r="10"/>
                     <circle cx="8.5" cy="9.5" r="1" fill="currentColor" stroke="none"/>
                     <circle cx="15.5" cy="9.5" r="1" fill="currentColor" stroke="none"/>
                     <path d="M8.5 14.5s1.5 2 3.5 2 3.5-2 3.5-2"/>
                   </svg>
                   <EditableText 
                     tagName="h4"
                     value={item.title}
                     onChange={(val) => handleUpdateLeading(idx, 'title', val)}
                     className="pptx-text text-[28px] font-bold text-gray-800 leading-tight"
                   />
                 </div>
                  <div className="flex items-start mt-[4px]">
                    <EditableText 
                      tagName="p"
                      value={item.desc || ""}
                      onChange={(val) => handleUpdateLeading(idx, 'desc', val)}
                      className="pptx-text text-[20px] text-gray-600 leading-relaxed break-words whitespace-pre-wrap flex-1 ml-[44px]"
                    />
                  </div>
               </div>
            )) : (
              <div className="flex items-center justify-center text-gray-400 text-[28px] font-medium h-full">
                <EditableText 
                  tagName="span"
                  value={slideData.labels?.noFeatures || "暂无内容"}
                  onChange={(val) => handleUpdateLabels('noFeatures', val)}
                  className="pptx-text"
                />
              </div>
            )}
          </div>
        </div>
      </div>
    </SlideCanvas>
  );
};

export default TemplateAreaAnalysisLeading;
