import React from 'react';

interface SceneAnalysisIconProps {
  active: boolean;
}

const SceneAnalysisIcon: React.FC<SceneAnalysisIconProps> = ({ active }) => (
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
        <path d="M2 12s3-7 10-7 10 7 10 7-3 7-10 7-10-7-10-7Z" />
        <circle cx="12" cy="12" r="3" />
    </svg>
);

export default SceneAnalysisIcon;