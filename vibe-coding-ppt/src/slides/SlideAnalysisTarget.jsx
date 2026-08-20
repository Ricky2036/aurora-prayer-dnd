import React from 'react';
import SlideCanvas from '../components/SlideCanvas';
import SlideHeader from '../components/SlideHeader';
import EditableText from '../components/EditableText';
import DynamicIcon from '../components/DynamicIcon';
import { useSlides } from '../context/SlideContext';

const SlideAnalysisTarget = ({ slideData, slideId }) => {
  const { updateSlideData } = useSlides();
  const { hardwareData, subRatingData } = slideData.analysisTarget;

  const handleUpdate = (key, value) => {
    updateSlideData(slideId, (prev) => ({
      ...prev,
      analysisTarget: { ...prev.analysisTarget, [key]: value }
    }));
  };

  const handleUpdateNestedArray = (arrayName, index, field, value) => {
    updateSlideData(slideId, (prev) => {
      const newArray = [...prev.analysisTarget[arrayName]];
      newArray[index] = { ...newArray[index], [field]: value };
      return {
        ...prev,
        analysisTarget: { ...prev.analysisTarget, [arrayName]: newArray }
      };
    });
  };

  const handleUpdateProduct = (index, value) => {
    updateSlideData(slideId, (prev) => {
      const newProducts = [...prev.analysisTarget.products];
      newProducts[index] = value;
      return {
        ...prev,
        analysisTarget: { ...prev.analysisTarget, products: newProducts }
      };
    });
  };

  const handleUpdateRatingSubtitle2 = (field, value) => {
    updateSlideData(slideId, (prev) => ({
      ...prev,
      analysisTarget: {
        ...prev.analysisTarget,
        ratingSubtitle2: { ...prev.analysisTarget.ratingSubtitle2, [field]: value }
      }
    }));
  };

  // Design System Tokens for this slide
  const cardStyle = "bg-white rounded-[24px] border border-gray-200 shadow-[0_8px_30px_-12px_rgba(0,0,0,0.08)] flex flex-col overflow-hidden pptx-layer";
  
  const sectionHeaderContainer = "flex items-center mb-[16px] shrink-0 pl-[12px]";
  const sectionHeaderLine = "w-[6px] h-[24px] bg-blue-600 rounded-full pptx-layer";
  const sectionHeaderText = "pptx-text text-[24px] font-bold text-gray-800 tracking-wide";

  const tableHeaderContainer = "grid border-b border-gray-200 bg-gray-50 shrink-0";
  const tableHeaderText = "py-[16px] flex items-center justify-center text-center font-bold text-[18px]";
  
  const tableRowContainer = "grid flex-1 border-b border-gray-100 last:border-0 hover:bg-gray-50/50 transition-colors items-center";
  const tableRowLabel = "px-[12px] py-[9px] flex items-center justify-center text-center text-gray-500 text-[16px] font-medium leading-snug";
  const tableRowValue = "px-[12px] py-[9px] flex items-center justify-center text-center text-gray-800 text-[16px] font-medium leading-snug";

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
      <div className="w-full h-full pt-[100px] px-[120px] pb-[120px] relative z-10 flex flex-col box-border bg-gray-50">
        <SlideHeader 
          title={slideData.header?.title} 
          subtitle={slideData.header?.subtitle} 
          onChangeTitle={(val) => handleUpdateHeader('title', val)}
          onChangeSubtitle={(val) => handleUpdateHeader('subtitle', val)}
        />
        
        {/* Content Area */}
        <div className="flex-1 mt-[16px] flex gap-[48px] min-h-0">
          
          {/* LEFT: Section 01 Hardware */}
          <div className="flex-1 flex flex-col min-h-0">
            <div className={sectionHeaderContainer}>
               <EditableText 
                 tagName="h3"
                 value={slideData.header?.section1 || "01 参数对比"}
                 onChange={(val) => handleUpdateHeader('section1', val)}
                 className={sectionHeaderText}
               />
            </div>
            
            <div className={`${cardStyle} flex-1`}>
               <div className={`${tableHeaderContainer} grid-cols-[25%_37.5%_37.5%]`}>
                 <div className={`${tableHeaderText} text-gray-500`}>
                   <EditableText 
                     tagName="span"
                     value={slideData.labels?.dim1 || "对比维度"}
                     onChange={(val) => handleUpdateLabels('dim1', val)}
                     className="pptx-text"
                   />
                 </div>
                 <div className={`${tableHeaderText} text-blue-600`}>
                   <EditableText 
                     value={slideData.analysisTarget.products[0]}
                     onChange={(val) => handleUpdateProduct(0, val)}
                     className="pptx-text"
                   />
                 </div>
                 <div className={`${tableHeaderText} text-orange-500`}>
                   <EditableText 
                     value={slideData.analysisTarget.products[1]}
                     onChange={(val) => handleUpdateProduct(1, val)}
                     className="pptx-text"
                   />
                 </div>
               </div>
               
               <div className="flex-1 flex flex-col">
                 {hardwareData.map((row, idx) => (
                   <div key={idx} className={`${tableRowContainer} grid-cols-[25%_37.5%_37.5%]`}>
                       <div className={tableRowLabel}>
                         <EditableText 
                           value={row.label}
                           onChange={(val) => handleUpdateNestedArray('hardwareData', idx, 'label', val)}
                           className="pptx-text"
                         />
                       </div>
                       <div className={tableRowValue}>
                         <EditableText 
                           value={row.v}
                           onChange={(val) => handleUpdateNestedArray('hardwareData', idx, 'v', val)}
                           className="pptx-text"
                         />
                       </div>
                       <div className={tableRowValue}>
                         <EditableText 
                           value={row.i}
                           onChange={(val) => handleUpdateNestedArray('hardwareData', idx, 'i', val)}
                           className="pptx-text"
                         />
                       </div>
                   </div>
                 ))}
               </div>
            </div>
          </div>

          {/* RIGHT: Section 02 Ratings & Section 03 Insights */}
          <div className="flex-1 flex flex-col min-h-0 gap-[28px]">
            
            {/* Top Right: Section 02 Ratings Table */}
            <div className="flex flex-col flex-1 min-h-0">
              <div className="flex items-end justify-between mb-[16px] shrink-0">
                 <div className="flex items-center pl-[12px]">
                   <EditableText 
                     tagName="h3"
                     value={`02 ${slideData.analysisTarget.ratingSubtitle1}`}
                     onChange={(val) => handleUpdate('ratingSubtitle1', val.replace(/^02\s*/, ''))}
                     className={sectionHeaderText}
                   />
                 </div>
                 
                 {/* Weakened badges: no border, uniform gray brand names */}
                 <div className="flex gap-[8px] items-center text-[14px] text-gray-500 mb-[2px]">
                   <span className="flex items-center">
                     {slideData.analysisTarget.products[0]}: 
                     <EditableText 
                       tagName="span"
                       value={slideData.analysisTarget.ratingSubtitle2.v}
                       onChange={(val) => handleUpdateRatingSubtitle2('v', val)}
                       className="font-bold ml-[4px] text-gray-600"
                     />
                     <span className="text-gray-400 ml-[4px]">(N=</span>
                     <EditableText 
                       tagName="span"
                       value={slideData.analysisTarget.ratingSubtitle2.vCount}
                       onChange={(val) => handleUpdateRatingSubtitle2('vCount', val)}
                       className="text-gray-400"
                     />
                     <span className="text-gray-400">)</span>
                   </span>
                   <span className="text-gray-300 mx-[4px]">|</span>
                   <span className="flex items-center">
                     {slideData.analysisTarget.products[1]}: 
                     <EditableText 
                       tagName="span"
                       value={slideData.analysisTarget.ratingSubtitle2.i}
                       onChange={(val) => handleUpdateRatingSubtitle2('i', val)}
                       className="font-bold ml-[4px] text-gray-600"
                     />
                     <span className="text-gray-400 ml-[4px]">(N=</span>
                     <EditableText 
                       tagName="span"
                       value={slideData.analysisTarget.ratingSubtitle2.iCount}
                       onChange={(val) => handleUpdateRatingSubtitle2('iCount', val)}
                       className="text-gray-400"
                     />
                     <span className="text-gray-400">)</span>
                   </span>
                 </div>
              </div>
              
              <div className={`${cardStyle} flex-1 min-h-0`}>
                 <div className="grid grid-cols-[40%_30%_30%] items-center border-b border-gray-200 bg-gray-50 shrink-0">
                   <div className={tableHeaderText}>
                     <EditableText 
                       tagName="span"
                       value={slideData.labels?.dim2 || "维度"}
                       onChange={(val) => handleUpdateLabels('dim2', val)}
                       className="pptx-text"
                     />
                   </div>
                   <div className={`${tableHeaderText} text-blue-600`}>
                     <EditableText 
                       tagName="span"
                       value={slideData.analysisTarget.products[0]}
                       onChange={(val) => handleUpdateProduct(0, val)}
                       className="pptx-text"
                     />
                   </div>
                   <div className={`${tableHeaderText} text-orange-500`}>
                     <EditableText 
                       tagName="span"
                       value={slideData.analysisTarget.products[1]}
                       onChange={(val) => handleUpdateProduct(1, val)}
                       className="pptx-text"
                     />
                   </div>
                 </div>
                 
                 <div className="flex-1 flex flex-col">
                   {subRatingData.map((row, idx) => (
                     <div key={idx} className={`${tableRowContainer} grid-cols-[40%_30%_30%]`}>
                       <div className={tableRowLabel}>
                         <EditableText 
                           value={row.label}
                           onChange={(val) => handleUpdateNestedArray('subRatingData', idx, 'label', val)}
                           className="pptx-text"
                         />
                       </div>
                       <div className={`${tableRowValue} text-[18px] text-gray-700`}>
                         <EditableText 
                           value={row.v}
                           onChange={(val) => handleUpdateNestedArray('subRatingData', idx, 'v', val)}
                           className="pptx-text"
                         />
                       </div>
                       <div className={`${tableRowValue} text-[18px] text-gray-700`}>
                         <EditableText 
                           value={row.i}
                           onChange={(val) => handleUpdateNestedArray('subRatingData', idx, 'i', val)}
                           className="pptx-text"
                         />
                       </div>
                     </div>
                   ))}
                 </div>
              </div>
            </div>

            {/* Bottom Right: Section 03 Insights Card */}
            <div className="flex flex-col shrink-0">
              <div className={sectionHeaderContainer}>
                 <EditableText 
                   tagName="h3"
                   value={slideData.header?.section3 || "03 洞察总结"}
                   onChange={(val) => handleUpdateHeader('section3', val)}
                   className={sectionHeaderText}
                 />
              </div>
              
              <div className={`${cardStyle} flex-1 p-[24px] justify-center gap-[20px] shrink-0 bg-[#F8FAFC]`}>
                {slideData.analysisTarget.insights.map((insight, idx) => {
                  const defaultIcons = ["Camera", "Sparkles", "Coins"];
                  const iconName = insight.icon || defaultIcons[idx % defaultIcons.length];
                  return (
                    <div key={idx} className="flex flex-col gap-[6px]">
                      <div className="text-[18px] font-bold text-gray-800 flex items-center gap-[8px]">
                        <DynamicIcon name={iconName} className="w-[20px] h-[20px] pptx-layer" />
                        <EditableText 
                          value={insight.title}
                          onChange={(val) => handleUpdateNestedArray('insights', idx, 'title', val)}
                          className="pptx-text leading-none"
                        />
                      </div>
                      <EditableText 
                        tagName="div"
                        allowHtml={true}
                        value={insight.descHtml}
                        onChange={(val) => handleUpdateNestedArray('insights', idx, 'descHtml', val)}
                        className="pptx-text text-[16px] leading-relaxed text-gray-600"
                      />
                    </div>
                  );
                })}
              </div>
            </div>
            
          </div>

        </div>
      </div>
    </SlideCanvas>
  );
};

export default SlideAnalysisTarget;
