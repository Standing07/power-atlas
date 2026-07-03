import { useEffect, useRef } from 'react'
import * as echarts from 'echarts'

interface Props {
  option: echarts.EChartsOption
  className?: string
  onClick?: (params: echarts.ECElementEvent) => void
  onReady?: (chart: echarts.ECharts) => void
}

/** 通用 ECharts 包裝：自動掛載、更新與隨視窗縮放 */
export default function EChart({ option, className, onClick, onReady }: Props) {
  const ref = useRef<HTMLDivElement>(null)
  const chartRef = useRef<echarts.ECharts | null>(null)
  const onClickRef = useRef(onClick)
  onClickRef.current = onClick

  useEffect(() => {
    if (!ref.current) return
    const chart = echarts.init(ref.current)
    chartRef.current = chart
    chart.on('click', (params) => onClickRef.current?.(params))
    const resize = () => chart.resize()
    window.addEventListener('resize', resize)
    onReady?.(chart)
    return () => {
      window.removeEventListener('resize', resize)
      chart.dispose()
      chartRef.current = null
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  useEffect(() => {
    // try/catch：圖表設定異常時只記錄錯誤，不讓整頁崩潰
    try {
      chartRef.current?.setOption(option, { notMerge: false })
    } catch (err) {
      console.error('EChart setOption failed:', err)
    }
  }, [option])

  return <div ref={ref} className={className} />
}
