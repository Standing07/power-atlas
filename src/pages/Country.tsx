import { useEffect, useMemo, useState } from 'react'
import { Link, useParams } from 'react-router-dom'
import { useLang } from '../i18n'
import { loadCountry, loadIndex } from '../lib/data'
import type { CountriesIndex, CountryIndexEntry, CountrySeries, SeriesPoint } from '../lib/types'
import MixPie from '../components/MixPie'
import TrendArea from '../components/TrendArea'
import Flag from '../components/Flag'
import InfoTip from '../components/InfoTip'
import { fmt, twhToHuman } from '../lib/energy'
import { pick, type Lang } from '../i18n'
import insightsData from '../data/country-insights.json'
import sectorData from '../data/sector-breakdown.json'
import outlookData from '../data/outlook.json'
import consumersData from '../data/major-consumers.json'
import CountrySelect from '../components/CountrySelect'
import Carousel from '../components/Carousel'

type L10n = { zh: string; en: string }
interface SourcedItem { text: L10n; source: { label: string; url: string } }
interface SectorEntry {
  year: number
  sectors: { label: L10n; share: number }[]
  note?: L10n
  source: { label: L10n; url: string }
}

export default function Country() {
  const { iso3 } = useParams<{ iso3: string }>()
  const { t } = useLang()
  const [data, setData] = useState<CountrySeries | null>(null)
  const [index, setIndex] = useState<CountriesIndex | null>(null)
  const [failed, setFailed] = useState(false)

  useEffect(() => {
    setData(null)
    setFailed(false)
    if (!iso3) return
    Promise.all([loadCountry(iso3.toUpperCase()), loadIndex()])
      .then(([c, idx]) => {
        setData(c)
        setIndex(idx)
      })
      .catch(() => setFailed(true))
  }, [iso3])

  if (failed)
    return (
      <div className="py-24 text-center">
        <p className="text-lg text-stone-500">{t('not_found')}</p>
        <Link to="/" className="mt-4 inline-block text-brand-600 hover:underline">← {t('back_home')}</Link>
      </div>
    )
  if (!data || !index) return <div className="py-24 text-center text-stone-400">{t('loading')}</div>

  const entry = index.countries.find((c) => c.iso3 === data.iso3)
  const latest = [...data.series].reverse().find((p) => p.generation != null) ?? data.series.at(-1)!
  return <CountryView data={data} entry={entry} latest={latest} index={index} />
}

