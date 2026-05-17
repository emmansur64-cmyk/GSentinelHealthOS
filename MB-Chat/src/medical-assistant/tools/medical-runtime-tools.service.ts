import { Injectable, Logger } from '@nestjs/common';
import { MedicalRuntimeToolContext } from '../../ai/medical-runtime-context';
import { MedicalCitation } from '../../knowledge/types';
import { MedicalChatLearningService } from '../learning/medical-chat-learning.service';

const DEFAULT_TIMEZONE = 'America/Argentina/Buenos_Aires';
const DEFAULT_WEATHER_LAT = -34.6037;
const DEFAULT_WEATHER_LON = -58.3816;
const DEFAULT_WEATHER_LOCATION = 'Buenos Aires, Argentina';
const BLOCKED_WEB_KEYWORDS = [
  'deep web',
  'dark web',
  'marianas web',
  'mariana web',
  'onion',
  'porn',
  'porno',
  'xxx',
  'adult',
  'adulto',
];
const BLOCKED_WEB_HOST_SNIPPETS = ['.onion', 'porn', 'xvideos', 'xnxx', 'pornhub', 'redtube', 'youporn'];

const OFFICIAL_SOURCE_DIRECTORY: Array<MedicalCitation & {
  domains: string[];
  countries: string[];
  keywords: string[];
}> = [
  {
    source: 'guideline',
    title: 'Sociedad Argentina de Terapia Intensiva (SATI) - Guias y consensos',
    url: 'https://www.sati.org.ar/guias/',
    date: 'current',
    domains: ['sati.org.ar'],
    countries: ['AR', 'DEFAULT'],
    keywords: ['terapia', 'intensiva', 'uti', 'critical', 'sepsis', 'ventilacion', 'shock', 'icu'],
  },
  {
    source: 'guideline',
    title: 'Ministerio de Salud de la Republica Argentina',
    url: 'https://www.argentina.gob.ar/salud',
    date: 'current',
    domains: ['argentina.gob.ar'],
    countries: ['AR', 'DEFAULT'],
    keywords: ['argentina', 'salud', 'vacuna', 'epidemiologia', 'normativa', 'ministerio'],
  },
  {
    source: 'guideline',
    title: 'Ministerio de Salud de la Republica Argentina - Noticias oficiales',
    url: 'https://www.argentina.gob.ar/salud/noticias',
    date: 'current',
    domains: ['argentina.gob.ar'],
    countries: ['AR', 'DEFAULT'],
    keywords: ['noticia', 'noticias', 'comunicado', 'alerta', 'ministerio', 'argentina'],
  },
  {
    source: 'guideline',
    title: 'ANMAT - Administracion Nacional de Medicamentos, Alimentos y Tecnologia Medica',
    url: 'https://www.argentina.gob.ar/anmat',
    date: 'current',
    domains: ['argentina.gob.ar'],
    countries: ['AR', 'DEFAULT'],
    keywords: ['medicamento', 'farmaco', 'anmat', 'dispositivo', 'tecnologia'],
  },
  {
    source: 'who',
    title: 'World Health Organization - Health topics',
    url: 'https://www.who.int/health-topics',
    date: 'current',
    domains: ['who.int'],
    countries: ['DEFAULT'],
    keywords: ['who', 'oms', 'public health', 'guideline', 'infection'],
  },
  {
    source: 'who',
    title: 'World Health Organization - Official news',
    url: 'https://www.who.int/news',
    date: 'current',
    domains: ['who.int'],
    countries: ['DEFAULT'],
    keywords: ['news', 'noticia', 'alert', 'outbreak', 'who', 'oms'],
  },
  {
    source: 'guideline',
    title: 'Pan American Health Organization',
    url: 'https://www.paho.org/',
    date: 'current',
    domains: ['paho.org'],
    countries: ['AR', 'DEFAULT'],
    keywords: ['ops', 'paho', 'latam', 'america', 'salud publica'],
  },
  {
    source: 'cdc',
    title: 'Centers for Disease Control and Prevention',
    url: 'https://www.cdc.gov/',
    date: 'current',
    domains: ['cdc.gov'],
    countries: ['DEFAULT'],
    keywords: ['cdc', 'infection', 'vaccine', 'outbreak', 'prevention'],
  },
  {
    source: 'cdc',
    title: 'CDC Newsroom',
    url: 'https://www.cdc.gov/media/',
    date: 'current',
    domains: ['cdc.gov'],
    countries: ['DEFAULT'],
    keywords: ['news', 'noticia', 'alert', 'outbreak', 'cdc', 'media'],
  },
  {
    source: 'pubmed',
    title: 'PubMed / National Library of Medicine',
    url: 'https://pubmed.ncbi.nlm.nih.gov/',
    date: 'current',
    domains: ['pubmed.ncbi.nlm.nih.gov', 'ncbi.nlm.nih.gov'],
    countries: ['DEFAULT'],
    keywords: ['pubmed', 'evidence', 'trial', 'review', 'study'],
  },
  {
    source: 'clinicaltrials',
    title: 'ClinicalTrials.gov',
    url: 'https://clinicaltrials.gov/',
    date: 'current',
    domains: ['clinicaltrials.gov'],
    countries: ['DEFAULT'],
    keywords: ['clinical trial', 'ensayo', 'trial', 'research'],
  },
  {
    source: 'guideline',
    title: 'NICE Guidance',
    url: 'https://www.nice.org.uk/guidance',
    date: 'current',
    domains: ['nice.org.uk'],
    countries: ['DEFAULT'],
    keywords: ['nice', 'guideline', 'clinical guideline'],
  },
  {
    source: 'guideline',
    title: 'Harvard Health Publishing',
    url: 'https://www.health.harvard.edu/',
    date: 'current',
    domains: ['health.harvard.edu'],
    countries: ['DEFAULT'],
    keywords: ['harvard', 'university', 'patient education'],
  },
  {
    source: 'guideline',
    title: 'Johns Hopkins Medicine',
    url: 'https://www.hopkinsmedicine.org/health',
    date: 'current',
    domains: ['hopkinsmedicine.org'],
    countries: ['DEFAULT'],
    keywords: ['johns hopkins', 'university', 'patient education'],
  },
  {
    source: 'guideline',
    title: 'Stanford Medicine',
    url: 'https://med.stanford.edu/',
    date: 'current',
    domains: ['stanford.edu', 'med.stanford.edu'],
    countries: ['DEFAULT'],
    keywords: ['stanford', 'university', 'medicine'],
  },
];

