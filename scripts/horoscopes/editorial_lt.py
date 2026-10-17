"""Original Lithuanian reflection copy derived only from licensed sky calculations."""

from __future__ import annotations

from datetime import date

SIGN_NAMES = {
    "avinas": ("Avinas", "Avino"), "jautis": ("Jautis", "Jaučio"),
    "dvyniai": ("Dvyniai", "Dvynių"), "vezys": ("Vėžys", "Vėžio"),
    "liutas": ("Liūtas", "Liūto"), "mergele": ("Mergelė", "Mergelės"),
    "svarstykles": ("Svarstyklės", "Svarstyklių"), "skorpionas": ("Skorpionas", "Skorpiono"),
    "saulys": ("Šaulys", "Šaulio"), "oziaragis": ("Ožiaragis", "Ožiaragio"),
    "vandenis": ("Vandenis", "Vandenio"), "zuvys": ("Žuvys", "Žuvų"),
}

ENGLISH_SIGNS = {
    "aries": "avinas", "taurus": "jautis", "gemini": "dvyniai", "cancer": "vezys",
    "leo": "liutas", "virgo": "mergele", "libra": "svarstykles", "scorpio": "skorpionas",
    "sagittarius": "saulys", "capricorn": "oziaragis", "aquarius": "vandenis", "pisces": "zuvys",
}

