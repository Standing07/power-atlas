import type { CountriesIndex, CountrySeries } from './types'

const BASE = import.meta.env.BASE_URL

const cache = new Map<string, unknown>()

async function fetchJson<T>(path: string): Promise<T> {
  if (cache.has(path)) return cache.get(path) as T
  const res = await fetch(BASE + path)
  if (!res.ok) throw new Error(`Failed to load ${path}: ${res.status}`)
  const json = (await res.json()) as T
  cache.set(path, json)
  return json
}

export const loadIndex = () => fetchJson<CountriesIndex>('data/countries.json')
export const loadCountry = (iso3: string) => fetchJson<CountrySeries>(`data/country/${iso3}.json`)
export interface WorldGeo {
  type: 'FeatureCollection'
  features: { type: 'Feature'; properties: { iso3?: string; name: string }; geometry: unknown }[]
}
export const loadWorldGeo = () => fetchJson<WorldGeo>('data/world.geo.json')
