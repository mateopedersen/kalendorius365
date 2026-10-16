"""Original Lithuanian reflection copy derived only from licensed sky calculations."""

from __future__ import annotations

import hashlib
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
        "heading": "Dėmesį verta grąžinti prie savo pasirinkimo",
        "focus": "asmeninė kryptis ir saviraiška",
        "overview": "Šios dienos simboliniame skaityme pirmiausia išryškėja tavo laikysena ir tai, kaip pradedi darbus. Tai nėra raginimas viską daryti vienam: veikiau proga aiškiau įvardyti, ko nori ir kokiu tempu gali judėti. Nedidelis, sąmoningas sprendimas dažnai pasako daugiau nei skubus pažadas.",
        "relationships": "Bendraudamas pasakyk savo poreikį paprastai ir palik kitam žmogui vietos atsakyti. Aiški saviraiška ir pagarbus klausymasis gali puikiai derėti. Jei nuomonės išsiskiria, pirmiausia susitarkite, ką kiekvienas iš tikrųjų nori apsaugoti, o ne skubėkite ieškoti laimėtojo.",
        "work": "Veikloje išsirink vieną darbą, kuriam reikia tavo iniciatyvos, ir apibrėžk, ką šiandien reiškia jį užbaigti. Pradėk nuo pirmo patikrinamo žingsnio. Taip energija turės aiškią kryptį, o naujos užduotys neužgoš to, ką jau nusprendei padaryti.",
        "reflection": "Paklausk savęs, kuris sprendimas iš tiesų tavo, o kurį priimi vien dėl kitų lūkesčių. Simbolinė astrologija nepateikia garantijų; ši tema gali būti tik patogus atspirties taškas ramesniam apsisprendimui.",
        "tip": "Užrašyk vieną šiandienos prioritetą ir jam skirtą pirmą veiksmą.",
    },
    2: {
        "heading": "Vertę kuria apgalvotas, ne skubotas pasirinkimas",
        "focus": "vertybės, laikas ir turimi ištekliai",
        "overview": "Simbolinė dienos tema kviečia pastebėti, kam skiri savo laiką, dėmesį ir pastangas. Tai nėra finansinė prognozė ar nurodymas, ką pirkti. Naudingiau pasitikrinti, ar kasdieniai įsipareigojimai dera su tuo, ką laikai svarbiausia, ir ar tavo tempas palieka vietos atsigauti.",
        "relationships": "Santykiuose patikimumą dažnai parodo maži, įvykdomi susitarimai. Jei kažko negali pažadėti, pasakyk tai laiku ir pasiūlyk realią alternatyvą. Toks atvirumas sumažina spėliojimą ir leidžia abiem pusėms aiškiau suprasti, kokios pagalbos galima tikėtis.",
        "work": "Prieš imdamasis naujo darbo, įvertink, kiek jis pareikalaus laiko ir kokį jau pradėtą dalyką gali tekti atidėti. Susirašyk būtiniausias priemones ar informaciją, kurios trūksta. Tvarka čia skirta padėti rinktis, o ne sukurti dar vieną ilgą kontrolinį sąrašą.",
        "reflection": "Kuris tavo įprotis suteikia tikros atramos, o kuris tik užima vietą kalendoriuje? Atsakymo nereikia paversti dideliu pokyčiu: pakanka pastebėti, ką verta išsaugoti, o ką galima supaprastinti.",
        "tip": "Išsirink vieną įsipareigojimą, kurį gali sumažinti arba aiškiau apibrėžti.",
    },
    3: {
        "heading": "Tikslus klausimas sutaupys ilgą aiškinimąsi",
        "focus": "pokalbiai, informacija ir artima aplinka",
        "overview": "Dienos simbolika iškelia žinių apykaitą ir mažus susitarimus. Prieš reaguodamas į naują informaciją, patikrink, ką tikrai žinai, o ką tik numanai. Trumpas pokalbis gali padėti susidėlioti mintis, jei jame paliksi vietos patikslinimui ir nesistengsi atsakyti greičiau, nei spėji suprasti klausimą.",
        "relationships": "Artimam žmogui skirk dėmesį ne vien atsakydamas, bet ir pasitikrindamas, ar teisingai jį supratai. Jei pokalbis jautrus, rinkis aiškius, paprastus žodžius. Vienas konkretus klausimas dažnai atveria daugiau nei ilgas spėjimų sąrašas.",
        "work": "Darbe ar moksluose suskaidyk didesnę užduotį į kelis aiškius veiksmus. Užrašyk, kokios informacijos dar trūksta ir kas gali ją patvirtinti. Taip pokalbiai virsta naudingu darbu, o skirtingos užduotys mažiau konkuruoja dėl tavo dėmesio.",
        "reflection": "Kokią mintį norėtum perduoti taip, kad kitam nereikėtų jos spėlioti? Prieš siųsdamas žinutę perskaityk ją dar kartą ir pašalink tai, kas užtemdo pagrindinę mintį.",
        "tip": "Svarbiausią klausimą suformuluok vienu sakiniu ir užduok tiesiai.",
    },
    4: {
        "heading": "Ramybė prasideda nuo saugios kasdienės erdvės",
        "focus": "namų aplinka, artumas ir vidinė atrama",
        "overview": "Šios dienos simbolinis akcentas siejamas su tuo, kas leidžia jaustis turinčiam pagrindą po kojomis. Tai gali būti namų tvarka, pažįstamas ritualas ar laikas be papildomų reikalavimų. Nebūtina spręsti visko iš karto: pasirink vieną mažą dalyką, kuris aplinką ar dienotvarkę padarytų šiek tiek ramesnę.",
        "relationships": "Artumo nereikia įrodinėti dideliais gestais. Pasidomėk, kokios pagalbos iš tavęs tikimasi, ir pasakyk, kokią dalį realiai gali prisiimti. Jei tau pačiam reikia tylos ar laiko, įvardyk tai švelniai ir konkrečiai, nelaukdamas, kol kitas žmogus perskaitys tavo nuotaiką.",
        "work": "Praktiniuose reikaluose pradėk nuo aplinkos, kuri trukdo susikaupti: sutvarkyk vieną paviršių, dokumentą ar atidėtą smulkmeną. Aiški darbo vieta nėra tikslas savaime; ji turi padėti atlikti tai, kas svarbu, ir neužimti visos dienos.",
        "reflection": "Kokia maža rutina tau suteikia pastovumo, o kokia tapo papildoma našta? Galima išlaikyti tai, kas ramina, ir pakeisti vieną įprotį, kuris nebeatitinka dabartinių poreikių.",
        "tip": "Skirk dešimt minučių vienai erdvei ar rutinai, kuri padeda nusiraminti.",
    },
    5: {
        "heading": "Kūrybiškumui padeda žaidimas be tobulo rezultato",
        "focus": "kūryba, džiaugsmas ir laisva iniciatyva",
        "overview": "Dienos simbolika primena apie kūrybinę raišką ir tai, kas teikia gyvo susidomėjimo. Tai nereiškia, kad privalai sukurti įspūdingą rezultatą. Leisk sau išbandyti mažą idėją, net jei dar nežinai, kuo ji baigsis. Smalsumas gali būti vertingas ir tada, kai jis lieka paprastu malonumu.",
        "relationships": "Bendra veikla gali suartinti, kai jos tikslas nėra pasirodyti ar įrodyti savo teisumą. Pasiūlyk tai, kas abiem atrodo malonu, ir pasiteirauk, ar kitas žmogus turi kitą sumanymą. Lengvumas geriausiai veikia tada, kai niekas nejaučia spaudimo linksmintis pagal grafiką.",
        "work": "Darbo užduotyje pabandyk vieną naują būdą pateikti idėją, išdėstyti informaciją ar pradėti projektą. Laikyk eksperimentą nedidelį: aiškiai nuspręsk, ką tikrinsi, ir kada įvertinsi rezultatą. Taip kūryba papildo atsakomybę, o ne ją pakeičia.",
        "reflection": "Kokią veiklą rinktumeisi, jei šiandien nereikėtų jos rodyti ar vertinti? Atsakymas gali priminti, kas tave domina dėl pačios patirties, o ne dėl aplodismentų.",
        "tip": "Skirk trumpą laiką vienai kūrybinei idėjai, nevertindamas galutinio rezultato.",
    },
    6: {
        "heading": "Kasdienybė palengvėja, kai planas turi ribas",
        "focus": "dienos tvarka, įpročiai ir užduočių ritmas",
        "overview": "Simbolinė dienos kryptis susijusi su tuo, kaip išdėstai įprastas užduotis. Geras planas turi ne tik darbų, bet ir pabaigos tašką. Pasirink, kas iš tiesų būtina, ir palik tarpą nenumatytiems reikalams. Tvarka turi sumažinti sprendimų skaičių, o ne reikalauti nuolat ją tobulinti.",
        "relationships": "Bendruose reikaluose aiškiai pasidalykite kasdienėmis pareigomis. Jei susitarimas nebeveikia, aptarkite, kuri jo dalis per sunki ar neaiški, užuot tyliai prisiėmę dar daugiau. Konkretus prašymas kitam žmogui suteikia daugiau galimybių padėti.",
        "work": "Užduotis grupuok pagal panašumą ir vienu kartu skirk dėmesį vienai jų rūšiai. Prieš pradėdamas pasitikrink, ko reikia rezultatui, o atlikęs pažymėk darbą užbaigtu. Taip išvengsi ilgo taisymo vien dėl to, kad nebuvo aiškaus pakankamo rezultato kriterijaus.",
        "reflection": "Kuri darbo dalis iš tiesų svarbi, o kuri kartojasi vien iš inercijos? Galbūt verta pakeisti seką, paprašyti patikslinimo ar atsisakyti vieno perteklinio žingsnio.",
        "tip": "Pasirink tris būtinas užduotis ir vieną sąmoningai palik kitai dienai.",
    },
    7: {
        "heading": "Geresnis susitarimas prasideda išklausymu",
        "focus": "partnerystė, susitarimai ir abipusės ribos",
        "overview": "Šiandienos simbolinis skaitymas išryškina bendradarbiavimą ir tai, kaip derini savo planus su kitais. Kompromisas nėra automatiškai teisingas vien todėl, kad visi nutilo. Iš pradžių išsiaiškinkite, kas kiekvienai pusei svarbiausia, tada ieškokite konkretaus susitarimo, kurį galima ramiai paaiškinti.",
        "relationships": "Pokalbyje pabandyk apibendrinti, ką išgirdai, prieš pateikdamas savo atsakymą. Tai nereiškia, kad privalai sutikti. Aiški riba ir nuoširdus noras suprasti kitą gali egzistuoti kartu. Jei tema jautri, susitarkite, kada prie jos grįšite, o ne veržkitės viską užbaigti akimirksniu.",
        "work": "Bendrame darbe įvardykite atsakomybę, terminą ir tai, kokio rezultato tikitės vieni iš kitų. Pasitikrink, ar visi supranta susitarimą vienodai. Toks aiškumas padeda išvengti situacijos, kai žmonės sąžiningai stengiasi, bet siekia skirtingų tikslų.",
        "reflection": "Kurioje situacijoje ieškai vien pritarimo, o kur reikia tikro pokalbio? Atskirti šiuos dalykus gali padėti pasirinkti tinkamą klausimą ir tinkamą laiką.",
        "tip": "Prieš atsakydamas į svarbų prašymą, savais žodžiais pakartok jo esmę.",
    },
    8: {
        "heading": "Pasitikėjimą augina aiškios ribos ir atvirumas",
        "focus": "pasitikėjimas, bendri įsipareigojimai ir pokyčiai",
        "overview": "Simbolinis dienos akcentas liečia temas, kurioms reikia daugiau pasitikėjimo ir atidaus pokalbio. Neskubėk atskleisti to, kam dar neradai tinkamų žodžių. Kartu verta atskirti faktus nuo nuogąstavimų ir pasitikrinti, kokie susitarimai jau galioja. Aiškumas gali būti ir švelnus, ir tvirtas.",
        "relationships": "Jei su artimu žmogumi dalijatės atsakomybe ar jautria tema, iš anksto susitarkite, ką galima aptarti ir kokios ribos svarbios abiem. Nespėliok apie nutylėjimų priežastis. Tiesus klausimas, užduotas be kaltinimo, leidžia pokalbiui tapti saugesniam.",
        "work": "Bendrame projekte peržiūrėk, kas už ką atsako, kokia informacija prieinama ir kada reikia atnaujinti susitarimą. Jei kyla neaiškumas, užrašyk jį ir kreipkis į tinkamą atsakingą žmogų. Nedaryk išvadų apie kitų ketinimus be patikrinamų faktų.",
        "reflection": "Kokį pokytį gali pradėti nepažeisdamas savo galimybių ir kitų žmonių ribų? Kartais geriausia pradžia yra ne drąsus šuolis, o aiškiai įvardytas klausimas.",
        "tip": "Vieną neaiškų susitarimą paversk konkrečiu klausimu apie atsakomybę ar ribas.",
    },
    9: {
        "heading": "Platesnis požiūris prasideda nuo patikrinto klausimo",
        "focus": "mokymasis, idėjos ir platesnis požiūris",
        "overview": "Dienos simbolika kviečia praplėsti akiratį, bet neatsisakyti kruopštumo. Nauja idėja gali būti įdomi, net jei dar neaišku, kaip ją pritaikysi. Pasirink patikimą šaltinį, pasižymėk, ko dar nežinai, ir leisk savo nuomonei keistis, kai atsiranda geresnių argumentų.",
        "relationships": "Pokalbyje skirtingas požiūris gali padėti geriau suprasti kitą, jei nekonkuruojate, kuris teisus. Paklausk, kokia patirtis formuoja kito žmogaus nuomonę. Tada papasakok savo požiūrį kaip vieną perspektyvą, o ne vienintelę galimą tiesą.",
        "work": "Mokymuisi ar projektui pasirink vieną temą, kuri dabar būtų praktiškai naudinga. Užsibrėžk nedidelį tikslą: perskaityti, palyginti ar išbandyti vieną dalyką. Įsitikink, kad informacijos šaltinis patikimas, prieš paversdamas jos teiginius savo sprendimų pagrindu.",
        "reflection": "Kokią nuomonę laikai savaime suprantama, nors seniai jos netikrinai? Atvirumas naujam įrodymui stiprina, o ne silpnina gebėjimą spręsti.",
        "tip": "Išsirink vieną patikimą šaltinį ir užrašyk vieną naują klausimą.",
    },
    10: {
        "heading": "Atsakomybė aiškėja įvardijus tikrąjį tikslą",
        "focus": "atsakomybė, ilgalaikiai tikslai ir matomas darbas",
        "overview": "Simbolinė dienos tema susijusi su vaidmeniu, kurį prisiimi, ir rezultatu, kurį nori pasiekti. Didelis tikslas tampa lengviau valdomas, kai jį suskaidai į patikrinamus etapus. Nebūtina šiandien padaryti visko: svarbiau suprasti, kuris žingsnis iš tiesų artina prie pasirinktos krypties.",
        "relationships": "Jei tavo įsipareigojimai veikia ir kitus, iš anksto pasakyk apie laiką, kurio tau reikia, ir ką jie gali planuoti. Patikimumą kuria ne vien sėkmė, bet ir laiku pateikta aiški informacija. Prašymas pasidalyti atsakomybe nėra silpnumas.",
        "work": "Profesiniame ar asmeniniame projekte atskirk svarbų rezultatą nuo užduočių, kurios tik atrodo užimtos. Vieną etapą apibrėžk taip, kad galėtum patikrinti, ar jis baigtas. Jei trūksta informacijos ar pagalbos, įvardyk tai prieš terminui tampant problema.",
        "reflection": "Kokį tikslą sieki dėl savęs, o kokį vien tam, kad jis atrodytų įspūdingai? Atsakymas gali padėti pasirinkti tvaresnį tempą ir aiškesnį kriterijų.",
        "tip": "Užrašyk vieną artimiausią patikrinamą žingsnį savo didesniame plane.",
    },
    11: {
        "heading": "Bendruomenės idėją verta paversti konkrečiu veiksmu",
        "focus": "draugystė, bendruomenė ir ateities planai",
        "overview": "Dienos simbolika atkreipia dėmesį į grupes, bendrus sumanymus ir tai, kokią ateitį kuri kartu su kitais. Idėjų gali būti daug, todėl pasirink tą, kuriai atsirado realių bendraminčių ir aiškus pirmas žingsnis. Bendras tikslas tampa tvirtesnis, kai kiekvienas žino, kaip prisidėti.",
        "relationships": "Draugystėje verta parodyti dėmesį ne tik reaguojant į didelį įvykį. Parašyk žmogui, su kuriuo seniai norėjai pasikalbėti, arba pasidomėk, ko jam šiuo metu reikia. Grupėje suteik erdvės ir tylesniam balsui, o ne vien greičiausiai išsakytai nuomonei.",
        "work": "Komandos veikloje aiškiai apibrėžkite bendrą rezultatą ir dalykus, kuriuos kiekvienas gali nuspręsti savarankiškai. Jei planas platus, pradėkite nuo mažo bandymo. Taip patikrinsite, ar idėja naudinga, ir nesukursite perteklinių įsipareigojimų.",
        "reflection": "Kokioje bendruomenėje nori dalyvauti ne vien kaip stebėtojas? Pagalvok, koks indėlis tau būtų prasmingas ir realus, net jei jis nedidelis.",
        "tip": "Pasiūlyk vieną aiškų bendrą veiksmą, kuriam nereikia didelio pasiruošimo.",
    },
    12: {
        "heading": "Tylos tarpas padės atskirti svarbą nuo triukšmo",
        "focus": "poilsis, užbaigimas ir ramesnis apmąstymas",
        "overview": "Simbolinė dienos kryptis kviečia sulėtinti tempą ir pastebėti tai, kas lieka tarp įprastų reikalų. Tai nėra raginimas vengti atsakomybės ar pasikliauti nuojauta vietoj faktų. Trumpa pauzė gali padėti atskirti tikrai svarbų dalyką nuo informacijos, kuri tik prašo skubaus atsako.",
        "relationships": "Jei pokalbiui reikia daugiau laiko, pasakyk, kada galėsi prie jo grįžti. Tyla neturėtų būti naudojama kaip spėjimo žaidimas. Aiškus paaiškinimas, kad nori ramiai pagalvoti, dažnai yra pagarbesnis už skubų atsakymą, kurio pats dar nelaikai tiksliu.",
        "work": "Užbaik vieną atidėtą smulkmeną, kuri nuolat blaško dėmesį, ir iš anksto nustatyk, kada darbą baigsi. Jei užduotis neaiški, užrašyk konkretų klausimą kitam darbo laikui. Taip poilsio tarpas netaps bandymu viską išspręsti vien mintyse.",
        "reflection": "Kokį rūpestį bandai išspręsti vien galvodamas, nors jam reikėtų informacijos ar pokalbio? Atskirti šiuos atvejus gali būti pirmas žingsnis į paprastesnį planą.",
        "tip": "Padaryk trumpą pertrauką be ekrano ir užrašyk vieną kitą veiksmą.",
    },
}

