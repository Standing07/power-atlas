import { useEffect, useState } from 'react'
import { useLang } from '../i18n'
import taiwanDetail from '../data/taiwan-detail.json'
import { loadIndex } from '../lib/data'
import { fmt } from '../lib/energy'

const householdMonthly = Math.round(taiwanDetail.householdAvgKwhPerYear / 12).toLocaleString()
const householdYearly = taiwanDetail.householdAvgKwhPerYear.toLocaleString()

/** 說明文字裡的資料點一律從即時資料計算，永遠不會與各頁面顯示的數字衝突 */
interface LiveExamples {
  year: number
  worldCi: string
  fraCi: string
  twnCi: string
  twnSelf: string
}

function buildContent(live: LiveExamples) {
  return {
  zh: {
    intro: [
      '全球電力地圖是一個開放的公益工具，讓任何人都能輕鬆查詢：全世界每個國家的電從哪裡來（煤、天然氣、核能、水力、風力、太陽能、地熱⋯⋯）、電網有多乾淨、能源靠不靠進口，以及電流向了哪些產業與企業。',
      '網站的程式碼開放原始碼（MIT 授權），資料也完全開放——你可以直接把本站的 JSON 檔當成免費 API 使用。',
    ],
    methodTitle: '資料來源與方法',
    methods: [
      ['各國發電結構、碳強度、用電量', 'Our World in Data（OWID）energy dataset，底層來源為 Ember 與 Energy Institute，涵蓋 1985 年至今、215 個國家/地區，每月由自動化管線更新並經驗證關卡把關。'],
      ['地熱、離岸/陸域風電拆分', 'IRENA（國際再生能源總署）統計。IRENA 年份較 Ember 晚一至兩年時，較新年份沿用最近一年的拆分「比例」估計，圖上會標註。'],
      ['能源自給率', `以 OWID 資料估算：本國生產能源（煤、油、氣＋核能與再生能源）÷ 一次能源總消費（替代法）。與各國官方數字可能有差異——例如台灣官方（能源署）以進口能源占能源供給計算約 96–97%（核燃料視為進口），本站以替代法估算的自產比例目前為 ${live.twnSelf}%（隨資料每月更新），兩者口徑不同、結論一致：台灣能源高度依賴進口。`],
      ['台灣部門用電與用電大戶、企業綠電', '人工整理自經濟部能源署、台電、各公司永續報告、RE100 與媒體報導，每筆資料都標註來源與年份。'],
      ['地圖圖資', 'Natural Earth（world-atlas）。台灣以獨立圖徵呈現；本站尊重各地區的主體性。'],
    ],
    glossaryTitle: '名詞小辭典',
    glossary: [
      ['度（kWh）／ TWh', '「一度電」= 1 kWh，大約可以讓冷氣吹一小時。1 TWh = 10 億度。'],
      ['碳強度', `每發一度電平均排放多少克 CO₂。越低越乾淨——${live.year} 年實際數值：全球平均約 ${live.worldCi}、法國（核能為主）約 ${live.fraCi}、台灣（化石為主）約 ${live.twnCi}。這些數字直接取自本站即時資料，隨每月更新變動。`],
      ['低碳電力', '再生能源（水力、風力、太陽能、地熱、生質能）＋核能。'],
      ['CPPA（企業購電契約）', '企業直接與綠電電廠簽訂長期購電合約，是大企業取得綠電的主要方式，也幫新電廠取得融資。'],
      ['RE100', '全球再生能源倡議，成員企業承諾在目標年前 100% 使用再生電力。'],
      ['容量因子', '電廠實際發電量佔理論最大發電量的比例。太陽能約 15–25%、離岸風電約 40–50%、核能可達 90%。'],
      ['家庭用電換算', `本站台灣頁以台電最新統計「每戶每月平均約 ${householdMonthly} 度（年約 ${householdYearly} 度）」為換算基準，數字取自 taiwan-detail.json，與台灣頁同步更新。`],
    ],
    apiTitle: '開放資料 API',
    apiIntro: '本站所有資料都是靜態 JSON 檔，部署後即為免費開放 API，歡迎直接串接（CC BY 4.0，請標註來源）：',
    apiRows: [
      ['/data/countries.json', '全部國家索引：最新年份能源結構佔比、碳強度、自給率、進出口徽章、世界彙總'],
      ['/data/country/TWN.json', '單一國家 1985 年至今完整時間序列（以 ISO3 代碼替換 TWN）'],
      ['/data/world.geo.json', '世界地圖 GeoJSON（含 iso3 屬性）'],
    ],
    licenseTitle: '授權與引用',
    license: [
      '程式碼：MIT License，歡迎 fork 與改作。',
      '地圖邊界：採用 Natural Earth 圖資，僅供資料視覺化之用，不代表本站對任何領土主權爭議的立場；台灣以獨立圖徵呈現。',
      '資料：衍生自 OWID／Ember／Energy Institute／IRENA，依 CC BY 4.0 再散布。引用時請標註「Global Power Atlas，資料來源：Our World in Data、Ember、Energy Institute、IRENA」。',
      '本站為公益資訊工具，數據僅供大眾理解參考，重大決策請以官方統計為準。',
    ],
  },
  en: {
    intro: [
      'Global Power Atlas is an open, public-interest tool: look up where any country’s electricity comes from (coal, gas, nuclear, hydro, wind, solar, geothermal…), how clean its grid is, how import-dependent its energy supply is, and which industries and companies use the power.',
      'The code is open source (MIT) and the data is fully open — you can use this site’s JSON files directly as a free API.',
    ],
    methodTitle: 'Data sources & methodology',
    methods: [
      ['Country generation mix, carbon intensity, demand', 'Our World in Data (OWID) energy dataset, built on Ember and the Energy Institute. Covers 215 countries/areas since 1985, refreshed monthly by an automated, validated pipeline.'],
      ['Geothermal and onshore/offshore wind split', 'IRENA statistics. Where IRENA lags Ember by a year or two, the most recent split ratio is carried forward as an estimate (marked on charts).'],
      ['Energy self-sufficiency', `Estimated from OWID data: domestic energy production (coal, oil, gas + nuclear and renewables) ÷ total primary energy consumption (substitution method). May differ from official national figures — e.g. Taiwan officially reports ~96–97% import dependence (counting nuclear fuel as imported), while our substitution-method estimate of domestic production is currently ${live.twnSelf}% (refreshed monthly); different methods, same conclusion.`],
      ['Taiwan sector/company data, corporate clean power', 'Hand-compiled from Taiwan’s Energy Administration, Taipower, corporate sustainability reports, RE100 and media coverage — every figure carries its source and year.'],
      ['Map', 'Natural Earth (world-atlas). Taiwan is shown as its own feature; we respect the identity of every region.'],
    ],
    glossaryTitle: 'Glossary',
    glossary: [
      ['kWh / TWh', 'One kWh runs an air conditioner for about an hour. 1 TWh = 1 billion kWh.'],
      ['Carbon intensity', `Grams of CO₂ per kWh generated. Lower is cleaner — actual ${live.year} values: world average ≈ ${live.worldCi}, France (mostly nuclear) ≈ ${live.fraCi}, Taiwan (mostly fossil) ≈ ${live.twnCi}. These figures come straight from this site's live data and shift with the monthly refresh.`],
      ['Low-carbon electricity', 'Renewables (hydro, wind, solar, geothermal, bioenergy) plus nuclear.'],
      ['CPPA', 'Corporate Power Purchase Agreement — a long-term contract to buy power directly from a clean-energy plant; how big companies mainly source renewables, and how new plants get financed.'],
      ['RE100', 'A global initiative whose members commit to 100% renewable electricity by a target year.'],
      ['Capacity factor', 'Actual output as a share of theoretical maximum. Solar ≈ 15–25%, offshore wind ≈ 40–50%, nuclear up to 90%.'],
      ['Household conversion', `The Taiwan page converts using Taipower's latest average of ~${householdMonthly} kWh per household per month (≈ ${householdYearly} kWh/yr), sourced from taiwan-detail.json and kept in sync with the Taiwan page.`],
    ],
    apiTitle: 'Open data API',
    apiIntro: 'All site data is static JSON — once deployed it doubles as a free open API (CC BY 4.0, attribution required):',
    apiRows: [
      ['/data/countries.json', 'Index of all countries: latest mix shares, carbon intensity, self-sufficiency, trade badges, world aggregate'],
      ['/data/country/TWN.json', 'Full time series since 1985 for one country (replace TWN with any ISO3 code)'],
      ['/data/world.geo.json', 'World map GeoJSON with iso3 properties'],
    ],
    licenseTitle: 'License & citation',
    license: [
      'Code: MIT License — forks and derivatives welcome.',
      'Map boundaries: Natural Earth data, used for visualization only — no position is taken on territorial disputes; Taiwan is shown as its own feature.',
      'Data: derived from OWID / Ember / Energy Institute / IRENA, redistributed under CC BY 4.0. Please cite “Global Power Atlas — data: Our World in Data, Ember, Energy Institute, IRENA”.',
      'This is a public-interest tool; figures are for general understanding. Rely on official statistics for consequential decisions.',
    ],
  },
  }
}

