import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { useLang, pick, type Lang } from '../i18n'
import Flag from '../components/Flag'
import aiEnergy from '../data/ai-energy.json'
import companiesData from '../data/companies.json'
import { fmt, twhToHuman } from '../lib/energy'

type L10n = { zh: string; en: string }
interface AiSystem {
  name: string
  mw: number
  iso3: string | null
  country: string
  owner: string
  chips: string
  chipCount: number | null
  since: string | null
}
interface AiCompute {
  generated: string
  source: { label: string; url: string; year: number }
  totalMw: number
  count: number
  byCountry: Record<string, { mw: number; count: number }>
  systems: AiSystem[]
}

/** AI 與電力專區：AI 算力耗電、資料中心成長 vs 全國用電成長 */
export default function AI() {
  const { t, lang, countryName } = useLang()
  const [data, setData] = useState<AiCompute | null>(null)

  useEffect(() => {
    fetch(`${import.meta.env.BASE_URL}data/ai-compute.json`)
      .then((r) => r.json())
      .then(setData)
      .catch(() => setData(null))
  }, [])

  const g = aiEnergy.global
  const gc = aiEnergy.growthCompare
  const maxPct = Math.max(...gc.rows.map((r) => Math.max(r.nationalPct ?? 0, r.dcPct ?? 0)), 1)

  return (
    <div className="space-y-12 pt-8">
      <header>
        <h1 className="text-2xl font-bold text-stone-900 sm:text-3xl">🤖 {t('ai_title')}</h1>
        <p className="mt-3 max-w-3xl text-sm leading-relaxed text-stone-600">{t('ai_subtitle')}</p>
      </header>

      {/* ───────── ① 各國資料中心用電與預測 ───────── */}
      <div className="border-t-2 border-brand-100 pt-8">
        <h2 className="text-2xl font-bold text-stone-900">{t('ai_sec1')}</h2>
      </div>

      {/* 全球資料中心用電摘要 */}
      <section className="rounded-3xl border-2 border-brand-100 bg-brand-50/50 p-6">
        <h2 className="font-bold text-brand-700">🌍 {t('ai_dc_global')}</h2>
        <div className="mt-3 flex flex-wrap items-baseline gap-x-8 gap-y-2">
          <div>
            <div className="text-3xl font-bold text-stone-900">{fmt(g.dcTwh2024)} TWh</div>
            <div className="text-xs text-stone-500">{t('ai_dc_2024', { t: g.dcTwh2024, s: g.dcShare2024 })}</div>
          </div>
          <div className="text-2xl text-stone-300">→</div>
          <div>
            <div className="text-3xl font-bold text-brand-600">{fmt(g.dcTwh2030)} TWh</div>
            <div className="text-xs text-stone-500">{t('ai_dc_2030', { t: g.dcTwh2030 })}</div>
          </div>
        </div>
        <a href={g.source.url} target="_blank" rel="noreferrer" className="mt-3 inline-block text-xs text-brand-600 hover:underline">
          {t('source_label')}：{g.source.label} ↗
        </a>
      </section>

      {/* 成長率對比 */}
      <section>
        <h3 className="text-xl font-bold text-stone-900">📈 {t('ai_growth_title')}</h3>
        <p className="mt-1 max-w-3xl text-sm leading-relaxed text-stone-500">{pick(lang as Lang, gc.note as L10n)}</p>
        <div className="mt-5 space-y-4">
          {gc.rows.map((r) => (
            <div key={r.iso3} className="rounded-3xl border border-stone-200 bg-white p-5 shadow-sm">
              <div className="flex flex-wrap items-center gap-2">
                {r.iso3 !== 'WORLD' && <Flag iso2={r.iso3 === 'USA' ? 'US' : r.iso3 === 'CHN' ? 'CN' : r.iso3 === 'IRL' ? 'IE' : r.iso3 === 'TWN' ? 'TW' : null} />}
                <span className="font-bold text-stone-900">{pick(lang as Lang, r.name as L10n)}</span>
                <span className="rounded-full bg-stone-100 px-2 py-0.5 text-[11px] text-stone-500">{r.period}</span>
              </div>

              {r.nationalPct != null && r.dcPct != null && (
                <div className="mt-3 space-y-2">
                  <div className="flex items-center gap-3">
                    <span className="w-20 shrink-0 text-xs text-stone-500">{t('ai_growth_national')}</span>
                    <div className="h-4 flex-1 overflow-hidden rounded-full bg-stone-100">
                      <div className="h-full rounded-full bg-stone-400" style={{ width: `${(r.nationalPct / maxPct) * 100}%` }} />
                    </div>
                    <span className="w-24 shrink-0 whitespace-nowrap text-right text-sm font-semibold text-stone-700">
                      +{r.nationalPct}%<span className="text-[10px] font-normal text-stone-400">{t('ai_growth_peryear')}</span>
                    </span>
                  </div>
                  <div className="flex items-center gap-3">
                    <span className="w-20 shrink-0 text-xs text-stone-500">{t('ai_growth_dc')}</span>
                    <div className="h-4 flex-1 overflow-hidden rounded-full bg-stone-100">
                      <div className="h-full rounded-full bg-amber-500" style={{ width: `${(r.dcPct / maxPct) * 100}%` }} />
                    </div>
                    <span className="w-24 shrink-0 whitespace-nowrap text-right text-sm font-semibold text-amber-600">
                      +{r.dcPct}%<span className="text-[10px] font-normal text-amber-400">{t('ai_growth_peryear')}</span>
                    </span>
                  </div>
                </div>
              )}

              <p className="mt-3 text-sm leading-relaxed text-stone-600">{pick(lang as Lang, r.note as L10n)}</p>
              <a href={r.source.url} target="_blank" rel="noreferrer" className="mt-2 inline-block text-xs text-brand-600 hover:underline">
                {t('source_label')}：{r.source.label} ↗
              </a>
            </div>
          ))}
        </div>
      </section>

      {/* ───────── ② 科技巨頭用電與綠電比例 ───────── */}
      <div className="border-t-2 border-brand-100 pt-8">
        <h2 className="text-2xl font-bold text-stone-900">{t('ai_sec2')}</h2>
        <p className="mt-1 text-sm text-stone-500">{t('ai_sec2_sub')}</p>
      </div>

      <section>
        <div className="overflow-hidden rounded-3xl border border-stone-200 bg-white shadow-sm">
          {TECH_COMPANIES.map((c) => (
            <div key={c.id} className="flex flex-wrap items-center gap-x-4 gap-y-1 border-b border-stone-100 px-4 py-3 last:border-0">
              <Flag iso2={c.region === 'EU' ? 'EU' : c.region} />
              <span className="w-28 shrink-0 text-sm font-medium text-stone-800">{pick(lang as Lang, c.name as L10n)}</span>

              <div className="w-32 shrink-0">
                <div className="text-[10px] text-stone-400">{t('ai_tech_elec')}</div>
                <div className="text-sm font-semibold text-stone-900">
                  {c.electricityTWh != null ? twhToHuman(c.electricityTWh, lang as Lang) : <span className="text-xs font-normal text-stone-400">{t('ai_tech_nodata')}</span>}
                  {c.electricityYear && <span className="ml-1 text-[10px] font-normal text-stone-400">{c.electricityYear}</span>}
                </div>
              </div>

              <div className="flex min-w-[180px] flex-1 items-center gap-2">
                <div className="min-w-0 flex-1">
                  <div className="text-[10px] text-stone-400">{t('ai_tech_green')}</div>
                  <div className="mt-0.5 h-3 overflow-hidden rounded-full bg-stone-100">
                    {c.renewablePct != null && (
                      <div className="h-full rounded-full bg-brand-500" style={{ width: `${Math.min(c.renewablePct, 100)}%` }} />
                    )}
                  </div>
                </div>
                <span className="w-20 shrink-0 whitespace-nowrap text-right text-sm font-semibold text-brand-600">
                  {c.renewablePct != null ? `${fmt(c.renewablePct, 1)}%` : <span className="text-xs font-normal text-stone-400">{t('ai_tech_nodata')}</span>}
                  {c.renewableYear && <span className="ml-1 text-[10px] font-normal text-stone-400">{c.renewableYear}</span>}
                </span>
              </div>
            </div>
          ))}
        </div>
        <p className="mt-2 text-xs leading-relaxed text-stone-400">
          {pick(lang as Lang, companiesData.disclaimer as L10n)}
          <Link to="/companies" className="text-brand-600 hover:underline">→ {t('nav_companies')}</Link>
        </p>
      </section>

      {/* ───────── ③ 全球 AI 超級電腦資料庫 ───────── */}
      <div className="border-t-2 border-brand-100 pt-8">
        <h2 className="text-2xl font-bold text-stone-900">{t('ai_sec3')}</h2>
      </div>

      {/* AI 超級電腦排行 */}
      {data && (
        <section>
          <h3 className="text-xl font-bold text-stone-900">⚡ {t('ai_super_title')}</h3>
          <p className="mt-1 text-sm text-stone-500">
            {t('ai_super_subtitle', { n: fmt(data.count), gw: (data.totalMw / 1000).toFixed(1) })}
          </p>
          <div className="mt-4 overflow-hidden rounded-3xl border border-stone-200 bg-white shadow-sm">
            {data.systems.slice(0, 15).map((s, i) => (
              <div key={i} className="flex items-center gap-3 border-b border-stone-100 px-4 py-3 last:border-0">
                <span className="w-6 text-right text-xs font-semibold text-stone-400">{i + 1}</span>
                <Flag iso2={s.iso3 ? isoToFlag(s.iso3) : null} />
                <div className="min-w-0 flex-1">
                  <div className="truncate text-sm font-medium text-stone-800">{s.name}</div>
                  <div className="truncate text-[11px] text-stone-400">
                    {s.owner && `${t('ai_owner')}：${s.owner}`}
                    {s.chips && ` · ${t('ai_chips')}：${s.chips}`}
                    {s.since && ` · ${t('ai_since')} ${s.since}`}
                  </div>
                </div>
                <span className="shrink-0 text-sm font-bold text-amber-600">{fmt(s.mw, 1)} MW</span>
              </div>
            ))}
          </div>
          <a href={data.source.url} target="_blank" rel="noreferrer" className="mt-2 inline-block text-xs text-brand-600 hover:underline">
            {t('source_label')}：{data.source.label} ↗
          </a>
        </section>
      )}

      {/* 各國 AI 算力功率 */}
      {data && (
        <section>
          <h3 className="text-xl font-bold text-stone-900">🗺️ {t('ai_bycountry_title')}</h3>
          <p className="mt-1 text-sm text-stone-500">{t('ai_bycountry_subtitle')}</p>
          <div className="mt-4 grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
            {Object.entries(data.byCountry)
              .sort((a, b) => b[1].mw - a[1].mw)
              .slice(0, 12)
              .map(([iso3, v]) => (
                <Link
                  key={iso3}
                  to={iso3 === 'TWN' ? '/taiwan' : `/country/${iso3}`}
                  className="flex items-center gap-2.5 rounded-2xl border border-stone-200 bg-white px-4 py-3 shadow-sm transition hover:border-brand-500"
                >
                  <Flag iso2={isoToFlag(iso3)} />
                  <span className="min-w-0 flex-1 truncate text-sm text-stone-700">{countryName(isoToFlag(iso3), iso3)}</span>
                  <span className="shrink-0 text-sm font-semibold text-amber-600">{fmt(v.mw)} MW</span>
                  <span className="shrink-0 text-[11px] text-stone-400">({v.count})</span>
                </Link>
              ))}
          </div>
        </section>
      )}

      {/* 換個角度看 */}
      <section>
        <h3 className="text-xl font-bold text-stone-900">💡 {t('ai_context_title')}</h3>
        <div className="mt-4 grid gap-4 md:grid-cols-3">
          {aiEnergy.context.map((c, i) => (
            <div key={i} className="rounded-3xl border border-stone-200 bg-white p-5 shadow-sm">
              <p className="text-sm leading-relaxed text-stone-700">{pick(lang as Lang, c.text as L10n)}</p>
              <a href={c.source.url} target="_blank" rel="noreferrer" className="mt-3 inline-block text-xs text-brand-600 hover:underline">
                {t('source_label')}：{c.source.label} ↗
              </a>
            </div>
          ))}
        </div>
      </section>
    </div>
  )
}

