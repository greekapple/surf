# Surf heights: every spot × the next 7 days of CDIP MOP forecast hours (T-130)

Generated 2026-11-04T19:47:34.909Z by `docs/forecast/data/spot-heights-week.ts` through the real `headlineSurf`. CDIP MOP forecast files only (public THREDDS); the v1 offshore-swell estimate is not part of this table.

- Coverage: every one of the 45 spots has a CDIP MOP point (44 distinct); this run fetched all of them.
- Model-vs-model agreement is not validation: v1 and MOP are both models, and neither is compared with an observation here.
- Hours checked: **2205**; offshore headlines: **0**; hours that were neither an estimate nor flat: **0**.
- Columns: mean MOP Hs at the point (the surf-height convention), mean typical-wave to sets band, then the share of hours made by the breaking rules (**rules**), by MOP's own nearshore height because the rules say the swell is blocked or too short (**blocked**), by MOP's height because the spot has no breaking profile (**no profile**), and the share under 0.5 ft (**Flat**).
- A modelled MOP point at 10–15 m depth is not the surf zone; every number is a model estimate.

| Spot | id | MOP point | hours | mean Hs at point | mean band | rules | blocked | no profile | Flat |
|---|---|---|---|---|---|---|---|---|---|
| Bolinas | spot-0 | MA137 (15 m) | 49 | 3.9 ft | 3.4–5.0 ft | 0% | 100% | 0% | 0% |
| Stinson Beach | spot-1 | MA121 (15 m) | 49 | 3.7 ft | 3.2–4.7 ft | 100% | 0% | 0% | 0% |
| Ocean Beach | spot-2 | SF023 (10 m) | 49 | 10.7 ft | 10.1–13.3 ft | 100% | 0% | 0% | 0% |
| Linda Mar | spot-3 | SM375 (15 m) | 49 | 5.4 ft | 4.9–6.9 ft | 100% | 0% | 0% | 0% |
| Montara | spot-4 | SM340 (15.05 m) | 49 | 7.2 ft | 6.6–9.0 ft | 100% | 0% | 0% | 0% |
| Mavericks | spot-5 | SM306 (15 m) | 49 | 6.6 ft | 6.1–8.5 ft | 0% | 0% | 100% | 0% ⚠ 15 m point, not the reef peak; big-wave focusing not modelled |
| Steamer Lane | spot-6 | SC149 (15 m) | 49 | 3.0 ft | 2.5–3.8 ft | 0% | 100% | 0% | 0% |
| Cowell’s | spot-7 | SC149 (15 m) | 49 | 3.0 ft | 2.5–3.8 ft | 0% | 0% | 100% | 0% ⚠ sheltered wrap point: the bay-mouth MOP point reads high here |
| Pleasure Point | spot-8 | SC117 (15 m) | 49 | 2.7 ft | 2.2–3.5 ft | 100% | 0% | 0% | 0% |
| Davenport | spot-9 | SC255 (15.01 m) | 49 | 5.0 ft | 4.5–6.3 ft | 100% | 0% | 0% | 0% |
| Crescent City | cs-crescent-city | DN194 (15 m) | 49 | 6.3 ft | 5.8–8.0 ft | 0% | 100% | 0% | 0% |
| Moonstone Beach | cs-moonstone | HU708 (15 m) | 49 | 9.8 ft | 9.3–12.1 ft | 100% | 0% | 0% | 0% |
| Humboldt North Jetty | cs-north-jetty | HU541 (15 m) | 49 | 11.2 ft | 10.7–13.9 ft | 12% | 88% | 0% | 0% |
| Shelter Cove | cs-shelter-cove | HU029 (15.01 m) | 49 | 8.4 ft | 7.9–10.7 ft | 0% | 0% | 100% | 0% |
| Point Arena | cs-point-arena | M0151 (15 m) | 49 | 5.6 ft | 5.1–7.3 ft | 100% | 0% | 0% | 0% |
| Salmon Creek | cs-salmon-creek | SN080 (15 m) | 49 | 6.8 ft | 6.3–8.6 ft | 100% | 0% | 0% | 0% |
| Dillon Beach | cs-dillon-beach | MA563 (15 m) | 49 | 5.9 ft | 5.5–7.5 ft | 100% | 0% | 0% | 0% |
| Waddell Creek | cs-waddell | SC319 (15.01 m) | 49 | 4.9 ft | 4.4–6.2 ft | 100% | 0% | 0% | 0% |
| Manresa | cs-manresa | SC049 (15 m) | 49 | 5.2 ft | 4.6–6.6 ft | 100% | 0% | 0% | 0% |
| Moss Landing | cs-moss-landing | MO893 (15.07 m) | 49 | 3.0 ft | 2.4–3.8 ft | 100% | 0% | 0% | 0% |
| Asilomar | cs-asilomar | MO716 (15 m) | 49 | 7.0 ft | 6.4–8.9 ft | 100% | 0% | 0% | 0% |
| Carmel Beach | cs-carmel | MO646 (15.01 m) | 49 | 4.4 ft | 3.9–5.6 ft | 100% | 0% | 0% | 0% |
| Sand Dollar | cs-sand-dollar | MO111 (15 m) | 49 | 7.9 ft | 7.3–9.8 ft | 100% | 0% | 0% | 0% |
| Morro Rock | cs-morro-rock | SL347 (15 m) | 49 | 5.6 ft | 5.1–7.2 ft | 100% | 0% | 0% | 0% |
| Pismo Beach Pier | cs-pismo | SL091 (15 m) | 49 | 3.8 ft | 3.3–4.8 ft | 100% | 0% | 0% | 0% |
| Jalama | cs-jalama | B1084 (10.01 m) | 49 | 4.1 ft | 3.7–5.2 ft | 100% | 0% | 0% | 0% |
| Rincon | cs-rincon | B0001 (10 m) | 49 | 1.7 ft | 1.3–2.3 ft | 0% | 0% | 100% | 0% |
| C Street | cs-c-street | VE466 (10.01 m) | 49 | 1.8 ft | 1.3–2.4 ft | 100% | 0% | 0% | 0% |
| County Line | cs-county-line | VE019 (10 m) | 49 | 2.2 ft | 1.7–2.7 ft | 100% | 0% | 0% | 0% |
| Zuma | cs-zuma | L1059 (10 m) | 49 | 2.2 ft | 1.6–2.7 ft | 100% | 0% | 0% | 0% |
| Malibu (Surfrider) | cs-malibu | L0904 (10.01 m) | 49 | 1.5 ft | 1.0–2.0 ft | 100% | 0% | 0% | 0% |
| Topanga | cs-topanga | L0809 (10 m) | 49 | 1.6 ft | 1.1–2.1 ft | 100% | 0% | 0% | 0% |
| El Porto | cs-el-porto | L0577 (10 m) | 49 | 2.5 ft | 1.9–3.0 ft | 100% | 0% | 0% | 0% |
| Hermosa Pier | cs-hermosa | L0530 (10.01 m) | 49 | 2.1 ft | 1.5–2.6 ft | 100% | 0% | 0% | 0% |
| Huntington Pier | cs-huntington | OC517 (10 m) | 49 | 1.9 ft | 1.5–2.5 ft | 100% | 0% | 0% | 0% |
| The Wedge | cs-wedge | OC379 (9.93 m) | 49 | 1.6 ft | 1.2–2.2 ft | 100% | 0% | 0% | 0% |
| Salt Creek | cs-salt-creek | OC177 (10 m) | 49 | 1.9 ft | 1.3–2.3 ft | 100% | 0% | 0% | 0% |
| Trestles | cs-trestles | D1206 (10 m) | 49 | 2.1 ft | 1.4–2.5 ft | 100% | 0% | 0% | 0% |
| Oceanside Pier | cs-oceanside | D0905 (10.01 m) | 49 | 2.0 ft | 1.4–2.5 ft | 100% | 0% | 0% | 0% |
| Swami’s | cs-swamis | D0704 (10.01 m) | 49 | 2.1 ft | 1.4–2.5 ft | 100% | 0% | 0% | 0% |
| Cardiff Reef | cs-cardiff | D0681 (10 m) | 49 | 1.9 ft | 1.4–2.5 ft | 100% | 0% | 0% | 0% |
| Black’s Beach | cs-blacks | D0541 (10 m) | 49 | 2.1 ft | 1.6–2.6 ft | 100% | 0% | 0% | 0% |
| Windansea | cs-windansea | D0457 (10.01 m) | 49 | 2.5 ft | 2.0–3.2 ft | 100% | 0% | 0% | 0% |
| Ocean Beach (San Diego) | cs-ob-sd | D0352 (10 m) | 49 | 3.0 ft | 2.6–3.8 ft | 100% | 0% | 0% | 0% |
| Imperial Beach | cs-imperial | D0054 (10 m) | 49 | 2.3 ft | 1.8–3.0 ft | 100% | 0% | 0% | 0% |

