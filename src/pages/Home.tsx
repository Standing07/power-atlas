import { useEffect, useMemo, useState } from 'react'
import { Link } from 'react-router-dom'
import { useLang, pick } from '../i18n'
import { loadIndex } from '../lib/data'
import type { CountriesIndex, CountryIndexEntry } from '../lib/types'
import SearchBox from '../components/SearchBox'
import WorldMap from '../components/WorldMap'
import MixPie from '../components/MixPie'
import Flag from '../components/Flag'
import InfoTip from '../components/InfoTip'
import { PRIORITY_COUNTRIES } from '../data/priority-countries'
import cleantech from '../data/cleantech.json'
import insightsData from '../data/country-insights.json'
import outlookData from '../data/outlook.json'
import { fmt } from '../lib/energy'

const MIN_GEN_TWH = 5 // 排行榜只列入具規模的電力系統

interface Board {
  titleKey: 'lb_cleanest' | 'lb_windsolar' | 'lb_efficient' | 'lb_exporters' | 'lb_importers'
  descKey: 'lb_cleanest_desc' | 'lb_windsolar_desc' | 'lb_efficient_desc' | 'lb_exporters_desc' | 'lb_importers_desc'
  rows: { c: CountryIndexEntry; display: string }[]
}

export default function Home() {
  const { t, lang, countryName } = useLang()
  const [index, setIndex] = useState<CountriesIndex | null>(null)

  useEffect(() => {
    loadIndex().then(setIndex)
  }, [])

  const boards = useMemo<Board[]>(() => {
    if (!index) return []
    const sizable = index.countries.filter((c) => (c.generation ?? 0) >= MIN_GEN_TWH)
    const top = (
      arr: CountryIndexEntry[],
      value: (c: CountryIndexEntry) => number | null,
      display: (c: CountryIndexEntry) => string,
      asc = false
    ) =>
      arr
        .filter((c) => value(c) != null)
        .sort((a, b) => (asc ? value(a)! - value(b)! : value(b)! - value(a)!))
        .slice(0, 10)
        .map((c) => ({ c, display: display(c) }))

    return [
      {
        titleKey: 'lb_cleanest', descKey: 'lb_cleanest_desc',
        rows: top(sizable, (c) => c.shares.lowCarbon, (c) => `${fmt(c.shares.lowCarbon, 1)}%`),
      },
      {
        titleKey: 'lb_windsolar', descKey: 'lb_windsolar_desc',
        rows: top(sizable, (c) => (c.shares.wind ?? 0) + (c.shares.solar ?? 0), (c) => `${fmt((c.shares.wind ?? 0) + (c.shares.solar ?? 0), 1)}%`),
      },
      {
        titleKey: 'lb_efficient', descKey: 'lb_efficient_desc',
        rows: top(sizable.filter((c) => (c.generation ?? 0) >= 20), (c) => c.energyPerGdp, (c) => `${fmt(c.energyPerGdp, 2)} kWh/$`, true),
      },
      {
        titleKey: 'lb_exporters', descKey: 'lb_exporters_desc',
        rows: top(sizable, (c) => c.selfSufficiency, (c) => `${fmt((c.selfSufficiency ?? 0) * 100)}%`),
      },
      {
        titleKey: 'lb_importers', descKey: 'lb_importers_desc',
        rows: top(sizable, (c) => c.selfSufficiency, (c) => `${fmt((c.selfSufficiency ?? 0) * 100)}%`, true),
      },
    ]
  }, [index])

  const priority = useMemo(() => {
    if (!index) return []
    const byIso = new Map(index.countries.map((c) => [c.iso3, c]))
    return PRIORITY_COUNTRIES.map((iso) => byIso.get(iso)).filter(Boolean) as CountryIndexEntry[]
  }, [index])

  return (
    <div className="space-y-14">
      {/* Hero */}
      <section className="pt-12 text-center sm:pt-16">
        <h1 className="text-3xl font-bold tracking-tight text-stone-900 sm:text-5xl">{t('hero_title')}</h1>
        <p className="mx-auto mt-4 max-w-2xl text-sm leading-relaxed text-stone-500 sm:text-base">{t('hero_subtitle')}</p>
        <div className="mt-7 flex justify-center">
          <SearchBox large />
        </div>
      </section>

      {/* 世界地圖 */}
      <section>
        <WorldMap />
      </section>

      {/* 30 大國精選 */}
      <section>
        <h2 className="text-xl font-bold text-stone-900">{t('priority_title')}</h2>
        <p className="mt-1 text-sm text-stone-500">{t('priority_subtitle')}</p>
        <div className="mt-4 grid grid-cols-2 gap-2 sm:grid-cols-3 md:grid-cols-5">
          {priority.map((c) => (
            <Link
              key={c.iso3}
              to={c.iso3 === 'TWN' ? '/taiwan' : `/country/${c.iso3}`}
              className="group flex items-center gap-2.5 rounded-2xl border border-stone-200 bg-white px-3 py-2.5 shadow-sm transition hover:-translate-y-0.5 hover:border-brand-500 hover:shadow"
            >
              <Flag iso2={c.iso2} className="text-lg" />
              <div className="min-w-0">
                <div className="truncate text-sm font-medium text-stone-800 group-hover:text-brand-700">
                  {countryName(c.iso2, c.name)}
                </div>
                <div className="text-[11px] text-stone-400">
                  {t('metric_lowCarbon')} {fmt(c.shares.lowCarbon)}%
                </div>
              </div>
            </Link>
          ))}
        </div>
      </section>

      {/* 全球電力結構 */}
      {index && (
        <section className="grid gap-6 lg:grid-cols-2">
          <div className="rounded-3xl border border-stone-200 bg-white p-5 shadow-sm">
            <h2 className="text-lg font-bold text-stone-900">
              {t('global_mix_title')}（{index.world.latestYear}）
            </h2>
            <MixPie point={index.world.latest} />
          </div>
          <div className="flex flex-col justify-center gap-4">
            <StatBig label={t('country_generation')} value={lang === 'zh' ? `${fmt((index.world.latest.generation ?? 0) * 10)} 億度` : `${fmt(index.world.latest.generation)} TWh`} tip={t('tip_twh')} />
            <StatBig label={<>{t('metric_lowCarbon')}</>} value={`${fmt(index.world.latest.shares.lowCarbon, 1)}%`} tip={t('tip_lowCarbon')} />
            <StatBig label={t('metric_carbonIntensity')} value={`${fmt(index.world.latest.carbonIntensity)} gCO₂/kWh`} tip={t('tip_carbonIntensity')} />
          </div>
        </section>
      )}

      {/* 全球電力脈動 */}
      <section>
        <h2 className="text-xl font-bold text-stone-900">📰 {t('global_pulse_title')}</h2>
        <p className="mt-1 text-sm text-stone-500">{t('insights_subtitle')}</p>
        <div className="mt-4 grid gap-4 md:grid-cols-3">
          {insightsData.global.map((it, i) => (
            <div key={i} className="rounded-3xl border border-stone-200 bg-white p-5 shadow-sm">
              <p className="text-sm leading-relaxed text-stone-700">{pick(lang, it.text)}</p>
              <a href={it.source.url} target="_blank" rel="noreferrer" className="mt-3 inline-block text-xs text-brand-600 hover:underline">
                {t('source_label')}：{it.source.label} ↗
              </a>
            </div>
          ))}
        </div>
      </section>

      {/* 未來五年展望（全球） */}
      <section>
        <h2 className="text-xl font-bold text-stone-900">🔮 {t('outlook_title')}</h2>
        <div className="mt-4 grid gap-4 md:grid-cols-2">
          {outlookData.global.map((it, i) => (
            <div key={i} className="rounded-3xl border border-stone-200 bg-white p-5 shadow-sm">
              <p className="text-sm leading-relaxed text-stone-700">{pick(lang, it.text)}</p>
              <a href={it.source.url} target="_blank" rel="noreferrer" className="mt-3 inline-block text-xs text-brand-600 hover:underline">
                {t('source_label')}：{it.source.label} ↗
              </a>
            </div>
          ))}
        </div>
      </section>

      {/* 排行榜 */}
      <section>
        <h2 className="text-xl font-bold text-stone-900">{t('leaderboards_title')}</h2>
        <p className="mt-1 text-sm text-stone-500">{t('lb_min_size_note')}</p>
        <div className="mt-4 grid gap-4 md:grid-cols-2 xl:grid-cols-3">
          {boards.map((b) => (
            <div key={b.titleKey} className="rounded-3xl border border-stone-200 bg-white p-5 shadow-sm">
              <h3 className="font-bold text-stone-900">{t(b.titleKey)}</h3>
              <p className="mt-0.5 text-xs text-stone-400">{t(b.descKey)}</p>
              <ol className="mt-3 space-y-1.5">
                {b.rows.map(({ c, display }, i) => (
                  <li key={c.iso3}>
                    <Link
                      to={c.iso3 === 'TWN' ? '/taiwan' : `/country/${c.iso3}`}
                      className="flex items-center gap-2 rounded-lg px-2 py-1 text-sm hover:bg-brand-50"
                    >
                      <span className="w-5 text-right text-xs font-semibold text-stone-400">{i + 1}</span>
                      <Flag iso2={c.iso2} />
                      <span className="flex-1 truncate">{countryName(c.iso2, c.name)}</span>
                      <span className="text-xs font-semibold text-brand-600">{display}</span>
                    </Link>
                  </li>
                ))}
              </ol>
            </div>
          ))}
        </div>
      </section>

      {/* 潔淨科技榜 */}
      <section>
        <h2 className="text-xl font-bold text-stone-900">{t('cleantech_title')}</h2>
        <p className="mt-1 text-sm text-stone-500">{t('cleantech_subtitle')}</p>
        <div className="mt-4 grid gap-4 md:grid-cols-2">
          {cleantech.items.map((item) => (
            <div key={item.id} className="rounded-3xl border border-stone-200 bg-white p-5 shadow-sm">
              <div className="flex items-center gap-2.5">
                <Flag iso2={item.flag} className="text-lg" />
                <h3 className="font-bold text-stone-900">{pick(lang, item.title)}</h3>
              </div>
              <p className="mt-2 text-sm leading-relaxed text-stone-600">{pick(lang, item.body)}</p>
              <a href={item.source.url} target="_blank" rel="noreferrer" className="mt-3 inline-block text-xs text-brand-600 hover:underline">
                {t('source_label')}：{item.source.label} ↗
              </a>
            </div>
          ))}
        </div>
      </section>
    </div>
  )
}

function StatBig({ label, value, tip }: { label: React.ReactNode; value: string; tip?: string }) {
  return (
    <div className="rounded-3xl border border-stone-200 bg-white px-6 py-5 shadow-sm">
      <div className="flex items-center gap-1 text-sm text-stone-500">
        {label}
        {tip && <InfoTip text={tip} />}
      </div>
      <div className="mt-1 text-2xl font-bold text-stone-900">{value}</div>
    </div>
  )
}