export function CountryView({
  data, entry, latest, index, children,
}: {
  data: CountrySeries
  entry?: CountryIndexEntry
  latest: SeriesPoint
  index: CountriesIndex
  children?: React.ReactNode
}) {
  const { t, lang, countryName } = useLang()
  const name = countryName(data.iso2, data.name)
  const world = index.world.latest

  const ciRatio =
    latest.carbonIntensity != null && world.carbonIntensity ? latest.carbonIntensity / world.carbonIntensity : null

  // 碳強度全球百分位：這個國家比多少 % 的國家髒（僅比較具規模的電網）
  const ciPercentile = useMemo(() => {
    if (latest.carbonIntensity == null) return null
    const peers = index.countries.filter((c) => c.carbonIntensity != null && (c.generation ?? 0) >= 5)
    if (peers.length < 20) return null
    const cleaner = peers.filter((c) => c.carbonIntensity! < latest.carbonIntensity!).length
    return Math.round((cleaner / peers.length) * 100)
  }, [index, latest])

  return (
    <div className="space-y-10 pt-8">
      {/* 標題列 */}
      <header className="flex flex-wrap items-center gap-4">
        <Flag iso2={data.iso2} className="!h-10 !w-14 text-4xl" />
        <div>
          <h1 className="text-2xl font-bold text-stone-900 sm:text-3xl">{name}</h1>
          <p className="text-sm text-stone-400">
            {t('latest_data')}：{latest.year}
          </p>
        </div>
        <div className="ml-auto flex flex-wrap items-center gap-2">
          <CountrySelect current={data.iso3} />
          {(entry?.badges ?? []).map((b) => (
            <span
              key={b}
              className={`rounded-full px-3 py-1 text-xs font-semibold ${
                b === 'importDependent' ? 'bg-red-50 text-red-600' : 'bg-brand-50 text-brand-700'
              }`}
            >
              {b === 'importDependent' ? t('idcard_import_dependent')
                : b === 'energyExporter' ? t('idcard_energy_exporter')
                : t(`badge_${b}` as never)}
            </span>
          ))}
        </div>
      </header>

      {/* 摘要卡 */}
      <section className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        <Stat label={t('country_generation')} value={twhToHuman(latest.generation, lang)} tip={t('tip_twh')} />
        <Stat label={t('country_demand')} value={twhToHuman(latest.demand, lang)} />
        <Stat label={t('country_demand_per_capita')} value={`${fmt(latest.demandPerCapita)} kWh`} />
        <Stat
          label={t('country_carbon_intensity')}
          value={`${fmt(latest.carbonIntensity)} g`}
          sub={[
            ciRatio != null ? t('vs_world_avg', { x: ciRatio.toFixed(1) }) : null,
            ciPercentile != null ? t('ci_percentile', { x: ciPercentile }) : null,
          ].filter(Boolean).join('・')}
          tip={t('tip_carbonIntensity')}
        />
      </section>

      {/* 乾淨程度進度條 */}
      {latest.shares.lowCarbon != null && (
        <section className="rounded-3xl border border-stone-200 bg-white p-5 shadow-sm">
          <div className="flex items-center gap-1 font-bold text-stone-900">
            {t('lowcarbon_bar_title')}
            <InfoTip text={t('tip_lowCarbon')} />
          </div>
          <div className="mt-3 flex h-6 overflow-hidden rounded-full bg-stone-100 text-[11px] font-semibold text-white">
            <div className="flex items-center justify-center overflow-hidden whitespace-nowrap bg-brand-500" style={{ width: `${latest.shares.lowCarbon}%` }}>
              {latest.shares.lowCarbon >= 25 && `${t('lowcarbon_label')} ${fmt(latest.shares.lowCarbon, 1)}%`}
            </div>
            {latest.shares.fossil != null && (
              <div className="flex items-center justify-center overflow-hidden whitespace-nowrap bg-stone-400" style={{ width: `${latest.shares.fossil}%` }}>
                {latest.shares.fossil >= 25 && `${t('fossil_label')} ${fmt(latest.shares.fossil, 1)}%`}
              </div>
            )}
          </div>
          <div className="mt-1.5 flex flex-wrap gap-x-4 text-xs text-stone-500">
            <span><span className="mr-1 inline-block h-2 w-2 rounded-full bg-brand-500" />{t('lowcarbon_label')} {fmt(latest.shares.lowCarbon, 1)}%</span>
            {latest.shares.fossil != null && (
              <span><span className="mr-1 inline-block h-2 w-2 rounded-full bg-stone-400" />{t('fossil_label')} {fmt(latest.shares.fossil, 1)}%</span>
            )}
          </div>
          <p className="mt-2 text-xs text-stone-400">
            {t('world_avg')}：{t('lowcarbon_label')} {fmt(world.shares.lowCarbon, 1)}%
          </p>
        </section>
      )}

      {/* 結構圓餅 + 能源身分證 */}
      <section className="grid gap-6 lg:grid-cols-2">
        <div className="rounded-3xl border border-stone-200 bg-white p-5 shadow-sm">
          <h2 className="font-bold text-stone-900">{t('mix_title')}</h2>
          <p className="text-xs text-stone-400">{t('mix_subtitle', { y: latest.year })}</p>
          <MixPie point={latest} />
          {latest.splitEstimated && <p className="mt-1 text-center text-[11px] text-stone-400">※ {t('est_split_note')}</p>}
        </div>
        <EnergyIdCard latest={latest} entry={entry} />
      </section>

      {/* 趨勢 */}
      <section className="rounded-3xl border border-stone-200 bg-white p-5 shadow-sm">
        <h2 className="font-bold text-stone-900">{t('trend_title')}</h2>
        <p className="text-xs text-stone-400">{t('trend_subtitle')}</p>
        <TrendArea series={data.series} className="mt-2 h-80 w-full" />
      </section>

      <SectorSection iso3={data.iso3} />

      <ConsumersSection iso3={data.iso3} />

      <OutlookSection iso3={data.iso3} />

      <InsightsSection iso3={data.iso3} />

      {children}
    </div>
  )
}

