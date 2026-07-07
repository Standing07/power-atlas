#!/usr/bin/env node
/**
 * 電廠資料管線：WRI Global Power Plant Database (v1.3.0, CC BY 4.0)
 * → 篩選 ≥100MW 的大型電廠 → 依國家產出 public/data/plants/{ISO3}.json
 *
 * WRI GPPD 為 2021 年凍結版本（之後未更新），屬「靜態參考圖層」，
 * 因此產出的 JSON 直接進版本庫，不隨每月電力資料管線重跑。
 * 若要重建：npm run plants
 *
 * 授權：資料衍生自 WRI Global Power Plant Database，CC BY 4.0，須標註來源。
 */
import { mkdir, readFile, writeFile, rm, access } from 'node:fs/promises'
import { createWriteStream } from 'node:fs'
import { Readable } from 'node:stream'
import { pipeline } from 'node:stream/promises'
import { execSync } from 'node:child_process'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..')
const CACHE = path.join(ROOT, 'scripts', '.cache')
const OUT = path.join(ROOT, 'public', 'data', 'plants')
const ZIP_URL = 'https://wri-dataportal-prod.s3.amazonaws.com/manual/global_power_plant_database_v_1_3.zip'
const MIN_MW = 100

// GPPD 的 primary_fuel → 本站能源分類（對應 energy.ts 的配色鍵）
const FUEL_MAP = {
  Coal: 'coal', Gas: 'gas', Oil: 'oil', Nuclear: 'nuclear', Hydro: 'hydro',
  Wind: 'wind', Solar: 'solar', Geothermal: 'geothermal',
  Biomass: 'biofuel', Waste: 'biofuel', Cogeneration: 'gas',
  'Petcoke': 'coal', 'Storage': 'other', Other: 'other',
}

function tierOf(mw) {
  if (mw >= 2000) return '2GW+'
  if (mw >= 1000) return '1-2GW'
  if (mw >= 500) return '500MW-1GW'
  return '100-500MW'
}

function parseCsvLine(line) {
  const out = []
  let cur = '', q = false
  for (let i = 0; i < line.length; i++) {
    const ch = line[i]
    if (q) {
      if (ch === '"') { if (line[i + 1] === '"') { cur += '"'; i++ } else q = false }
      else cur += ch
    } else if (ch === '"') q = true
    else if (ch === ',') { out.push(cur); cur = '' }
    else cur += ch
  }
  out.push(cur)
  return out
}

async function ensureCsv() {
  const csv = path.join(CACHE, 'gppd.csv')
  try { await access(csv); console.log('  ✓ 使用快取 gppd.csv'); return csv } catch { /* download */ }
  await mkdir(CACHE, { recursive: true })
  const zip = path.join(CACHE, 'gppd.zip')
  console.log('  ↓ 下載 WRI Global Power Plant Database')
  const res = await fetch(ZIP_URL)
  if (!res.ok) throw new Error(`下載失敗 HTTP ${res.status}`)
  await pipeline(Readable.fromWeb(res.body), createWriteStream(zip))
  // 用系統 unzip 解出 CSV（macOS 與 GitHub Actions ubuntu 皆內建）
  execSync(`unzip -o -j "${zip}" "global_power_plant_database.csv" -d "${CACHE}"`, { stdio: 'ignore' })
  execSync(`mv "${path.join(CACHE, 'global_power_plant_database.csv')}" "${csv}"`)
  return csv
}

async function main() {
  console.log('== 電廠資料管線（WRI GPPD）==')
  const csvPath = await ensureCsv()
  const text = await readFile(csvPath, 'utf8')
  const lines = text.split('\n')
  const header = parseCsvLine(lines[0])
  const idx = Object.fromEntries(header.map((h, i) => [h, i]))
  for (const c of ['country', 'name', 'capacity_mw', 'latitude', 'longitude', 'primary_fuel']) {
    if (!(c in idx)) throw new Error(`GPPD 缺欄位 ${c}`)
  }

  const byCountry = new Map()
  let kept = 0
  for (let i = 1; i < lines.length; i++) {
    if (!lines[i]) continue
    const cells = parseCsvLine(lines[i])
    const mw = Number(cells[idx.capacity_mw])
    if (!Number.isFinite(mw) || mw < MIN_MW) continue
    const iso3 = cells[idx.country]
    const lat = Number(cells[idx.latitude])
    const lon = Number(cells[idx.longitude])
    if (!iso3 || !Number.isFinite(lat) || !Number.isFinite(lon)) continue
    const fuel = FUEL_MAP[cells[idx.primary_fuel]] ?? 'other'
    const yearRaw = cells[idx.commissioning_year]
    const year = yearRaw && Number.isFinite(Number(yearRaw)) ? Math.round(Number(yearRaw)) : null
    const plant = {
      name: cells[idx.name],
      mw: Math.round(mw),
      lat: Number(lat.toFixed(4)),
      lon: Number(lon.toFixed(4)),
      fuel,
      tier: tierOf(mw),
      year,
    }
    if (!byCountry.has(iso3)) byCountry.set(iso3, [])
    byCountry.get(iso3).push(plant)
    kept++
  }

  await rm(OUT, { recursive: true, force: true })
  await mkdir(OUT, { recursive: true })
  const summary = {}
  for (const [iso3, plants] of byCountry) {
    plants.sort((a, b) => b.mw - a.mw)
    const byFuel = {}
    const byTier = {}
    for (const p of plants) {
      byFuel[p.fuel] = (byFuel[p.fuel] ?? 0) + 1
      byTier[p.tier] = (byTier[p.tier] ?? 0) + 1
    }
    await writeFile(
      path.join(OUT, `${iso3}.json`),
      JSON.stringify({ iso3, count: plants.length, byFuel, byTier, plants })
    )
    summary[iso3] = plants.length
  }
  await writeFile(path.join(OUT, '_index.json'), JSON.stringify({
    source: 'WRI Global Power Plant Database v1.3.0 (2021), CC BY 4.0',
    minMW: MIN_MW,
    generated: new Date().toISOString().slice(0, 10),
    counts: summary,
  }))

  console.log(`  ✓ ${kept} 座 ≥${MIN_MW}MW 電廠，分佈於 ${byCountry.size} 國`)
  console.log('  完成 ✓')
}

main().catch((err) => { console.error('✗ 電廠管線失敗：', err.message); process.exit(1) })
