import React from 'react';
import SlideCanvas from '../components/SlideCanvas';
import SlideHeader from '../components/SlideHeader';
import EditableText from '../components/EditableText';
import DynamicIcon from '../components/DynamicIcon';
import { useSlides } from '../context/SlideContext';

const SlidePublicOpinion = ({ slideData, slideId }) => {
  const { updateSlideData } = useSlides();
  const defaultIcons = ["MessageSquareHeart", "MessageSquareWarning", "Lightbulb"];
  const colors = ["text-green-500", "text-red-500", "text-blue-500"];
  const bgColors = ["bg-green-50/50", "bg-red-50/50", "bg-blue-50/50"];

  const handleUpdateOpinion = (index, field, value) => {
    updateSlideData(slideId, (prev) => {
      const newOpinions = [...prev.overallOpinions];
      newOpinions[index] = { ...newOpinions[index], [field]: value };
      return { ...prev, overallOpinions: newOpinions };
    });
  };

  const handleUpdateSummary = (value) => {
    updateSlideData(slideId, (prev) => ({
      ...prev,
      summaryHtml: value
    }));
  };

  const handleUpdateHeader = (field, value) => {
    updateSlideData(slideId, (prev) => ({
      ...prev,
      header: { ...prev.header, [field]: value }
    }));
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
        
        <div className="flex-1 mt-[20px] flex flex-col justify-start items-center min-h-0">
          <div className="w-full grid grid-cols-3 gap-[48px] flex-1 min-h-0">
            {slideData.overallOpinions.map((opinion, idx) => {
              const iconName = opinion.icon || defaultIcons[idx % defaultIcons.length];
              return (
                <div key={idx} className={`p-[48px] rounded-[40px] bg-white border border-gray-100 flex flex-col shadow-[0_16px_40px_-12px_rgba(0,0,0,0.08)] relative overflow-hidden pptx-layer h-full`}>
                  <div className={`p-[12px] rounded-[20px] w-[64px] h-[64px] flex items-center justify-center mb-[32px] ${bgColors[idx % bgColors.length]} ${colors[idx % colors.length]} shrink-0 pptx-layer`}>
                    <DynamicIcon name={iconName} className="w-[40px] h-[40px] inline-block" />
                  </div>
                  <EditableText 
                    tagName="h3"
                    value={opinion.title}
                    onChange={(val) => handleUpdateOpinion(idx, 'title', val)}
                    className="pptx-text text-[40px] font-black text-gray-800 mb-[24px] shrink-0 leading-tight"
                  />
                  <div className="flex-1 min-h-0 bg-gray-50/50 p-[32px] rounded-[24px] overflow-hidden pptx-layer">
                    <EditableText 
                      tagName="p"
                      value={opinion.desc}
                      onChange={(val) => handleUpdateOpinion(idx, 'desc', val)}
                      className="pptx-text text-[28px] text-gray-600 leading-relaxed"
                    />
                  </div>
                </div>
              );
            })}
          </div>
          
          <div className="mt-[48px] bg-gray-900 text-white p-[48px] rounded-[32px] w-full shadow-[0_20px_50px_-12px_rgba(0,0,0,0.3)] pptx-layer shrink-0">
            <EditableText 
              tagName="p"
              allowHtml={true}
              value={slideData.summaryHtml}
              onChange={(val) => handleUpdateSummary(val)}
              className="pptx-text text-[32px] font-light leading-relaxed text-center"
            />
          </div>
        </div>
      </div>
    </SlideCanvas>
  );
};

export default SlidePublicOpinion;
