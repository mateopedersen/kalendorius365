# Pradinė horoskopų funkcijos būklė

Patikra atlikta 2026-10-16 prieš pakeitimus. Darbo šaka sukurta nuo tuo metu atnaujintos `origin/main` būsenos.

| Sritis | Būsena | Įrodymas |
|---|---|---|
| GitHub `mateopedersen/kalendorius365` | YRA | Privačios saugyklos vietinė kopija ir `origin` nuotolinis adresas pasiekiami; pradinis `origin/main` commit: `b6baeb1c280b407032e25a145da7b26d1727939e`. Vietinė `main` rodyklė buvo pasenusi (`a78a578`), todėl ji nebuvo naudojama kaip pagrindas. |
| Cloudflare Pages integracija | YRA | `README.md` nurodo esamą Cloudflare Git integraciją, `main` gamybinę šaką ir `public` išvesties katalogą; neaptikta atskiro `.github/workflows` katalogo ar naujos hosting konfigūracijos. |
| Ruby/Jekyll generavimas | YRA | Ruby 3.4.11 ir Bundler 2.6.9 įdiegti už saugyklos ribų į projekto darbo įrankių katalogą; sistemos Ruby 2.6.10 netinkamas. Jekyll priklausomybės nurodytos `Gemfile` ir `Gemfile.lock`. |
| Horoskopų hub ir 12 Vakarų ženklų puslapių | TRŪKSTA | `site/horoskopai/` maršrutų ir ženklo puslapių nebuvo; istorinių šakų medyje ir commit pavadinimuose nerasta įgyvendinimo. |
| Kinų arba lietuvių kultūrinio zodiako puslapiai | TRŪKSTA | Horoskopų ar zodiako turinio maršrutų nerasta. Šie formatai neįtraukiami į šios užduoties Vakarų zodiako puslapius. |
| Horoskopo nuoroda gyvoje navigacijoje / pradžios atradimo bloke | TRŪKSTA | Gamybinė pradžia atverta Codex naršyklėje. `Pagrindinis meniu` turi kalendoriaus, metų, švenčių, darbo, saulės, atsisiuntimų ir įrankių nuorodas. Pradžios „Svarbios datos ir dienos ritmas“ bloke yra švenčių, saulės, Mėnulio ir ilgųjų savaitgalių kortelės, bet horoskopo nėra. |
| Gamybinis horoskopo URL atsako HTTP 200 | TRŪKSTA | 2026-10-16 tiesiogiai naršyklėje atvertas `https://kalendorius365.lt/horoskopai/` maršrutas. Jis grąžino svetainės tikrą 404 puslapį, todėl gamyboje nebuvo veikiančio hub puslapio. |
| Dienos turinio teisių šaltinis | IŠ DALIES IŠTIRTA | ELTA viešas prenumeratos aprašas mini astrologines žinias, o kopijavimą platinti draudžia be sutikimo; kainos neviešos, temos derinamos sutartyje. Sigastra palaiko 15 kalbų, bet ne lietuvių, pilnam tekstui reikalauja šaltinio canonical. Joks tinkamas automatinis lietuviškas sindikavimo leidimas nenustatytas. |
| Pradinė indeksuojamų URL inventorizacija | YRA | Esamame `public/sitemap.xml` užfiksuoti 88 URL faile `BASELINE_INDEXABLE_URLS.txt`. |
| Pradinė atsisiunčiamų kalendorių inventorizacija | YRA | Užfiksuota 832 PDF/WebP failų SHA-256 suma faile `BASELINE_DOWNLOAD_SHA256.txt`; įskaičiuoti visi `site/downloads/` PDF ir WebP failai. |

Gamybinės pradžios puslapio gyvas DOM patvirtina dabartinę navigaciją. `index.html` HTML yra serveriu sugeneruotas; svetainė naudoja `lang="lt"`, Lato šriftą, dizaino žetonus ir build-time sitemap / canonical generavimą. Gamybinis `/horoskopai/` kelias patikrintas ir iki šios šakos pakeitimų grąžino svetainės 404 dizainą.

## Leidimo ribos

ELTA, day.lt, horoskopai.lt ir Sigastra nėra patvirtinti kaip teisėtas, lietuviškas, pilno teksto automatinis turinio šaltinis. Svetainės puslapiai ir turinys nenaudojami kopijavimui. Kol nėra rašytinės sindikavimo licencijos, paskelbti galima tik originalų turinį su aiškia data ir nurodyta jo parengimo / redakcinės peržiūros būsena. Kasdienio automatinio atnaujinimo nereikia teigti, kol nėra veikiančio ir leidimą turinčio turinio tiekimo.
