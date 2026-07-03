import { useEffect, useState } from 'react'
import { useLang, pick, type Lang } from '../i18n'
import { loadCountry, loadIndex } from '../lib/data'
import type { CountriesIndex, CountrySeries } from '../lib/types'
import { CountryView } from './Country'
import { fmt, twhToHuman } from '../lib/energy'
import InfoTip from '../components/InfoTip'
import taiwanDetail from '../data/taiwan-detail.json'

type L10n = { zh: string; en: string }

export default function Taiwan() {
  const { t } = useLang()
  const [data, setData] = useState<CountrySeries | null>(null)
  const [index, setIndex] = useState<CountriesIndex | null>(null)

  useEffect(() => {
    Promise.all([loadCountry('TWN'), loadIndex()]).then(([c, idx]) => {
      setData(c)
      setIndex(idx)
    })
  }, [])

  if (!data || !index) return <div className="py-24 text-center text-stone-400">{t('loading')}</div>

  const entry = index.countries.find((c) => c.iso3 === 'TWN')
  const latest = [...data.series].reverse().find((p) => p.generation != null) ?? data.series.at(-1)!

  return (
    <div>
      <div className="mt-8 rounded-3xl bg-gradient-to-r from-red-50 to-amber-50 px-6 py-4 text-sm font-medium text-red-700">
        ⚠️ {t('tw_import_banner')}
      </div>
      <CountryView data={data} entry={entry} latest={latest} index={index}>
        <SpotlightSection />
      </CountryView>
    </div>
  )
}

/** 用電大戶聚光燈 */
function SpotlightSection() {
  const { t, lang } = useLang()
  const d = taiwanDetail
  const households = (twh: number | null) =>
    twh == null ? null : (twh * 1e9) / d.householdAvgKwhPerYear / 1e4 // 萬戶

  return (
    <section>
      <h2 className="text-xl font-bold text-stone-900">🔦 {t('tw_spotlight_title')}</h2>
      <p className="mt-1 text-sm text-stone-500">{t('tw_spotlight_subtitle')}</p>
      <div className="mt-4 grid gap-4 md:grid-cols-2">
        {d.majorConsumers.map((m) => {
          const hh = households(m.electricityTWh)
          return (
            <div key={m.id} className="flex flex-col rounded-3xl border border-stone-200 bg-white p-5 shadow-sm">
              <div className="flex items-baseline justify-between gap-2">
                <h3 className="text-lg font-bold text-stone-900">{pick(lang as Lang, m.name as L10n)}</h3>
                <span className="rounded-full bg-stone-100 px-2.5 py-0.5 text-xs text-stone-500">
                  {pick(lang as Lang, m.industry as L10n)}
                </span>
              </div>
              <div className="mt-3 flex flex-wrap items-center gap-x-6 gap-y-2">
                {m.electricityTWh != null && (
                  <div>
                    <div className="text-xs text-stone-400">{t('company_electricity')}（{m.dataYear}）</div>
                    <div className="text-xl font-bold text-stone-900">{twhToHuman(m.electricityTWh, lang as Lang)}</div>
                  </div>
                )}
                {m.shareOfTaiwanPct != null && (
                  <div>
                    <div className="text-xs text-stone-400">{t('tw_share_of_taiwan')}</div>
                    <div className="text-xl font-bold text-brand-600">{m.shareOfTaiwanPct}%</div>
                  </div>
                )}
              </div>
              {hh != null && (
                <div className="mt-3 rounded-2xl bg-brand-50 px-4 py-2.5 text-sm font-semibold text-brand-700">
                  🏠 {t('tw_household_equiv', { n: fmt(hh) })}
                  <InfoTip text={t('tw_household_basis')} />
                </div>
              )}
              <p className="mt-3 flex-1 text-sm leading-relaxed text-stone-600">{pick(lang as Lang, m.note as L10n)}</p>
              <a href={m.source.url} target="_blank" rel="noreferrer" className="mt-3 text-xs text-brand-600 hover:underline">
                {t('source_label')}：{pick(lang as Lang, m.source.label as L10n)} ↗
              </a>
            </div>
          )
        })}
      </div>
    </section>
  )
}