@Injectable()
export class MedicalRuntimeToolsService {
  private readonly logger = new Logger(MedicalRuntimeToolsService.name);

  constructor(private readonly medicalChatLearningService: MedicalChatLearningService) {}

  async buildContext(query: string, country = 'AR'): Promise<MedicalRuntimeToolContext> {
    const timezone = process.env.MEDICAL_CHAT_TIMEZONE?.trim() || DEFAULT_TIMEZONE;
    const now = new Date();
    const adaptiveDomains = this.medicalChatLearningService.getAdaptiveSourceHints();
    const internetMode = this.resolveInternetMode();
    const officialSources = await this.selectSources(query, country, internetMode, adaptiveDomains);
    const officialSourceEvidence = await this.fetchOfficialSourceEvidence(officialSources.slice(0, 4));
    const weather = await this.getWeather(query);

    return {
      generatedAt: now.toISOString(),
      timezone,
      currentTimeText: new Intl.DateTimeFormat('es-AR', {
        dateStyle: 'full',
        timeStyle: 'long',
        timeZone: timezone,
      }).format(now),
      ...(weather ? { weather } : {}),
      officialSources,
      officialSourceEvidence,
      allowedDomains: Array.from(new Set(officialSources.flatMap((source) => {
        const found = OFFICIAL_SOURCE_DIRECTORY.find((item) => item.url === source.url);
        return found?.domains ?? [];
      }))).sort(),
      notes: [
        internetMode === 'open'
          ? 'Internet abierto habilitado para soporte clinico profesional con trazabilidad de fuentes.'
          : 'Internet controlado: solo se permite consulta a fuentes oficiales/academicas preaprobadas y APIs operativas sin datos de paciente.',
        'No enviar identificadores del paciente en consultas web ni usar fuentes sin trazabilidad clínica.',
        'Bloqueos activos de seguridad web: deep/dark web, marianas web, dominios .onion y contenido pornografico.',
        'Para Argentina y cuidados criticos, priorizar SATI y Ministerio de Salud cuando correspondan.',
        ...(adaptiveDomains.length > 0
          ? [`Aprendizaje autonomo activo: dominios de alto valor historico=${adaptiveDomains.slice(0, 6).join(', ')}`]
          : ['Aprendizaje autonomo activo sin dominios historicos acumulados por el momento.']),
      ],
    };
  }

  private async selectSources(
    query: string,
    country: string,
    internetMode: 'controlled' | 'open',
    adaptiveDomains: string[],
  ): Promise<MedicalCitation[]> {
    const official = this.selectOfficialSources(query, country);
    if (internetMode !== 'open') {
      return official;
    }

    const openCandidates = await this.discoverOpenInternetSources(query, country);
    const all = [...official, ...openCandidates];
    return this.rankSourcesByAdaptiveSignals(all, adaptiveDomains).slice(0, 12);
  }