# Each solar-house reading is original Kalendorius365.lt copy. It is reflective,
# not a factual prediction or professional advice.
SOLAR_HOUSES = {
    1: {
        "heading": "Pradėk nuo vieno savo pasirinkimo",
        "focus": "asmeninė kryptis ir saviraiška",
        "overview": "Šiandienos tema – savarankiškas pasirinkimas. Pagalvok, kurio darbo nori imtis pats, o kurį pradedi vien todėl, kad taip tikisi kiti. Nebūtina visko atlikti vienam. Aiškiai pasakyk, ko sieki ir kokios pagalbos tau reikia, kad galėtum pradėti.",
        "relationships": "Pasakyk, ko tau reikia, ir išklausyk atsakymą. Jei nuomonės skiriasi, pasiaiškinkite, kas kiekvienam svarbu. Pokalbis bus naudingesnis, jei mėginsite suprasti vienas kitą, užuot ieškoję, kuris teisus. Galite nesutikti ir vis tiek kalbėtis pagarbiai.",
        "work": "Pasirink vieną darbą, kurį gali pradėti savo iniciatyva. Nuspręsk, kokio rezultato šiandien pakaks, ir pradėk nuo nedidelės užduoties. Prieš imdamasis naujų reikalų pasitikrink, ar užbaigei tai, ką jau buvai suplanavęs.",
        "reflection": "Paklausk savęs, kuris sprendimas iš tiesų tavo, o kurį priimi vien dėl kitų lūkesčių. Simbolinė astrologija nepateikia garantijų; ši tema gali būti tik patogus atspirties taškas ramesniam apsisprendimui.",
        "tip": "Užrašyk vieną šiandienos prioritetą ir jam skirtą pirmą veiksmą.",
    },
    2: {
        "heading": "Prieš įsipareigodamas įvertink savo laiką",
        "focus": "vertybės, laikas ir turimi ištekliai",
        "overview": "Šiandien verta peržiūrėti, kam skiri laiką ir pastangas. Prieš sutikdamas padėti ar imtis dar vieno darbo, pasižiūrėk į savo dienotvarkę. Ar joje telpa ir poilsis? Ši tema nesusijusi su finansine prognoze: ji siūlo atidžiau rinktis kasdienius įsipareigojimus.",
        "relationships": "Santykiuose patikimumą dažnai parodo maži, įvykdomi susitarimai. Jei kažko negali pažadėti, pasakyk tai laiku ir pasiūlyk realią alternatyvą. Toks atvirumas sumažina spėliojimą ir leidžia abiem pusėms aiškiau suprasti, kokios pagalbos galima tikėtis.",
        "work": "Prieš imdamasis naujo darbo, įvertink, kiek jis pareikalaus laiko ir kokį jau pradėtą dalyką gali tekti atidėti. Susirašyk būtiniausias priemones ar informaciją, kurios trūksta. Tvarka čia skirta padėti rinktis, o ne sukurti dar vieną ilgą kontrolinį sąrašą.",
        "reflection": "Kuris įprotis padeda laikytis dienotvarkės, o kuris tik atima laiko? Nereikia iš karto visko keisti. Išsirink vieną pasikartojantį darbą ir pagalvok, ar jį galėtum atlikti paprasčiau.",
        "tip": "Išsirink vieną įsipareigojimą, kurį gali sumažinti arba aiškiau apibrėžti.",
    },
    3: {
        "heading": "Užduok vieną aiškų klausimą",
        "focus": "pokalbiai, informacija ir artima aplinka",
        "overview": "Šiandienos tema – bendravimas ir informacijos tikrinimas. Prieš atsakydamas į žinutę atskirk tai, ką žinai, nuo to, ką tik numanai. Jei ko nors nesupratai, paprašyk patikslinti. Trumpas pokalbis gali būti naudingesnis už ilgą susirašinėjimą, kuriame kiekvienas kalba apie skirtingus dalykus.",
        "relationships": "Artimam žmogui skirk dėmesį ne vien atsakydamas, bet ir pasitikrindamas, ar teisingai jį supratai. Jei pokalbis jautrus, rinkis aiškius, paprastus žodžius. Vienas konkretus klausimas dažnai atveria daugiau nei ilgas spėjimų sąrašas.",
        "work": "Darbe ar moksluose suskaidyk didesnę užduotį į kelis aiškius veiksmus. Užrašyk, kokios informacijos dar trūksta ir kas gali ją patvirtinti. Taip pokalbiai virsta naudingu darbu, o skirtingos užduotys mažiau konkuruoja dėl tavo dėmesio.",
        "reflection": "Ką nori pasakyti kitam žmogui? Prieš siųsdamas žinutę perskaityk ją dar kartą. Ar joje aišku, ko klausi arba prašai? Pašalink sakinius, kurie kartoja tą pačią mintį ar nukreipia dėmesį nuo esmės.",
        "tip": "Svarbiausią klausimą suformuluok vienu sakiniu ir užduok tiesiai.",
    },
    4: {
        "heading": "Pasirūpink vieta, kurioje gali ramiai pabūti",
        "focus": "namų aplinka, artumas ir vidinė atrama",
        "overview": "Šiandienos tema – namai ir įprasta dienotvarkė. Pagalvok, kas tavo aplinkoje padeda pailsėti, o kas nuolat erzina ar blaško. Nebūtina sutvarkyti visų namų. Pakanka vieno aiškaus darbo: atlaisvinti stalą, sutvarkyti dokumentus ar susitarti dėl ramaus laiko sau.",
        "relationships": "Pasidomėk, kokios pagalbos reikia artimam žmogui, ir pasakyk, ką iš tikrųjų gali padaryti. Jei pačiam reikia pabūti vienam, paaiškink tai ramiai. Kitam nereikės spėlioti tavo nuotaikos, o tau bus lengviau išvengti neišsakytų lūkesčių.",
        "work": "Praktiniuose reikaluose pradėk nuo aplinkos, kuri trukdo susikaupti: sutvarkyk vieną paviršių, dokumentą ar atidėtą smulkmeną. Aiški darbo vieta nėra tikslas savaime; ji turi padėti atlikti tai, kas svarbu, ir neužimti visos dienos.",
        "reflection": "Kokia maža rutina tau suteikia pastovumo, o kokia tapo papildoma našta? Galima išlaikyti tai, kas ramina, ir pakeisti vieną įprotį, kuris nebeatitinka dabartinių poreikių.",
        "tip": "Skirk dešimt minučių vienai erdvei ar rutinai, kuri padeda nusiraminti.",
    },
    5: {
        "heading": "Išbandyk idėją nesiekdamas tobulo rezultato",
        "focus": "kūryba, džiaugsmas ir laisva iniciatyva",
        "overview": "Šiandienos tema – kūryba ir mėgstama veikla. Išbandyk idėją, kuri tau įdomi, net jei dar nežinai, ką su ja darysi toliau. Tai gali būti piešinys, tekstas ar naujas įprasto darbo būdas. Ne kiekvienas bandymas turi virsti dideliu projektu.",
        "relationships": "Pasiūlyk artimam žmogui veiklą, kuri patiktų jums abiem, ir paklausk, ką jis norėtų nuveikti. Nebūtina visko suplanuoti iš anksto. Bendrai praleistas laikas bus malonesnis, jei abu galėsite laisvai pasakyti, kas jums tinka, o kas ne.",
        "work": "Darbo užduotyje pabandyk vieną naują būdą pateikti idėją, išdėstyti informaciją ar pradėti projektą. Laikyk eksperimentą nedidelį: aiškiai nuspręsk, ką tikrinsi, ir kada įvertinsi rezultatą. Taip kūryba papildo atsakomybę, o ne ją pakeičia.",
        "reflection": "Kokią veiklą rinktumeisi, jei šiandien nereikėtų jos rodyti ar vertinti? Atsakymas gali priminti, kas tave domina dėl pačios patirties, o ne dėl aplodismentų.",
        "tip": "Skirk trumpą laiką vienai kūrybinei idėjai, nevertindamas galutinio rezultato.",
    },
    6: {
        "heading": "Dienotvarkėje palik laiko pertraukoms",
        "focus": "dienos tvarka, įpročiai ir užduočių ritmas",
        "overview": "Šiandienos tema – kasdieniai darbai ir įpročiai. Išsirink svarbiausias užduotis ir nuspręsk, kada darbą baigsi. Palik laiko pietums, pertraukai ir nenumatytiems reikalams. Planas turėtų padėti orientuotis dienoje, o ne tapti dar vienu darbu, kurį nuolat reikia taisyti.",
        "relationships": "Bendruose reikaluose aiškiai pasidalykite kasdienėmis pareigomis. Jei susitarimas nebeveikia, aptarkite, kuri jo dalis per sunki ar neaiški, užuot tyliai prisiėmę dar daugiau. Konkretus prašymas kitam žmogui suteikia daugiau galimybių padėti.",
        "work": "Panašias užduotis atlik paeiliui: pavyzdžiui, vienu metu atsakyk į laiškus, kitu – tvarkyk dokumentus. Prieš pradėdamas nuspręsk, kokio rezultato reikia. Baigęs darbą pažymėk jį atliktu, kad nereikėtų vėl prie jo grįžti vien iš įpročio.",
        "reflection": "Kuri darbo dalis iš tiesų svarbi, o kuri kartojasi vien iš inercijos? Galbūt verta pakeisti seką, paprašyti patikslinimo ar atsisakyti vieno perteklinio žingsnio.",
        "tip": "Pasirink tris būtinas užduotis ir vieną sąmoningai palik kitai dienai.",
    },
    7: {
        "heading": "Prieš susitardamas išklausyk kitą",
        "focus": "partnerystė, susitarimai ir abipusės ribos",
        "overview": "Šiandienos tema – bendradarbiavimas. Prieš priimdami bendrą sprendimą išsiaiškinkite, kas kiekvienam svarbiausia. Nesutik vien tam, kad greičiau baigtųsi pokalbis. Geriau paprašyti laiko pagalvoti ir vėliau aiškiai pasakyti, ką gali pasiūlyti. Susitarimas turi būti suprantamas abiem pusėms.",
        "relationships": "Prieš atsakydamas savais žodžiais apibendrink, ką išgirdai. Paklausk, ar teisingai supratai. Išklausyti nereiškia su viskuo sutikti: gali ramiai pasakyti savo nuomonę ir ribas. Jei tema jautri, susitarkite, kada prie jos grįšite.",
        "work": "Bendrame darbe įvardykite atsakomybę, terminą ir tai, kokio rezultato tikitės vieni iš kitų. Pasitikrink, ar visi supranta susitarimą vienodai. Toks aiškumas padeda išvengti situacijos, kai žmonės sąžiningai stengiasi, bet siekia skirtingų tikslų.",
        "reflection": "Kurioje situacijoje ieškai vien pritarimo, o kur reikia tikro pokalbio? Atskirti šiuos dalykus gali padėti pasirinkti tinkamą klausimą ir tinkamą laiką.",
        "tip": "Prieš atsakydamas į svarbų prašymą, savais žodžiais pakartok jo esmę.",
    },
    8: {
        "heading": "Aiškiai aptark bendrą atsakomybę",
        "focus": "pasitikėjimas, bendri įsipareigojimai ir pokyčiai",
        "overview": "Šiandienos tema – pasitikėjimas ir bendri įsipareigojimai. Jei susitarimas neaiškus, pasitikslink, kas už ką atsako. Atskirti faktus nuo nuogąstavimų padės konkretūs klausimai. Neskubėk atskleisti asmeninių dalykų vien todėl, kad jautiesi spaudžiamas kalbėti; gali pats pasirinkti pokalbio laiką.",
        "relationships": "Jei su artimu žmogumi dalijatės atsakomybe ar jautria tema, iš anksto susitarkite, ką galima aptarti ir kokios ribos svarbios abiem. Nespėliok apie nutylėjimų priežastis. Tiesus klausimas, užduotas be kaltinimo, leidžia pokalbiui tapti saugesniam.",
        "work": "Bendrame projekte peržiūrėk, kas už ką atsako, kokia informacija prieinama ir kada reikia atnaujinti susitarimą. Jei kyla neaiškumas, užrašyk jį ir kreipkis į tinkamą atsakingą žmogų. Nedaryk išvadų apie kitų ketinimus be patikrinamų faktų.",
        "reflection": "Kokį pokytį gali pradėti nepažeisdamas savo galimybių ir kitų žmonių ribų? Kartais geriausia pradžia yra ne drąsus šuolis, o aiškiai įvardytas klausimas.",
        "tip": "Paklausk, kas atliks sutartą darbą ir iki kada jį reikia užbaigti.",
    },
    9: {
        "heading": "Prieš darydamas išvadą patikrink šaltinį",
        "focus": "mokymasis, idėjos ir platesnis požiūris",
        "overview": "Šiandienos tema – mokymasis ir naujos idėjos. Pasirink klausimą, į kurį norėtum atsakyti, ir paieškok patikimos informacijos. Palygink bent du paaiškinimus, jei jie vienas kitam prieštarauja. Gali pakeisti nuomonę, kai sužinai daugiau; nebūtina iš karto turėti galutinį atsakymą.",
        "relationships": "Pokalbyje paklausk, kokia patirtis padėjo kitam žmogui susidaryti nuomonę. Tada paaiškink, kaip tą patį klausimą matai pats. Skirtingi požiūriai neturi virsti ginču dėl to, kuris iš jūsų protingesnis ar geriau išmano temą.",
        "work": "Mokymuisi ar projektui pasirink vieną temą, kuri dabar būtų praktiškai naudinga. Užsibrėžk nedidelį tikslą: perskaityti, palyginti ar išbandyti vieną dalyką. Įsitikink, kad informacijos šaltinis patikimas, prieš paversdamas jos teiginius savo sprendimų pagrindu.",
        "reflection": "Kokią nuomonę laikai savaime suprantama, nors seniai jos netikrinai? Atvirumas naujam įrodymui stiprina, o ne silpnina gebėjimą spręsti.",
        "tip": "Išsirink vieną patikimą šaltinį ir užrašyk vieną naują klausimą.",
    },
    10: {
        "heading": "Didelį tikslą suskaidyk į aiškius darbus",
        "focus": "atsakomybė, ilgalaikiai tikslai ir matomas darbas",
        "overview": "Šiandienos tema – atsakomybė ir ilgesnio laikotarpio planai. Išsirink vieną tikslą ir pasižymėk, ką dėl jo gali padaryti artimiausiu metu. Nuspręsk, kaip suprasi, kad šį etapą baigei. Jei reikia kitų žmonių pagalbos, kreipkis į juos prieš prisiimdamas naują terminą.",
        "relationships": "Jei tavo įsipareigojimai veikia ir kitus, iš anksto pasakyk apie laiką, kurio tau reikia, ir ką jie gali planuoti. Patikimumą kuria ne vien sėkmė, bet ir laiku pateikta aiški informacija. Prašymas pasidalyti atsakomybe nėra silpnumas.",
        "work": "Atskirk užduotis, kurios padeda pasiekti rezultatą, nuo tų, kurios tik užima laiką. Vieną darbo etapą aprašyk taip, kad galėtum aiškiai patikrinti, ar jis baigtas. Jei trūksta informacijos, pasitikslink ją prieš pažadėdamas konkrečią užbaigimo datą.",
        "reflection": "Kokį tikslą sieki dėl savęs, o kokį vien tam, kad jis atrodytų įspūdingai? Atsakymas gali padėti pasirinkti tvaresnį tempą ir aiškesnį kriterijų.",
        "tip": "Užrašyk vieną artimiausią patikrinamą žingsnį savo didesniame plane.",
    },
    11: {
        "heading": "Pasiūlyk vieną bendrą veiklą",
        "focus": "draugystė, bendruomenė ir ateities planai",
        "overview": "Šiandienos tema – draugai ir bendri sumanymai. Išsirink vieną idėją, kurią norėtum aptarti su kitais. Paklausk, kas iš tiesų norėtų prisidėti ir kiek laiko galėtų tam skirti. Pradėti bus paprasčiau, jei susitarsite dėl nedidelio darbo, o ne iš karto suplanuosite visą projektą.",
        "relationships": "Parašyk draugui, su kuriuo seniai norėjai pasikalbėti. Gali tiesiog paklausti, kaip jam sekasi, ir skirti laiko atsakymui. Būdamas grupėje pakviesk pasisakyti ir tuos, kurie paprastai klausosi, tačiau nespausk jų kalbėti, jei jie to nenori.",
        "work": "Komandos veikloje aiškiai apibrėžkite bendrą rezultatą ir dalykus, kuriuos kiekvienas gali nuspręsti savarankiškai. Jei planas platus, pradėkite nuo mažo bandymo. Taip patikrinsite, ar idėja naudinga, ir nesukursite perteklinių įsipareigojimų.",
        "reflection": "Kokioje bendruomenėje nori dalyvauti ne vien kaip stebėtojas? Pagalvok, koks indėlis tau būtų prasmingas ir realus, net jei jis nedidelis.",
        "tip": "Pasiūlyk vieną aiškų bendrą veiksmą, kuriam nereikia didelio pasiruošimo.",
    },
    12: {
        "heading": "Padaryk pauzę ir susidėliok mintis",
        "focus": "poilsis, užbaigimas ir ramesnis apmąstymas",
        "overview": "Šiandienos tema – poilsis ir nebaigti reikalai. Pasirink vieną smulkmeną, kurią gali užbaigti, o tada skirk laiko pertraukai. Jei koks nors klausimas vis grįžta į mintis, užrašyk, kokios informacijos tau trūksta. Ne kiekvieną rūpestį galima išspręsti ilgiau apie jį galvojant.",
        "relationships": "Jei negali iš karto atsakyti į svarbų klausimą, pasakyk, kad nori pagalvoti, ir pasiūlyk, kada pratęsite pokalbį. Aiškus paaiškinimas padės kitam žmogui suprasti tavo tylą. Nereikia skubėti pažadėti to, dėl ko dar nesi apsisprendęs.",
        "work": "Užbaik vieną atidėtą smulkmeną, kuri nuolat blaško dėmesį, ir iš anksto nustatyk, kada darbą baigsi. Jei užduotis neaiški, užrašyk konkretų klausimą kitam darbo laikui. Taip poilsio tarpas netaps bandymu viską išspręsti vien mintyse.",
        "reflection": "Kokį rūpestį bandai išspręsti vien galvodamas, nors jam reikėtų informacijos ar pokalbio? Atskirti šiuos atvejus gali būti pirmas žingsnis į paprastesnį planą.",
        "tip": "Po pertraukos pasižymėk, nuo ko pradėsi kitą darbą.",
    },
}