MOON_FOCI = {
    1: "dėmesį į mažą naują pradžią ir tai, ko šiuo metu nori pats",
    2: "dėmesį į tai, kas tau suteikia pastovumo, nepriimant skubių įsipareigojimų",
    3: "dėmesį į pokalbį, klausimą ar informaciją, kurią verta patikrinti",
    4: "dėmesį į namų ritmą, artumą ir erdvę, kurioje gali susikaupti",
    5: "dėmesį į kūrybinę mintį ar veiklą, kuri teikia džiaugsmo be spaudimo",
    6: "dėmesį į vieną įprastą užduotį ir aiškią jos pabaigą",
    7: "dėmesį į abipusį susitarimą ir kitam žmogui paliktą erdvę",
    8: "dėmesį į pasitikėjimą, aiškią ribą ar neaptartą atsakomybę",
    9: "dėmesį į mokymąsi ir patikimą šaltinį, kuris gali išplėsti požiūrį",
    10: "dėmesį į vieną ilgalaikio tikslo etapą, kurį gali aiškiai įvardyti",
    11: "dėmesį į bendrą sumanymą ir realų būdą prie jo prisidėti",
    12: "dėmesį į trumpą pauzę ir informaciją, kuri padėtų sumažinti triukšmą",
}

ASPECT_MESSAGES = {
    "conjunction": "Astrologinėje simbolikoje jungtis sutelkia dėmesį į vieną temą; naudinga aiškiai atskirti norą nuo skubaus veiksmo.",
    "sextile": "Astrologinėje simbolikoje sekstilis kviečia pastebėti mažą bendradarbiavimo galimybę, bet jos nelaikyti garantuotu rezultatu.",
    "square": "Astrologinėje simbolikoje kvadratūra išryškina skirtingas kryptis; ramus prioritetų pasirinkimas vertingesnis už skubią reakciją.",
    "trine": "Astrologinėje simbolikoje trigonas nusako lengviau derančias temas; jų naudą vis tiek lemia konkretūs, apgalvoti veiksmai.",
    "opposition": "Astrologinėje simbolikoje opozicija primena dviem poreikiams skirti vietos; pusiausvyra prasideda nuo abiejų pusių išklausymo.",
}

