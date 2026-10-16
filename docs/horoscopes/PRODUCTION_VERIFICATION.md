# Gamybinio leidimo patikra

Patikros data: 2026-10-16. Šis įrašas sąžiningai atskiria vietinį leidimo testą nuo Cloudflare Pages diegimo.

## Iki Cloudflare peržiūros

- [x] Sukurtas Jekyll leidimo artefaktas su `K365_RELEASE=1`; sugeneruota 101 canonical HTML puslapis.
- [x] 12 ženklų ir hub puslapis server-side sugeneruoti su tikra 2026-10-16 data, `lang="lt"`, canonical ir sitemap įrašais.
- [x] Automatinis puslapių auditas: 0 sugadintų vietinių nuorodų; visi ankstesni 88 indeksuojami URL išsaugoti.
- [x] 832 esamų PDF/WebP failų SHA-256 sumos nepasikeitė.
- [x] 6 horoskopo validavimo vienetų testai ir 32 esami JavaScript testai praėjo.
- [x] Browser QA 78 maršrutas/plotis derinių ir pradžios puslapio atskiri patikrinimai aprašyti `QA_2_BROWSER.json`.
- [x] 390 ir 360 CSS px peržiūros atliktos tame pačiame origin iframe. Tai patvirtina CSS pertraukos taškus ir horizontalaus slinkimo nebuvimą, bet nėra fizinio telefono patikra.
- [ ] Nepriklausoma lietuvių kalbos redaktoriaus peržiūra.
- [ ] DI pagalba parengto teksto redakcinis patvirtinimas ir kasdienio atnaujinimo darbo tvarka.
- [ ] Cloudflare Pages šakos peržiūros URL ir Cloudflare build log.
- [ ] Tikroje viešoje peržiūroje 13 route narvelių, canonical, robots, HTTP atsakai ir console.
- [ ] Gamybinio domain dūmų testas ir Cloudflare deployment ID.

## Leidimo būklė

Vietiniai techniniai vartai praėjo, bet tikras Cloudflare peržiūros build ir gamybinis dūmų testas dar neatlikti. Dabartinis rinkinys pažymėtas kaip DI pagalba parengtas ir žmogaus kalbos redaktoriaus neperžiūrėtas. Jis nėra sindikuotas ir neturi automatinio kasdienio atnaujinimo. Šie ribojimai aiškiai parodyti pačiuose horoskopo puslapiuose.

Šį failą atnaujinti po Cloudflare šakos preview ir production patikrų, įrašant faktinius URL, commit, deployment ID, atsakų kodus ir laiką. Jokio deploy rezultato nelaikyti PASS be tikro Cloudflare build / viešo HTTP patvirtinimo.