MOON_FOCI = {
    1: "naujas sumanymas ir asmeninis pasirinkimas",
    2: "pastovūs įpročiai ir saikingi įsipareigojimai",
    3: "pokalbis ir informacijos tikrinimas",
    4: "namai, artumas ir ramus laikas sau",
    5: "mėgstama veikla ir kūrybinis bandymas",
    6: "kasdienės užduotys ir jų užbaigimas",
    7: "abipusis susitarimas ir pagarba kito pasirinkimui",
    8: "pasitikėjimas ir atsakomybės pasidalijimas",
    9: "mokymasis ir patikimų šaltinių paieška",
    10: "artimiausias didesnio plano darbas",
    11: "bendras sumanymas ir galimybė prisidėti",
    12: "poilsis ir nebaigtų reikalų peržiūra",
}

ASPECT_MESSAGES = {
    "conjunction": "Astrologinėje simbolikoje jungtis sutelkia dėmesį į vieną temą; naudinga aiškiai atskirti norą nuo skubaus veiksmo.",
    "sextile": "Astrologinėje simbolikoje sekstilis kviečia pastebėti mažą bendradarbiavimo galimybę, bet jos nelaikyti garantuotu rezultatu.",
    "square": "Astrologinėje simbolikoje kvadratūra išryškina skirtingas kryptis; ramus prioritetų pasirinkimas vertingesnis už skubią reakciją.",
    "trine": "Astrologinėje simbolikoje trigonas nusako lengviau derančias temas; jų naudą vis tiek lemia konkretūs, apgalvoti veiksmai.",
    "opposition": "Astrologinėje simbolikoje opozicija primena dviem poreikiams skirti vietos; pusiausvyra prasideda nuo abiejų pusių išklausymo.",
}

