# Gamybinio leidimo patikra

Patikros data: 2026-10-16. Leidimas patikrintas Jekyll artefakte, Cloudflare Pages peržiūroje ir gyvoje svetainėje. Ataskaita atskiria patikrintus faktus nuo likusių redakcinių ir operacinių darbų.

## Automatinė ir vietinė patikra

- [x] `K365_RELEASE=1 bundle exec ruby scripts/build.rb`: sugeneruoti 101 canonical HTML puslapis ir 1786 statiniai failai.
- [x] Visi 12 ženklų puslapių ir hub sugeneruoti serverio pusėje su rinkinio data `2026-10-16`, `lang="lt"`, canonical žyma ir sitemap įrašais.
- [x] `scripts/audit_site.py --release`: 102 HTML failas su 404 puslapiu, 101 indeksavimui skirtas puslapis, 8937 vietiniai tikslai, 0 sugadintų nuorodų; puslapių metaduomenų, kalbos, H1, canonical, paveikslėlių, JSON-LD, sitemap ir robots patikros praėjo.
- [x] Visi ankstesni 88 indeksuojami URL išsaugoti.
- [x] 832 esamų PDF/WebP failų SHA-256 sumos nepasikeitė.
- [x] 6 horoskopo validavimo vienetų testai ir 32 esami JavaScript testai praėjo.
- [x] Naršyklės QA: 13 puslapių, 6 CSS pločio kontekstų, iš viso 78 puslapio ir pločio deriniai; visi turėjo numatytą pavadinimą, turinį ir Lato stilių, nerasta horizontalaus slinkimo.
- [x] 390 ir 360 CSS px dydžiai patikrinti tos pačios kilmės iframe peržiūroje. Tai nėra fizinio telefono patikra.

## Cloudflare peržiūra ir gamybinis leidimas

- Peržiūros aplinka: `https://b9c12d40.kalendorius365.pages.dev` (deploy ID `b9c12d40-6981-4ef2-8888-dac5d1fcf8f5`), šaka `feature/lt-daily-horoscope`, commit `784645f9c30fb5dfa7f0df98532d3fc0e98543bf`; Cloudflare build ir publikavimo etapai sėkmingi.
- Gamybinė šaka: `main`; PR [#8](https://github.com/mateopedersen/kalendorius365/pull/8) sujungtas į `0d0c913123fcd3d3e82eb61d4304231b636550d8`.
- Cloudflare gamybinis deploy ID: `fb1840c3-7a50-4b59-99e4-d148766f9b8a`.
- Gamybinis deploy URL: `https://fb1840c3.kalendorius365.pages.dev`; prijungti alias domenai `kalendorius365.lt` ir `www.kalendorius365.lt`.
- Cloudflare detalėse matyti `success`; `initialize`, `clone repo`, `build` ir `deploy` etapai sėkmingi. Build logas rodo commit `0d0c913...`, 37 antraštės taisykles, 1788 statinius failus ir sėkmingą publikavimą. Cloudflare sąsajoje nurodyta trukmė – 30 s; logų laikas 2026-10-16 14:15:58–14:16:25 UTC.
- Gyva svetainė naršyklėje patikrinta 2026-10-16 14:19 UTC. Visos 13 adresų atvėrė numatytą puslapį, teisingą lietuvišką pavadinimą, rinkinio datą `2026-10-16` ir vieną H1; nė viename nebuvo 404 puslapio.
- Maršrutai: `/horoskopai/`, `/horoskopai/avinas/`, `/horoskopai/jautis/`, `/horoskopai/dvyniai/`, `/horoskopai/vezys/`, `/horoskopai/liutas/`, `/horoskopai/mergele/`, `/horoskopai/svarstykles/`, `/horoskopai/skorpionas/`, `/horoskopai/saulys/`, `/horoskopai/oziaragis/`, `/horoskopai/vandenis/`, `/horoskopai/zuvys/`.
- Gamybinės naršyklės dūmų patikra patvirtino puslapių įkėlimą ir turinį. Tiesioginis HTTP būsenos kodo nuskaitymas bei gamybinio atsakymo canonical/robots antraščių ištraukimas nebuvo atlikti; šie elementai patikrinti tikslaus leidimo artefakto audite, bet nepažymimi kaip atskirai nuskaityti iš gyvo atsakymo.
- Cloudflare peržiūroje hub ir visi 12 ženklų maršrutų buvo atverti atskirai; vietinės gamybinio režimo peržiūros pločių, klaviatūros ir kontrasto duomenys pateikti `QA_2_BROWSER.json`. Fizinis telefonas ir visų puslapių atskiri archyvuoti ekrano vaizdai nėra pateikti.

## Leidimo būklė ir ribojimai

Techninis puslapių rinkinys gyvas. Jis sudarytas iš originalių Kalendorius365.lt tekstų; išorinių horoskopų tekstų sindikavimo teisės nepatvirtintos ir tokie tekstai nekopijuojami. Šios datos rinkinį rengiant naudotas DI pirmojo varianto pagalbai, o nepriklausomas lietuvių kalbos redaktorius jo neperžiūrėjo. Kasdienis žmogaus redakcinis atnaujinimas nėra automatizuotas; todėl ši funkcija nėra patvirtintas visiškai automatinis kasdienis leidinys. Puslapiai tikrąją turinio datą ir šiuos ribojimus aiškiai parodo.

Gamybinės puslapio atvaizdavimo patikra PASS. Žmogaus redaktoriaus peržiūra, tvarus teisėtas kasdienio turinio šaltinis / kasdienė autorinė redakcinė darbo tvarka ir fizinio telefono patikra lieka neužbaigti. Paieškos sistemos crawl/indexability techninis auditas PASS; Google indeksavimas atskirai nepatvirtintas.
