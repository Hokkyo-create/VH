import React from 'react';

interface VolumeIconProps {
  volume: number;
}

const VolumeIcon: React.FC<VolumeIconProps> = ({ volume }) => {
    let iconPath;
    if (volume === 0) {
        iconPath = <>
            <path d="M11 5 6 9H2v6h4l5 4V5z"/>
            <line x1="23" y1="9" x2="17" y2="15"/>
            <line x1="17" y1="9" x2="23" y2="15"/>
        </>;
    } else if (volume < 0.5) {
        iconPath = <>
            <path d="M11 5 6 9H2v6h4l5 4V5z" />
            <path d="M15.54 8.46a5 5 0 0 1 0 7.07" />
        </>;
    } else {
        iconPath = <>
            <path d="M11 5 6 9H2v6h4l5 4V5z" />
            <path d="M15.54 8.46a5 5 0 0 1 0 7.07" />
            <path d="M19.07 4.93a10 10 0 0 1 0 14.14" />
        </>;
    }

    return (
        <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="w-6 h-6 text-white flex-shrink-0">
            {iconPath}
        </svg>
    );
};

export default VolumeIcon;
