
import { Channel } from '../types';

export const parseM3U = (m3uContent: string): { channels: Channel[], epgUrls: string[] } => {
  const channels: Channel[] = [];
  const epgUrls: string[] = [];
  const lines = m3uContent.split('\n');

  // First line parsing for EPG URL
  if (lines[0].startsWith('#EXTM3U')) {
    const urlTvgMatch = lines[0].match(/url-tvg="([^"]*)"/);
    if (urlTvgMatch && urlTvgMatch[1]) {
      epgUrls.push(...urlTvgMatch[1].split(',').filter(url => url.trim() !== ''));
    }
  }

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
        
        const tvgIdMatch = line.match(/tvg-id="([^"]*)"/);
        const tvgId = tvgIdMatch ? tvgIdMatch[1] : null;
        
        const url = lines[i + 1]?.trim();

        if (url && (url.startsWith('http://') || url.startsWith('https://'))) {
          channels.push({ name, logo, url, group, tvgId });
        }
      } catch (e) {
        console.error("Could not parse line: ", line, e);
      }
    }
  }

  return { channels, epgUrls };
};
