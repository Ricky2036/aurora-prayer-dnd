import React, { createContext, useContext, useState, useCallback, useEffect } from 'react';
import { reportData } from '../data/reportData';

const SlideContext = createContext();

const generateId = () => Math.random().toString(36).substr(2, 9);
const STORAGE_KEY = 'ppt_template_slides_data';

const createInitialSlides = () => {
  // If reportData is already an array, it means it has been saved via the WYSIWYG editor
  if (Array.isArray(reportData)) {
    return reportData;
  }

  // Fallback for the original structured object format
  const slides = [
    { id: generateId(), type: 'SlideCover', data: { global: reportData.global, toc: reportData.toc } },
    { id: generateId(), type: 'SlideTOC', data: { toc: reportData.toc, header: { title: "目 录", subtitle: "Contents" } } },
    { id: generateId(), type: 'SlideBackground', data: { background: reportData.background, global: reportData.global, header: { title: "背景与目的", subtitle: "Background & Objectives" } } },
    { id: generateId(), type: 'SlideAnalysisTarget', data: { analysisTarget: reportData.analysisTarget, global: reportData.global, header: { title: "分析对象", subtitle: reportData.analysisTarget.subtitle, section1: "01 参数对比", section3: "03 洞察总结" } } },
    { id: generateId(), type: 'SlidePublicOpinion', data: { overallOpinions: reportData.overallOpinions, summaryHtml: reportData.overallOpinionsSummaryHtml, header: { title: "整体舆情洞察", subtitle: "Public Opinion Analysis" } } },
    { id: generateId(), type: 'SlideSummary', data: { summary: reportData.summary, header: { title: "横向对比总结", subtitle: "Horizontal Comparison & Strategy" } } },
  ];

  if (reportData.areas) {
    reportData.areas.forEach((area, index) => {
      if (area.leading && area.leading.length > 0) {
        slides.push({ id: generateId(), type: 'TemplateAreaAnalysisLeading', data: { area, index, global: reportData.global } });
      }
      if (area.lagging && area.lagging.length > 0) {
        slides.push({ id: generateId(), type: 'TemplateAreaAnalysisLagging', data: { area, index, global: reportData.global } });
      }
    });
  }

  return slides;
};

export const SlideProvider = ({ children }) => {
  const [slides, setSlides] = useState(createInitialSlides());
  const [isEditMode, setIsEditMode] = useState(false);

  const saveSlides = useCallback(async () => {
    try {
      await fetch('/api/save', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify(slides)
      });
      console.log('Slides saved successfully.');
    } catch (e) {
      console.error('Failed to save slides to file', e);
    }
  }, [slides]);

  // Reset is no longer needed in the same way, but we can keep it as a no-op 
  // or actually reset it if we kept the original data somewhere.
  // For now, removing the functionality since the source code IS the truth.
  const resetToDefault = useCallback(() => {
    console.log("Reset is disabled when saving directly to source code.");
  }, []);


  const updateSlideData = useCallback((id, newDataOrUpdater, shouldSave = false) => {
    setSlides(prev => {
      const newSlides = prev.map(slide => {
        if (slide.id === id) {
          const newData = typeof newDataOrUpdater === 'function' ? newDataOrUpdater(slide.data) : newDataOrUpdater;
          return { ...slide, data: newData };
        }
        return slide;
      });
      if (shouldSave) {
        fetch('/api/save', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(newSlides)
        }).catch(e => console.error('Auto-save failed:', e));
      }
      return newSlides;
    });
  }, []);

  const duplicateSlide = useCallback((index) => {
    setSlides(prev => {
      const newSlides = [...prev];
      const slideToDuplicate = newSlides[index];
      // Deep clone data to avoid reference sharing when editing
      const clonedData = JSON.parse(JSON.stringify(slideToDuplicate.data));
      newSlides.splice(index + 1, 0, {
        id: generateId(),
        type: slideToDuplicate.type,
        data: clonedData
      });
      return newSlides;
    });
  }, []);

  const removeSlide = useCallback((index) => {
    setSlides(prev => {
      const newSlides = [...prev];
      newSlides.splice(index, 1);
      fetch('/api/save', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(newSlides)
      }).catch(e => console.error('Failed to save slides on remove', e));
      return newSlides;
    });
  }, []);

  return (
    <SlideContext.Provider value={{
      slides,
      updateSlideData,
      saveSlides,
      resetToDefault,
      isEditMode,
      setIsEditMode,
      duplicateSlide,
      removeSlide
    }}>
      {children}
    </SlideContext.Provider>
  );
};

export const useSlides = () => useContext(SlideContext);
