# frozen_string_literal: true

require 'cgi'
require 'json'

module SunrisePage
  extend self

  SOURCE = File.expand_path('../data/astronomy/sun-cities.json', __dir__)
  PRIMARY_CITIES = %w[vilnius kaunas klaipeda siauliai panevezys].freeze
  MOMENTS = [
    ['civilStart', 'Aušra', 'sun-civil-start'],
    ['sunrise', 'Saulėtekis', 'sun-rise-time'],
    ['noon', 'Vidurdienis', 'sun-noon-time'],
    ['sunset', 'Saulėlydis', 'sun-set-time'],
    ['civilEnd', 'Prieblandos pabaiga', 'sun-civil-end']
  ].freeze

  def icon(name, size = 28)
    %(<svg width="#{size}" height="#{size}" aria-hidden="true" focusable="false"><use href="/assets/visuals/solar-atlas.svg##{name}"></use></svg>)
  end

  def options(cities)
    cities.map do |city|
      %(<option value="#{city.fetch('id')}" data-lat="#{city.fetch('latitude')}" data-lon="#{city.fetch('longitude')}">#{CGI.escapeHTML(city.fetch('name'))}</option>)
    end.join
  end

  def metric(kind, label, value_id, note_id, caption = '')
    <<~HTML
      <article class="sun-metric sun-metric--#{kind}">
        <span class="sun-metric__icon">#{icon(kind, 34)}</span>
        <div><h2>#{label}</h2><strong id="#{value_id}">––</strong><p id="#{note_id}">#{caption}</p></div>
      </article>
    HTML
  end

  def body
    cities = JSON.parse(File.read(SOURCE)).fetch('cities')
    primary = PRIMARY_CITIES.map { |id| cities.find { |city| city['id'] == id } }
    other = cities.reject { |city| PRIMARY_CITIES.include?(city['id']) }
    buttons = MOMENTS.map do |key, label, id|
      %(<button type="button" data-sun-moment="#{key}" aria-pressed="false"><span>#{label}</span><time id="#{id}">––</time></button>)
    end.join
    <<~HTML
      <div class="sun-atlas">
        <header class="sun-atlas__hero dark-surface">
          <div class="sun-atlas__intro">
            <p class="sun-eyebrow" data-dark-accent>Saulės ritmas virš Lietuvos</p>
            <h1>Saulėtekis ir saulėlydis</h1>
            <p>Pasirinkite miestą ir datą. Sužinokite Saulės laikus, dienos trukmę ir stebėkite, kaip Saulė juda nuo aušros iki vakaro.</p>
            <div class="sun-controls" aria-label="Miestas ir data">
              <label>Miestas<select id="sun-city"><optgroup label="Didieji miestai">#{options(primary)}</optgroup><optgroup label="Kiti Lietuvos miestai">#{options(other)}</optgroup></select></label>
              <label>Data<input id="sun-date" type="date" min="2000-01-01" max="2100-12-31" required></label>
              <button id="sun-today" type="button">#{icon('today', 19)} Šiandien</button>
            </div>
          </div>
          <img class="sun-atlas__art" src="/assets/visuals/solar-atlas.svg" width="420" height="215" alt="" aria-hidden="true" decoding="async">
        </header>
        <section id="sun-tool" class="sun-tool" aria-label="Saulės laikai ir simuliacija">
          <p id="sun-summary" class="visually-hidden" role="status" aria-live="polite"></p>
          <p id="sun-error" role="alert" hidden></p>
          <noscript><p class="sun-panel">Norint apskaičiuoti Saulės laikus ir peržiūrėti simuliaciją, naršyklėje reikia įjungti „JavaScript“.</p></noscript>
          <section class="sun-metrics" aria-label="Dienos Saulės laikai">
            #{metric('rise', 'Saulėtekis', 'sunrise-time', 'sunrise-date')}
            #{metric('noon', 'Saulės vidurdienis', 'sun-noon', 'sun-noon-alt', 'Aukščiausiai virš horizonto')}
            #{metric('set', 'Saulėlydis', 'sunset-time', 'sunset-date')}
            #{metric('length', 'Dienos trukmė', 'sun-day-length', 'sun-day-change')}
          </section>
          <section class="sun-stage sun-panel" aria-labelledby="sun-experience-title">
            <header class="sun-stage__header">
              <div><h2 id="sun-experience-title">Saulės kelias danguje</h2><p id="sun-scene-caption">Pasirinktos vietos laikas ir apšvietimas.</p></div>
              <button id="sun-trajectory" type="button" aria-pressed="true"><span aria-hidden="true" class="sun-trajectory-line"></span> Saulės trajektorija</button>
            </header>
            <div class="sun-stage__visual">
              <div id="sun-scene" class="sun-scene" role="img" aria-label="Saulės kelias danguje">
                <img src="/assets/visuals/solar-atlas.svg" width="420" height="215" alt="" aria-hidden="true" decoding="async">
              </div>
              <div class="sun-stage__telemetry dark-surface">
                <div><strong id="sun-sim-time">––</strong><span id="sun-sim-phase" data-dark-accent>Vietos laikas</span></div>
                <div><span>Saulės aukštis</span><strong id="sun-altitude">––</strong></div>
                <div><span>Azimutas nuo šiaurės</span><strong id="sun-azimuth">––</strong></div>
              </div>
            </div>
            <div class="sun-scrubber">
              <div class="sun-scrubber__head">
                <label for="sun-scrubber">Simuliacijos laikas <output id="sun-sim-output" for="sun-scrubber">––</output></label>
                <button id="sun-play" type="button" aria-pressed="false"><svg viewBox="0 0 24 24" width="18" height="18" aria-hidden="true" focusable="false"><path d="M8 5.5v13l10-6.5z"/></svg><span>Paleisti animaciją</span></button>
              </div>
              <input id="sun-scrubber" type="range" min="0" max="1000" step="1" value="0">
              <div class="sun-moments" role="group" aria-label="Pasirinkti Saulės įvykį">#{buttons}</div>
              <p class="sun-stage__note">Horizontas scheminis, o Saulės diskas padidintas, kad būtų lengviau matyti. Tai apskaičiuotas vaizdas esant giedram dangui.</p>
            </div>
          </section>
          <div class="sun-insights">
            <section class="sun-panel sun-analysis" aria-labelledby="sun-month-title">
              <h2 id="sun-month-title">Dienos šviesa per mėnesį</h2>
              <p id="sun-chart-caption"></p>
              <div id="sun-chart" class="sun-chart"></div>
              <details class="sun-data-details">
                <summary>Mėnesio Saulės laikų lentelė #{icon('chevron', 18)}</summary>
                <div class="table-scroll" tabindex="0" role="region" aria-label="Mėnesio Saulės laikai">
                  <table class="data-table"><caption id="sun-table-caption"></caption>
                    <thead><tr><th scope="col">Data</th><th scope="col">Saulėtekis</th><th scope="col">Vidurdienis</th><th scope="col">Saulėlydis</th><th scope="col">Dienos trukmė</th><th scope="col">Civilinė prieblanda</th></tr></thead>
                    <tbody id="sun-rows"></tbody>
                  </table>
                </div>
              </details>
            </section>
            <section class="sun-panel sun-analysis" aria-labelledby="sun-year-title">
              <h2 id="sun-year-title">Dienos šviesa per metus</h2>
              <p id="sun-year-chart-caption"></p>
              <div id="sun-year-chart" class="sun-chart"></div>
              <details class="sun-data-details">
                <summary>Metų trukmės suvestinė #{icon('chevron', 18)}</summary>
                <div class="table-scroll" tabindex="0" role="region" aria-label="Mėnesio dienos trukmė">
                  <table class="data-table"><caption id="sun-year-caption"></caption>
                    <thead><tr><th scope="col">Mėnuo</th><th scope="col">Vidurkis</th><th scope="col">Trumpiausia diena</th><th scope="col">Ilgiausia diena</th></tr></thead>
                    <tbody id="sun-year-rows"></tbody>
                  </table>
                </div>
              </details>
            </section>
          </div>
          <section class="sun-panel sun-method" aria-labelledby="sun-method-title">
            <h2 id="sun-method-title">Kaip skaičiuojami Saulės laikai?</h2>
            <div class="sun-method__grid">
              <article><h3>Saulės padėtis ir kryptis</h3><p>Aukštį ir azimutą skaičiuojame pasirinktu momentu pagal miesto koordinates. Azimutas matuojamas nuo geografinės šiaurės. Saulės vidurdienis yra laikas, kai Saulė aukščiausiai virš horizonto.</p></article>
              <article><h3>Saulėtekis, saulėlydis ir prieblanda</h3><p>Saulė teka arba leidžiasi, kai jos viršutinis kraštas paliečia lygų horizontą. Skaičiuojant Saulės centro geometrinis aukštis tada yra apie −0,83°. Civilinės prieblandos riba yra −6°.</p></article>
              <article><h3>Laikas vietoje</h3><p>Valandos rodomos Lietuvos laiku, įskaitant vasaros laiką. Kalvos, pastatai, stebėjimo aukštis ir atmosferos refrakcija gali pakeisti matomą saulėtekio ar saulėlydžio laiką.</p></article>
              <article><h3>Miestų koordinatės</h3><p>Naudojami 103 miestų atskaitos taškai. Daugumai miestų naudojami apytiksliai ribų centrai iš VĮ Registrų centro Adresų registro rinkinio Nr. 1347 (CC BY 4.0). <a href="https://www.geoportal.lt/geoportal/atviri-duomenys">Lietuvos erdvinės informacijos portale</a> pateikiama prieiga prie registro erdvinių duomenų. Penkiems didiesiems miestams naudojamos <a href="https://www.geonames.org/export/">„GeoNames“ koordinatės (CC BY)</a>.</p></article>
            </div>
            <p class="sun-method__sources"><a href="https://aa.usno.navy.mil/faq/sun_approx">USNO Saulės koordinačių metodika</a> · <a href="https://aa.usno.navy.mil/faq/RST_defs">Horizontas ir prieblandos apibrėžimai</a></p>
          </section>
        </section>
        #{Phase568Pages.links([['astronominis-kalendorius/','Astronominis kalendorius','Lygiadieniai, saulėgrįžos ir dangaus reiškiniai.'],['menulio-fazes/','Mėnulio fazės','Jaunaties, pilnaties ir ketvirčių laikai.'],['metu-laikai/','Metų laikai','Astronominės ir meteorologinės metų laikų ribos.']])}
      </div>
    HTML
  end
end
