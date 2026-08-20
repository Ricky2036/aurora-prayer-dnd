import React from 'react';
import EditableText from './EditableText';

const SlideHeader = ({ title, subtitle, onChangeTitle, onChangeSubtitle }) => (
  <div className="flex items-center mb-[40px] relative z-10 shrink-0 w-full">
    <div className="inline-block w-[12px] h-[40px] bg-gradient-to-b from-purple-500 to-blue-500 rounded-full mr-[20px] shrink-0 pptx-layer"></div>
    <div className="flex items-baseline flex-wrap gap-x-[20px] gap-y-[12px]">
      {onChangeTitle ? (
        <EditableText 
          value={title} 
          onChange={onChangeTitle} 
          className="pptx-text text-[40px] leading-none font-bold text-gray-800 tracking-wide" 
        />
      ) : (
        <span className="pptx-text text-[40px] leading-none font-bold text-gray-800 tracking-wide">{title}</span>
      )}
      
      {subtitle && (
        <div className="flex items-baseline gap-[20px]">
          <span className="pptx-text text-[32px] leading-none text-gray-300 font-light">|</span>
          {onChangeSubtitle ? (
            <EditableText 
              value={subtitle} 
              onChange={onChangeSubtitle} 
              className="pptx-text text-[28px] leading-none text-purple-600 font-medium tracking-normal" 
            />
          ) : (
            <span className="pptx-text text-[28px] leading-none text-purple-600 font-medium tracking-normal">{subtitle}</span>
          )}
        </div>
      )}
    </div>
  </div>
);

export default SlideHeader;
