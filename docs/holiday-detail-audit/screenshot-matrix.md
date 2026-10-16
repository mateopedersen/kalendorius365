# Vaizdinės patikros matrica

**Atlikta:** 2026-10-16 vietinėje naršyklės peržiūroje. Matmenys tikrinti fiksuoto pločio turinio iframe viduje; naršyklės išorinio lango dydis nelaikytas CSS viewport įrodymu.

| CSS plotis | Puslapiai | Patikra | Rezultatas |
|---:|---:|---|---|
| 320 px | 16 | `innerWidth`, dokumento ir `body` plotis, H1 nukirpimas, hero stulpeliai, vaizdo įkėlimas | 16/16; perpildymų ir nukirptų H1 nėra |
| 360 px | 16 | Tie patys DOM matavimai | 16/16; perpildymų ir nukirptų H1 nėra |
| 390 px | 16 | Tie patys DOM matavimai; Velykų straipsnio ekrano kopija peržiūrėta | 16/16; perpildymų ir nukirptų H1 nėra |
| 414 px | 16 | Tie patys DOM matavimai | 16/16; perpildymų ir nukirptų H1 nėra |
| 768 px | 16 | Tie patys DOM matavimai | 16/16; hero dviejų stulpelių išdėstymas |
| 1280 px | 16 | Tie patys DOM matavimai | 16/16; hero dviejų stulpelių išdėstymas |
| 1440 px | 16 | Tie patys DOM matavimai | 16/16; hero dviejų stulpelių išdėstymas |
| 1920 px | 16 | Tie patys DOM matavimai | 16/16; hero dviejų stulpelių išdėstymas |

Iš viso: 128 puslapio ir CSS viewport deriniai; 0 horizontalaus dokumento perpildymo; 0 H1 nukirpimo; 128/128 įkelti vaizdai ir alternatyvūs tekstai. 320–414 px diapazone hero persirikiuoja į vieną stulpelį, nuo 768 px – į du. Siaura datų lentelė slenka savo pažymėtame konteineryje, o dokumentas išlieka viewport pločio.

## Vaizdų ir likusios peržiūros ribos

- Visų 16 originalių vaizdų kontaktinis lapas peržiūrėtas; antraštė, caption-as, nuotrauka ir įvykio kontekstas sulyginti. Tai AI atliktas vizualus patikrinimas, ne nepriklausoma fotografijos ekspertizė.
- `/sventes/velykos/` puslapio herojus papildomai vizualiai patikrintas 320 px mobiliajame ir 1440 px darbalaukio pločiuose; 390 px pilno puslapio kadras taip pat peržiūrėtas. Kitų 15 puslapių kiekvieno elemento žmogaus atliekamas pixel-by-pixel priėmimas neatliktas.
- Tikro naršyklės mastelio 125 %, 150 % ir 200 % testas neatliktas; iframe pločiai nėra zoom testas.
- Klaviatūros, DOM semantikos ir kontrasto patikros aprašytos QA-GATE-2.md. VoiceOver ar kito atskiro ekrano skaitytuvo žmogaus smoke testas neatliktas.