PLANETS_LT = {
    "Sun": "Saulė", "Moon": "Mėnulis", "Mercury": "Merkurijus", "Venus": "Venera",
    "Mars": "Marsas", "Jupiter": "Jupiteris", "Saturn": "Saturnas", "Uranus": "Uranas",
    "Neptune": "Neptūnas", "Pluto": "Plutonas",
}


def _daily_variation(target_date: date, sign_key: str, moon_house: int) -> str:
    options = (
        "Tai simbolinis pasiūlymas, o ne pažadas apie įvykių baigtį.",
        "Šį akcentą naudok kaip klausimą sau, ne kaip sprendimą už tave.",
        "Palik vietos faktams ir aplinkybėms, kurių horoskopo tekstas negali numatyti.",
        "Ši mintis skirta apmąstymui; svarbius pasirinkimus grįsk tikrais duomenimis.",
        "Kiekvieno žmogaus dieną lemia tikros aplinkybės, o ne vien zodiako ženklas.",
        "Rinkis tik tai, kas dera su tavo situacija ir realiomis galimybėmis.",
        "Astrologija čia pateikiama kaip kultūrinė simbolių sistema pramogai.",
    )
    digest = hashlib.sha256(f"{target_date.isoformat()}:{sign_key}:{moon_house}".encode()).digest()
    return options[int.from_bytes(digest[:2], "big") % len(options)]


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
    body_context = f"{ASPECT_MESSAGES[aspect_type]} Šios dienos skaičiavime užfiksuotas {planet1} ir {planet2} aspektas; jo nuokrypis – {orb:.1f}°."
    overview = f"{house['overview']} Dėmesio kryptį gali padėti apmąstyti ir šiandienos simbolinis Mėnulio akcentas: {MOON_FOCI[moon_house]}. {body_context}"
    return {
        "sign_key": sign_key,
        "editorial_heading": house["heading"],
        "lead": f"{genitive} dienos tema – {house['focus']}. Rinkis tempą pagal savo aplinkybes.",
        "overview": overview,
        "relationships": house["relationships"],
        "work": house["work"],
        "reflection": f"{house['reflection']} {_daily_variation(target_date, sign_key, moon_house)}",
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
