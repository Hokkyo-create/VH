import React, { useState, useMemo } from 'react';
import { Channel } from '../types';

interface ChannelListProps {
  channels: Channel[];
  onSelectChannel: (channel: Channel) => void;
  selectedChannelUrl?: string | null;
}

const ChannelList: React.FC<ChannelListProps> = ({ channels, onSelectChannel, selectedChannelUrl }) => {
  const [searchTerm, setSearchTerm] = useState('');

  const filteredChannels = useMemo(() => {
    if (!searchTerm) return channels;
    return channels.filter(channel =>
      channel.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
      channel.group.toLowerCase().includes(searchTerm.toLowerCase())
    );
  }, [channels, searchTerm]);

  const groupedChannels = useMemo(() => {
    return filteredChannels.reduce((acc, channel) => {
      const group = channel.group || 'Uncategorized';
      if (!acc[group]) {
        acc[group] = [];
      }
      acc[group].push(channel);
      return acc;
    }, {} as Record<string, Channel[]>);
  }, [filteredChannels]);
  
  if (channels.length === 0) {
      return (
         <div className="bg-gray-800 rounded-lg shadow-md p-4 h-full flex flex-col max-h-[80vh]">
            <h2 className="text-xl font-semibold mb-3 text-teal-400">Canais</h2>
            <div className="flex-grow flex items-center justify-center">
                <p className="text-gray-400">Carregue uma lista para ver os canais.</p>
            </div>
         </div>
      )
  }

  return (
    <div className="bg-gray-800 rounded-lg shadow-md p-4 flex flex-col max-h-[80vh]">
      <h2 className="text-xl font-semibold mb-3 text-teal-400">Canais ({channels.length})</h2>
      <input
        type="text"
        placeholder="Buscar canais ou grupos..."
        value={searchTerm}
        onChange={(e) => setSearchTerm(e.target.value)}
        className="w-full bg-gray-700 text-gray-200 placeholder-gray-400 border border-gray-600 rounded-md px-3 py-2 mb-4 focus:outline-none focus:ring-2 focus:ring-teal-500"
      />
      <div className="overflow-y-auto flex-grow">
        {/* FIX: Use Object.keys to iterate over grouped channels to avoid type inference issues with Object.entries. */}
        {Object.keys(groupedChannels).sort((a, b) => a.localeCompare(b)).map((group) => {
          const channelsInGroup = groupedChannels[group];
          return (
            <details key={group} open className="mb-2">
              <summary className="font-bold text-gray-300 cursor-pointer p-2 rounded-md hover:bg-gray-700/50">
                {group} ({channelsInGroup.length})
              </summary>
              <ul className="pl-4 pt-1">
                {channelsInGroup.map(channel => (
                  <li
                    key={channel.url}
                    onClick={() => onSelectChannel(channel)}
                    className={`flex items-center p-2 rounded-md cursor-pointer transition-colors duration-200 ${selectedChannelUrl === channel.url ? 'bg-teal-500/30' : 'hover:bg-gray-700'}`}
                  >
                    {channel.logo ? (
                      <img src={channel.logo} alt={channel.name} className="w-10 h-10 object-contain mr-3 rounded-md bg-gray-600" />
                    ) : (
                      <div className="w-10 h-10 mr-3 rounded-md bg-gray-700 flex items-center justify-center text-teal-400">
                        <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M12 20.94c1.5 0 2.75 1.06 4 1.06 3 0 6-8 6-12.5A4.5 4.5 0 0 0 18 2c-1.5 0-2.75 1.06-4 1.06-3 0-6-8-6-12.5A4.5 4.5 0 0 0 6 2c-1.5 0-2.75 1.06-4 1.06-3 0-6-8-6-12.5A4.5 4.5 0 0 0 2 2c1.5 0 2.75 1.06 4 1.06 3 0 6-8 6-12.5Z"/><path d="M12 20.94c1.5 0 2.75 1.06 4 1.06 3 0 6-8 6-12.5A4.5 4.5 0 0 0 18 2c-1.5 0-2.75 1.06-4 1.06-3 0-6-8-6-12.5A4.5 4.5 0 0 0 6 2c-1.5 0-2.75 1.06-4 1.06-3 0-6-8-6-12.5A4.5 4.5 0 0 0 2 2c1.5 0 2.75 1.06 4 1.06 3 0 6-8 6-12.5Z"/></svg>
                      </div>
                    )}
                    <span className="text-sm font-medium">{channel.name}</span>
                  </li>
                ))}
              </ul>
            </details>
          );
        })}
      </div>
    </div>
  );
};

export default ChannelList;
