import { useEffect, useState } from 'react'
import { NavLink, Outlet, ScrollRestoration } from 'react-router-dom'
import { useLang } from '../i18n'
import { loadIndex } from '../lib/data'

export default function Layout() {
  const { t, lang, setLang } = useLang()
  const [dataDate, setDataDate] = useState<string | null>(null)
  useEffect(() => {
    loadIndex().then((idx) => setDataDate(idx.generated)).catch(() => {})
  }, [])

  const navCls = ({ isActive }: { isActive: boolean }) =>
    `rounded-full px-3 py-1.5 text-sm font-medium transition ${
      isActive ? 'bg-brand-500 text-white' : 'text-stone-600 hover:bg-stone-100'
    }`

  return (
    <div className="flex min-h-screen flex-col">
      <header className="sticky top-0 z-50 border-b border-stone-200 bg-white/90 backdrop-blur">
        <div className="mx-auto flex max-w-6xl flex-wrap items-center gap-x-4 gap-y-2 px-4 py-3">
          <NavLink to="/" className="flex items-center gap-2 text-lg font-bold text-stone-900">
            <span className="text-xl">⚡</span>
            {t('siteName')}
          </NavLink>
          <nav className="order-3 flex w-full flex-wrap gap-1 sm:order-2 sm:ml-4 sm:w-auto">
            <NavLink to="/" end className={navCls}>{t('nav_home')}</NavLink>
            <NavLink to="/explore" className={navCls}>{t('nav_explore')}</NavLink>
            <NavLink to="/companies" className={navCls}>{t('nav_companies')}</NavLink>
            <NavLink to="/about" className={navCls}>{t('nav_about')}</NavLink>
          </nav>
          <button
            type="button"
            onClick={() => setLang(lang === 'zh' ? 'en' : 'zh')}
            className="order-2 ml-auto rounded-full border border-stone-300 px-3 py-1.5 text-sm font-medium text-stone-600 hover:border-brand-500 hover:text-brand-600 sm:order-3"
          >
            {lang === 'zh' ? 'EN' : '中文'}
          </button>
        </div>
      </header>

      <main className="mx-auto w-full max-w-6xl flex-1 px-4 pb-16">
        <Outlet />
      </main>

      <footer className="border-t border-stone-200 bg-white py-8 text-center text-xs leading-relaxed text-stone-400">
        <div className="mx-auto max-w-3xl space-y-1 px-4">
          <p>⚡ {t('siteName')} — {t('siteTagline')}</p>
          <p>{t('footer_license')}</p>
          <p>{t('footer_disclaimer')}</p>
          {dataDate && <p>{lang === 'zh' ? `資料更新日期：${dataDate}` : `Data last updated: ${dataDate}`}</p>}
        </div>
      </footer>
      <ScrollRestoration />
    </div>
  )
}