  private selectOfficialSources(query: string, country: string): MedicalCitation[] {
    const normalizedQuery = this.normalize(query);
    const normalizedCountry = country.toUpperCase();

    const scored = OFFICIAL_SOURCE_DIRECTORY
      .filter((source) => source.countries.includes(normalizedCountry) || source.countries.includes('DEFAULT'))
      .map((source) => {
        const keywordScore = source.keywords.reduce(
          (score, keyword) => score + (normalizedQuery.includes(this.normalize(keyword)) ? 1 : 0),
          0,
        );
        const localScore = source.countries.includes(normalizedCountry) ? 2 : 0;
        const satiScore = source.domains.includes('sati.org.ar') && normalizedCountry === 'AR' ? 3 : 0;
        return { source, score: keywordScore + localScore + satiScore };
      })
      .sort((a, b) => b.score - a.score);

    return scored.slice(0, 8).map(({ source }) => ({
      source: source.source,
      title: source.title,
      url: source.url,
      date: source.date,
    }));
  }

  private rankSourcesByAdaptiveSignals(
    sources: MedicalCitation[],
    adaptiveDomains: string[],
  ): MedicalCitation[] {
    const seen = new Set<string>();
    const unique = sources.filter((source) => {
      const key = `${source.source}|${source.url}`;
      if (seen.has(key)) return false;
      seen.add(key);
      return true;
    });

    const adaptiveSet = new Set(adaptiveDomains.map((d) => d.toLowerCase()));
    const baseScore = (source: MedicalCitation): number => {
      if (source.source === 'guideline') return 3;
      if (source.source === 'who' || source.source === 'cdc') return 2;
      return 1;
    };

    return unique
      .map((source) => {
        let adaptiveBoost = 0;
        try {
          const host = new URL(source.url).hostname.toLowerCase();
          if (adaptiveSet.has(host)) {
            adaptiveBoost = 3;
          }
        } catch {
          adaptiveBoost = 0;
        }
        return { source, score: baseScore(source) + adaptiveBoost };
      })
      .sort((a, b) => b.score - a.score)
      .map((item) => item.source);
  }

  private async discoverOpenInternetSources(query: string, country: string): Promise<MedicalCitation[]> {
    const sanitized = this.sanitizeQueryForWeb(query);
    if (!sanitized || this.containsBlockedWebKeyword(sanitized)) {
      return [];
    }

    const scopedQuery = `${sanitized} ${country} clinical guideline evidence`;
    const url = `https://www.google.com/search?q=${encodeURIComponent(scopedQuery)}&hl=es&gl=ar&num=10`;

    try {
      const controller = new AbortController();
      const timeout = setTimeout(() => controller.abort(), 4000);
      const res = await fetch(url, {
        signal: controller.signal,
        headers: {
          accept: 'text/html,application/xhtml+xml',
          'user-agent': 'MB-Chat-MedicalRuntimeTools/1.0 google-open-internet-clinical-retrieval',
        },
      });
      clearTimeout(timeout);
      if (!res.ok) return [];

      const html = await res.text();
      const discovered = this.extractSearchResultUrls(html)
        .map((candidateUrl): MedicalCitation => ({
          source: 'guideline',
          title: `Open clinical source: ${candidateUrl}`,
          url: candidateUrl,
          date: 'current',
        }))
        .slice(0, 6);

      return discovered;
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      this.logger.warn(`[MedicalRuntimeTools:openInternet] ${msg}`);
      return [];
    }
  }

  private extractSearchResultUrls(html: string): string[] {
    const urls: string[] = [];
    const regex = /href=["']([^"']+)["']/gi;
    const rawMatches = html.match(regex) ?? [];

    for (const match of rawMatches) {
      const hrefMatch = match.match(/href=["']([^"']+)["']/i);
      if (!hrefMatch) continue;
      const href = hrefMatch[1];
      const decoded = this.decodeSearchRedirect(href);
      if (!decoded) continue;
      if (!this.isAllowedOpenInternetUrl(decoded)) continue;
      urls.push(decoded);
      if (urls.length >= 12) break;
    }

    return Array.from(new Set(urls));
  }

  private decodeSearchRedirect(href: string): string | undefined {
    try {
      if (href.startsWith('/url?')) {
        const googleUrl = new URL(`https://www.google.com${href}`);
        const q = googleUrl.searchParams.get('q');
        if (q) return q;
      }

      const candidate = href.startsWith('http') ? href : `https://www.google.com${href}`;
      const url = new URL(candidate);
      const q = url.searchParams.get('q');
      if (q) {
        return decodeURIComponent(q);
      }
      return candidate;
    } catch {
      return undefined;
    }
  }

