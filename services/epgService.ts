import { EpgData, Programme } from "../types";

const CORS_PROXY_URL = 'https://corsproxy.io/?';
const CACHE_DURATION_MS = 60 * 60 * 1000; // 1 hora de cache

// Cache em memória para os dados do EPG
let epgCache: {
  data: EpgData;
  timestamp: number;
  epgUrls: string[];
} | null = null;


// Mapeia IDs de M3U para IDs de EPG quando eles não correspondem.
// A chave é o tvg-id do M3U, o valor é uma lista de possíveis IDs no arquivo XMLTV.
const EPG_ID_ALIASES: Record<string, string[]> = {
  'fuji_tv': ['CX'],
  'ntv': ['NTV'],
  'tbs': ['TBS'],
  'tv_asahi': ['EX'],
  'tv_tokyo': ['TX'],
  'nhk_g_tokyo': ['NHK-G'],
  'nhk_e_tokyo': ['NHK-E'],
};


// Analisa o formato de data do XMLTV (YYYYMMDDHHMMSS +/-ZZZZ) em um objeto Date
const parseXmlTvDate = (dateString: string): Date => {
  const year = parseInt(dateString.substring(0, 4), 10);
  const month = parseInt(dateString.substring(4, 6), 10) - 1; // Meses em JS são baseados em 0
  const day = parseInt(dateString.substring(6, 8), 10);
  const hours = parseInt(dateString.substring(8, 10), 10);
  const minutes = parseInt(dateString.substring(10, 12), 10);
  const seconds = parseInt(dateString.substring(12, 14), 10);
  
  // Objeto de data básico no horário local
  const date = new Date(year, month, day, hours, minutes, seconds);

  // Lida com o deslocamento de fuso horário
  const tzMatch = dateString.match(/\s([+-])(\d{2})(\d{2})$/);
  if (tzMatch) {
    const sign = tzMatch[1] === '+' ? -1 : 1;
    const tzHours = parseInt(tzMatch[2], 10);
    const tzMinutes = parseInt(tzMatch[3], 10);
    const offsetMillis = (tzHours * 60 + tzMinutes) * 60 * 1000 * sign;
    
    // Obtém o deslocamento de fuso horário local atual em milissegundos
    const localOffsetMillis = date.getTimezoneOffset() * 60 * 1000;
    
    // Ajusta a data para UTC e, em seguida, aplica o deslocamento correto
    const utcMillis = date.getTime() - localOffsetMillis;
    return new Date(utcMillis + offsetMillis);
  }

  return date;
};


export const fetchAndParseEPG = async (urls: string[]): Promise<EpgData> => {
    // Verifica o cache em memória primeiro
    if (epgCache) {
        const isCacheValid = (Date.now() - epgCache.timestamp) < CACHE_DURATION_MS;
        const areUrlsSame = JSON.stringify(urls.sort()) === JSON.stringify(epgCache.epgUrls.sort());
        
        if (isCacheValid && areUrlsSame) {
            console.log("Carregando dados do EPG do cache em memória.");
            return epgCache.data;
        }
    }
    
    console.log("Buscando novos dados do EPG da rede.");
    const epgData: EpgData = {};

    const fetchPromises = urls.map(async (url) => {
        try {
            const proxyUrl = `${CORS_PROXY_URL}${encodeURIComponent(url)}`;
            const response = await fetch(proxyUrl);
            if (!response.ok) {
                console.error(`Falha ao buscar EPG de ${url}: ${response.statusText}`);
                return;
            }
            const xmlText = await response.text();
            const parser = new DOMParser();
            const xmlDoc = parser.parseFromString(xmlText, "application/xml");
            
            const programmeElements = xmlDoc.getElementsByTagName('programme');
            
            for (let i = 0; i < programmeElements.length; i++) {
                const progElement = programmeElements[i];
                const channelId = progElement.getAttribute('channel');
                const startStr = progElement.getAttribute('start');
                const stopStr = progElement.getAttribute('stop');
                
                if (!channelId || !startStr || !stopStr) continue;

                const titleElement = progElement.getElementsByTagName('title')[0];
                const descElement = progElement.getElementsByTagName('desc')[0];

                const programme: Programme = {
                    channel: channelId,
                    start: parseXmlTvDate(startStr),
                    stop: parseXmlTvDate(stopStr),
                    title: titleElement?.textContent || 'Sem Título',
                    desc: descElement?.textContent,
                };

                if (!epgData[channelId]) {
                    epgData[channelId] = [];
                }
                epgData[channelId].push(programme);
            }

        } catch (error) {
            console.error(`Erro ao processar URL de EPG ${url}:`, error);
        }
    });

    await Promise.all(fetchPromises);

    // Consolida dados de EPG usando os apelidos
    for (const primaryId in EPG_ID_ALIASES) {
        const aliasIds = EPG_ID_ALIASES[primaryId];
        for (const aliasId of aliasIds) {
            if (epgData[aliasId]) {
                if (!epgData[primaryId]) {
                    epgData[primaryId] = [];
                }
                epgData[primaryId].push(...epgData[aliasId]);
                delete epgData[aliasId]; // Remove o apelido para evitar duplicação
            }
        }
    }
    
    // Ordena os programas por hora de início para cada canal
    for (const channelId in epgData) {
        epgData[channelId].sort((a, b) => a.start.getTime() - b.start.getTime());
    }
    
    // Salva no cache em memória após buscar e analisar com sucesso
    epgCache = {
        data: epgData,
        timestamp: Date.now(),
        epgUrls: urls,
    };
    console.log("Dados do EPG salvos em cache em memória.");

    return epgData;
};