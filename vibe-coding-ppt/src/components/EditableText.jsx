import React, { useState, useEffect, useRef, useMemo } from 'react';
import { useSlides } from '../context/SlideContext';

const EditableText = ({ 
  value, 
  onChange, 
  className = "", 
  tagName = "span",
  placeholder = "点击输入文字...",
  allowHtml = false
}) => {
  const { isEditMode } = useSlides();
  const [isEditing, setIsEditing] = useState(false);
  const elementRef = useRef(null);

  // When value prop changes externally, update the element if not currently editing
  useEffect(() => {
    if (!isEditing && elementRef.current) {
      if (allowHtml) {
        if (elementRef.current.innerHTML !== value) {
          elementRef.current.innerHTML = value;
        }
      } else {
        if (elementRef.current.innerText !== value) {
          elementRef.current.innerText = value;
        }
      }
    }
  }, [value, isEditing, allowHtml]);

  const handleBlur = () => {
    setIsEditing(false);
    if (!elementRef.current) return;
    
    const newValue = allowHtml ? elementRef.current.innerHTML : elementRef.current.innerText;
    if (newValue !== value) {
      onChange(newValue);
    }
  };

  const handleFocus = () => {
    if (isEditMode) {
      setIsEditing(true);
    }
  };
  
  const handleKeyDown = (e) => {
    // If it's a span/single line and user presses enter, blur it
    if (e.key === 'Enter' && !allowHtml && tagName !== 'p' && tagName !== 'div') {
      e.preventDefault();
      elementRef.current.blur();
    }
  };

  const Tag = tagName;

  // Add a visual indicator when in edit mode
  const htmlObj = useMemo(() => (allowHtml ? { __html: value } : undefined), [allowHtml, value]);

  const editStyles = isEditMode 
    ? "outline-none hover:ring-2 hover:ring-blue-400/50 hover:bg-blue-50/20 transition-all rounded-[4px] cursor-text min-w-[20px] min-h-[1em] inline-block" 
    : "";

  const handlePaste = (e) => {
    // Intercept paste to force plain text, preventing rich text formats from breaking the layout
    e.preventDefault();
    const text = e.clipboardData.getData('text/plain');
    document.execCommand('insertText', false, text);
  };

  return (
    <Tag
      ref={elementRef}
      className={`${className} ${editStyles}`}
      contentEditable={isEditMode}
      onBlur={handleBlur}
      onFocus={handleFocus}
      onKeyDown={handleKeyDown}
      onPaste={handlePaste}
      suppressContentEditableWarning={true}
      data-placeholder={isEditMode && !value ? placeholder : ""}
      style={{
        emptyCells: "show",
      }}
      dangerouslySetInnerHTML={htmlObj}
    >
      {!allowHtml ? value : undefined}
    </Tag>
  );
};

export default EditableText;
