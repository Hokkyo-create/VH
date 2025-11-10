import React from 'react';

interface AiIconProps {
  active: boolean;
}

const AiIcon: React.FC<AiIconProps> = ({ active }) => (
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
        <path d="M9.5 13a2.5 2.5 0 0 1-5 0" />
        <path d="M19.5 13a2.5 2.5 0 0 1-5 0" />
        <path d="M12 2a3 3 0 0 0-3 3v2" />
        <path d="M12 22a3 3 0 0 0 3-3v-2" />
        <path d="M22 12a3 3 0 0 0-3-3h-2" />
        <path d="M2 12a3 3 0 0 0 3 3h2" />
        <path d="M12 12a1 1 0 1 0 0-2 1 1 0 0 0 0 2z" />
    </svg>
);

export default AiIcon;