/** 電流向哪裡：各部門用電佔比（有查證資料的國家才顯示） */
function SectorSection({ iso3 }: { iso3: string }) {
  const { t, lang } = useLang()
  const entry = (sectorData as unknown as Record<string, SectorEntry>)[iso3]
  if (!entry) return null
  return (
    <section className="rounded-3xl border border-stone-200 bg-white p-5 shadow-sm">
      <h2 className="font-bold text-stone-900">🔌 {t('sectors_title')}</h2>
      <p className="text-xs text-stone-400">{t('sectors_subtitle', { y: entry.year })}</p>
      <div className="mt-4 space-y-2.5">
        {entry.sectors.map((s) => (
          <div key={s.label.en} className="flex items-center gap-3">
            <span className="w-40 shrink-0 text-sm text-stone-600">{pick(lang as Lang, s.label)}</span>
            <div className="h-5 flex-1 overflow-hidden rounded-full bg-stone-100">
              <div className="h-full rounded-full bg-brand-500" style={{ width: `${s.share}%` }} />
            </div>
            <span className="w-14 shrink-0 text-right text-sm font-semibold text-stone-800">{s.share}%</span>
          </div>
        ))}
      </div>
      {entry.note && <p className="mt-3 text-xs leading-relaxed text-stone-500">💡 {pick(lang as Lang, entry.note)}</p>}
      <a href={entry.source.url} target="_blank" rel="noreferrer" className="mt-3 inline-block text-xs text-brand-600 hover:underline">
        {t('source_label')}：{pick(lang as Lang, entry.source.label)} ↗
      </a>
    </section>
  )
}

/** 未來五年展望：只顯示該國專屬預測（全球趨勢放首頁） */
function OutlookSection({ iso3 }: { iso3: string }) {
  const { t } = useLang()
  const items = (outlookData.countries as Record<string, SourcedItem[]>)[iso3] ?? []
  if (!items.length) return null
  return (
    <section>
      <h2 className="text-xl font-bold text-stone-900">🔮 {t('outlook_title')}</h2>
      <p className="mt-1 text-sm text-stone-500">{t('outlook_subtitle')}</p>
      <div className="mt-4">
        <SourcedCarousel items={items} accent />
      </div>
    </section>
  )
}

/** 翻頁式來源卡片列表 */
function SourcedCarousel({ items, accent = false }: { items: SourcedItem[]; accent?: boolean }) {
  const { t, lang } = useLang()
  return (
    <Carousel
      items={items.map((it, i) => (
        <div
          key={i}
          className={`flex h-full min-h-32 flex-col rounded-3xl p-5 shadow-sm ${
            accent ? 'border-2 border-brand-100 bg-brand-50/50' : 'border border-stone-200 bg-white'
          }`}
        >
          <p className="flex-1 text-sm leading-relaxed text-stone-700">{pick(lang as Lang, it.text)}</p>
          <a href={it.source.url} target="_blank" rel="noreferrer" className="mt-2 inline-block text-xs text-brand-600 hover:underline">
            {t('source_label')}：{it.source.label} ↗
          </a>
        </div>
      ))}
    />
  )
}

/** 誰用掉最多電：該國用電大戶與成長熱點（有查證資料的國家才顯示） */
function ConsumersSection({ iso3 }: { iso3: string }) {
  const { t } = useLang()
  const items = (consumersData.countries as Record<string, SourcedItem[]>)[iso3] ?? []
  if (!items.length) return null
  return (
    <section>
      <h2 className="text-xl font-bold text-stone-900">🏭 {t('consumers_title')}</h2>
      <p className="mt-1 text-sm text-stone-500">{t('consumers_subtitle')}</p>
      <div className="mt-4">
        <SourcedCarousel items={items} />
      </div>
    </section>
  )
}

