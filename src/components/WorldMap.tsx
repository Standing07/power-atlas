import { useEffect, useMemo, useRef, useState } from 'react'
import * as echarts from 'echarts'
import { useNavigate } from 'react-router-dom'
import EChart from './EChart'
import { useLang } from '../i18n'
import { loadIndex, loadWorldGeo } from '../lib/data'
import type { CountryIndexEntry } from '../lib/types'
import { fmt } from '../lib/energy'

export type MapMetric = 'lowCarbon' | 'carbonIntensity' | 'selfSufficiency'

const REGIONS: Record<string, { center: [number, number]; zoom: number }> = {
  world: { center: [10, 20], zoom: 1.15 },
  eastAsia: { center: [122, 30], zoom: 4.2 },
  europe: { center: [12, 53], zoom: 3.8 },
  northAmerica: { center: [-98, 45], zoom: 2.4 },
  seAsia: { center: [110, 8], zoom: 4 },
}

/** 可縮放/拖曳的世界著色地圖 */
export default function WorldMap() {
  const { t, lang, countryName } = useLang()
  const navigate = useNavigate()
  const [metric, setMetric] = useState<MapMetric>('lowCarbon')
  const [countries, setCountries] = useState<CountryIndexEntry[]>([])
  const [mapReady, setMapReady] = useState(false)
  const chartRef = useRef<echarts.ECharts | null>(null)

  useEffect(() => {
    Promise.all([loadWorldGeo(), loadIndex()]).then(([geo, idx]) => {
      echarts.registerMap('world', geo as Parameters<typeof echarts.registerMap>[1])
      setCountries(idx.countries)
      setMapReady(true)
    })
  }, [])

  const option = useMemo<echarts.EChartsOption>(() => {
    if (!mapReady) return {}
    const byIso = new Map(countries.map((c) => [c.iso3, c]))
    const value = (c: CountryIndexEntry): number | null =>
      metric === 'lowCarbon' ? c.shares.lowCarbon
      : metric === 'carbonIntensity' ? c.carbonIntensity
      : c.selfSufficiency == null ? null : Math.min(c.selfSufficiency * 100, 200)
    const data = countries
      .map((c) => ({ name: c.iso3, value: value(c) }))
      .filter((d) => d.value != null) as { name: string; value: number }[]

    const visualByMetric: Record<MapMetric, Partial<echarts.VisualMapComponentOption>> = {
      lowCarbon: { min: 0, max: 100, inRange: { color: ['#d6d3d1', '#a7f3d0', '#10a37f', '#065f46'] }, text: ['100%', '0%'] },
      carbonIntensity: { min: 0, max: 800, inRange: { color: ['#065f46', '#facc15', '#ea580c', '#44403c'] }, text: ['800+', '0 g'] },
      selfSufficiency: { min: 0, max: 200, inRange: { color: ['#b91c1c', '#fde68a', '#10a37f', '#065f46'] }, text: ['200%+', '0%'] },
    }

    return {
      tooltip: {
        trigger: 'item',
        confine: true,
        formatter: (params) => {
          const p = params as { name: string; value: number | undefined }
          const c = byIso.get(p.name)
          if (!c) return ''
          const name = countryName(c.iso2, c.name)
          const val =
            metric === 'lowCarbon' ? `${t('metric_lowCarbon')}：${fmt(c.shares.lowCarbon, 1)}%`
            : metric === 'carbonIntensity' ? `${t('metric_carbonIntensity')}：${fmt(c.carbonIntensity)} gCO₂/kWh`
            : `${t('metric_selfSufficiency')}：${c.selfSufficiency == null ? '–' : fmt(c.selfSufficiency * 100)}%`
          return `<b>${name}</b><br/>${val}<br/><span style="color:#888;font-size:11px">${t('map_hint')}</span>`
        },
      },
      visualMap: {
        type: 'continuous',
        left: 8,
        bottom: 8,
        calculable: false,
        itemHeight: 90,
        textStyle: { fontSize: 10, color: '#78716c' },
        ...visualByMetric[metric],
      },
      series: [
        {
          type: 'map',
          map: 'world',
          nameProperty: 'iso3',
          roam: true,
          zoom: REGIONS.world.zoom,
          center: REGIONS.world.center,
          scaleLimit: { min: 0.8, max: 12 },
          itemStyle: { areaColor: '#e7e5e4', borderColor: '#ffffff', borderWidth: 0.6 },
          emphasis: { label: { show: false }, itemStyle: { areaColor: '#fbbf24' } },
          select: { disabled: true },
          data,
        },
      ],
    }
  }, [countries, metric, mapReady, t, countryName, lang])

  return (
    <div className="overflow-hidden rounded-3xl border border-stone-200 bg-white shadow-sm">
      <div className="flex flex-wrap items-center justify-between gap-2 border-b border-stone-100 px-4 py-3">
        <div className="flex flex-wrap gap-1.5">
          {(['lowCarbon', 'carbonIntensity', 'selfSufficiency'] as MapMetric[]).map((m) => (
            <button
              key={m}
              type="button"
              onClick={() => setMetric(m)}
              className={`rounded-full px-3 py-1.5 text-xs font-medium transition ${
                metric === m ? 'bg-brand-500 text-white shadow' : 'bg-stone-100 text-stone-600 hover:bg-stone-200'
              }`}
            >
              {t(`metric_${m}` as const)}
            </button>
          ))}
        </div>
        <div className="flex flex-wrap gap-1.5">
          {Object.keys(REGIONS).map((r) => (
            <button
              key={r}
              type="button"
              onClick={() => {
                const cfg = REGIONS[r]
                chartRef.current?.setOption({ series: [{ center: cfg.center, zoom: cfg.zoom }] })
              }}
              className="rounded-full border border-stone-200 px-2.5 py-1 text-xs text-stone-500 hover:border-brand-500 hover:text-brand-600"
            >
              {t(`focus_${r}` as never)}
            </button>
          ))}
        </div>
      </div>
      {mapReady ? (
        <EChart
          option={option}
          className="h-[340px] w-full sm:h-[460px]"
          onReady={(chart) => (chartRef.current = chart)}
          onClick={(params) => {
            if (params.componentType === 'series' && typeof params.name === 'string' && params.name.length === 3) {
              navigate(params.name === 'TWN' ? '/taiwan' : `/country/${params.name}`)
            }
          }}
        />
      ) : (
        <div className="flex h-[340px] items-center justify-center text-stone-400 sm:h-[460px]">{t('loading')}</div>
      )}
      <p className="border-t border-stone-100 px-4 py-2 text-center text-xs text-stone-400">{t('map_hint')}</p>
    </div>
  )
}