export default function About() {
  const { t, lang } = useLang()
  const [live, setLive] = useState<LiveExamples | null>(null)

  useEffect(() => {
    loadIndex().then((idx) => {
      const twn = idx.countries.find((c) => c.iso3 === 'TWN')
      const fra = idx.countries.find((c) => c.iso3 === 'FRA')
      setLive({
        year: idx.world.latestYear,
        worldCi: fmt(idx.world.latest.carbonIntensity),
        fraCi: fmt(fra?.carbonIntensity),
        twnCi: fmt(twn?.carbonIntensity),
        twnSelf: twn?.selfSufficiency != null ? fmt(twn.selfSufficiency * 100, 1) : '–',
      })
    })
  }, [])

  if (!live) return <div className="py-24 text-center text-stone-400">{t('loading')}</div>
  const c = buildContent(live)[lang]

  return (
    <div className="mx-auto max-w-3xl space-y-10 pt-8">
      <header>
        <h1 className="text-2xl font-bold text-stone-900 sm:text-3xl">{t('about_title')}</h1>
        {c.intro.map((p, i) => (
          <p key={i} className="mt-3 text-sm leading-relaxed text-stone-600">{p}</p>
        ))}
      </header>

      <section>
        <h2 className="text-xl font-bold text-stone-900">{c.methodTitle}</h2>
        <dl className="mt-4 space-y-4">
          {c.methods.map(([term, desc]) => (
            <div key={term} className="rounded-2xl border border-stone-200 bg-white p-4 shadow-sm">
              <dt className="font-semibold text-stone-800">{term}</dt>
              <dd className="mt-1 text-sm leading-relaxed text-stone-600">{desc}</dd>
            </div>
          ))}
        </dl>
      </section>

      <section>
        <h2 className="text-xl font-bold text-stone-900">{c.glossaryTitle}</h2>
        <dl className="mt-4 space-y-3">
          {c.glossary.map(([term, desc]) => (
            <div key={term} className="flex flex-col gap-0.5 rounded-2xl bg-white p-4 shadow-sm sm:flex-row sm:gap-4">
              <dt className="shrink-0 font-semibold text-brand-700 sm:w-44">{term}</dt>
              <dd className="text-sm leading-relaxed text-stone-600">{desc}</dd>
            </div>
          ))}
        </dl>
      </section>

      <section>
        <h2 className="text-xl font-bold text-stone-900">{c.apiTitle}</h2>
        <p className="mt-2 text-sm leading-relaxed text-stone-600">{c.apiIntro}</p>
        <div className="mt-3 overflow-hidden rounded-2xl border border-stone-200 bg-white shadow-sm">
          {c.apiRows.map(([path, desc]) => (
            <div key={path} className="border-b border-stone-100 p-4 last:border-0">
              <code className="rounded bg-stone-100 px-2 py-0.5 text-xs font-semibold text-brand-700">{path}</code>
              <p className="mt-1.5 text-sm text-stone-600">{desc}</p>
            </div>
          ))}
        </div>
      </section>

      <section>
        <h2 className="text-xl font-bold text-stone-900">{c.licenseTitle}</h2>
        <ul className="mt-3 list-disc space-y-2 pl-5 text-sm leading-relaxed text-stone-600">
          {c.license.map((p, i) => (
            <li key={i}>{p}</li>
          ))}
        </ul>
      </section>
    </div>
  )
}
