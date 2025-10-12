
import React from 'react';

interface DubbingIconProps {
  active: boolean;
}

const DubbingIcon: React.FC<DubbingIconProps> = ({ active }) => (
    <svg xmlns="http://www.w3.org/2000/svg" 
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
        <path d="m13 14-4 4 4 4"/>
        <path d="M10.5 10.5c.5.5.5 1.5.5 2.5s0 2-.5 2.5"/>
        <path d="M17 11c1.5 0 3 .5 3 2.5S18.5 16 17 16"/>
        <path d="M7 11v-1a2 2 0 0 1 2-2h1"/>
        <path d="M15 11h1a2 2 0 0 1 2 2v1"/>
        <path d="M12 6.5A2.5 2.5 0 0 1 14.5 4h0A2.5 2.5 0 0 1 17 6.5V11"/>
        <path d="M8.5 4A2.5 2.5 0 0 0 6 6.5V11"/>
    </svg>
);

export default DubbingIcon;
