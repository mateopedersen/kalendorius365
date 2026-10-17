# Exact before/after examples

Date: 2026-10-17. This ledger contains **56 distinct real changes** drawn from saved source-change reports, spanning every editorial family. Values are exact source strings or exact recorded literal fragments; code syntax such as quotes remains where it is part of the recorded change. These are not invented demonstration errors. The About examples compare its reviewed working draft with the corrected pre-publication draft; `/apie/` was newly created, not an existing production page.

A source link uses the current line when the complete after-value can be located exactly; otherwise the recorded original line is labelled explicitly. Generated output may repeat a single source repair across many pages, so these examples are not a count of unique root causes. Full record keys, affected routes and reasons remain in the named evidence JSON files under the operator audit bundle.

## Core calendars, print collections, tools, search and privacy

| # | Before | After | Source and evidence |
|---:|---|---|---|
| 1 | `Teisinė peržiūra: 2026-10-16.` | `Teisės aktų duomenys sutikrinti 2026-10-16.` | [scripts/pages.rb:67](../../../scripts/pages.rb#L67); `root-changes.json` / `row 1` |
| 2 | `Portretas` | `Stačias` | [scripts/pages.rb:258](../../../scripts/pages.rb#L258); `root-changes.json` / `row 8` |
| 3 | `36 mėnesiai. Kiekvienam – dešimt savitų planavimo būdų.` | `Pasirinkite mėnesį ir peržiūrėkite dešimt jo kalendoriaus maketų.` | [scripts/pages.rb:238](../../../scripts/pages.rb#L238); `root-changes.json` / `row 12` |
| 4 | `Ne keliamieji metai, 365 dienos ir 10 metinių dizainų.` | `Įprastiniai metai: 365 dienos ir 10 metinių kalendoriaus maketų.` | [scripts/pages.rb:234](../../../scripts/pages.rb#L234); `root-changes.json` / `row 13` |
| 5 | `Mėnuo atveria savo dešimties dizainų kolekciją.` | `Spustelėję mėnesio pavadinimą rasite dešimt jo kalendoriaus maketų.` | [scripts/pages.rb:273](../../../scripts/pages.rb#L273); `root-changes.json` / `row 14` |
| 6 | `Tikros datos. Jūsų pasirinkimai. Asmeniniai įvykiai apdorojami tik šioje naršyklėje.` | `Pasirinkite mėnesį ar metus, lapo dydį ir išvaizdą. Asmeniniai įvykiai apdorojami tik šioje naršyklėje.` | [scripts/pages.rb:302](../../../scripts/pages.rb#L302); `root-changes.json` / `row 17` |
| 7 | `Spausdinti / Išsaugoti PDF` | `Spausdinti arba išsaugoti PDF` | [scripts/pages.rb:303](../../../scripts/pages.rb#L303); `root-changes.json` / `row 18` |
| 8 | `Dienos, savaitės ir darbo laikas – pagal tikras kalendoriaus datas.` | `Sužinokite dienų skirtumą, pridėkite dienų prie datos arba apskaičiuokite darbo laiką.` | [scripts/pages.rb:299](../../../scripts/pages.rb#L299); `root-changes.json` / `row 21` |
| 9 | `Keiskite orų miestą arba naudokite automatinį pasirinkimą.` | `Pasirinkite miestą, kurio orus norite matyti.` | [scripts/pages.rb:488](../../../scripts/pages.rb#L488); `root-changes.json` / `row 22` |
| 10 | `Turimas atostogų dienų biudžetas` | `Turimas atostogų dienų likutis` | [scripts/pages.rb:321](../../../scripts/pages.rb#L321); `root-changes.json` / `row 23` |
| 11 | `Tikri PDF ir 600 PPI WebP.` | `Vektoriniai PDF ir 600 PPI WebP failai.` | [lib/page_designs.rb:62](../../../lib/page_designs.rb#L62); `root-changes.json` / `row 29` |
| 12 | `Kalendorious 365` | `Kalendorius365` | [site/_includes/privacy-policy-lt.html:21](../../../site/_includes/privacy-policy-lt.html#L21); `root-changes.json` / `row 55` |
| 13 | `paieškos tekstas lyginamas su statiniu katalogu ir serveriui nesiunčiamas.` | `paieška atliekama naršyklėje pagal statinį katalogą. Atvėrus paieškos rezultatų puslapį, paieškos frazė gali būti URL dalis ir patekti į užklausos techninius metaduomenis.` | [site/_includes/privacy-policy-lt.html:14](../../../site/_includes/privacy-policy-lt.html#L14); `root-changes.json` / `row 56` |
| 14 | `spausdinamais 2027–2028 m. kalendoriais.` | `spausdinamais 2027–2029 m. kalendoriais.` | [site/index.html:3](../../../site/index.html#L3); `root-changes.json` / `row 64` |
| 15 | `Ieškokite visame Kalendorius365 puslapyje:` | `Ieškokite visoje „Kalendorius365“ svetainėje:` | [scripts/pages.rb:407](../../../scripts/pages.rb#L407); `root-changes.json` / `row 66` |
| 16 | `Tvarkaraščio pavadinimas (nebūtina)` | `Tvarkaraščio pavadinimas (nebūtinas)` | [lib/phase_5_6_8_pages.rb:32](../../../lib/phase_5_6_8_pages.rb#L32); `root-changes.json` / `row 69` |

## Nameday interface and source explanation

| # | Before | After | Source and evidence |
|---:|---|---|---|
| 17 | `Vardadienis ir Velykos yra skirtingos datos: vardadienis šiame kalendoriuje nekinta, o Velykų sekmadienis kasmet apskaičiuojamas atskirai.` | `Vardadienių datos šiame kalendoriuje nekinta, o Velykų sekmadienio data kasmet apskaičiuojama atskirai.` | [lib/namedays_pages.rb:19](../../../lib/namedays_pages.rb#L19); `root-changes.json` / `row 31` |
| 18 | `autorių istoriją` | `straipsnio keitimų istoriją` | [lib/namedays_pages.rb:55](../../../lib/namedays_pages.rb#L55); `root-changes.json` / `row 32` |
| 19 | `Aprėptis: 366 mėnesio dienos, įskaitant vasario 29-ąją.` | `Rinkinyje – 366 kalendorinės datos, įskaitant vasario 29-ąją.` | [lib/namedays_pages.rb:58](../../../lib/namedays_pages.rb#L58); `root-changes.json` / `row 35` |
| 20 | `Paieška parengiama iš vietinio duomenų rinkinio…` | `Įkeliama vardų paieška…` | [lib/namedays_pages.rb:75](../../../lib/namedays_pages.rb#L75); `root-changes.json` / `row 36` |
| 21 | `Įrašas nebus sukurtas, kol data neužpildyta.` | `Prieš kurdami įrašą pasirinkite datą.` | [site/assets/namedays.js:41](../../../site/assets/namedays.js#L41); `root-changes.json` / `row 40` |
| 22 | `Vasario 29-oji ${y} m. neegzistuoja.` | `${y} m. vasaris turi 28 dienas.` | [site/assets/namedays.js:59](../../../site/assets/namedays.js#L59); `root-changes.json` / `row 41` |

## Lunar, seasonal and solar copy

| # | Before | After | Source and evidence |
|---:|---|---|---|
| 23 | `Tikros datos. Aiškiai paaiškintas vaizdas.` | `Kaip apskaičiuojamos fazės ir Mėnulio vaizdas?` | [scripts/lunar/pages.py:22](../../../scripts/lunar/pages.py#L22); `astronomy-changes.json` / `ASTRO-001` |
| 24 | `Pridėti visas fazes` | `Atsisiųsti fazes (ICS)` | [scripts/lunar/pages.py:34](../../../scripts/lunar/pages.py#L34); `astronomy-changes.json` / `ASTRO-003` |
| 25 | `Metinis dvylikos eilučių plakatas, kuriame matyti visų metų Mėnulio ritmas.` | `Dvylika mėnesių viename plakate: kasdieniai Mėnulio vaizdai ir fazių datos.` | [scripts/lunar/pages.py:47](../../../scripts/lunar/pages.py#L47); `astronomy-changes.json` / `ASTRO-005` |
| 26 | `Jaunatis, priešpilnis, pilnatis ir delčia yra tikslios akimirkos. Tarp jų Mėnulio apšviesta dalis keičiasi nuolat.` | `Lentelėse nurodomi tikslūs jaunaties, priešpilnio, pilnaties ir delčios momentai. Tarp jų Mėnulio apšviesta dalis keičiasi nuolat.` | [scripts/lunar/pages.py:109](../../../scripts/lunar/pages.py#L109); `astronomy-changes.json` / `ASTRO-017` |
| 27 | `Ilgiausia diena nėra karščiausios dienos pažadas.` | `Ilgiausia metų diena nebūtinai būna karščiausia.` | [scripts/seasons/pages.py:22](../../../scripts/seasons/pages.py#L22); `astronomy-changes.json` / `ASTRO-019` |
| 28 | `Viena ašis. Keturi metų lūžiai.` | `Kaip Žemės ašies pasvirimas keičia metų laikus?` | [scripts/seasons/pages.py:54](../../../scripts/seasons/pages.py#L54); `astronomy-changes.json` / `ASTRO-022` |
| 29 | `Dvi savaitės aplink įvykį` | `Dienos ilgumas prieš reiškinį ir po jo` | [scripts/seasons/pages.py:64](../../../scripts/seasons/pages.py#L64); `astronomy-changes.json` / `ASTRO-025` |
| 30 | `Šios dienos saulės laikų apskaičiuoti nepavyko.` | `Pasirinktos dienos Saulės laikų apskaičiuoti nepavyko.` | [site/assets/sunrise.js:144](../../../site/assets/sunrise.js#L144); `astronomy-changes.json` / `ASTRO-033` |
| 31 | `Palyginti su vakar:` | `Palyginti su ankstesne diena:` | [site/assets/sunrise.js:149](../../../site/assets/sunrise.js#L149); `astronomy-changes.json` / `ASTRO-035` |
| 32 | `Sustabdyti saulės kelią` | `Sustabdyti animaciją` | [site/assets/sunrise.js:166](../../../site/assets/sunrise.js#L166); `astronomy-changes.json` / `ASTRO-038` |

## Holiday detail and monthly guides

| # | Before | After | Source and evidence |
|---:|---|---|---|
| 33 | `Pažymėta šios dienos data` | `Paryškintos šio gido datos` | [scripts/holiday_phase2/pages.py:83](../../../scripts/holiday_phase2/pages.py#L83); `holiday-changes-work.json` / `LT-HOL-001` |
| 34 | `Turinį ir lietuvių kalbą peržiūrėjo DI redaktorius.` | `Turinys ir kalba peržiūrėti pasitelkiant dirbtinį intelektą.` | [scripts/holiday_phase2/pages.py:101](../../../scripts/holiday_phase2/pages.py#L101); `holiday-changes-work.json` / `LT-HOL-004` |
| 35 | `Ieškoti šiame mėnesyje` | `Ieškoti šio mėnesio datų` | [scripts/monthly_holidays/pages.py:89](../../../scripts/monthly_holidays/pages.py#L89); `holiday-changes-work.json` / `LT-HOL-006` |
| 36 | `Atkurti viską` | `Išvalyti filtrus` | [scripts/monthly_holidays/pages.py:89](../../../scripts/monthly_holidays/pages.py#L89); `holiday-changes-work.json` / `LT-HOL-007` |
| 37 | `Pirmoji mėnesio data:` | `Pirmoji pažymėta data:` | [scripts/monthly_holidays/pages.py:110](../../../scripts/monthly_holidays/pages.py#L110); `holiday-changes-work.json` / `LT-HOL-010` |
| 38 | `Pagal šiuos filtrus datų nerasta. Pakeiskite paiešką arba atkurkite viską.` | `Datų pagal pasirinktus filtrus nerasta. Pakeiskite paiešką arba išvalykite filtrus.` | [scripts/monthly_holidays/pages.py:111](../../../scripts/monthly_holidays/pages.py#L111); `holiday-changes-work.json` / `LT-HOL-011` |
| 39 | `Tekstas parengtas ir peržiūrėtas naudojant dirbtinį intelektą; nepriklausomo gimtakalbio ar teisininko patvirtinimas neteikiamas.` | `Tekstas parengtas ir peržiūrėtas pasitelkiant dirbtinį intelektą. Nepriklausoma gimtakalbio redaktoriaus ar teisininko peržiūra neatlikta.` | [scripts/monthly_holidays/pages.py:115](../../../scripts/monthly_holidays/pages.py#L115); `holiday-changes-work.json` / `LT-HOL-014` |
| 40 | `Birželio 24-oji yra Rasos ir Joninių diena: teisėje vartojamas bendras pavadinimas, o gyvos tradicijos gali vadinti Rasomis, Kupolinėmis ar Joninėmis.` | `Birželio 24-ąją minima Rasos ir Joninių diena. Su šia vasaros švente siejami Rasų, Kupolinių ir Joninių pavadinimai bei skirtingi papročiai.` | [data/holiday-editorial.json:712](../../../data/holiday-editorial.json#L712); `holiday-changes-work.json` / `LT-HOL-020` |
| 41 | `Kūčios minimos gruodžio 24 d. DK 123 straipsnyje ši diena atskirai įvardyta kaip šventinė diena. Kūčių tradicijų centre dažnai yra vakaro vakarienė.` | `Kūčios minimos gruodžio 24 d. Darbo kodekso 123 straipsnyje ši diena įvardyta kaip šventinė diena. Vienas svarbiausių papročių – šeimos vakarienė Kūčių vakarą.` | [data/holiday-editorial.json:1025](../../../data/holiday-editorial.json#L1025); `holiday-changes-work.json` / `LT-HOL-023` |
| 42 | `Padėka gali būti trumpa ir asmeniška. Dovana ar bendras rinkliavos fondas neturėtų būti prievolė. Savaitgalį tenkanti data automatiškai neperkeliama.` | `Padėka gali būti trumpa ir asmeniška. Dovanos ir pinigų rinkimas turėtų būti savanoriški. Šiai neoficialiai progai netaikoma automatinio datos perkėlimo taisyklė.` | [data/holiday-phase2.json:310](../../../data/holiday-phase2.json#L310); `holiday-changes-work.json` / `LT-HOL-026` |

## Daily horoscopes, zodiac boundaries and ascendant results

| # | Before | After | Source and evidence |
|---:|---|---|---|
| 43 | `"Geresnis susitarimas prasideda išklausymu"` | `"Prieš susitardamas išklausyk kitą"` | [scripts/horoscopes/editorial_lt.py:80](../../../scripts/horoscopes/editorial_lt.py#L80); `agent-horoscope.json` / `LT-HOR-020` |
| 44 | `"dėmesį į mažą naują pradžią ir tai, ko šiuo metu nori pats"` | `"naujas sumanymas ir asmeninis pasirinkimas"` | [scripts/horoscopes/editorial_lt.py:136](../../../scripts/horoscopes/editorial_lt.py#L136); `agent-horoscope.json` / `LT-HOR-039` |
| 45 | `"Neptune": "Neptūnas"` | `"Neptune": "Neptūno"` | [scripts/horoscopes/editorial_lt.py:162](../../../scripts/horoscopes/editorial_lt.py#L162); `agent-horoscope.json` / `LT-HOR-059` |
| 46 | `"Pluto": "Plutonas"` | `"Pluto": "Plutono"` | [scripts/horoscopes/editorial_lt.py:162](../../../scripts/horoscopes/editorial_lt.py#L162); `agent-horoscope.json` / `LT-HOR-060` |
| 47 | `Kovo 21 d. – balandžio 19 d.` | `kovo 21 d. – balandžio 19 d.` | [site/_data/horoscope_signs.json:6](../../../site/_data/horoscope_signs.json#L6); `agent-horoscope.json` / `LT-HOR-064` |
| 48 | `Ascendentui apskaičiuoti reikalinga gimimo data, tikslus vietos laikas ir miestas. Įveskite duomenis – skaičiavimas vyksta šiame įrenginyje.` | `Ascendentui apskaičiuoti reikia gimimo datos, tikslaus vietos laiko ir gimimo vietos. Skaičiuojama šiame įrenginyje.` | [lib/horoscopes_pages.rb:148](../../../lib/horoscopes_pages.rb#L148); `agent-horoscope.json` / `LT-HOR-076` |
| 49 | `rezultatas nėra pilnas gimimo horoskopas.` | `rezultatas nėra išsamus gimimo horoskopas.` | [lib/horoscopes_pages.rb:156](../../../lib/horoscopes_pages.rb#L156); `agent-horoscope.json` / `LT-HOR-078` |
| 50 | `Tekstuose nepateikiami sveikatos diagnozės, finansiniai nurodymai ar garantuotos baigtys.` | `Tekstuose nerasite sveikatos diagnozių, finansinių rekomendacijų ar garantuotų baigčių.` | [lib/horoscopes_pages.rb:201](../../../lib/horoscopes_pages.rb#L201); `agent-horoscope.json` / `LT-HOR-085` |
| 51 | `arti ribos tiksliam Saulės ženklui reikėtų metų, laiko ir laiko juostos.` | `gimus ties ženklų riba tiksliam atsakymui reikia gimimo metų, laiko ir laiko juostos.` | [lib/zodiac_pages.rb:103](../../../lib/zodiac_pages.rb#L103); `agent-horoscope.json` / `LT-HOR-095` |
| 52 | `Dažnai apibūdinamas kaip smalsus, judrus ir klausimų kupinas bendravimo būdas.` | `Šioje astrologinėje interpretacijoje Dvynių ascendentas siejamas su smalsumu, klausimais ir noru bendrauti.` | [site/assets/ascendant-calculator.js:6](../../../site/assets/ascendant-calculator.js#L6); `agent-horoscope.json` / `LT-HOR-102` |
| 53 | `Šiuo vietos laiku laikrodis galėjo būti persuktas. Pasirinkite kitą gimimo laiką arba patikrinkite jo įrašą.` | `Dėl laikrodžio persukimo pasirinktoje vietoje tokio laiko nebuvo. Patikrinkite gimimo dokumentuose nurodytą laiką.` | [site/assets/ascendant-calculator.js:83](../../../site/assets/ascendant-calculator.js#L83); `agent-horoscope.json` / `LT-HOR-105` |
| 54 | `Jūsų kylantis ženklas` | `Jūsų ascendentas` | [site/assets/ascendant-calculator.js:186](../../../site/assets/ascendant-calculator.js#L186); `agent-horoscope.json` / `LT-HOR-107` |

## About methodology: independently corrected working draft

| # | Before | After | Source and evidence |
|---:|---|---|---|
| 55 | `nurodytos autorių, šaltinio, pakeitimų ir CC BY-SA 4.0 licencijos sąlygos` | `nurodyti duomenų šaltiniai, keitimų istorijos nuorodos, atlikti pakeitimai ir CC BY-SA 4.0 licencijos sąlygos` | [site/apie/index.html:12](../../../site/apie/index.html#L12); `independent-root-corrections.json` / `row 3` |
| 56 | `Vardadienių šaltinio duomenų redakcija atskirta nuo kasdien naršyklėje apskaičiuojamų „šiandien“ ir „rytoj“.` | `Vardadienių šaltinio redakcija nesusijusi su pasirinkta data: rodydami „šiandien“ ir „rytoj“, remiamės Lietuvos laiku.` | [site/apie/index.html:15](../../../site/apie/index.html#L15); `independent-root-corrections.json` / `row 4` |

## Verification notes

The first round corrected source templates, JSON copy and browser strings. The independent second review found additional date punctuation, search wording and abbreviation truncation issues; their corrected output was checked after rebuilding. Provider/source license metadata, astronomical instants and source-spelled nameday data were not rewritten as language fixes. Native-human review and final production success are not claimed by this sample ledger.
