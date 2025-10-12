import React from 'react';

interface SubtitlesIconProps {
  active: boolean;
}

const SubtitlesIcon: React.FC<SubtitlesIconProps> = ({ active }) => (
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
        <path d="M21 15a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V7a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z"></path>
        <path d="M7 11h4"></path>
        <path d="M13 11h4"></path>
        <path d="M9 11v2"></path>
    </svg>
);

export default SubtitlesIcon;