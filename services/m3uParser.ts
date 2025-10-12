
import { Channel } from '../types';

export const parseM3U = (m3uContent: string): Channel[] => {
  const channels: Channel[] = [];
  const lines = m3uContent.split('\n');

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i].trim();
    if (line.startsWith('#EXTINF:')) {
      try {
        const nameMatch = line.match(/,(.*)$/);
        const name = nameMatch ? nameMatch[1] : 'Unknown Channel';

        const logoMatch = line.match(/tvg-logo="([^"]*)"/);
        const logo = logoMatch ? logoMatch[1] : null;

        const groupMatch = line.match(/group-title="([^"]*)"/);
        const group = groupMatch ? groupMatch[1] : 'Uncategorized';
        
        const url = lines[i + 1]?.trim();

        if (url && (url.startsWith('http://') || url.startsWith('https://'))) {
          channels.push({ name, logo, url, group });
        }
      } catch (e) {
        console.error("Could not parse line: ", line, e);
      }
    }
  }

  return channels;
};
