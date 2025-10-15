import React from 'react';

interface OcrIconProps {
  active: boolean;
}

const OcrIcon: React.FC<OcrIconProps> = ({ active }) => (
    <svg 
        xmlns="http://www.w3.org/2000/svg" 
        width="24" 
        height="24" 
        viewBox="0 0 24 24" 
        fill="none" 
        stroke="currentColor" 
        strokeWidth="2" 
        strokeLinecap="round" 
        strokeLinejoin="round" 
        className={`w-6 h-6 transition-colors ${active ? 'text-teal-400' : 'text-white hover:text-teal-300'}`}
    >
        <path d="M3 7V5a2 2 0 0 1 2-2h2" />
        <path d="M17 3h2a2 2 0 0 1 2 2v2" />
        <path d="M21 17v2a2 2 0 0 1-2 2h-2" />
        <path d="M7 21H5a2 2 0 0 1-2-2v-2" />
        <path d="M12 8v4" />
        <path d="M10 10h4" />
        <path d="M8 16h8" />
    </svg>
);

export default OcrIcon;