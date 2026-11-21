# frozen_string_literal: true

require 'cgi'
require 'json'
require 'open3'

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

  def cities
    @cities ||= JSON.parse(File.read(SOURCE)).fetch('cities')
  end

  def city_readings
    @city_readings ||= begin
      payload, status = Open3.capture2('node', File.expand_path('../scripts/sunrise_readings.mjs', __dir__))
      raise 'Could not generate Lithuanian solar times' unless status.success?
      JSON.parse(payload)
    end
  end

  def options(cities, selected_id)
    cities.map do |city|
      id = city.fetch('id')
      selected = id == selected_id ? ' selected' : ''
      %(<option value="#{id}" data-lat="#{city.fetch('latitude')}" data-lon="#{city.fetch('longitude')}" data-locative="#{CGI.escapeHTML(city.fetch('locative'))}"#{selected}>#{CGI.escapeHTML(city.fetch('name'))}</option>)
    end.join
  end

  def metric(kind, label, value_id, note_id, value, caption = '')
    <<~HTML
      <article class="sun-metric sun-metric--#{kind}">
        <img class="sun-metric__icon" src="/assets/visuals/sun-metrics/#{kind}.svg" width="76" height="76" alt="" aria-hidden="true" decoding="async">
        <div><h2>#{label}</h2><strong id="#{value_id}">#{value}</strong><p id="#{note_id}">#{caption}</p></div>
      </article>
    HTML
  end

  def solar_time(value, instant, id: nil)
    attribute = id ? %( id="#{id}") : ''
    %(<time#{attribute} datetime="#{instant}">#{value}</time>)
  end

  def answer(city, row)
    place = CGI.escapeHTML(city.fetch('locative'))
    rise = solar_time(row.fetch('sunrise'), row.fetch('sunriseAt'), id: 'sun-answer-rise')
    set = solar_time(row.fetch('sunset'), row.fetch('sunsetAt'), id: 'sun-answer-set')
    <<~HTML
      <section class="sun-panel sun-answer" aria-labelledby="sun-answer-title">
        <h2 id="sun-answer-title">Kada teka ir leidžiasi Saulė #{place}?</h2>
        <p class="sun-answer__line"><span id="sun-answer-today" hidden>Šiandien, </span><time id="sun-answer-date" datetime="#{row.fetch('date')}">#{row.fetch('label')}</time><span id="sun-answer-today-comma" hidden>,</span> <span id="sun-answer-city">#{place}</span> Saulė teka #{rise} val., o leidžiasi #{set} val.</p>
        <p class="sun-answer__note">Dienos trukmė <strong id="sun-answer-daylight">#{row.fetch('daylight')}</strong> Laikas rodomas Lietuvos laiku.</p>
      </section>
    HTML
  end

  def outlook(city, rows)
    place = CGI.escapeHTML(city.fetch('locative'))
    entries = rows.map do |row|
      date = solar_time(row.fetch('label'), row.fetch('date'))
      rise = solar_time(row.fetch('sunrise'), row.fetch('sunriseAt'))
      set = solar_time(row.fetch('sunset'), row.fetch('sunsetAt'))
      %(<tr><th scope="row">#{date}</th><td>#{rise}</td><td>#{set}</td><td>#{row.fetch('daylight')}</td></tr>)
    end.join("\n")
    <<~HTML
      <section class="sun-panel sun-week" aria-labelledby="sun-week-title">
        <h2 id="sun-week-title">Saulės laikų lentelė nuo pasirinktos datos</h2>
        <table class="data-table">
          <caption id="sun-week-caption">Saulės laikai #{place} · Lietuvos laiku</caption>
          <thead><tr><th scope="col">Data</th><th scope="col">Saulėtekis</th><th scope="col">Saulėlydis</th><th scope="col">Dienos trukmė</th></tr></thead>
          <tbody id="sun-week-rows">#{entries}</tbody>
        </table>
      </section>
    HTML
  end

  def city_links(entries)
    entries.map do |city|
      %(<a href="/saule/#{city.fetch('id')}/">#{CGI.escapeHTML(city.fetch('name'))}</a>)
    end.join("\n")
  end

  def city_directory(primary, other, hub)
    other_links = if hub
      %(<details class="sun-cities__more"><summary>Visi #{cities.size} Lietuvos miestai</summary><div class="sun-cities__links">#{city_links(other)}</div></details>)
    else
      %(<a class="sun-cities__all" href="/saule/#saules-miestai">Visi #{cities.size} Lietuvos miestai</a>)
    end
    <<~HTML
      <nav id="saules-miestai" class="sun-panel sun-cities" aria-labelledby="sun-cities-title">
        <h2 id="sun-cities-title">Saulės laikai Lietuvos miestuose</h2>
        <div class="sun-cities__links">#{city_links(primary)}</div>
        #{other_links}
      </nav>
    HTML
  end

  def body(place = nil)
    primary = PRIMARY_CITIES.map { |id| cities.find { |city| city['id'] == id } }
    other = cities.reject { |city| PRIMARY_CITIES.include?(city['id']) }
    city = place || primary.first
    selected_id = city.fetch('id')
    week = city_readings.fetch(selected_id)
    day = week.first
    title = 'Saulėtekis ir saulėlydis'
    title += " #{CGI.escapeHTML(city.fetch('locative'))}" if place
    buttons = MOMENTS.map do |key, label, id|
      %(<button type="button" data-sun-moment="#{key}" aria-pressed="false"><span>#{label}</span><time id="#{id}">––</time></button>)
    end.join
    <<~HTML
      <div class="sun-atlas">
        <header class="sun-atlas__hero dark-surface">
          <div class="sun-atlas__intro">
            <p class="sun-eyebrow" data-dark-accent>Saulės ritmas virš Lietuvos</p>
            <h1 id="sun-page-title">#{title}</h1>
            <p>Pasirinkite miestą ir datą. Sužinokite Saulės laikus, dienos trukmę ir stebėkite, kaip Saulė juda nuo aušros iki vakaro.</p>
            <div class="sun-controls" aria-label="Miestas ir data">
              <label>Miestas<select id="sun-city" disabled><optgroup label="Didieji miestai">#{options(primary, selected_id)}</optgroup><optgroup label="Kiti Lietuvos miestai">#{options(other, selected_id)}</optgroup></select></label>
              <label>Data<input id="sun-date" type="date" min="2000-01-01" max="2100-12-31" value="#{day.fetch('date')}" required disabled></label>
              <button id="sun-today" type="button" disabled>#{icon('today', 19)} Šiandien</button>
            </div>
          </div>
          <img class="sun-atlas__art" src="/assets/visuals/solar-atlas.svg" width="420" height="215" alt="" aria-hidden="true" decoding="async">
        </header>
        <section id="sun-tool" class="sun-tool" aria-label="Saulės laikai ir simuliacija">
          <p id="sun-summary" class="visually-hidden" role="status" aria-live="polite"></p>
          <p id="sun-error" role="alert" hidden></p>
          <noscript><p class="sun-panel">Įjunkite „JavaScript“, jei norite pasirinkti kitą datą ar paleisti Saulės kelio simuliaciją. Kitų miestų laikus galite atverti puslapio apačioje.</p></noscript>
          #{answer(city, day)}
          <section class="sun-metrics" aria-label="Dienos Saulės laikai">
            #{metric('rise', 'Saulėtekis', 'sunrise-time', 'sunrise-date', day.fetch('sunrise'))}
            #{metric('noon', 'Saulės vidurdienis', 'sun-noon', 'sun-noon-alt', day.fetch('noon'), 'Aukščiausiai virš horizonto')}
            #{metric('set', 'Saulėlydis', 'sunset-time', 'sunset-date', day.fetch('sunset'))}
            #{metric('length', 'Dienos trukmė', 'sun-day-length', 'sun-day-change', day.fetch('daylight'))}
          </section>
          #{outlook(city, week)}
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
        #{city_directory(primary, other, place.nil?)}
        #{Phase568Pages.links([['astronominis-kalendorius/','Astronominis kalendorius','Lygiadieniai, saulėgrįžos ir dangaus reiškiniai.'],['menulio-fazes/','Mėnulio fazės','Jaunaties, pilnaties ir ketvirčių laikai.'],['metu-laikai/','Metų laikai','Astronominės ir meteorologinės metų laikų ribos.']])}
      </div>
    HTML
  end
end
