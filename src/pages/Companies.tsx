import { useMemo, useState } from 'react'
import { useLang, pick, type Lang } from '../i18n'
import Flag from '../components/Flag'
import InfoTip from '../components/InfoTip'
import companiesData from '../data/companies.json'
import { twhToHuman, fmt } from '../lib/energy'

type L10n = { zh: string; en: string }
const INDUSTRIES = ['all', 'semiconductor', 'tech', 'telecom', 'steel', 'petrochemical'] as const

export default function Companies() {
  const { t, lang } = useLang()
  const [industry, setIndustry] = useState<(typeof INDUSTRIES)[number]>('all')

  const list = useMemo(
    () => companiesData.companies.filter((c) => industry === 'all' || c.industry === industry),
    [industry]
  )

  return (
    <div className="space-y-6 pt-8">
      <header>
        <h1 className="flex items-center gap-2 text-2xl font-bold text-stone-900 sm:text-3xl">
          {t('companies_title')}
          <InfoTip text={t('tip_cppa')} />
        </h1>
        <p className="mt-2 max-w-2xl text-sm text-stone-500">{t('companies_subtitle')}</p>
      </header>

      <div className="flex flex-wrap gap-1.5">
        {INDUSTRIES.map((i) => (
          <button
            key={i}
            type="button"
            onClick={() => setIndustry(i)}
            className={`rounded-full px-3.5 py-1.5 text-sm font-medium transition ${
              industry === i ? 'bg-brand-500 text-white shadow' : 'bg-stone-100 text-stone-600 hover:bg-stone-200'
            }`}
          >
            {t(`industry_${i}` as const)}
          </button>
        ))}
      </div>

      <div className="grid gap-4 md:grid-cols-2">
        {list.map((c) => (
          <div key={c.id} className="flex flex-col rounded-3xl border border-stone-200 bg-white p-5 shadow-sm">
            <div className="flex items-center gap-2.5">
              <Flag iso2={c.region === 'EU' ? 'EU' : c.region} />
              <h2 className="text-lg font-bold text-stone-900">{pick(lang as Lang, c.name as L10n)}</h2>
              <span className="ml-auto rounded-full bg-stone-100 px-2.5 py-0.5 text-xs text-stone-500">
                {t(`industry_${c.industry}` as never)}
              </span>
            </div>

            <div className="mt-4 flex flex-wrap gap-x-8 gap-y-2">
              {c.electricityTWh != null && (
                <div>
                  <div className="text-xs text-stone-400">
                    {t('company_electricity')}
                    {c.electricityYear && `（${c.electricityYear}）`}
                  </div>
                  <div className="text-xl font-bold text-stone-900">{twhToHuman(c.electricityTWh, lang as Lang)}</div>
                </div>
              )}
              {c.renewablePct != null && (
                <div>
                  <div className="text-xs text-stone-400">
                    {t('company_renewable')}
                    {c.renewableYear && `（${c.renewableYear}）`}
                  </div>
                  <div className="flex items-center gap-2">
                    <div className="text-xl font-bold text-brand-600">{fmt(c.renewablePct, 1)}%</div>
                    <div className="h-2 w-20 overflow-hidden rounded-full bg-stone-100">
                      <div className="h-full rounded-full bg-brand-500" style={{ width: `${Math.min(c.renewablePct, 100)}%` }} />
                    </div>
                  </div>
                </div>
              )}
            </div>

            <div className="mt-4 space-y-2 text-sm leading-relaxed text-stone-600">
              <p><span className="font-semibold text-stone-800">{t('company_cppa')}：</span>{pick(lang as Lang, c.cppa as L10n)}</p>
              <p>
                <span className="inline-flex items-center gap-1 font-semibold text-stone-800">
                  {t('company_target')}<InfoTip text={t('tip_re100')} />：
                </span>
                {pick(lang as Lang, c.target as L10n)}
              </p>
            </div>

            <a href={c.source.url} target="_blank" rel="noreferrer" className="mt-auto pt-3 text-xs text-brand-600 hover:underline">
              {t('source_label')}：{c.source.label} ↗
            </a>
          </div>
        ))}
      </div>

      <p className="rounded-2xl bg-amber-50 px-5 py-3 text-xs leading-relaxed text-amber-800">
        ⚠️ {pick(lang as Lang, companiesData.disclaimer as L10n)}
      </p>
    </div>
  )
}