  private isAllowedOpenInternetUrl(rawUrl: string): boolean {
    try {
      const url = new URL(rawUrl);
      if (url.protocol !== 'https:') return false;
      const host = url.hostname.toLowerCase();
      if (this.containsBlockedWebKeyword(rawUrl)) return false;
      if (BLOCKED_WEB_HOST_SNIPPETS.some((snippet) => host.includes(snippet))) return false;
      if (host.includes('facebook.com') || host.includes('instagram.com') || host.includes('tiktok.com')) {
        return false;
      }
      if (host.includes('google.com') || host.includes('gstatic.com')) return false;
      return true;
    } catch {
      return false;
    }
  }

  private sanitizeQueryForWeb(query: string): string {
    return query
      .replace(/\b[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}\b/gi, ' ')
      .replace(/(?<!\d)(?:\+?\d[\d\s().-]{7,}\d)(?!\d)/g, ' ')
      .replace(/\b(?:dni|documento|pasaporte|ssn|cuit|cuil|rut)\s*[:#-]?\s*[A-Z0-9.\-]{5,}\b/gi, ' ')
      .replace(/\s+/g, ' ')
      .trim()
      .slice(0, 280);
  }

  private containsBlockedWebKeyword(text: string): boolean {
    const normalized = this.normalize(text);
    return BLOCKED_WEB_KEYWORDS.some((keyword) => normalized.includes(this.normalize(keyword)));
  }

  private resolveInternetMode(): 'controlled' | 'open' {
    const value = process.env.MEDICAL_CHAT_INTERNET_MODE?.trim().toLowerCase();
    return value === 'open' ? 'open' : 'controlled';
  }

  private async fetchOfficialSourceEvidence(
    sources: MedicalCitation[],
  ): Promise<MedicalRuntimeToolContext['officialSourceEvidence']> {
    const evidence = await Promise.all(sources.map(async (source) => {
      if (!this.isAllowedContextUrl(source.url)) return undefined;

      try {
        const controller = new AbortController();
        const timeout = setTimeout(() => controller.abort(), 3500);
        const res = await fetch(source.url, {
          signal: controller.signal,
          headers: {
            accept: 'text/html,application/xhtml+xml,application/xml;q=0.9,text/plain;q=0.8',
            'user-agent': 'MB-Chat-MedicalRuntimeTools/1.0 controlled-official-source-reader',
          },
        });
        clearTimeout(timeout);

        if (!res.ok) return undefined;
        const text = await res.text();
        const excerpt = this.extractExcerpt(text);
        if (!excerpt) return undefined;

        return {
          source: source.source,
          title: source.title,
          url: source.url,
          excerpt,
        };
      } catch (err) {
        const msg = err instanceof Error ? err.message : String(err);
        this.logger.warn(`[MedicalRuntimeTools:officialSource] ${source.url} ${msg}`);
        return undefined;
      }
    }));

    return evidence.filter((item): item is MedicalRuntimeToolContext['officialSourceEvidence'][number] => Boolean(item));
  }

  private isAllowedContextUrl(rawUrl: string): boolean {
    if (this.resolveInternetMode() === 'open') {
      return this.isAllowedOpenInternetUrl(rawUrl);
    }

    try {
      const url = new URL(rawUrl);
      if (url.protocol !== 'https:') return false;
      const allowed = OFFICIAL_SOURCE_DIRECTORY.flatMap((source) => source.domains);
      return allowed.some((domain) => url.hostname === domain || url.hostname.endsWith(`.${domain}`));
    } catch {
      return false;
    }
  }

  private extractExcerpt(raw: string): string {
    const title = this.extractFirst(raw, /<title[^>]*>([\s\S]*?)<\/title>/i);
    const description = this.extractFirst(
      raw,
      /<meta[^>]+name=["']description["'][^>]+content=["']([^"']+)["'][^>]*>/i,
    );
    const plain = raw
      .replace(/<script[\s\S]*?<\/script>/gi, ' ')
      .replace(/<style[\s\S]*?<\/style>/gi, ' ')
      .replace(/<[^>]+>/g, ' ')
      .replace(/&nbsp;/g, ' ')
      .replace(/&amp;/g, '&')
      .replace(/\s+/g, ' ')
      .trim();

    return [title, description, plain]
      .filter(Boolean)
      .join(' | ')
      .slice(0, 900);
  }

  private extractFirst(input: string, pattern: RegExp): string {
    const match = input.match(pattern);
    return (match?.[1] ?? '')
      .replace(/<[^>]+>/g, ' ')
      .replace(/\s+/g, ' ')
      .trim();
  }

  private async getWeather(query: string): Promise<MedicalRuntimeToolContext['weather'] | undefined> {
    if (process.env.MEDICAL_CHAT_WEATHER_ENABLED === 'false') {
      return undefined;
    }

    const fallbackLat = this.readNumberEnv('MEDICAL_CHAT_WEATHER_LAT', DEFAULT_WEATHER_LAT);
    const fallbackLon = this.readNumberEnv('MEDICAL_CHAT_WEATHER_LON', DEFAULT_WEATHER_LON);
    const fallbackLocation = process.env.MEDICAL_CHAT_WEATHER_LOCATION?.trim() || DEFAULT_WEATHER_LOCATION;
    let lat = fallbackLat;
    let lon = fallbackLon;
    let location = fallbackLocation;

    const normalizedQuery = this.normalize(query || '');
    const weatherIntent =
      normalizedQuery.includes('clima')
      || normalizedQuery.includes('tiempo')
      || normalizedQuery.includes('temperatura')
      || normalizedQuery.includes('lluvia')
      || normalizedQuery.includes('viento');

    if (weatherIntent) {
      const locationMatch = normalizedQuery.match(/\b(?:en|de)\s+([a-z0-9\s,.-]{3,80})$/i);
      const requestedLocation = locationMatch?.[1]?.trim();
      if (requestedLocation) {
        const geocodeUrl = `https://geocoding-api.open-meteo.com/v1/search?name=${encodeURIComponent(requestedLocation)}&count=1&language=es&format=json`;
        try {
          const geoRes = await fetch(geocodeUrl);
          if (geoRes.ok) {
            const geoJson = await geoRes.json() as {
              results?: Array<{ latitude?: number; longitude?: number; name?: string; admin1?: string; country?: string }>;
            };
            const top = geoJson.results?.[0];
            if (top && typeof top.latitude === 'number' && typeof top.longitude === 'number') {
              lat = top.latitude;
              lon = top.longitude;
              const locParts = [top.name, top.admin1, top.country].filter((value) => typeof value === 'string' && value.trim().length > 0);
              location = locParts.join(', ') || requestedLocation;
            }
          }
        } catch (err) {
          const msg = err instanceof Error ? err.message : String(err);
          this.logger.warn(`[MedicalRuntimeTools:weather-geocode] ${msg}`);
        }
      }
    }

    const url = [
      'https://api.open-meteo.com/v1/forecast',
      `?latitude=${lat}`,
      `&longitude=${lon}`,
      '&current=temperature_2m,precipitation,wind_speed_10m',
      '&forecast_days=1',
      '&timezone=auto',
    ].join('');

    try {
      const res = await fetch(url);
      if (!res.ok) return undefined;
      const json = await res.json() as {
        current?: {
          temperature_2m?: number;
          precipitation?: number;
          wind_speed_10m?: number;
        };
      };

      const current = json.current ?? {};
      const temperatureC = this.finiteNumber(current.temperature_2m);
      const precipitationMm = this.finiteNumber(current.precipitation);
      const windKmh = this.finiteNumber(current.wind_speed_10m);

      return {
        provider: 'Open-Meteo',
        location,
        ...(temperatureC !== undefined ? { temperatureC } : {}),
        ...(windKmh !== undefined ? { windKmh } : {}),
        ...(precipitationMm !== undefined ? { precipitationMm } : {}),
        summary: [
          temperatureC !== undefined ? `${temperatureC} C` : undefined,
          precipitationMm !== undefined ? `precipitacion ${precipitationMm} mm` : undefined,
          windKmh !== undefined ? `viento ${windKmh} km/h` : undefined,
        ].filter(Boolean).join(', ') || 'pronostico no disponible',
        url: 'https://open-meteo.com/',
      };
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      this.logger.warn(`[MedicalRuntimeTools:weather] ${msg}`);
      return undefined;
    }
  }

  private readNumberEnv(name: string, fallback: number): number {
    const raw = process.env[name];
    if (!raw) return fallback;
    const parsed = Number(raw);
    return Number.isFinite(parsed) ? parsed : fallback;
  }

  private finiteNumber(value: unknown): number | undefined {
    return typeof value === 'number' && Number.isFinite(value) ? value : undefined;
  }

  private normalize(value: string): string {
    return value
      .toLowerCase()
      .normalize('NFD')
      .replace(/[\u0300-\u036f]/g, '');
  }
}