/** 第 ② 段：AI 相關的科技巨頭（雲端、半導體），依用電量與綠電比例排序 */
const TECH_IDS = ['google', 'amazon', 'microsoft', 'meta', 'apple', 'tsmc', 'samsung', 'intel', 'tencent', 'alibaba', 'umc']
const TECH_COMPANIES = TECH_IDS
  .map((id) => companiesData.companies.find((c) => c.id === id))
  .filter(Boolean)
  .sort((a, b) => (b!.electricityTWh ?? -1) - (a!.electricityTWh ?? -1)) as typeof companiesData.companies

/** ISO3 → ISO2（給國旗用）：只需常見國家，其餘回 null 顯示地球 */
const ISO3_TO_2: Record<string, string> = {
  USA: 'US', CHN: 'CN', JPN: 'JP', KOR: 'KR', DEU: 'DE', FRA: 'FR', GBR: 'GB', ITA: 'IT',
  TWN: 'TW', SGP: 'SG', IND: 'IN', CAN: 'CA', AUS: 'AU', RUS: 'RU', BRA: 'BR', ESP: 'ES',
  NLD: 'NL', CHE: 'CH', SWE: 'SE', NOR: 'NO', FIN: 'FI', POL: 'PL', ARE: 'AE', SAU: 'SA',
  IRL: 'IE', ISR: 'IL', AUT: 'AT', BEL: 'BE', DNK: 'DK', CZE: 'CZ', LUX: 'LU', VNM: 'VN',
}
function isoToFlag(iso3: string): string | null {
  return ISO3_TO_2[iso3] ?? null
}
