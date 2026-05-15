import { Injectable, Logger } from '@nestjs/common';
import { MedicalNormalizedDocument } from './types';

const CACHE_TTL_MS = 30 * 60_000;

interface CacheEntry {
  expiresAt: number;
  value: MedicalNormalizedDocument[];
}

@Injectable()
export class MedicalSourcesService {
  private readonly logger = new Logger(MedicalSourcesService.name);
  private readonly cache = new Map<string, CacheEntry>();

  async fetchTrustedDocuments(
    query: string,
    country = 'US',
    perSource = 8,
  ): Promise<MedicalNormalizedDocument[]> {
    const key = `${query.toLowerCase()}|${country.toUpperCase()}|${perSource}`;
    const cached = this.cache.get(key);
    if (cached && Date.now() < cached.expiresAt) {
      return cached.value;
    }

    const [pubmed, who, cdc, trials, guidelines] = await Promise.all([
      this.fetchPubMed(query, perSource),
      this.fetchWho(query, perSource),
      this.fetchCdc(query, perSource),
      this.fetchClinicalTrials(query, perSource),
      this.fetchGuidelines(query, country, perSource),
    ]);

    const all = [...guidelines, ...who, ...cdc, ...trials, ...pubmed]
      .filter((d) => d.title && d.url)
      .slice(0, perSource * 5);

    this.cache.set(key, { expiresAt: Date.now() + CACHE_TTL_MS, value: all });
    return all;
  }

  private async fetchPubMed(query: string, limit: number): Promise<MedicalNormalizedDocument[]> {
    try {
      const term = encodeURIComponent(query);
      const esearchUrl = `https://eutils.ncbi.nlm.nih.gov/entrez/eutils/esearch.fcgi?db=pubmed&retmode=json&sort=relevance&retmax=${limit}&term=${term}`;
      const searchRes = await fetch(esearchUrl);
      if (!searchRes.ok) return [];
      const searchJson = (await searchRes.json()) as {
        esearchresult?: { idlist?: string[] };
      };
      const ids = searchJson.esearchresult?.idlist ?? [];
      if (!ids.length) return [];

      const summaryUrl = `https://eutils.ncbi.nlm.nih.gov/entrez/eutils/esummary.fcgi?db=pubmed&retmode=json&id=${ids.join(',')}`;
      const summaryRes = await fetch(summaryUrl);
      if (!summaryRes.ok) return [];
      const summaryJson = (await summaryRes.json()) as {
        result?: Record<string, Record<string, unknown>>;
      };

      return ids
        .map((id) => {
          const row = summaryJson.result?.[id] ?? {};
          const title = String(row.title ?? '').trim();
          const date = String(row.pubdate ?? row.epubdate ?? '');
          const source = String(row.fulljournalname ?? row.source ?? 'PubMed');
          const authors = Array.isArray(row.authors)
            ? row.authors
                .map((a) => (a && typeof a === 'object' ? String((a as Record<string, unknown>).name ?? '') : ''))
                .filter(Boolean)
                .slice(0, 3)
            : [];
          const abstract = `Journal: ${source}. Authors: ${authors.join(', ') || 'N/A'}.`;

          return {
            title,
            abstract,
            source: 'pubmed' as const,
            url: `https://pubmed.ncbi.nlm.nih.gov/${id}/`,
            date: date || new Date().toISOString(),
            keywords: this.extractKeywords(`${title} ${source} ${query}`),
            externalId: id,
          };
        })
        .filter((d) => d.title.length > 0);
    } catch (error) {
      const msg = error instanceof Error ? error.message : String(error);
      this.logger.warn(`[Knowledge:PubMed] ${msg}`);
      return [];
    }
  }

  private async fetchWho(query: string, limit: number): Promise<MedicalNormalizedDocument[]> {
    const defaultFeed = 'https://www.who.int/feeds/entity/health-topics/news/en/rss.xml';
    const feed = process.env.WHO_RSS_URL?.trim() || defaultFeed;
    return this.fetchRss(feed, 'who', query, limit);
  }

  private async fetchCdc(query: string, limit: number): Promise<MedicalNormalizedDocument[]> {
    const defaultFeed = 'https://tools.cdc.gov/api/v2/resources/media/316422.rss';
    const feed = process.env.CDC_RSS_URL?.trim() || defaultFeed;
    return this.fetchRss(feed, 'cdc', query, limit);
  }