/** 深度洞察：Ember / IEA / BNEF 等權威來源的人工整理分析 */
function InsightsSection({ iso3 }: { iso3: string }) {
  const { t } = useLang()
  const items = (insightsData.countries as Record<string, { text: { zh: string; en: string }; source: { label: string; url: string } }[]>)[iso3]
  if (!items?.length) return null
  return (
    <section>
      <h2 className="text-xl font-bold text-stone-900">🔍 {t('insights_title')}</h2>
      <p className="mt-1 text-sm text-stone-500">{t('insights_subtitle')}</p>
      <div className="mt-4">
        <SourcedCarousel items={items} />
      </div>
    </section>
  )
}

function EnergyIdCard({ latest, entry }: { latest: SeriesPoint; entry?: CountryIndexEntry }) {
  const { t } = useLang()
  const selfSuff = entry?.selfSufficiency ?? latest.selfSufficiency
  const pct = selfSuff == null ? null : Math.round(selfSuff * 100)
  const imports = latest.netImportsShare

  return (
    <div className="rounded-3xl border border-stone-200 bg-white p-5 shadow-sm">
      <h2 className="font-bold text-stone-900">🪪 {t('idcard_title')}</h2>

      <div className="mt-4">
        <div className="flex items-center gap-1 text-sm font-medium text-stone-700">
          {t('idcard_selfSufficiency')}
          <InfoTip text={t('tip_selfSufficiency')} />
        </div>
        {pct != null ? (
          <>
            <div className="mt-2 h-4 overflow-hidden rounded-full bg-stone-100">
              <div
                className={`h-full rounded-full ${pct < 30 ? 'bg-red-500' : pct < 80 ? 'bg-amber-400' : 'bg-brand-500'}`}
                style={{ width: `${Math.min(pct, 100)}%` }}
              />
            </div>
            <div className="mt-1 flex justify-between text-xs text-stone-500">
              <span className="font-bold text-stone-800">{pct}%</span>
              {entry && <span>{t('data_year')}: {entry.tradeYear}</span>}
            </div>
          </>
        ) : (
          <p className="mt-1 text-sm text-stone-400">–</p>
        )}
        <p className="mt-1 text-xs leading-relaxed text-stone-400">{t('idcard_selfSufficiency_desc')}</p>
      </div>

      <div className="mt-5">
        <div className="text-sm font-medium text-stone-700">{t('idcard_elec_trade')}</div>
        <p className="mt-1 text-sm text-stone-600">
          {imports == null || Math.abs(imports) < 0.5
            ? t('idcard_elec_none')
            : imports > 0
              ? t('idcard_elec_import', { x: fmt(imports, 1) })
              : t('idcard_elec_export', { x: fmt(-imports, 1) })}
        </p>
      </div>

      {entry && entry.badges.length > 0 && (
        <div className="mt-5 flex flex-wrap gap-2">
          {entry.badges.map((b) => (
            <span key={b} className={`rounded-full px-3 py-1 text-xs font-semibold ${b === 'importDependent' ? 'bg-red-50 text-red-600' : 'bg-brand-50 text-brand-700'}`}>
              {b === 'importDependent' ? t('idcard_import_dependent')
                : b === 'energyExporter' ? t('idcard_energy_exporter')
                : t(`badge_${b}` as never)}
            </span>
          ))}
        </div>
      )}
    </div>
  )
}

function Stat({ label, value, sub, tip }: { label: string; value: string; sub?: string; tip?: string }) {
  return (
    <div className="rounded-2xl border border-stone-200 bg-white px-4 py-3.5 shadow-sm">
      <div className="flex items-center gap-1 text-xs text-stone-500">
        {label}
        {tip && <InfoTip text={tip} />}
      </div>
      <div className="mt-0.5 text-lg font-bold text-stone-900">{value}</div>
      {sub && <div className="text-[11px] text-stone-400">{sub}</div>}
    </div>
  )
}
