export interface Shares {
  coal: number | null
  gas: number | null
  oil: number | null
  nuclear: number | null
  hydro: number | null
  wind: number | null
  solar: number | null
  biofuel: number | null
  otherRenewables: number | null
  lowCarbon: number | null
  renewables: number | null
  fossil: number | null
}

export interface FuelTrade {
  coalProduction: number | null
  coalConsumption: number | null
  oilProduction: number | null
  oilConsumption: number | null
  gasProduction: number | null
  gasConsumption: number | null
}

export interface CountryIndexEntry {
  iso3: string
  iso2: string | null
  name: string
  latestYear: number
  generation: number | null
  demand: number | null
  demandPerCapita: number | null
  population: number | null
  carbonIntensity: number | null
  netImportsShare: number | null
  selfSufficiency: number | null
  tradeYear: number
  energyPerGdp: number | null
  shares: Shares
  fuelTrade: FuelTrade
  windOnshore: number | null
  windOffshore: number | null
  geothermal: number | null
  badges: string[]
}

export interface SeriesPoint {
  year: number
  generation: number | null
  demand: number | null
  demandPerCapita: number | null
  carbonIntensity: number | null
  netImports: number | null
  netImportsShare: number | null
  population: number | null
  coal: number | null
  gas: number | null
  oil: number | null
  nuclear: number | null
  hydro: number | null
  wind: number | null
  solar: number | null
  biofuel: number | null
  otherRenewables: number | null
  windOnshore?: number | null
  windOffshore?: number | null
  geothermal?: number | null
  splitEstimated?: boolean
  shares: Shares
  selfSufficiency: number | null
  fuelTrade: FuelTrade
  energyPerGdp: number | null
}

export interface CountrySeries {
  iso3: string
  iso2: string | null
  name: string
  series: SeriesPoint[]
}

export interface CountriesIndex {
  generated: string
  sources: Record<string, string>
  world: { name: string; latestYear: number; latest: SeriesPoint; series: SeriesPoint[] }
  countries: CountryIndexEntry[]
}
