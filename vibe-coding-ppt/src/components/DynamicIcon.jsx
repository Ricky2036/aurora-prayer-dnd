import React from 'react';
import * as LucideIcons from 'lucide-react';

const DynamicIcon = ({ name, className }) => {
  if (!name) return null;
  const Icon = LucideIcons[name];
  if (!Icon) {
    console.warn(`Icon ${name} not found in lucide-react`);
    return null;
  }
  return <Icon className={className} />;
};

export default DynamicIcon;
