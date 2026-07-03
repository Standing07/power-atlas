import type { SeriesPoint } from './types'
import type { TKey } from '../i18n'

/** 全站固定的能源配色（親民原則：同一種能源在任何圖表都是同一個顏色） */
export const ENERGY_COLORS: Record<string, string> = {
  coal: '#57534e', // 煤＝深灰
  gas: '#f97316', // 天然氣＝橘
  oil: '#a16207', // 石油＝棕
  nuclear: '#8b5cf6', // 核能＝紫
  hydro: '#2563eb', // 水力＝深藍
  wind: '#38bdf8', // 風力＝天藍
  windOnshore: '#38bdf8', // 陸域風電＝天藍
  windOffshore: '#0d9488', // 離岸風電＝藍綠
  solar: '#eab308', // 太陽能＝黃
  geothermal: '#c2410c', // 地熱＝磚紅
  biofuel: '#16a34a', // 生質能＝綠
  otherRenewables: '#65a30d', // 其他再生＝橄欖綠
}

export const ENERGY_LABEL_KEYS: Record<string, TKey> = {
  coal: 'src_coal',
  gas: 'src_gas',
  oil: 'src_oil',
  nuclear: 'src_nuclear',
  hydro: 'src_hydro',
  wind: 'src_wind',
  windOnshore: 'src_windOnshore',
  windOffshore: 'src_windOffshore',
  solar: 'src_solar',
  geothermal: 'src_geothermal',
  biofuel: 'src_biofuel',
  otherRenewables: 'src_otherRenewables',
}

/** 趨勢圖使用的基本來源（風力不拆分，確保全部年份一致） */
export const TREND_KEYS = [
  'coal', 'gas', 'oil', 'nuclear', 'hydro', 'wind', 'solar', 'biofuel', 'otherRenewables',
] as const

export interface MixSlice {
  key: string
  value: number
  estimated?: boolean
}

/** 圓餅圖用的能源切片：有 IRENA 拆分時顯示陸域/離岸風電與地熱 */
export function mixSlices(p: SeriesPoint): MixSlice[] {
  const slices: MixSlice[] = []
  const push = (key: string, value: number | null | undefined, estimated?: boolean) => {
    if (value != null && value > 0.001) slices.push({ key, value, estimated })
  }
  push('coal', p.coal)
  push('gas', p.gas)
  push('oil', p.oil)
  push('nuclear', p.nuclear)
  push('hydro', p.hydro)
  if (p.windOnshore != null && p.windOffshore != null) {
    push('windOnshore', p.windOnshore, p.splitEstimated)
    push('windOffshore', p.windOffshore, p.splitEstimated)
  } else {
    push('wind', p.wind)
  }
  push('solar', p.solar)
  if (p.geothermal != null && p.geothermal > 0) {
    push('geothermal', p.geothermal, p.splitEstimated)
    push('otherRenewables', p.otherRenewables)
  } else {
    push('otherRenewables', p.otherRenewables)
  }
  push('biofuel', p.biofuel)
  return slices
}

/** 數字格式化 */
export function fmt(n: number | null | undefined, digits = 0): string {
  if (n == null || !Number.isFinite(n)) return '–'
  return n.toLocaleString(undefined, { maximumFractionDigits: digits })
}

/** TWh → 人類看得懂的度數字串。zh 用「億度」，en 用 TWh。 */
export function twhToHuman(twh: number | null | undefined, lang: 'zh' | 'en'): string {
  if (twh == null || !Number.isFinite(twh)) return '–'
  if (lang === 'zh') return `${fmt(twh * 10, twh * 10 >= 100 ? 0 : 1)} 億度`
  return `${fmt(twh, twh >= 100 ? 0 : 1)} TWh`
}
