type Unavailable = null;

const API_BASE_URL = process.env.NEXT_PUBLIC_API_URL || process.env.API_URL || 'http://127.0.0.1:8003';

async function fetchJson<T>(url: string): Promise<T | null> {
  try {
    const response = await fetch(url);
    if (!response.ok) {
      return null;
    }

    return (await response.json()) as T;
  } catch {
    return null;
  }
}

// The FastAPI service is the only source for observations and predictions.
export async function getPrediction(lat: number, lon: number): Promise<any | Unavailable> {
  return fetchJson<any>(`${API_BASE_URL}/predict?lat=${lat}&lon=${lon}`);
}

export async function getForecast(lat: number, lon: number): Promise<any | Unavailable> {
  return fetchJson<any>(`${API_BASE_URL}/api/forecast/2day?lat=${lat}&lon=${lon}`);
}

export async function getHistorical(lat: number, lon: number): Promise<any | Unavailable> {
  return fetchJson<any>(`${API_BASE_URL}/api/historical?lat=${lat}&lon=${lon}`);
}

export async function getSubsurface(lat: number, lon: number): Promise<any | Unavailable> {
  return fetchJson<any>(`${API_BASE_URL}/api/analysis/subsurface?lat=${lat}&lon=${lon}`);
}

export async function getValidation(): Promise<any | Unavailable> {
  return fetchJson<any>(`${API_BASE_URL}/validation`);
}

export async function getDataQuality(): Promise<any | Unavailable> {
  return fetchJson<any>(`${API_BASE_URL}/api/data-quality`);
}

export async function getArgoProfiles(
  dateFrom?: string,
  dateTo?: string,
  parameter?: string,
  limit: number = 2500,
): Promise<any[] | Unavailable> {
  const params = new URLSearchParams({
    limit: String(limit),
  });

  if (dateFrom) params.set('date_from', dateFrom);
  if (dateTo) params.set('date_to', dateTo);
  if (parameter) params.set('parameter', parameter);

  const data = await fetchJson<{ profiles?: any[] }>(`${API_BASE_URL}/argo/profiles?${params.toString()}`);
  return data?.profiles ?? [];
}

export async function getArgoSingleProfile(platform: string, cycle: string | number) {
  return fetchJson<any>(`${API_BASE_URL}/argo/profile/${encodeURIComponent(platform)}/${cycle}`);
}