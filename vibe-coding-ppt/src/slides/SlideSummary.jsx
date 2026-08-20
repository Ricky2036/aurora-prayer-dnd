import React from 'react';
import SlideCanvas from '../components/SlideCanvas';
import SlideHeader from '../components/SlideHeader';
import EditableText from '../components/EditableText';
import DynamicIcon from '../components/DynamicIcon';
import { useSlides } from '../context/SlideContext';

const SlideSummary = ({ slideData, slideId }) => {
  const { updateSlideData } = useSlides();

  // Fallback for old structure vs new paragraphs/keyPoints structure
  const isOldStructure = typeof slideData.summary?.overall === 'string';
  const paragraphs = isOldStructure 
    ? [slideData.summary.overall] 
    : (slideData.summary?.paragraphs || []);
  const keyPoints = isOldStructure 
    ? [{ title: "关键行动", desc: slideData.summary.action }] 
    : (slideData.summary?.keyPoints || []);

  const handleUpdateHeader = (field, value) => {
    updateSlideData(slideId, (prev) => ({
      ...prev,
      header: { ...prev.header, [field]: value }
    }));
  };

  const handleUpdateLabels = (field, value) => {
    updateSlideData(slideId, (prev) => ({
      ...prev,
      labels: { ...prev.labels, [field]: value }
    }));
  };

  const handleUpdateParagraph = (index, field, value) => {
    if (isOldStructure) {
      updateSlideData(slideId, (prev) => ({
        ...prev, summary: { ...prev.summary, overall: value }
      }));
      return;
    }
    updateSlideData(slideId, (prev) => {
      const newParas = [...(prev.summary.paragraphs || [])];
      if (field) {
        newParas[index] = { ...newParas[index], [field]: value };
      } else {
        newParas[index] = value;
      }
      return { ...prev, summary: { ...prev.summary, paragraphs: newParas } };
    });
  };

  const handleUpdateKeyPoint = (index, field, value) => {
    if (isOldStructure) {
      updateSlideData(slideId, (prev) => ({
        ...prev, summary: { ...prev.summary, action: value }
      }));
      return;
    }
    updateSlideData(slideId, (prev) => {
      const newPoints = [...(prev.summary.keyPoints || [])];
      newPoints[index] = { ...newPoints[index], [field]: value };
      return { ...prev, summary: { ...prev.summary, keyPoints: newPoints } };
    });
  };

  return (
    <SlideCanvas id={slideId}>
      <div className="w-full h-full pt-[100px] px-[120px] pb-[120px] relative z-10 flex flex-col box-border">
        <SlideHeader 
          title={slideData.header?.title} 
          subtitle={slideData.header?.subtitle} 
          onChangeTitle={(val) => handleUpdateHeader('title', val)}
          onChangeSubtitle={(val) => handleUpdateHeader('subtitle', val)}
        />
        
        <div className="flex-1 mt-[40px] flex flex-col justify-start pptx-layer min-h-0">
          <div className="w-full h-full flex flex-row gap-[48px] pptx-layer">
            
            <div className="bg-violet-50/60 p-[64px] rounded-[48px] shadow-[0_16px_40px_-12px_rgba(0,0,0,0.05)] border border-violet-100 relative overflow-hidden pptx-layer flex-1 min-h-0 flex flex-col justify-start">
              <div className="absolute -left-[100px] -top-[100px] w-[400px] h-[400px] bg-violet-400/5 rounded-full blur-[80px]"></div>
              
              <div className="p-[16px] rounded-[24px] w-[80px] h-[80px] flex items-center justify-center mb-[32px] bg-purple-100 text-purple-600 shrink-0 pptx-layer relative z-10">
                <DynamicIcon name="Lightbulb" className="w-[48px] h-[48px] inline-block" />
              </div>
              <EditableText 
                tagName="h3"
                value={slideData.labels?.conclusion || "核心结论"}
                onChange={(val) => handleUpdateLabels('conclusion', val)}
                className="pptx-text text-[32px] font-black tracking-wider text-purple-600 mb-[40px] shrink-0 relative z-10"
              />
              <div className="flex flex-col gap-[32px] pptx-layer overflow-hidden relative z-10">
                {paragraphs.map((p, i) => (
                  <div key={i} className="flex gap-[24px] items-start pptx-layer">
                    <div className="w-[12px] h-[12px] bg-purple-500 rounded-sm mt-[14px] shrink-0 rotate-45 shadow-[0_0_12px_rgba(168,85,247,0.4)]"></div>
                    <div className="flex flex-col gap-[8px] pptx-layer w-full">
                      {typeof p === 'object' && p.title && (
                        <EditableText 
                          tagName="h4"
                          value={p.title}
                          onChange={(val) => handleUpdateParagraph(i, 'title', val)}
                          className="pptx-text text-[26px] font-bold text-gray-900 tracking-wide"
                        />
                      )}
                      <EditableText 
                        tagName="p"
                        value={typeof p === 'object' ? p.desc : p}
                        onChange={(val) => handleUpdateParagraph(i, typeof p === 'object' ? 'desc' : null, val)}
                        className="pptx-text text-[26px] leading-[1.6] text-gray-700 font-normal"
                      />
                    </div>
                  </div>
                ))}
              </div>
            </div>

            <div className="bg-gradient-to-br from-blue-50 to-indigo-50 p-[64px] rounded-[48px] shadow-[0_16px_40px_-12px_rgba(0,0,0,0.05)] border border-blue-100 relative overflow-hidden pptx-layer flex-1 min-h-0 flex flex-col justify-start">
              <div className="absolute -right-[100px] -top-[100px] w-[400px] h-[400px] bg-blue-400/5 rounded-full blur-[80px]"></div>
              
              <div className="p-[16px] rounded-[24px] w-[80px] h-[80px] flex items-center justify-center mb-[32px] bg-blue-100 text-blue-500 shrink-0 pptx-layer relative z-10">
                <DynamicIcon name="Target" className="w-[48px] h-[48px] inline-block" />
              </div>
              <EditableText 
                tagName="h3"
                value={slideData.labels?.actionPlan || "关键行动"}
                onChange={(val) => handleUpdateLabels('actionPlan', val)}
                className="pptx-text text-[32px] font-black tracking-wider text-blue-600 mb-[40px] shrink-0 relative z-10"
              />
              
              <div className="flex flex-col gap-[32px] relative z-10 overflow-hidden pptx-layer">
                {keyPoints.map((kp, i) => (
                  <div key={i} className="flex gap-[24px] items-start pptx-layer">
                    <div className="w-[12px] h-[12px] bg-blue-500 rounded-full mt-[14px] shrink-0 shadow-[0_0_12px_rgba(59,130,246,0.4)]"></div>
                    <div className="flex flex-col gap-[8px] pptx-layer w-full">
                      <EditableText 
                        tagName="h4"
                        value={kp.title}
                        onChange={(val) => handleUpdateKeyPoint(i, 'title', val)}
                        className="pptx-text text-[26px] font-bold text-gray-900 tracking-wide"
                      />
                      <EditableText 
                        tagName="p"
                        value={kp.desc}
                        onChange={(val) => handleUpdateKeyPoint(i, 'desc', val)}
                        className="pptx-text text-[26px] leading-[1.6] text-gray-700 font-normal"
                      />
                    </div>
                  </div>
                ))}
              </div>
            </div>
            
          </div>
        </div>
      </div>
    </SlideCanvas>
  );
};

export default SlideSummary;
