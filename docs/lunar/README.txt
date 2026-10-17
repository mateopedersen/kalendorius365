MĖNULIO KALENDORIUS 2027–2029

Pradinė gamybinė versija: 6421e5dab39ff164ebb7fa36ec5e3af122830b74.
Darbo šaka: feature/lunar-2027-2029-complete.
Pradiniai failai: 416 PDF + 416 WebP; jų SHA-256 sąrašas – qa/existing-downloads-before.json.
Pradiniai puslapiai: /menulio-fazes/ ir /menulio-kalendorius/2027/, /2028/, /2029/.
Pradiniai USNO įvykiai apėmė 2026-10-18–2030-01-04; tarp įvykių buvo naudojamas apytikslis apšviestumo modelis.

NAUJA KOLEKCIJA
36 mėnesių puslapiai, 2 skirtingi kiekvieno mėnesio maketai.
72 mėnesių PDF + 72 mėnesių WebP; papildomai 2027 metų plakato PDF ir WebP.
Iš viso: 73 PDF + 73 WebP = 146 nauji atsisiunčiami spaudiniai.
Visų failų nuorodos, SHA-256, dydžiai, matmenys ir šaltinio duomenų santrauka:
asset-manifest.csv ir asset-manifest.json.

DUOMENYS IR VAIZDAS
Astronomy Engine 2.1.19, MIT licencija. Naršyklės bibliotekoje išsaugotas autoriaus licencijos tekstas.
1096 dienos: kiekvienos datos 12:00 Europe/Vilnius laiku. Vasaros laikas tvarkomas pagal IANA laiko juostą.
Nepriklausomas palyginimas: Skyfield 1.55 su JPL DE440s; rezultatai – qa/astronomy-pass-a.json.
Pagrindinių fazių UTC momentai: USNO API 4.0.1, 2026–2030 m.; originalūs atsakymai – data/lunar/sources/.
Paviršius: NASA mokslinės vizualizacijos studijos „CGI Moon Kit“, Ernie Wright, LRO / LROC.
Šaltinis ir naudojimo pagrindas – data/lunar/texture-source.json.
NASA žemėlapis skirtas vizualizavimui; astronominiai skaičiai gaunami iš efemeridžių, ne iš vaizdo.
Šiaurė viršuje. Libracija, vietinis pasvirimas ir reljefo šešėliai nemodeliuojami.
Tamsioji pusė vos pašviesinta meniniais sumetimais. Teleskopinio tikslumo teiginiai neteikiami.
Savininko pateiktos vandensženkliais pažymėtos iliustracijos nepanaudotos kaip spaudinių ar tekstūrų dalys.

ATKŪRIMAS
Svetainės generavimas nereikalauja išorinio astronomijos API: skaičiai ir spaudiniai įrašyti saugykloje.
Įprasta svetainės versija: K365_RELEASE=1 bundle exec ruby scripts/build.rb
Techninė patikra: python3 scripts/audit_site.py --release
Funkcinės patikros: node --test test/*.test.js

Spaudiniams atkurti naudokite atskirą Python aplinką su scripts/lunar/requirements.txt paketais.
Išsaugota išvestinė paviršiaus tekstūra leidžia atkurti visus spaudinius be naujo paveikslo siuntimo:
python3 scripts/lunar/render.py
python3 scripts/lunar/preflight.py
python3 scripts/lunar/review.py
K365_RELEASE=1 bundle exec ruby scripts/build.rb

Astronominiam nepriklausomam patikrinimui papildomai reikia JPL DE440s branduolio:
https://ssd.jpl.nasa.gov/ftp/eph/planets/bsp/de440s.bsp
SHA-256: c1c7feeab882263fc493a9d5a5b2ddd71b54826cdf65d8d17a76126b260a49f2
python3 scripts/lunar/ephemeris.py --kernel /kelias/iki/de440s.bsp
Po duomenų pakeitimo būtina iš naujo atlikti spaudinių generavimą ir abu patikros etapus.

SPAUDOS PARAMETRAI
Mėnesiai: A4, tamsus stačias ir šviesus gulsčias maketas.
2027 metų plakatas: A3 gulsčias.
PDF: vektorinės raidės ir linijos, įterptas Lato su lietuviškais rašmenimis; pilkumo skalės Mėnulio rastrai.
WebP: tikras ne mažesnis kaip 600 PPI vaizdo taškų tankis nurodytu popieriaus dydžiu.
MediaBox ir TrimBox sutampa. Užlaidos nenumatytos; svarbus turinys paliktas saugiose paraštėse.
Spalvų erdvė: RGB / pilkumo skalė. PDF/X ir CMYK sertifikavimas neatliktas ir neteigiamas.

PATIKRA IR ATŠAUKIMAS
A etapas – pypdf: struktūra, šriftai, tekstas, kalba, rastrų faktinis PPI ir WebP matmenys.
B etapas – nepriklausomas MuPDF: žodžių ir diskų koordinatės, datų vietos, kolizijos ir apkirpimas.
73 maketų kontaktiniai lapai bei metinio plakato eilučių fragmentai – qa/visual/.
Naršyklės ataskaitose nurodyti tikrieji CSS pločiai; vietinis testavimo rėmelis į gamybinę versiją nepatenka.
Tikrinta virtualiose naršyklės srityse, ne fiziniuose telefonuose. Fizinė bandomoji spauda neatlikta.
Prieš publikavimą generavimo scenarijus patikrina visų 146 failų SHA-256 ir abiejų spaudinių patikros etapų sutapimą.
Atšaukti galima grąžinus ankstesnį Cloudflare Pages diegimą arba sukūrus atšaukimo commitą.
Nenaudoti force push. Pradiniai spaudiniai nekeisti.
