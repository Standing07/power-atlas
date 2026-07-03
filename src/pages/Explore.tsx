import { useEffect, useMemo, useState } from 'react'
import { Link } from 'react-router-dom'
import { useLang } from '../i18n'
import { loadIndex } from '../lib/data'
import type { CountryIndexEntry } from '../lib/types'
import CountrySelect from '../components/CountrySelect'
import SearchBox from '../components/SearchBox'
import Flag from '../components/Flag'
import { PRIORITY_COUNTRIES } from '../data/priority-countries'
import { fmt } from '../lib/energy'

/** 國家深度解析入口：下拉自選任何國家＋主要大國一鍵進入 */
export default function Explore() {
  const { t, countryName } = useLang()
  const [countries, setCountries] = useState<CountryIndexEntry[]>([])

  useEffect(() => {
    loadIndex().then((idx) => setCountries(idx.countries))
  }, [])

  const priority = useMemo(() => {
    const byIso = new Map(countries.map((c) => [c.iso3, c]))
    return PRIORITY_COUNTRIES.map((iso) => byIso.get(iso)).filter(Boolean) as CountryIndexEntry[]
  }, [countries])

  return (
    <div className="space-y-10 pt-10">
      <header className="text-center">
        <h1 className="text-2xl font-bold text-stone-900 sm:text-4xl">{t('explore_title')}</h1>
        <p className="mx-auto mt-3 max-w-2xl text-sm leading-relaxed text-stone-500">{t('explore_subtitle')}</p>
        <div className="mt-6 flex flex-col items-center justify-center gap-3 sm:flex-row">
          <CountrySelect />
          <SearchBox />
        </div>
      </header>

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
    </div>
  )
}
