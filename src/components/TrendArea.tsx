import { useMemo } from 'react'
import type { EChartsOption } from 'echarts'
import EChart from './EChart'
import { useLang } from '../i18n'
import { ENERGY_COLORS, ENERGY_LABEL_KEYS, TREND_KEYS, twhToHuman } from '../lib/energy'
import type { SeriesPoint } from '../lib/types'

/** 歷年發電結構堆疊面積圖 */
export default function TrendArea({ series, className = 'h-80 w-full' }: { series: SeriesPoint[]; className?: string }) {
  const { t, lang } = useLang()

  const option = useMemo<EChartsOption>(() => {
    const years = series.map((p) => p.year)
    return {
      toolbox: { right: 8, top: 0, feature: { saveAsImage: { title: lang === 'zh' ? '下載圖片' : 'Save image', name: 'power-atlas-trend' } } },
      tooltip: {
        trigger: 'axis',
        confine: true,
        valueFormatter: (v) => twhToHuman(typeof v === 'number' ? v : null, lang),
      },
      legend: { bottom: 0, type: 'scroll', itemWidth: 12, itemHeight: 12, textStyle: { fontSize: 11, color: '#57534e' } },
      grid: { left: 48, right: 16, top: 24, bottom: 48 },
      xAxis: { type: 'category', data: years, axisLine: { lineStyle: { color: '#d6d3d1' } } },
      yAxis: {
        type: 'value',
        name: 'TWh',
        nameTextStyle: { color: '#a8a29e' },
        splitLine: { lineStyle: { color: '#f5f5f4' } },
      },
      series: TREND_KEYS.map((key) => ({
        name: t(ENERGY_LABEL_KEYS[key]),
        type: 'line' as const,
        stack: 'total',
        areaStyle: { color: ENERGY_COLORS[key], opacity: 0.9 },
        lineStyle: { width: 0 },
        symbol: 'none',
        emphasis: { focus: 'series' as const },
        color: ENERGY_COLORS[key],
        data: series.map((p) => p[key] ?? 0),
      })),
    }
  }, [series, t, lang])

  return <EChart option={option} className={className} />
}
