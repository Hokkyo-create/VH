import React from 'react';

interface FullscreenIconProps {
  isFullscreen: boolean;
}

const FullscreenIcon: React.FC<FullscreenIconProps> = ({ isFullscreen }) => (
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
    className="w-6 h-6 text-white hover:text-teal-300"
  >
    {isFullscreen ? (
      <>
        <path d="M8 3v3a2 2 0 0 1-2 2H3" />
        <path d="M3 16h3a2 2 0 0 1 2 2v3" />
        <path d="M16 21v-3a2 2 0 0 1 2-2h3" />
        <path d="M21 8h-3a2 2 0 0 1-2-2V3" />
      </>
    ) : (
      <>
        <path d="M8 3H5a2 2 0 0 0-2 2v3" />
        <path d="M21 8V5a2 2 0 0 0-2-2h-3" />
        <path d="M3 16v3a2 2 0 0 0 2 2h3" />
        <path d="M16 21h3a2 2 0 0 0 2-2v-3" />
      </>
    )}
  </svg>
);

export default FullscreenIcon;
