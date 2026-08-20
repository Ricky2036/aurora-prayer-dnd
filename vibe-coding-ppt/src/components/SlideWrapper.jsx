import React, { memo } from 'react';

const SlideWrapper = memo(({ children, index, slideId }) => {

  return (
    <div className="relative group slide-container-node" data-slide-index={index}>
      {children}
    </div>
  );
});

export default SlideWrapper;