  private async fetchClinicalTrials(query: string, limit: number): Promise<MedicalNormalizedDocument[]> {
    try {
      const term = encodeURIComponent(query);
      const url = `https://clinicaltrials.gov/api/v2/studies?query.term=${term}&pageSize=${limit}`;
      const res = await fetch(url);
      if (!res.ok) return [];

      const json = (await res.json()) as {
        studies?: Array<Record<string, unknown>>;
      };
      const studies = json.studies ?? [];

      return studies
        .map((study) => {
          const protocol = (study.protocolSection as Record<string, unknown>) ?? {};
          const ident = (protocol.identificationModule as Record<string, unknown>) ?? {};
          const status = (protocol.statusModule as Record<string, unknown>) ?? {};
          const desc = (protocol.descriptionModule as Record<string, unknown>) ?? {};

          const nctId = String(ident.nctId ?? '');
          const title = String(ident.briefTitle ?? '').trim();
          const abstract = String(desc.briefSummary ?? desc.detailedDescription ?? '').slice(0, 2000);
          const date = String(status.lastUpdatePostDateStruct && typeof status.lastUpdatePostDateStruct === 'object'
            ? (status.lastUpdatePostDateStruct as Record<string, unknown>).date ?? ''
            : status.lastUpdatePostDate ?? '');

          return {
            title,
            abstract,
            source: 'clinicaltrials' as const,
            url: nctId ? `https://clinicaltrials.gov/study/${nctId}` : '',
            date: date || new Date().toISOString(),
            keywords: this.extractKeywords(`${title} ${abstract} ${query}`),
            externalId: nctId || undefined,
          };
        })
        .filter((d) => d.title.length > 0 && d.url.length > 0);
    } catch (error) {
      const msg = error instanceof Error ? error.message : String(error);
      this.logger.warn(`[Knowledge:ClinicalTrials] ${msg}`);
      return [];
    }
  }

  private async fetchGuidelines(
    query: string,
    country: string,
    limit: number,
  ): Promise<MedicalNormalizedDocument[]> {
    const mappingRaw = process.env.CLINICAL_GUIDELINE_FEEDS ?? '';
    const map = this.parseGuidelineMapping(mappingRaw);
    const feeds = map[country.toUpperCase()] ?? map.DEFAULT ?? [];

    if (!feeds.length) return [];

    const results = await Promise.all(feeds.map((feed) => this.fetchRss(feed, 'guideline', query, limit, country)));
    return results.flat().slice(0, limit);
  }

  private parseGuidelineMapping(input: string): Record<string, string[]> {
    // Expected format:
    // US=https://www.cdc.gov/rss;UK=https://www.nice.org.uk/guidance/rss.xml;DEFAULT=https://www.who.int/rss
    if (!input.trim()) return {};
    const out: Record<string, string[]> = {};

    for (const chunk of input.split(';')) {
      const [rawKey, rawUrls] = chunk.split('=');
      const key = (rawKey ?? '').trim().toUpperCase();
      if (!key) continue;
      const urls = (rawUrls ?? '')
        .split(',')
        .map((x) => x.trim())
        .filter((x) => x.startsWith('http'));
      if (urls.length > 0) out[key] = urls;
    }

    return out;
  }

  private async fetchRss(
    url: string,
    source: MedicalNormalizedDocument['source'],
    query: string,
    limit: number,
    country?: string,
  ): Promise<MedicalNormalizedDocument[]> {
    try {
      const res = await fetch(url);
      if (!res.ok) return [];
      const xml = await res.text();

      const items = this.extractRssItems(xml)
        .map((item) => ({
          title: item.title,
          abstract: item.description,
          source,
          url: item.link,
          date: item.pubDate || new Date().toISOString(),
          keywords: this.extractKeywords(`${item.title} ${item.description} ${query}`),
          country,
        }))
        .filter((d) => d.title.toLowerCase().includes(query.toLowerCase()) || d.abstract.toLowerCase().includes(query.toLowerCase()))
        .slice(0, limit);

      return items;
    } catch (error) {
      const msg = error instanceof Error ? error.message : String(error);
      this.logger.warn(`[Knowledge:RSS:${source}] ${msg}`);
      return [];
    }
  }

  private extractRssItems(xml: string): Array<{
    title: string;
    link: string;
    description: string;
    pubDate: string;
  }> {
    const blocks = xml.match(/<item>[\s\S]*?<\/item>/g) ?? [];

    return blocks.map((block) => ({
      title: this.extractTag(block, 'title'),
      link: this.extractTag(block, 'link'),
      description: this.stripHtml(this.extractTag(block, 'description')),
      pubDate: this.extractTag(block, 'pubDate'),
    }));
  }

  private extractTag(raw: string, tag: string): string {
    const m = raw.match(new RegExp(`<${tag}>([\\s\\S]*?)<\\/${tag}>`, 'i'));
    return (m?.[1] ?? '').replace(/<!\[CDATA\[|\]\]>/g, '').trim();
  }

  private stripHtml(input: string): string {
    return input.replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ').trim();
  }

  private extractKeywords(text: string): string[] {
    const words = (text.toLowerCase().match(/[a-z0-9]{4,}/g) ?? [])
      .filter((x) => !['with', 'that', 'this', 'from', 'have', 'were', 'which', 'about', 'their'].includes(x));
    return Array.from(new Set(words)).slice(0, 12);
  }
}
