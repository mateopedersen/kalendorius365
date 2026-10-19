# Kalendorius365 — 192 puslapių kompiuterio peržiūros QA

Atlikta 2026-10-19 tiesiogiai prieš diegimą. Viešas svetainės žemėlapis pateikė 191 puslapio URL; prie jų įtraukiau ir `404.html`, tad patikrinta 192 taikiniai. Kiekvieną atvėriau Playwright Chromium ir WebKit naršyklėmis, nuskenavau visą puslapį ir patikrinau 1024, 1440 bei 1920 px darbastalio pločius: iš viso **1 152 puslapio / naršyklės / pločio matavimai**.

## Rezultatai

| Patikra | Chromium | WebKit |
|---|---:|---:|
| Puslapiai su HTTP 200 | 192/192 | 192/192 |
| Naršymo, tinklo ar JavaScript klaidos | 0 | 0 |
| Horizontalus puslapio persipynimas už ekrano | 0 | 0 |
| Nerodomas pagrindinis antraštės tekstas | 0 | 0 |
| Nukirptas matomas tekstas ar valdikliai | 0 | 0 |
| Sugedę / neužsikrovę matomi paveikslai | 0 / 0 | 0 / 0 |

Puslapio atvaizdavimo ir tinklo kritinių ar didelių defektų nerasta. Mėnulio ir Saulės iliustracijų dekoratyvinės orbitos kai kuriuose pločiuose sąmoningai pasislepia savo piešinio rėmo pakraštyje; jos nepastumia puslapio, neuždengia teksto ar veiksmų ir neatsiranda kaip turinio ar išdėstymo klaida.

## Pataisymų registras

- **K365-DESK-01 — duomenų įkėlimo ir formos įvykių lenktynės (aukštas funkcinis pavojus):** kalendoriaus JSON įkėlimo metu datos skaičiuoklės, ISO datos, atgalinio skaičiavimo, darbo dienų tikrintuvo ir atsisiuntimų pasirinkimo valdikliai galėjo tapti interaktyvūs dar iki jų įvykių apdorojimo parengimo. Dėl to anksti įvesta data galėjo būti perrašyta arba pirmas pasirinkimas prarastas. Pataisyta baziniuose šablonuose ir statiniuose puslapiuose: parengimo metu valdikliai yra `inert`, o jų prieinamumo būseną nurodo `aria-busy`; raktų įkėlimui ir įvykiams pasirengus, būsena atlaisvinama. Jau įvestos datos išsaugomos, o ne pakeičiamos dabartine data.
- **Duomenų saugojimas:** pataisos neliečia naudotojo `localStorage` ar `IndexedDB` duomenų ir nuostatų.
- **Perpublikavimas:** `scripts/pages.rb` ir baziniai Ruby/Javascript šablonai atnaujinti, pataisa išlieka atstatant kasdienį Jekyll leidimą.

## E2E ir build patikros

- Pilnas vietinis Jekyll release build: sėkmingas; sugeneruota 191 HTML puslapio URL, 4 621 statinis failas, 390 vaizdas; release ID `642420ce957957ca6b37`.
- JavaScript / domeno / HTML regression: **400/400** `node --test test/*.test.js` praėjo.
- Nauja async-startup pataisų E2E turas: **72/72** Chromium + WebKit E2E testai praėjo: paieška, datos ir darbo skaičiavimai, interaktyvūs kalendoriai, 5/6 eilučių parsisiuntimas ir PDF generavimas, o taip pat pirmo prisilietimo lenktynių atvejai.

## Puslapis po puslapio

`page-by-page.csv` turi visų 192 URL rezultatus, abu naršyklių variklius, HTTP būsenas, tinklo / JavaScript klaidas, 3 patikrintus pločius, persipynimo / nukirpto turinio / paveikslų skaitiklius.

Keletas atvaizdavimo įrodymų (Chromium, 1440 px):

- [Mėnesio parsisiuntimo šablonai — 2029 m. vasaris](evidence/desktop-monthly-download-2029-february.png)
- [Mėnulio fazės](evidence/desktop-lunar-phases.png)
- [Saulės ir astronomijos įrankiai](evidence/desktop-solar-tools.png)

Matuojančio audito scenarijus: `scripts/desktop_site_visual_audit.mjs`.