## v1 (offshore swell, breaking rules) vs MOP nearshore height (spec acceptance 4)

Mean over the hours where both exist (timestamps matched). v1 = the offshore-swell estimate carried to 10 m (its central surf height); MOP = CDIP's nearshore Hs at the assigned point. A positive difference means v1 reads higher than MOP. Spots with no breaking profile have no v1 estimate. **Spots flagged > 1 ft get their profile reviewed (with sources); this table is evidence, not a verdict.** Caveats: only hours where v1 produced an estimate are compared (v1 refuses short-period, out-of-window and wrapped swells, so the sample is biased toward hours it accepts, and "hours compared" is small for some spots); one week is one swell regime; "no Open-Meteo data" means the provider returned nothing for that spot's marine point.

| Spot | id | MOP | hours compared | mean v1 | mean MOP | v1 - MOP | verdict |
|---|---|---|---|---|---|---|---|
| Bolinas | spot-0 | MA137 | no Open-Meteo data | – ft | – ft | – ft | v1 has no estimate where MOP has one |
| Stinson Beach | spot-1 | MA121 | 0 | – ft | – ft | – ft | v1 has no estimate where MOP has one |
| Ocean Beach | spot-2 | SF023 | 41 | 6.3 ft | 11.1 ft | -4.8 ft | **> 1 ft: review the profile** |
| Linda Mar | spot-3 | SM375 | 46 | 7.5 ft | 5.4 ft | +2.0 ft | **> 1 ft: review the profile** |
| Montara | spot-4 | SM340 | 47 | 8.1 ft | 7.3 ft | +0.8 ft | within 1 ft |
| Mavericks | spot-5 | SM306 | 0 | – ft | – ft | – ft | v1 has no estimate where MOP has one |
| Steamer Lane | spot-6 | SC149 | 0 | – ft | – ft | – ft | v1 has no estimate where MOP has one |
| Cowell’s | spot-7 | SC149 | 0 | – ft | – ft | – ft | v1 has no estimate where MOP has one |
| Pleasure Point | spot-8 | SC117 | 0 | – ft | – ft | – ft | v1 has no estimate where MOP has one |
| Davenport | spot-9 | SC255 | 0 | – ft | – ft | – ft | v1 has no estimate where MOP has one |
| Crescent City | cs-crescent-city | DN194 | 0 | – ft | – ft | – ft | v1 has no estimate where MOP has one |
| Moonstone Beach | cs-moonstone | HU708 | 49 | 9.1 ft | 9.8 ft | -0.7 ft | within 1 ft |
| Humboldt North Jetty | cs-north-jetty | HU541 | 16 | 10.8 ft | 13.0 ft | -2.3 ft | **> 1 ft: review the profile** |
| Shelter Cove | cs-shelter-cove | HU029 | 0 | – ft | – ft | – ft | v1 has no estimate where MOP has one |
| Point Arena | cs-point-arena | M0151 | 0 | – ft | – ft | – ft | v1 has no estimate where MOP has one |
| Salmon Creek | cs-salmon-creek | SN080 | 49 | 8.5 ft | 6.8 ft | +1.7 ft | **> 1 ft: review the profile** |
| Dillon Beach | cs-dillon-beach | MA563 | 49 | 7.9 ft | 5.9 ft | +1.9 ft | **> 1 ft: review the profile** |
| Waddell Creek | cs-waddell | SC319 | 1 | 6.0 ft | 4.9 ft | +1.1 ft | **> 1 ft: review the profile** |
| Manresa | cs-manresa | SC049 | 0 | – ft | – ft | – ft | v1 has no estimate where MOP has one |
| Moss Landing | cs-moss-landing | MO893 | 40 | 7.1 ft | 3.1 ft | +4.0 ft | **> 1 ft: review the profile** |
| Asilomar | cs-asilomar | MO716 | 49 | 8.9 ft | 7.0 ft | +1.9 ft | **> 1 ft: review the profile** |
| Carmel Beach | cs-carmel | MO646 | 7 | 7.2 ft | 4.6 ft | +2.5 ft | **> 1 ft: review the profile** |
| Sand Dollar | cs-sand-dollar | MO111 | 49 | 8.3 ft | 7.9 ft | +0.5 ft | within 1 ft |
| Morro Rock | cs-morro-rock | SL347 | 48 | 6.9 ft | 5.6 ft | +1.3 ft | **> 1 ft: review the profile** |
| Pismo Beach Pier | cs-pismo | SL091 | 0 | – ft | – ft | – ft | v1 has no estimate where MOP has one |
| Jalama | cs-jalama | B1084 | 9 | 6.8 ft | 3.5 ft | +3.3 ft | **> 1 ft: review the profile** |
| Rincon | cs-rincon | B0001 | 0 | – ft | – ft | – ft | v1 has no estimate where MOP has one |
| C Street | cs-c-street | VE466 | 0 | – ft | – ft | – ft | v1 has no estimate where MOP has one |
| County Line | cs-county-line | VE019 | 1 | 2.0 ft | 1.7 ft | +0.3 ft | within 1 ft |
| Zuma | cs-zuma | L1059 | 22 | 2.3 ft | 2.2 ft | +0.1 ft | within 1 ft |
| Malibu (Surfrider) | cs-malibu | L0904 | 2 | 2.3 ft | 1.3 ft | +1.1 ft | **> 1 ft: review the profile** |
| Topanga | cs-topanga | L0809 | 2 | 2.3 ft | 1.3 ft | +1.0 ft | within 1 ft |
| El Porto | cs-el-porto | L0577 | 31 | 2.6 ft | 2.6 ft | +0.1 ft | within 1 ft |
| Hermosa Pier | cs-hermosa | L0530 | 31 | 2.5 ft | 2.2 ft | +0.3 ft | within 1 ft |
| Huntington Pier | cs-huntington | OC517 | 0 | – ft | – ft | – ft | v1 has no estimate where MOP has one |
| The Wedge | cs-wedge | OC379 | 0 | – ft | – ft | – ft | v1 has no estimate where MOP has one |
| Salt Creek | cs-salt-creek | OC177 | 36 | 2.5 ft | 1.9 ft | +0.7 ft | within 1 ft |
| Trestles | cs-trestles | D1206 | 11 | 2.9 ft | 1.8 ft | +1.1 ft | **> 1 ft: review the profile** |
| Oceanside Pier | cs-oceanside | D0905 | 9 | 2.2 ft | 1.9 ft | +0.3 ft | within 1 ft |
| Swami’s | cs-swamis | D0704 | 27 | 2.7 ft | 2.2 ft | +0.6 ft | within 1 ft |
| Cardiff Reef | cs-cardiff | D0681 | 21 | 2.6 ft | 1.9 ft | +0.6 ft | within 1 ft |
| Black’s Beach | cs-blacks | D0541 | 27 | 3.1 ft | 2.1 ft | +1.0 ft | within 1 ft |
| Windansea | cs-windansea | D0457 | 29 | 3.5 ft | 2.5 ft | +1.0 ft | within 1 ft |
| Ocean Beach (San Diego) | cs-ob-sd | D0352 | 39 | 3.9 ft | 3.1 ft | +0.9 ft | within 1 ft |
| Imperial Beach | cs-imperial | D0054 | 41 | 4.1 ft | 2.4 ft | +1.8 ft | **> 1 ft: review the profile** |