# Genitive forms modify the noun “aspektas” in the generated sentence.
PLANETS_LT = {
    "Sun": "Saulės", "Moon": "Mėnulio", "Mercury": "Merkurijaus", "Venus": "Veneros",
    "Mars": "Marso", "Jupiter": "Jupiterio", "Saturn": "Saturno", "Uranus": "Urano",
    "Neptune": "Neptūno", "Pluto": "Plutono",
}


def render_forecast(sign_key: str, solar_house: int, moon_house: int, aspect: dict, target_date: date) -> dict[str, str]:
    if sign_key not in SIGN_NAMES:
        raise ValueError(f"Nežinomas zodiako ženklas: {sign_key}")
    if solar_house not in SOLAR_HOUSES or moon_house not in MOON_FOCI:
        raise ValueError("Saulės ir Mėnulio būstai turi būti nuo 1 iki 12")
    sign_name, genitive = SIGN_NAMES[sign_key]
    house = SOLAR_HOUSES[solar_house]
    aspect_type = str(aspect.get("aspect", "")).strip().casefold()
    if aspect_type not in ASPECT_MESSAGES:
        raise ValueError("Neatpažintas pagrindinio aspekto tipas")
    planet1 = PLANETS_LT.get(str(aspect.get("planet1", "")), "")
    planet2 = PLANETS_LT.get(str(aspect.get("planet2", "")), "")
    if not planet1 or not planet2:
        raise ValueError("Neatpažintas planetos pavadinimas aspekto duomenyse")
    orb = float(aspect.get("orb"))
    if not 0 <= orb <= 20:
        raise ValueError("Aspekto nuokrypis nepatenka į leistiną intervalą")
    orb_label = f"{orb:.1f}".replace(".", ",")
    body_context = f"{ASPECT_MESSAGES[aspect_type]} Šios dienos skaičiavimuose nurodytas {planet1} ir {planet2} aspektas; jo nuokrypis nuo tikslaus kampo – {orb_label}°."
    overview = f"{house['overview']} Papildoma astrologinė Mėnulio tema – {MOON_FOCI[moon_house]}. {body_context}"
    return {
        "sign_key": sign_key,
        "editorial_heading": house["heading"],
        "lead": f"{genitive} dienos tema – {house['focus']}.",
        "overview": overview,
        "relationships": house["relationships"],
        "work": house["work"],
        "reflection": house["reflection"],
        "tip": house["tip"],
        "source_solar_house": str(solar_house),
        "source_moon_house": str(moon_house),
    }


