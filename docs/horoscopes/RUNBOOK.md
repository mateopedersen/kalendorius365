# Dienos rinkinio atnaujinimo vadovas

## Kiekvienas naujas leidimas

1. Nukopijuok dabartinį `site/_data/horoscope_current.json` į atskirą kandidato JSON ir pakeisk visus 12 ženklų tekstus. Neišmesk checksum laukų ar kilmės metaduomenų.
2. Atnaujink `local_date`, `display_date_lt`, `generated_at_utc`, `prepared_at_vilnius`, `prepared_at_display_lt` ir `source_publication_date` pagal `Europe/Vilnius`. Laiko juostos DST nuokrypį `+02:00` / `+03:00` validavimo programa pati patikrina.
3. Nustatyk `content_status` į `draft`. Įrašyk lietuvių kalbos redaktoriaus tikrą patikrą; tik po jos naudok `native-human-proofread-approved`.
4. Paleisk `python3 scripts/validate_horoscopes.py --require-current --require-native-review --promote <kandidato-failas>`. Komanda pilną 12 tekstų rinkinį tikrina ir tik tada saugiai pakeičia aktyvų failą; ankstesnė versija išsaugoma atskirai.
5. Paleisk Ruby/Jekyll build ir `python3 scripts/validate_horoscopes.py --require-current --check-rendered --release`. Išleisk tik esamą Cloudflare Pages / GitHub darbo srautą pagal `README.md`.
6. Patikrink preview maršrutus, visus 12 ženklų, date, canonical, meniu, darbalaukio ir mobilų vaizdą. Tik tada junk produkcijos Git pakeitimus pagal projekto release taisykles.

## Jei nėra šios dienos patvirtinto rinkinio

Turinio data lieka tikroji paskelbto rinkinio data. Neredaguok metaduomenų taip, kad vakarykštis tekstas atrodytų šiandienos. Nepaleisk automatinės generacijos. `--require-current` privalo nepraeiti, kol neparengtas ir nepatvirtintas naujas rinkinys.

## Grąžinimas

Prieš kiekvieną `--promote` senasis aktyvus JSON įrašomas `docs/horoscopes/snapshots/`. Grąžinant ankstesnį leidimą, pasirink norimą snapshot, patikrink checksum ir datą, tada aktyvuok kaip naują atskirą leidimą per tuos pačius validavimo veiksmus. Neištrink Git istorijos.
