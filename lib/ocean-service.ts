type Unavailable = null;

// The FastAPI service is the only source for observations and predictions.
export function getPrediction(_lat: number, _lon: number): Unavailable {
  return null;
}

export function getForecast(_lat: number, _lon: number): Unavailable {
  return null;
}

export function getHistorical(_lat: number, _lon: number): Unavailable {
  return null;
}

export function getSubsurface(_lat: number, _lon: number): Unavailable {
  return null;
}

export function getValidation(): Unavailable {
  return null;
}

export function getDataQuality(): Unavailable {
  return null;
}

export function getArgoProfiles(
  _dateFrom?: string,
  _dateTo?: string,
  _parameter?: string,
  _limit: number = 2500,
): never[] {
  return [];
}

export function getArgoSingleProfile(_platform: string, _cycle: string | number) {
  return { error: 'Real Argo backend is unavailable' };
}