def validate_original_copy(forecasts: list[dict]) -> None:
    import re

    expected = set(SIGN_NAMES)
    if len(forecasts) != 12 or {row.get("sign_key") for row in forecasts} != expected:
        raise ValueError("Teksto rinkinyje turi būti lygiai po vieną įrašą visiems 12 ženklų")
    headings = [row["editorial_heading"] for row in forecasts]
    if len(set(headings)) != 12:
        raise ValueError("Dienos antraštės turi būti skirtingos visiems ženklams")
    bodies = []
    for row in forecasts:
        expected_genitive = SIGN_NAMES[row["sign_key"]][1]
        if not row["lead"].startswith(expected_genitive + " "):
            raise ValueError(f"{row['sign_key']}: lietuviškas ženklo kilmininkas neteisingas")
        body = " ".join(row[key] for key in ("lead", "overview", "relationships", "work", "reflection", "tip"))
        count = len(re.findall(r"[^\W_]+", body, re.UNICODE))
        if not 150 <= count <= 300:
            raise ValueError(f"{row['sign_key']}: reikia 150–300 žodžių, gauta {count}")
        if "http://" in body or "https://" in body or re.search(r"<\s*/?[a-z!][^>]*>", body, re.I):
            raise ValueError(f"{row['sign_key']}: nesaugi nuoroda arba HTML tekste")
        if any(ord(ch) < 32 and ch not in "\n\t\r" for ch in body):
            raise ValueError(f"{row['sign_key']}: valdymo simbolis tekste")
        bodies.append(body.casefold())
    for idx, left in enumerate(bodies):
        for right in bodies[idx + 1:]:
            left_words, right_words = set(left.split()), set(right.split())
            overlap = len(left_words & right_words) / max(1, len(left_words | right_words))
            if overlap > 0.48:
                raise ValueError("Dviejų ženklų tekstai per daug panašūs")
