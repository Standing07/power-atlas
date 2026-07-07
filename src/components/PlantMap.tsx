import { useEffect, useMemo, useRef, useState } from 'react'
import L from 'leaflet'
import 'leaflet/dist/leaflet.css'
import { useLang } from '../i18n'
import { loadPlants, type Plant } from '../lib/data'
import { ENERGY_COLORS, ENERGY_LABEL_KEYS, fmt } from '../lib/energy'

const TIERS = ['2GW+', '1-2GW', '500MW-1GW', '100-500MW'] as const
const TIER_RADIUS: Record<string, number> = { '2GW+': 15, '1-2GW': 10, '500MW-1GW': 7, '100-500MW': 4.5 }
const FUEL_ORDER = ['coal', 'gas', 'oil', 'nuclear', 'hydro', 'wind', 'solar', 'geothermal', 'biofuel', 'other']

/** 單一國家的大型發電廠（≥100MW）可縮放地圖（Leaflet） */
export default function PlantMap({ iso3 }: { iso3: string }) {
  const { t } = useLang()
  const [plants, setPlants] = useState<Plant[] | null>(null)
  const [missing, setMissing] = useState(false)
  const [activeTier, setActiveTier] = useState<string | null>(null)
  const mapEl = useRef<HTMLDivElement>(null)
  const mapRef = useRef<L.Map | null>(null)
  const layerRef = useRef<L.LayerGroup | null>(null)

  useEffect(() => {
    setPlants(null)
    setMissing(false)
    loadPlants(iso3).then((d) => setPlants(d.plants)).catch(() => setMissing(true))
  }, [iso3])

  const fuelsPresent = useMemo(() => {
    if (!plants) return []
    const set = new Set(plants.map((p) => p.fuel))
    return FUEL_ORDER.filter((f) => set.has(f))
  }, [plants])

  // 建立地圖（只做一次）
  useEffect(() => {
    if (!mapEl.current || mapRef.current) return
    // preferCanvas：以 canvas 繪製標記，讓美/中等上千座電廠的國家仍流暢
    const map = L.map(mapEl.current, { scrollWheelZoom: true, attributionControl: true, preferCanvas: true })
    L.tileLayer('https://{s}.basemaps.cartocdn.com/light_all/{z}/{x}/{y}{r}.png', {
      attribution: '© OpenStreetMap · © CARTO',
      maxZoom: 18,
    }).addTo(map)
    layerRef.current = L.layerGroup().addTo(map)
    mapRef.current = map
    return () => {
      map.remove()
      mapRef.current = null
      layerRef.current = null
    }
  }, [])

  // 依資料/篩選重畫標記
  useEffect(() => {
    const map = mapRef.current
    const layer = layerRef.current
    if (!map || !layer || !plants) return
    layer.clearLayers()
    const shown = activeTier ? plants.filter((p) => p.tier === activeTier) : plants
    for (const p of shown) {
      const color = ENERGY_COLORS[p.fuel] ?? '#a8a29e'
      const fuelName = t(ENERGY_LABEL_KEYS[p.fuel] ?? 'src_otherRenewables')
      L.circleMarker([p.lat, p.lon], {
        radius: TIER_RADIUS[p.tier] ?? 5,
        color: '#fff',
        weight: 1,
        fillColor: color,
        fillOpacity: 0.85,
      })
        .bindPopup(
          `<b>${p.name}</b><br/>${fuelName}・${fmt(p.mw)} MW${p.year ? `<br/>${p.year}` : ''}`,
          { closeButton: false }
        )
        .addTo(layer)
    }
    // 自動縮放到全部電廠範圍
    if (shown.length > 0) {
      const bounds = L.latLngBounds(shown.map((p) => [p.lat, p.lon] as [number, number]))
      map.fitBounds(bounds, { padding: [30, 30], maxZoom: 9 })
    }
    setTimeout(() => map.invalidateSize(), 100)
  }, [plants, activeTier, t])

  if (missing) return null
  if (plants && plants.length === 0) return null

  return (
    <div className="overflow-hidden rounded-3xl border border-stone-200 bg-white shadow-sm">
      <div className="flex flex-wrap items-center justify-between gap-2 border-b border-stone-100 px-4 py-3">
        <div>
          <h2 className="font-bold text-stone-900">🏭 {t('plants_title')}</h2>
          <p className="text-xs text-stone-400">{plants ? t('plants_subtitle', { n: plants.length }) : t('loading')}</p>
        </div>
        <div className="flex flex-wrap gap-1.5">
          <button
            type="button"
            onClick={() => setActiveTier(null)}
            className={`rounded-full px-3 py-1 text-xs font-medium ${activeTier === null ? 'bg-brand-500 text-white' : 'bg-stone-100 text-stone-600 hover:bg-stone-200'}`}
          >
            {t('plants_all')}
          </button>
          {TIERS.map((tr) => (
            <button
              key={tr}
              type="button"
              onClick={() => setActiveTier(tr === activeTier ? null : tr)}
              className={`rounded-full px-3 py-1 text-xs font-medium ${activeTier === tr ? 'bg-brand-500 text-white' : 'bg-stone-100 text-stone-600 hover:bg-stone-200'}`}
            >
              {tr}
            </button>
          ))}
        </div>
      </div>

      <div ref={mapEl} className="h-[360px] w-full sm:h-[460px]" />

      <div className="flex flex-wrap items-center gap-x-4 gap-y-1.5 border-t border-stone-100 px-4 py-2.5 text-xs text-stone-500">
        {fuelsPresent.map((f) => (
          <span key={f} className="inline-flex items-center gap-1">
            <span className="inline-block h-2.5 w-2.5 rounded-full" style={{ background: ENERGY_COLORS[f] ?? '#a8a29e' }} />
            {t(ENERGY_LABEL_KEYS[f] ?? 'src_otherRenewables')}
          </span>
        ))}
        <span className="ml-auto text-[11px] text-stone-400">{t('plants_size_note')}</span>
      </div>
      <p className="border-t border-stone-100 px-4 py-2 text-center text-[11px] text-stone-400">{t('plants_source')}</p>
    </div>
  )
}
