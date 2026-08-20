import React from 'react';
import SlideCanvas from '../components/SlideCanvas';
import SlideHeader from '../components/SlideHeader';
import EditableText from '../components/EditableText';
import DynamicIcon from '../components/DynamicIcon';
import { useSlides } from '../context/SlideContext';

const SlideBackground = ({ slideData, slideId }) => {
  const { updateSlideData } = useSlides();

  const handleUpdateGlobal = (key, value) => {
    updateSlideData(slideId, (prev) => ({
      ...prev,
      global: { ...prev.global, [key]: value }
    }));
  };

  const handleUpdateBackground = (key, value) => {
    updateSlideData(slideId, (prev) => ({
      ...prev,
      background: { ...prev.background, [key]: value }
    }));
  };

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

  return (
    <SlideCanvas id={slideId}>
      <div className="w-full h-full pt-[100px] px-[120px] pb-[120px] relative z-10 flex flex-col box-border">
        <SlideHeader 
          title={slideData.header?.title} 
          subtitle={slideData.header?.subtitle} 
          onChangeTitle={(val) => handleUpdateHeader('title', val)}
          onChangeSubtitle={(val) => handleUpdateHeader('subtitle', val)}
        />
        
        <div className="flex-1 mt-[20px] flex gap-[64px] pptx-layer min-h-0">
          
          {/* Left: Core Metrics (Competitor & Market Share) */}
          <div className="w-[600px] flex flex-col shrink-0">
            <div className="flex-1 bg-gradient-to-br from-indigo-50 to-blue-50 rounded-[48px] p-[56px] shadow-[0_16px_40px_-12px_rgba(0,0,0,0.08)] flex flex-col justify-center relative overflow-hidden border border-indigo-100 pptx-layer">
               {/* Subtle modern light decorative elements */}
               <div className="absolute -top-[100px] -right-[100px] w-[300px] h-[300px] bg-purple-400/10 rounded-full blur-[60px]"></div>
               <div className="absolute -bottom-[100px] -left-[100px] w-[300px] h-[300px] bg-blue-400/10 rounded-full blur-[60px]"></div>

               <div className="pptx-layer relative z-10 space-y-[64px]">
                 <div>
                   <div className="flex items-center gap-[12px] mb-[16px]">
                     <DynamicIcon name={slideData.style?.targetIcon || "Smartphone"} className="w-[28px] h-[28px] text-blue-500 inline-block shrink-0 pptx-layer"/>
                     <EditableText 
                     tagName="span"
                     value={slideData.labels?.analysisTarget || "分析对象"}
                     onChange={(val) => handleUpdateLabels('analysisTarget', val)}
                     className="pptx-text leading-none text-[24px] text-indigo-400 font-bold tracking-widest uppercase"
                   />
                   </div>
                   <div className="text-[56px] font-black text-gray-800">
                     <EditableText 
                       value={slideData.global.targetVersion || "超级个体"}
                       onChange={(val) => handleUpdateGlobal('targetVersion', val)}
                       className="pptx-text"
                     />
                   </div>
                 </div>

                 <div className="w-full h-[2px] bg-gradient-to-r from-indigo-200 via-blue-200 to-transparent"></div>

                 <div>
                   <div className="flex items-center gap-[12px] mb-[16px]">
                     <DynamicIcon name={slideData.style?.shareIcon || "PieChart"} className="w-[28px] h-[28px] text-purple-500 inline-block shrink-0 pptx-layer"/>
                     <EditableText 
                     tagName="span"
                     value={slideData.labels?.marketShare || "市占率"}
                     onChange={(val) => handleUpdateLabels('marketShare', val)}
                     className="pptx-text leading-none text-[24px] text-indigo-400 font-bold tracking-widest uppercase"
                   />
                   </div>
                   <EditableText 
                     tagName="div"
                     value={slideData.global.marketShare || "25%+"}
                     onChange={(val) => handleUpdateGlobal('marketShare', val)}
                     className="text-[72px] font-black text-blue-600 pptx-text"
                   />
                 </div>
               </div>
            </div>
          </div>

          {/* Right: Background and Purpose Cards Vertically */}
          <div className="flex-1 flex flex-col gap-[40px] pptx-layer min-h-0">
            
            {/* Background Card */}
            <div className="flex-1 min-h-0 bg-white p-[40px] rounded-[48px] shadow-[0_16px_40px_-12px_rgba(0,0,0,0.08)] border border-gray-100 flex flex-col pptx-layer">
              <h3 className="text-[36px] font-black text-gray-800 flex items-center gap-[16px] mb-[24px] shrink-0">
                <DynamicIcon name={slideData.style?.bgIcon || "Flag"} className="w-[40px] h-[40px] text-purple-600 inline-block pptx-layer" />
                <EditableText 
                  tagName="span"
                  value={slideData.labels?.projectBg || "项目背景"}
                  onChange={(val) => handleUpdateLabels('projectBg', val)}
                  className="pptx-text leading-none"
                />
              </h3>
              <div className="flex-1 min-h-0 bg-gray-50/50 p-[32px] rounded-[24px] overflow-hidden flex items-center">
                <EditableText 
                  tagName="p"
                  value={slideData.background.bg}
                  onChange={(val) => handleUpdateBackground('bg', val)}
                  className="pptx-text text-[24px] text-gray-600 leading-relaxed font-medium break-words whitespace-pre-wrap"
                />
              </div>
            </div>

            {/* Purpose Card */}
            <div className="flex-1 min-h-0 bg-white p-[40px] rounded-[48px] shadow-[0_16px_40px_-12px_rgba(0,0,0,0.08)] border border-gray-100 flex flex-col pptx-layer">
               <h3 className="text-[36px] font-black text-gray-800 flex items-center gap-[16px] mb-[24px] shrink-0">
                <DynamicIcon name={slideData.style?.purposeIcon || "Target"} className="w-[40px] h-[40px] text-blue-600 inline-block pptx-layer" />
                <EditableText 
                  tagName="span"
                  value={slideData.labels?.analysisObj || "分析目的"}
                  onChange={(val) => handleUpdateLabels('analysisObj', val)}
                  className="pptx-text leading-none"
                />
              </h3>
              <div className="flex-1 min-h-0 bg-gray-50/50 p-[32px] rounded-[24px] overflow-hidden flex items-center">
                <EditableText 
                  tagName="p"
                  value={slideData.background.purpose}
                  onChange={(val) => handleUpdateBackground('purpose', val)}
                  className="pptx-text text-[24px] text-gray-600 leading-relaxed font-medium break-words whitespace-pre-wrap"
                />
              </div>
            </div>

          </div>

        </div>
      </div>
    </SlideCanvas>
  );
};

export default SlideBackground;
