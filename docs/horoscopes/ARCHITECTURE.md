# Horoskopų techninė struktūra

- Jekyll statinio leidimo metu iš `site/_data/horoscope_signs.json` ir `site/_data/horoscope_current.json` generuojami `/horoskopai/` bei 12 ASCII slug maršrutų.
- Puslapių turinys HTML viduje pateikiamas iš karto. Naršyklės JavaScript horoskopų tekstui, datai, canonical ar indeksavimui nereikalingas.
- Bendras Jekyll maketas sukuria `lang="lt"`, unikalų pavadinimą ir aprašą, HTTPS self-canonical, breadcrumbs duomenis ir bendrą dizaino sistemą. Tik `K365_RELEASE=1` leidimas pašalina noindex žymas ir įrašo maršrutus sitemap'e; šakų peržiūroje `X-Robots-Tag: noindex` lieka.
- Data ir laiko zonoje DST-arithmetic `Europe/Vilnius` patikrinami su Python `zoneinfo`. Siūlomas vienas failas visiems 12 ženklams; kiekvienas įrašas tikrinamas prieš išleidimą, todėl dalinis rinkinys negali praeiti.
- Turinio SHA-256 skaičiuojamas iš sutvarkytų 12 įrašų ir fiksuoto lauko eiliškumo. Ruby generatorius ir Python validavimo programa naudoja tą patį algoritmą.
- `scripts/validate_horoscopes.py --promote <kandidato-failas>` tik tada pakeičia aktyvų rinkinį, kai 12 tekstai pilni, checksum teisingas, vietos data šiandien, o metaduomenyse įrašytas lietuvių kalbos redaktoriaus patvirtinimas. Aktyvus rinkinys prieš pakeitimą išsaugomas `docs/horoscopes/snapshots/` aplanke.
- Nėra trečios šalies API, slaptų raktų, mokamos paslaugos ar automatinio DI teksto publikavimo. Išlaikomas esamas Cloudflare Pages Git integravimas ir esamas release build.

## Maršrutų sąrašas

`/horoskopai/`, `/horoskopai/avinas/`, `/horoskopai/jautis/`, `/horoskopai/dvyniai/`, `/horoskopai/vezys/`, `/horoskopai/liutas/`, `/horoskopai/mergele/`, `/horoskopai/svarstykles/`, `/horoskopai/skorpionas/`, `/horoskopai/saulys/`, `/horoskopai/oziaragis/`, `/horoskopai/vandenis/`, `/horoskopai/zuvys/`.
