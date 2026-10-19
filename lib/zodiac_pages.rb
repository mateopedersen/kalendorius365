# frozen_string_literal: true
require 'json'
require 'cgi'
require 'date'
require 'digest'
require 'fileutils'

# Evergreen material is independent of the date-specific forecast dataset.
module ZodiacPages
  extend self
  ROOT = File.expand_path('..', __dir__)
  ELEMENTS = { 'fire' => ['Ugnis', 'Iniciatyvos ir gyvybingumo simbolika'],
               'earth' => ['Žemė', 'Atramos ir apčiuopiamų dalykų simbolika'],
               'air' => ['Oras', 'Minčių ir bendravimo simbolika'],
               'water' => ['Vanduo', 'Jausmų ir vaizduotės simbolika'] }.freeze
  MONTHS = %w[Sausis Vasaris Kovas Balandis Gegužė Birželis Liepa Rugpjūtis Rugsėjis Spalis Lapkritis Gruodis].freeze
  def esc(value); CGI.escapeHTML(value.to_s); end
  def catalog
    @catalog ||= begin
      signs = JSON.parse(File.read(File.join(ROOT, 'site/_data/horoscope_signs.json'), encoding: 'UTF-8'))
      profiles = JSON.parse(File.read(File.join(ROOT, 'site/_data/zodiac_profiles.json'), encoding: 'UTF-8'))
      raise 'Exactly twelve unique zodiac profiles are required' unless signs.length == 12 && profiles.keys.sort == signs.map { |s| s.fetch('key') }.sort
      signs.map do |sign|
        data = sign.merge(profiles.fetch(sign.fetch('key')))
        raise 'Invalid element' unless ELEMENTS.key?(data.fetch('element_key'))
        Date.new(2000, *data.fetch('start'))
        %w[focus symbol_label summary art_alt].each do |field|
          text = data.fetch(field)
          raise "Invalid #{field}" unless text.is_a?(String) && text == text.unicode_normalize(:nfc) && !text.match?(/[<>]/)
        end
        data.merge('element_name' => ELEMENTS.fetch(data.fetch('element_key')).first,
                   'art' => "/assets/visuals/zodiac/#{data.fetch('key')}.svg",
                   'url' => "/horoskopai/#{data.fetch('key')}/")
      end
    end
  end
  def mark(key)
    art_path = File.join(ROOT, 'site/assets/visuals/zodiac', "#{key}.svg")
    version = Digest::SHA256.file(art_path).hexdigest[0, 12]
    %(<img class="zodiac-mark" src="/assets/visuals/zodiac/#{esc(key)}.svg?v=#{version}" width="96" height="96" alt="" aria-hidden="true" decoding="async">)
  end
  def art(sign, class_name = '', eager = false)
    %(<img class="#{esc(class_name)}" src="#{esc(sign.fetch('art'))}" width="320" height="320" alt="#{esc(sign.fetch('art_alt'))}" loading="#{eager ? 'eager' : 'lazy'}" decoding="async"#{eager ? ' fetchpriority="high"' : ''}>)
  end
  def sign_options(selected)
    catalog.map { |s| %(<option value="#{esc(s['key'])}"#{s['key'] == selected ? ' selected' : ''}>#{esc(s['name'])}</option>) }.join
  end
  def compare_card(sign, id)
    %(<article class="z-compare-card" id="#{id}">#{art(sign)}<div><p class="z-eyebrow">Simbolio interpretacija</p><h3 data-compare-name>#{esc(sign['name'])}</h3><dl><div><dt>Orientacinės datos</dt><dd data-compare-range>#{esc(sign['range'])}</dd></div><div><dt>Tradicinė stichija</dt><dd data-compare-element>#{esc(sign['element_name'])}</dd></div><div><dt>Simbolis</dt><dd data-compare-symbol>#{esc(sign['symbol_label'])}</dd></div></dl><p data-compare-summary>#{esc(sign['summary'])}</p><a data-compare-link href="#{esc(sign['url'])}">#{esc(sign['genitive'])} dienos horoskopas →</a></div></article>)
  end
  def evergreen_profile(key)
    index = catalog.index { |s| s['key'] == key }
    raise 'Unknown sign profile' unless index
    sign = catalog[index]; previous = catalog[(index + 11) % 12]; following = catalog[(index + 1) % 12]
    related = catalog.select { |s| s['element_key'] == sign['element_key'] && s['key'] != key }
    <<~HTML
      <section class="z-sign-profile" aria-labelledby="z-profile-title">
        <div class="z-sign-profile__art">#{art(sign)}<span class="z-element-tag z-element-tag--#{sign['element_key']}">#{esc(sign['element_name'])}</span></div>
        <div><p class="z-eyebrow">Ženklo simbolika · astrologinė tradicija</p><h2 id="z-profile-title">#{esc(sign['name'])}: #{esc(sign['focus'].downcase)}</h2>
          <p class="z-sign-profile__range">Orientacinės datos: <strong>#{esc(sign['range'])}</strong></p>
          <p>#{esc(sign['summary'])}</p><p class="z-symbol-caption"><strong>Simbolis:</strong> #{esc(sign['symbol_label'].downcase)}.</p>
          <p class="z-small">Tai simbolio interpretacija, o ne mokslinis asmenybės įvertinimas. Netoli datų ribos Saulės ženklas priklauso nuo konkrečių metų ir gimimo momento.</p>
          <div class="z-inline-links"><a href="/zodiakas/#mano-zenklas">Pasitikrinkite Saulės ženklą →</a><a href="/zodiakas/#metodika">Datos ir šaltiniai</a></div>
        </div>
      </section>
      <nav class="z-neighbours" aria-label="Ankstesnis ir kitas zodiako ženklas">
        <a href="#{esc(previous['url'])}"><span>← Ankstesnis ženklas</span><strong>#{esc(previous['name'])}</strong></a>
        <a href="#{esc(following['url'])}"><span>Kitas ženklas →</span><strong>#{esc(following['name'])}</strong></a>
      </nav>
      <div class="z-same-element"><span>Ta pati tradicinė stichija:</span> #{related.map { |s| %(<a href="#{esc(s['url'])}">#{esc(s['name'])}</a>) }.join(' · ')} <a href="/zodiakas/#palyginti">Palyginti ženklus →</a></div>
    HTML
  end
  def hub_cta
    %(<aside class="z-daily-cta"><div><p class="z-eyebrow">Saulės ženklas ir dienos horoskopas</p><h2>Dar nežinote savo ženklo?</h2><p>Pagal gimimo mėnesį ir dieną raskite orientacinį ženklą, palyginkite stichijas ir sužinokite, kodėl svarbios ženklų datų ribos.</p></div><a class="z-button" href="/zodiakas/">Sužinokite savo Zodiako ženklą <span aria-hidden="true">↗</span></a></aside>)
  end
  def run
    signs = catalog; first = signs.first
    json = JSON.generate({ 'method' => 'conventional-western-tropical-month-day; two-day-boundary-window; not-an-ephemeris', 'signs' => signs })
    File.write(File.join(ROOT, 'site/assets/data/zodiac.json'), json, encoding: 'UTF-8')
    digest = Digest::SHA256.hexdigest(json)[0, 12]
    controls = signs.each_with_index.map do |s, index|
      angle = index * Math::PI / 6
      x = 50 + Math.sin(angle) * 35; y = 50 - Math.cos(angle) * 35
      %(<button class="z-wheel__button" type="button" data-wheel-sign="#{esc(s['key'])}" style="--x:#{x.round(3)}%;--y:#{y.round(3)}%" aria-label="Ženklas: #{esc(s['name'])}" aria-controls="z-wheel-detail" aria-pressed="#{index.zero?}" tabindex="#{index.zero? ? 0 : -1}" disabled>#{mark(s['key'])}<span class="z-wheel__name">#{esc(s['name'])}</span></button>)
    end.join
    sectors = signs.each_with_index.map do |s, index|
      angle = (index * 30 - 105) * Math::PI / 180
      x1 = 320 + 160 * Math.cos(angle); y1 = 320 + 160 * Math.sin(angle)
      x2 = 320 + 288 * Math.cos(angle); y2 = 320 + 288 * Math.sin(angle)
      %(<path d="M#{x1.round(2)} #{y1.round(2)}L#{x2.round(2)} #{y2.round(2)}" stroke="#a7915745"/>)
    end.join
    cards = signs.map do |s|
      %(<article class="z-sign-card" id="z-#{esc(s['key'])}" data-sign-card="#{esc(s['key'])}" data-element="#{esc(s['element_key'])}"><a href="#{esc(s['url'])}" class="z-sign-card__image" aria-label="#{esc(s['genitive'])} dienos horoskopas">#{art(s)}</a><div><span class="z-element-tag z-element-tag--#{esc(s['element_key'])}">#{esc(s['element_name'])}</span><h3><a href="#{esc(s['url'])}">#{esc(s['name'])}</a></h3><p class="z-range">#{esc(s['range'])}</p><p>#{esc(s['focus'])}.</p><a class="z-card-link" href="#{esc(s['url'])}">#{esc(s['genitive'])} dienos horoskopas <span aria-hidden="true">↗</span></a></div></article>)
    end.join
    filters = [['all','Visi ženklai']] + ELEMENTS.map { |key, value| [key, value.first] }
    body = <<~HTML
      <article class="zodiac-guide" data-zodiac-source="/assets/data/zodiac.json?v=#{digest}">
        <header class="z-hero">
          <div class="z-hero__copy"><p class="z-eyebrow">Vakarų tropinis zodiakas · 12 ženklų</p><h1>Zodiako ženklai: datos ir simboliai</h1><p class="z-intro">Pagal gimimo dieną raskite orientacinį Saulės ženklą, peržiūrėkite simbolius ir palyginkite tradicines stichijas.</p><a class="z-button" href="#mano-zenklas">Koks mano ženklas? <span aria-hidden="true">↓</span></a>
            <section id="z-wheel-detail" class="z-wheel-detail" aria-labelledby="z-wheel-name"><p class="z-eyebrow" id="z-wheel-element">Ugnies ženklas</p><h2 id="z-wheel-name">Avinas</h2><p id="z-wheel-range">#{esc(first['range'])}</p><p id="z-wheel-focus">#{esc(first['focus'])}</p><a id="z-wheel-link" href="#{esc(first['url'])}">Avino dienos horoskopas →</a></section>
          </div>
          <div class="z-wheel-wrap"><div class="z-wheel" role="group" aria-label="Interaktyvus dvylikos zodiako ženklų ratas"><svg class="z-wheel__dial" viewBox="0 0 640 640" aria-hidden="true" focusable="false"><circle cx="320" cy="320" r="306" fill="#fffdf7" stroke="#c4a974"/><circle cx="320" cy="320" r="289" fill="none" stroke="#c4a974" stroke-opacity=".5"/><circle cx="320" cy="320" r="160" fill="#0b3938"/>#{sectors}<circle cx="320" cy="320" r="153" fill="none" stroke="#d6b770" stroke-width="1.5"/><circle cx="320" cy="320" r="145" fill="none" stroke="#d6b770" stroke-opacity=".3"/></svg><div class="z-wheel__center">#{art(first, 'z-wheel__image', true)}</div>#{controls}</div><p class="z-wheel-help">Pasirinkite simbolį. Klaviatūra: rodyklėmis keiskite ženklą, tabuliavimo klavišu pereikite toliau. Ratas vaizduoja astrologinę sistemą, ne žvaigždėlapį.</p><p id="z-wheel-status" class="visually-hidden" role="status" aria-live="polite"></p></div>
        </header>
        <section class="z-finder z-panel" id="mano-zenklas" aria-labelledby="z-finder-title"><div><p class="z-eyebrow">Mėnuo ir diena · be registracijos</p><h2 id="z-finder-title">Koks mano Zodiako ženklas?</h2><p>Pakanka mėnesio ir dienos. Tai orientacinė datų lentelė; gimus ties ženklų riba tiksliam atsakymui reikia gimimo metų, laiko ir laiko juostos.</p></div><form id="z-finder"><fieldset disabled><legend class="visually-hidden">Gimimo mėnuo ir diena</legend><div class="z-finder__fields"><div><label for="z-month">Gimimo mėnuo</label><select id="z-month" name="month" required><option value="">Pasirinkite mėnesį</option>#{MONTHS.each_with_index.map { |name,i| %(<option value="#{i+1}">#{name}</option>) }.join}</select></div><div><label for="z-day">Gimimo diena</label><input id="z-day" name="day" type="number" min="1" max="31" inputmode="numeric" placeholder="Pvz., 15" required></div><button class="z-button" type="submit">Rasti ženklą <span aria-hidden="true">↗</span></button></div></fieldset></form><div id="z-finder-result" class="z-finder-result" role="status" aria-live="polite" aria-atomic="true" hidden></div><p class="z-small">Įvesti duomenys lieka tik šiame puslapyje: jų nesiunčiame ir neišsaugome.</p><noscript><p>Įrankiui reikia JavaScript. Savo datą galite palyginti su žemiau pateiktais 12 laikotarpių; ties ženklų riba atsakymas lieka apytikslis.</p></noscript></section>
        <section id="zenklai" aria-labelledby="z-signs-title"><header class="z-section-heading"><div><p class="z-eyebrow">Dvylika skirtingų simbolių</p><h2 id="z-signs-title">Ženklų datos ir keturios stichijos</h2></div><a href="/horoskopai/">Visi šios dienos horoskopai →</a></header><p class="z-small">Datos yra orientacinės. Stichijos – astrologinės tradicijos grupės, ne mokslinė žmonių klasifikacija.</p><div class="z-filters" role="group" aria-label="Filtruoti pagal stichiją">#{filters.map { |key,name| %(<button type="button" data-element-filter="#{key}" aria-pressed="#{key == 'all'}" disabled>#{key == 'all' ? '' : %(<img src="/assets/visuals/zodiac/stichija-#{key}.svg" width="30" height="30" alt="" aria-hidden="true" loading="lazy">)}#{esc(name)}</button>) }.join}</div><p id="z-filter-status" class="z-small" role="status" aria-live="polite">Rodomi visi 12 ženklų.</p><div class="z-sign-grid">#{cards}</div></section>
        <section class="z-panel z-comparison" id="palyginti" aria-labelledby="z-compare-title"><header><p class="z-eyebrow">Datos, simboliai ir stichijos</p><h2 id="z-compare-title">Palyginkite du ženklus</h2><p>Pažiūrėkite, kuo skiriasi datos, simboliai ir tradicinės stichijos. Šis palyginimas nevertina santykių sėkmės.</p></header><div class="z-compare-controls"><div><label for="z-compare-first">Pirmas ženklas</label><select id="z-compare-first" disabled>#{sign_options('avinas')}</select></div><div><label for="z-compare-second">Antras ženklas</label><select id="z-compare-second" disabled>#{sign_options('svarstykles')}</select></div><button id="z-compare-reset" class="z-text-button" type="button" disabled>Atkurti pradinį palyginimą</button></div><p id="z-compare-status" class="z-small" role="status" aria-live="polite">Avinas ir Svarstyklės: dvi skirtingos tradicinės stichijos.</p><div class="z-compare-grid">#{compare_card(first, 'z-compare-a')}#{compare_card(signs[6], 'z-compare-b')}</div></section>
        <section class="z-science z-panel" id="astrologija-ir-astronomija" aria-labelledby="z-science-title"><div><p class="z-eyebrow">Svarbus skirtumas</p><h2 id="z-science-title">Ženklas nėra žvaigždynas</h2><p>Astrologiniame tropiniame zodiake ratas dalijamas į <strong>12 vienodų dalių po 30°</strong>, skaičiuojamų nuo pavasario lygiadienio taško. Astronominiai žvaigždynai yra skirtingo dydžio dangaus sritys.</p><p>Ekliptika eina per <strong>13 žvaigždynų, įskaitant Gyvatnešį</strong>. Tai neprideda trylikto ženklo į įprastą tropinę dvylikos ženklų sistemą. Dėl Žemės ašies precesijos ženklų ir bendravardžių žvaigždynų padėtys ilgainiui išsiskyrė.</p><p>Astronomija tiria dangaus kūnus moksliniais metodais. Astrologiniai asmenybės ir ateities aiškinimai nėra moksliškai patvirtintos prognozės.</p><p class="z-source-links">Šaltiniai: <a href="https://www.vle.lt/straipsnis/zodiakas/">VLE: Zodiakas</a> · <a href="https://science.nasa.gov/learn/basics-of-space-flight/chapter2-1/">NASA: atskaitos sistemos ir precesija</a> · <a href="https://www.vle.lt/straipsnis/astrologija/">VLE: astrologija</a>.</p></div><figure><img src="/assets/visuals/zodiac/zodiakas-ir-zvaigzdynai.svg" width="680" height="520" loading="lazy" decoding="async" alt="Aiškinamoji schema: dvylika vienodų astrologinių dalių, trylika nevienodų žvaigždynų sričių ir Žemės ašies precesijos kūgis."><figcaption>Aiškinamoji schema, ne dangaus žemėlapis. Žvaigždynų sritys ir precesijos poslinkis pavaizduoti ne masteliu.</figcaption></figure></section>
        <section class="z-method z-panel" id="metodika" aria-labelledby="z-method-title"><p class="z-eyebrow">Kalendorius365 · turinys ir metodika</p><h2 id="z-method-title">Kaip nustatomas ženklas?</h2><p>Įrankis lygina mėnesį ir dieną su šiame puslapyje paskelbta įprastų Vakarų tropinio zodiako datų lentele. Jis <strong>neskaičiuoja tikslios Saulės padėties</strong>. Likus ne daugiau kaip dviem dienoms iki įprastos ženklų ribos arba praėjus tiek pat dienų po jos, pateikiame abu gretimus ženklus. Skirtingi šaltiniai gali rinktis kiek kitokias kalendorines ribas.</p><p>Vasario 29-oji priimama kaip keliamųjų metų data. Metų ir gimimo vietos šis paprastas įrankis neprašo. <strong>Ascendentui</strong> reikia gimimo datos, laiko ir vietos; atskiras jo skaičiuotuvas pateiktas kiekviename ženklo dienos horoskopo puslapyje.</p><details><summary>Šaltiniai ir redakcinė peržiūra</summary><p>Paaiškinimai savarankiškai suformuluoti pagal <a href="https://www.vle.lt/straipsnis/zodiakas/">VLE</a>, <a href="https://www.iau.org/IAU/Astronomy-FAQs/Constellations.aspx">IAU žvaigždynų apibrėžimus</a> ir <a href="https://spaceplace.nasa.gov/constellations/en/">NASA paaiškinimą apie astronomiją bei astrologiją</a>. Simbolių aprašymai – originalios redakcinės interpretacijos; jos nėra asmenybės testai. Visi piešiniai sukurti šiam projektui.</p><p>Leidėjas – Kalendorius365. Turinys ir įrankiai parengti padedant dirbtiniam intelektui, peržiūrėti ir tikrinti automatizuotais bandymais. Nepriklausomas gimtakalbis redaktorius turinio neperžiūrėjo. Šaltiniai ir metodas peržiūrėti <time datetime="2026-10-17">2026 m. spalio 17 d.</time></p></details></section>
        <nav class="z-related" aria-label="Susiję kalendoriaus puslapiai"><a href="/horoskopai/">Dienos horoskopai →</a><a href="/menulio-fazes/">Mėnulio fazės</a><a href="/astronominis-kalendorius/">Astronominis kalendorius</a><a href="/saule/">Saulėtekis ir saulėlydis</a></nav>
      </article>
    HTML
    values = { 'layout'=>'default', 'title'=>'Zodiako ženklai ir datos – ženklo paieška',
               'description'=>'Raskite Zodiako ženklą pagal gimimo mėnesį ir dieną, palyginkite 12 ženklų datas, simbolius bei stichijas. Ties datų ribomis pateikiami abu gretimi ženklai.',
               'horoscope'=>true, 'zodiac'=>true, 'zodiac_hub'=>true,
               'og_image'=>'/assets/visuals/zodiac/zodiakas-1200x630.png',
               'og_image_alt'=>'Originalus dvylikos Zodiako ženklų ratas ir trys reljefiškų simbolių iliustracijos.' }
    target = File.join(ROOT, 'site/zodiakas/index.html'); FileUtils.mkdir_p(File.dirname(target))
    File.write(target, "---\n#{values.map { |k,v| "#{k}: #{JSON.generate(v)}" }.join("\n")}\n---\n#{body}", encoding: 'UTF-8')
  end
end
