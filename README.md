# ⚡ 全球電力地圖 Global Power Atlas

一個開放的公益網站：查詢全世界每個國家的**電從哪裡來**（煤、天然氣、石油、核能、水力、陸域/離岸風電、太陽能、地熱、生質能）、**電網有多乾淨**、**能源靠不靠進口**，以及**電流向哪些產業與企業**（例如台積電用掉台灣 9% 的電，相當於 615 萬戶家庭）。

An open, public-interest site for exploring every country's electricity mix, grid cleanliness, energy imports/exports, and where the power goes — bilingual (繁中/EN).

## 特色

- 🗺️ 可縮放的互動世界地圖（低碳佔比／碳強度／能源自給率三種著色）
- 🌏 215 個國家/地區、1985 年至今的真實資料（OWID／Ember／Energy Institute／IRENA）
- 🇹🇼 台灣深度頁：部門用電、用電大戶（台積電、中鋼、台塑、資料中心）與家庭用電換算
- 🏢 企業綠電/CPPA 卡片（多產業，附來源）
- 🔄 GitHub Actions 每月自動更新資料，內建驗證關卡（驗證失敗自動保留舊資料）
- 📖 開放原始碼（MIT）；數據整理自各機構公開發布的資料集，逐筆標註來源

## 本地開發

```bash
npm install        # 安裝相依套件（第一次）
npm run dev        # 啟動本地預覽 → http://localhost:5173
npm run build      # 產出可部署的靜態網站（dist/）
npm run data       # 重新抓取並驗證最新資料（--force 可強制重新下載）
```

## 資料檔案（JSON）

網站的資料為靜態 JSON 檔，路徑如下（維護與除錯用；數據版權歸原始機構所有，再利用前請確認各機構授權條款）：

| 路徑 | 內容 |
|---|---|
| `/data/countries.json` | 全部國家索引：最新年份能源結構佔比（含離岸/陸域風電與地熱拆分）、碳強度、能源自給率、進出口徽章（`coalExporter` 等）、世界彙總 |
| `/data/country/{ISO3}.json` | 單一國家 1985 年至今的完整時間序列（例：`/data/country/TWN.json`） |
| `/data/world.geo.json` | 世界地圖 GeoJSON（feature `properties.iso3`） |

主要欄位：`generation`/`demand`（TWh）、`shares.*`（發電佔比 %）、`carbonIntensity`（gCO₂/kWh）、`selfSufficiency`（0–5，1 = 自給自足）、`netImportsShare`（電力淨進口佔需求 %）。

## 資料更新機制

`scripts/build-data.mjs` 會下載 OWID energy dataset 與 IRENA 統計 → 清洗合併 → 通過驗證關卡（佔比加總、國家數、13 個重點國家抽樣）才寫入 `public/data/`。`.github/workflows/update-data.yml` 每月 5 日自動執行並提交，驗證失敗時網站保持舊資料。

人工整理的資料（要手動更新）：
- `src/data/taiwan-detail.json` — 台灣部門用電、用電大戶、台電每戶平均用電
- `src/data/companies.json` — 企業綠電/CPPA 卡片
- `src/data/cleantech.json` — 潔淨科技大國榜

每筆人工資料都附 `source`（來源與年份），更新時請一併更新來源。

## 部署

看 [部署指南.md](./部署指南.md) —— 手把手中文教學，不需要會寫程式。

## 授權

- 程式碼：[MIT](./LICENSE)
- 數據：整理自 [Our World in Data](https://github.com/owid/energy-data)（Ember、Energy Institute）與 [IRENA](https://pxweb.irena.org) 公開發布的資料集，版權與授權條款歸原機構所有（OWID 標示為 CC BY 4.0）。引用請一併標註原始來源。

## 大型發電廠地圖

國家頁的電廠地圖使用 [WRI Global Power Plant Database](https://datasets.wri.org/dataset/globalpowerplantdatabase)（v1.3, 2021, CC BY 4.0），篩選裝置容量 ≥100MW 的電廠，依國家產出 `public/data/plants/{ISO3}.json`。地圖以 Leaflet + OpenStreetMap/CARTO 底圖呈現。此資料為 2021 凍結版，重建指令：`npm run plants`。
