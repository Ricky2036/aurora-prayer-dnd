import React from 'react';
import { TrendingUp, TrendingDown, Info } from 'lucide-react';

export const CompareCard = ({ type = "lead", title, description }) => {
  const isLead = type === "lead";
  const iconColor = isLead ? "text-purple-600" : "text-blue-600";
  const Icon = isLead ? TrendingUp : TrendingDown;
  const tagText = isLead ? "tOS 领先" : "OriginOS 优势";
  const tagBg = isLead ? "bg-purple-50 text-purple-600" : "bg-blue-50 text-blue-600";

  return (
    <div className="bg-white p-[24px] rounded-[24px] shadow-[0_8px_30px_-12px_rgba(0,0,0,0.08)] border border-gray-100 flex flex-col pptx-layer flex-1 min-h-0">
      <div className="flex items-center gap-[16px] mb-[16px] shrink-0">
        <div className={`p-[12px] rounded-[16px] ${tagBg} pptx-layer shrink-0`}>
          <Icon className={`w-[28px] h-[28px] ${iconColor}`} />
        </div>
        <h4 className="pptx-text text-[28px] font-bold text-gray-800 flex-1 leading-tight">{title}</h4>
        <div className={`pptx-text text-[16px] px-[12px] py-[6px] rounded-[8px] font-bold ${tagBg} shrink-0`}>
          {tagText}
        </div>
      </div>
      <div className="bg-gray-50/50 p-[20px] rounded-[16px] pptx-layer overflow-hidden flex-1 min-h-0 flex items-center">
        <p className="pptx-text text-[22px] text-gray-600 leading-relaxed break-words whitespace-pre-wrap line-clamp-3">
          {description}
        </p>
      </div>
    </div>
  );
};

export const InfoCard = ({ title, description, icon: IconComponent = Info }) => {
  return (
    <div className="bg-white p-[24px] rounded-[24px] shadow-[0_8px_30px_-12px_rgba(0,0,0,0.08)] border border-gray-100 flex flex-col pptx-layer flex-1 min-h-0">
      <div className="flex items-center gap-[16px] mb-[16px] shrink-0">
        <div className="p-[12px] bg-gray-50 rounded-[16px] text-gray-600 pptx-layer shrink-0">
          <IconComponent className={`w-[28px] h-[28px]`} />
        </div>
        <h4 className="pptx-text text-[28px] font-bold text-gray-800 leading-tight">{title}</h4>
      </div>
      <div className="bg-gray-50/50 p-[20px] rounded-[16px] pptx-layer overflow-hidden flex-1 min-h-0 flex items-center">
        <p className="pptx-text text-[22px] text-gray-600 leading-relaxed break-words whitespace-pre-wrap line-clamp-3">
          {description}
        </p>
      </div>
    </div>
  );
}
