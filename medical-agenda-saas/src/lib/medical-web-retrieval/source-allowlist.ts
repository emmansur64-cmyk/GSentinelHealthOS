import type { MedicalWebAllowedSource } from "./types";

function encoded(query: string): string {
  return encodeURIComponent(query);
}

export const MEDICAL_WEB_ALLOWLIST: MedicalWebAllowedSource[] = [
  { domain: "who.int", type: "organism", label: "WHO", searchUrl: (query) => `https://www.who.int/search?query=${encoded(query)}` },
  { domain: "paho.org", type: "organism", label: "PAHO", searchUrl: (query) => `https://www.paho.org/en/search/r?keys=${encoded(query)}` },
  { domain: "nih.gov", type: "organism", label: "NIH", searchUrl: (query) => `https://search.nih.gov/search?utf8=%E2%9C%93&affiliate=nih&query=${encoded(query)}` },
  { domain: "cdc.gov", type: "organism", label: "CDC", searchUrl: (query) => `https://search.cdc.gov/search/?query=${encoded(query)}` },
  { domain: "fda.gov", type: "organism", label: "FDA", searchUrl: (query) => `https://www.fda.gov/search?s=${encoded(query)}` },
  { domain: "ema.europa.eu", type: "organism", label: "EMA", searchUrl: (query) => `https://www.ema.europa.eu/en/search/search?search_api_fulltext=${encoded(query)}` },
  { domain: "argentina.gob.ar", type: "organism", label: "Argentina.gob.ar", searchUrl: (query) => `https://www.argentina.gob.ar/buscar/${encoded(query)}` },
  { domain: "anmat.gob.ar", type: "organism", label: "ANMAT", searchUrl: (query) => `https://www.argentina.gob.ar/anmat/buscador?search=${encoded(query)}` },
  { domain: "pubmed.ncbi.nlm.nih.gov", type: "science", label: "PubMed", searchUrl: (query) => `https://pubmed.ncbi.nlm.nih.gov/?term=${encoded(query)}` },
  { domain: "ncbi.nlm.nih.gov", type: "science", label: "NCBI", searchUrl: (query) => `https://www.ncbi.nlm.nih.gov/search/all/?term=${encoded(query)}` },
  { domain: "cochranelibrary.com", type: "science", label: "Cochrane Library", searchUrl: (query) => `https://www.cochranelibrary.com/search?searchBy=all&keyword=${encoded(query)}` },
  { domain: "nejm.org", type: "science", label: "NEJM", searchUrl: (query) => `https://www.nejm.org/search?q=${encoded(query)}` },
  { domain: "thelancet.com", type: "science", label: "The Lancet", searchUrl: (query) => `https://www.thelancet.com/action/doSearch?AllField=${encoded(query)}` },
  { domain: "bmj.com", type: "science", label: "BMJ", searchUrl: (query) => `https://www.bmj.com/search/${encoded(query)}` },
  { domain: "jamanetwork.com", type: "science", label: "JAMA Network", searchUrl: (query) => `https://jamanetwork.com/searchresults?q=${encoded(query)}` },
  { domain: "nature.com", type: "science", label: "Nature", searchUrl: (query) => `https://www.nature.com/search?q=${encoded(query)}` },
  { domain: "harvard.edu", type: "university_hospital", label: "Harvard", searchUrl: (query) => `https://www.harvard.edu/search/?q=${encoded(query)}` },
  { domain: "hopkinsmedicine.org", type: "university_hospital", label: "Johns Hopkins Medicine", searchUrl: (query) => `https://www.hopkinsmedicine.org/search?q=${encoded(query)}` },
  { domain: "mayoclinic.org", type: "university_hospital", label: "Mayo Clinic", searchUrl: (query) => `https://www.mayoclinic.org/search/search-results?q=${encoded(query)}` },
  { domain: "clevelandclinic.org", type: "university_hospital", label: "Cleveland Clinic", searchUrl: (query) => `https://my.clevelandclinic.org/search?q=${encoded(query)}` },
  { domain: "stanford.edu", type: "university_hospital", label: "Stanford", searchUrl: (query) => `https://www.stanford.edu/search/?q=${encoded(query)}` },
  { domain: "ox.ac.uk", type: "university_hospital", label: "Oxford", searchUrl: (query) => `https://www.ox.ac.uk/search?SearchableText=${encoded(query)}` },
  { domain: "cam.ac.uk", type: "university_hospital", label: "Cambridge", searchUrl: (query) => `https://www.cam.ac.uk/search?q=${encoded(query)}` },
  { domain: "ucl.ac.uk", type: "university_hospital", label: "UCL", searchUrl: (query) => `https://www.ucl.ac.uk/search?q=${encoded(query)}` },
  { domain: "psychiatry.org", type: "mental_health", label: "American Psychiatric Association", searchUrl: (query) => `https://www.psychiatry.org/search-results?search=${encoded(query)}` },
  { domain: "apa.org", type: "mental_health", label: "American Psychological Association", searchUrl: (query) => `https://www.apa.org/search?query=${encoded(query)}` },
  { domain: "nimh.nih.gov", type: "mental_health", label: "NIMH", searchUrl: (query) => `https://www.nimh.nih.gov/search?query=${encoded(query)}` },
  { domain: "dailymed.nlm.nih.gov", type: "medication", label: "DailyMed", searchUrl: (query) => `https://dailymed.nlm.nih.gov/dailymed/search.cfm?query=${encoded(query)}` },
];

export function isAllowedMedicalSourceUrl(rawUrl: string): boolean {
  try {
    const url = new URL(rawUrl);
    if (url.protocol !== "https:") return false;
    const hostname = url.hostname.toLowerCase();
    return MEDICAL_WEB_ALLOWLIST.some((source) => hostname === source.domain || hostname.endsWith(`.${source.domain}`));
  } catch {
    return false;
  }
}
