import { useMemo } from 'react'
import type { EChartsOption } from 'echarts'
import EChart from './EChart'
import { useLang } from '../i18n'
import { ENERGY_COLORS, ENERGY_LABEL_KEYS, mixSlices, twhToHuman } from '../lib/energy'
import type { SeriesPoint } from '../lib/types'

/** 能源結構圓餅（甜甜圈）圖 */
export default function MixPie({ point, className = 'h-80 w-full' }: { point: SeriesPoint; className?: string }) {
  const { t, lang } = useLang()

  const option = useMemo<EChartsOption>(() => {
    const slices = mixSlices(point)
    const total = slices.reduce((a, s) => a + s.value, 0)
    return {
      toolbox: { right: 8, top: 0, feature: { saveAsImage: { title: lang === 'zh' ? '下載圖片' : 'Save image', name: 'power-atlas-mix' } } },
      tooltip: {
        trigger: 'item',
        confine: true,
        formatter: (params) => {
          const p = params as { name: string; value: number; percent: number }
          return `<b>${p.name}</b><br/>${twhToHuman(p.value, lang)}（${p.percent.toFixed(1)}%）`
        },
      },
      legend: { bottom: 0, type: 'scroll', itemWidth: 12, itemHeight: 12, textStyle: { fontSize: 11, color: '#57534e' } },
      series: [
        {
          type: 'pie',
          radius: ['42%', '68%'],
          center: ['50%', '44%'],
          avoidLabelOverlap: true,
          itemStyle: { borderColor: '#fff', borderWidth: 2, borderRadius: 4 },
          label: {
            show: true,
            formatter: (p) => ((p.percent ?? 0) >= 4 ? `${p.name}\n${(p.percent ?? 0).toFixed(0)}%` : ''),
            fontSize: 11,
            color: '#44403c',
            lineHeight: 14,
          },
          labelLine: { length: 8, length2: 6 },
          data: slices.map((s) => ({
            name: t(ENERGY_LABEL_KEYS[s.key]),
            value: Number(s.value.toFixed(2)),
            itemStyle: { color: ENERGY_COLORS[s.key] },
          })),
        },
      ],
      graphic: {
        type: 'text',
        left: 'center',
        top: '40%',
        style: {
          text: `${twhToHuman(total, lang)}`,
          textAlign: 'center',
          fontSize: 13,
          fontWeight: 'bold',
          fill: '#292524',
        },
      },
    }
  }, [point, t, lang])

  return <EChart option={option} className={className} />
}
