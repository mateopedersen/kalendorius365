# frozen_string_literal: true

require 'cgi'
require 'date'
require 'digest'
require 'json'
require 'fileutils'
require 'time'

module HoroscopesPages
  extend self

  ROOT = File.expand_path('..', __dir__)
  SIGN_PATH = File.join(ROOT, 'site/_data/horoscope_signs.json')
  DAILY_PATH = File.join(ROOT, 'site/_data/horoscope_current.json')
  FORECAST_FIELDS = %w[sign_key editorial_heading lead overview relationships work reflection tip].freeze
  EXPECTED = %w[avinas jautis dvyniai vezys liutas mergele svarstykles skorpionas saulys oziaragis vandenis zuvys].freeze
  LT_NAMES = {
    'avinas' => ['Avinas', 'Avino'], 'jautis' => ['Jautis', 'Jaučio'],
    'dvyniai' => ['Dvyniai', 'Dvynių'], 'vezys' => ['Vėžys', 'Vėžio'],
    'liutas' => ['Liūtas', 'Liūto'], 'mergele' => ['Mergelė', 'Mergelės'],
    'svarstykles' => ['Svarstyklės', 'Svarstyklių'], 'skorpionas' => ['Skorpionas', 'Skorpiono'],
    'saulys' => ['Šaulys', 'Šaulio'], 'oziaragis' => ['Ožiaragis', 'Ožiaragio'],
    'vandenis' => ['Vandenis', 'Vandenio'], 'zuvys' => ['Žuvys', 'Žuvų']
  }.freeze
  MONTHS = %w[sausio vasario kovo balandžio gegužės birželio liepos rugpjūčio rugsėjo spalio lapkričio gruodžio].freeze
  WEEKDAYS = %w[pirmadienis antradienis trečiadienis ketvirtadienis penktadienis šeštadienis sekmadienis].freeze

  def escape(value)
    CGI.escapeHTML(value.to_s)
  end

  def local_date_label(date)
    parsed = Date.iso8601(date)
    "#{parsed.year} m. #{MONTHS[parsed.month - 1]} #{parsed.day} d., #{WEEKDAYS[parsed.cwday - 1]}"
  end

  def checksum(forecasts)
    canonical = forecasts.sort_by { |record| record.fetch('sign_key') }.map do |record|
      FORECAST_FIELDS.map { |field| record.fetch(field) }.join("\0")
    end.join("\1")
    Digest::SHA256.hexdigest(canonical)
  end

  def validate(signs, daily)
    raise 'Horoscope signs must contain exactly 12 records' unless signs.length == 12
    keys = signs.map { |sign| sign['key'] }
    raise 'Horoscope signs have a missing, duplicate, or unknown slug' unless keys.sort == EXPECTED.sort
    raise 'Daily horoscope set must contain exactly 12 forecasts' unless daily.fetch('forecasts').length == 12
    records = daily.fetch('forecasts')
    record_keys = records.map { |record| record['sign_key'] }
    raise 'Daily horoscope forecasts have a missing, duplicate, or unknown sign' unless record_keys.sort == EXPECTED.sort

    signs_by_key = signs.to_h { |sign| [sign.fetch('key'), sign] }
    signs.each do |sign|
      expected_names = LT_NAMES.fetch(sign.fetch('key'))
      raise "Incorrect Lithuanian zodiac name for #{sign['key']}" unless [sign['name'], sign['genitive']] == expected_names
    end
    records.each do |record|
      FORECAST_FIELDS.each do |field|
        value = record[field]
        raise "Empty horoscope field #{field} for #{record['sign_key']}" unless value.is_a?(String) && !value.strip.empty?
        raise "Unnormalized Lithuanian text in #{record['sign_key']}/#{field}" unless value == value.unicode_normalize(:nfc)
        raise "Unsafe HTML in #{record['sign_key']}/#{field}" if value.match?(/<\s*\/?\s*[a-z!]/i)
      end
      raise "Short editorial content for #{record['sign_key']}" if record['overview'].length < 110 || record['relationships'].length < 80 || record['work'].length < 80 || record['reflection'].length < 60 || record['tip'].length < 28
      raise "Unknown sign key #{record['sign_key']}" unless signs_by_key.key?(record['sign_key'])
    end

    leads = records.map { |record| record['lead'].downcase.gsub(/[^\p{Alnum}]+/u, ' ').strip }
    raise 'Repeated daily lead detected' unless leads.uniq.length == leads.length
    %w[local_date display_date_lt generated_at_utc prepared_at_vilnius source_publication_date source_timezone source_provider_id license_evidence_id attribution_text canonical_requirement original_text_or_licensed_translation editorial_review_status content_status].each do |field|
      raise "Missing daily metadata: #{field}" if daily[field].to_s.strip.empty?
    end
    raise 'Invalid Europe/Vilnius publication date' unless Date.iso8601(daily.fetch('local_date')).iso8601 == daily['local_date']
    raise 'Missing Europe/Vilnius preparation timestamp' unless daily['prepared_at_vilnius'].to_s.match?(/\A\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}[+-]\d{2}:\d{2}\z/)
    raise 'Invalid UTC preparation timestamp' unless Time.iso8601(daily.fetch('generated_at_utc')).utc_offset.zero?
    raise 'Publication and source dates differ' unless daily['source_publication_date'] == daily['local_date']
    raise 'This first version requires original editorial content and a self-canonical' unless daily['source_provider_id'] == 'kalendorius365-original-editorial' && daily['canonical_requirement'] == 'self-canonical'
    raise 'Only original text may enter this initial content pipeline' unless daily['original_text_or_licensed_translation'] == 'original-text' && daily['source_url'].nil?
    raise 'Unknown horoscope content status' unless %w[draft approved published stale unavailable].include?(daily['content_status'])
    raise 'Daily content checksum does not match its text' unless daily['content_checksum'] == checksum(records)
    true
  end

  def write_page(path, title, description, body, extra = {})
    target = File.join(ROOT, 'site', path, 'index.html')
    FileUtils.mkdir_p(File.dirname(target))
    values = { 'title' => title, 'description' => description, 'horoscope' => true }.merge(extra)
    frontmatter = values.map { |key, value| "#{key}: #{JSON.generate(value)}" }.join("\n")
    File.write(target, "---\n#{frontmatter}\n---\n#{body}\n", mode: 'w', encoding: 'UTF-8')
  end

  def mark(key, extra_class = '')
    %(<svg class="zodiac-mark #{extra_class}" viewBox="0 0 96 96" aria-hidden="true" focusable="false"><use href="/assets/visuals/zodiac-signs.svg#zodiac-#{escape(key)}"></use></svg>)
  end

  def notice(daily, date_label)
    %(<aside class="horoscope-editorial-note" aria-label="Turinio ir datos pastaba"><span class="horoscope-editorial-note__icon" aria-hidden="true">i</span><p><strong>Turinio pastaba.</strong> Tekstai sukurti Kalendorius365.lt, DI naudotas rengiant pirmąjį variantą; nepriklausomas lietuvių kalbos redaktorius jų neperžiūrėjo. Horoskopai yra bendro pobūdžio, skirti pramogai ir apmąstymui. <span>Turinio data: <time datetime="#{escape(daily['local_date'])}">#{escape(date_label)}</time>; parengta <time datetime="#{escape(daily['prepared_at_vilnius'])}">#{escape(daily['prepared_at_display_lt'])}</time>.</span></p></aside>)
  end

  def forecast_card(sign, forecast, date_label)
    %(<article class="horoscope-card" style="--sign-accent: #{escape(sign['theme'])}"><a class="horoscope-card__link" href="/horoskopai/#{escape(sign['key'])}/" aria-label="#{escape(sign['genitive'])} dienos horoskopas: #{escape(date_label)}"><span class="horoscope-card__mark">#{mark(sign['key'])}</span><span class="horoscope-card__content"><span class="horoscope-card__eyebrow">#{escape(sign['element'])} <span aria-hidden="true">·</span> #{escape(sign['range'])}</span><strong class="horoscope-card__title">#{escape(sign['name'])}</strong><span class="horoscope-card__heading">#{escape(forecast['editorial_heading'])}</span><span class="horoscope-card__excerpt">#{escape(forecast['lead'])}</span><span class="horoscope-card__cta">#{escape(sign['genitive'])} dienos horoskopas <span aria-hidden="true">↗</span></span></span></a></article>)
  end

  def sign_body(sign, forecast, daily, date_label)
    date_iso = escape(daily['local_date'])
    %(<article class="horoscope-detail" style="--sign-accent: #{escape(sign['theme'])}">
      <header class="horoscope-sign-hero">
        <div class="horoscope-sign-hero__art">#{mark(sign['key'], 'zodiac-mark--hero')}<span class="horoscope-sign-hero__ring" aria-hidden="true"></span></div>
        <div class="horoscope-sign-hero__copy"><p class="horoscope-kicker">Dienos horoskopas <span aria-hidden="true">·</span> Vakarų tropinis zodiakas</p><h1>#{escape(sign['genitive'])} dienos horoskopas</h1><p class="horoscope-sign-hero__date"><time datetime="#{date_iso}">#{escape(date_label)}</time></p><p class="horoscope-sign-hero__heading">#{escape(forecast['editorial_heading'])}</p></div>
      </header>
      <div class="horoscope-body-grid">
        <section class="horoscope-lead" aria-labelledby="horoscope-lead-title"><p class="horoscope-kicker">Dienos kryptis</p><h2 id="horoscope-lead-title">#{escape(forecast['lead'])}</h2></section>
        <section class="horoscope-reading" aria-labelledby="horoscope-overview-title"><h2 id="horoscope-overview-title">Bendra dienos nuotaika</h2><p>#{escape(forecast['overview'])}</p></section>
        <section class="horoscope-reading horoscope-reading--relationship" aria-labelledby="horoscope-relationships-title"><span class="horoscope-reading__index" aria-hidden="true">01</span><h2 id="horoscope-relationships-title">Santykiai</h2><p>#{escape(forecast['relationships'])}</p></section>
        <section class="horoscope-reading horoscope-reading--work" aria-labelledby="horoscope-work-title"><span class="horoscope-reading__index" aria-hidden="true">02</span><h2 id="horoscope-work-title">Veikla ir darbai</h2><p>#{escape(forecast['work'])}</p></section>
        <section class="horoscope-reading horoscope-reading--reflection" aria-labelledby="horoscope-reflection-title"><span class="horoscope-reading__index" aria-hidden="true">03</span><h2 id="horoscope-reflection-title">Apmąstymui</h2><p>#{escape(forecast['reflection'])}</p></section>
        <aside class="horoscope-tip" aria-label="Praktinis patarimas"><span class="horoscope-tip__label">Mažas dienos žingsnis</span><p>#{escape(forecast['tip'])}</p></aside>
      </div>
      <section class="horoscope-profile" aria-labelledby="horoscope-profile-title"><div class="horoscope-profile__symbol">#{mark(sign['key'])}</div><div><p class="horoscope-kicker">Ženklo profilis</p><h2 id="horoscope-profile-title">#{escape(sign['name'])}</h2><p>#{escape(sign['element'])} · orientacinis Vakarų tropinio zodiako laikotarpis: <strong>#{escape(sign['range'])}</strong>. Gimimo datos ribos skirtinguose šaltiniuose ar konkrečiais metais gali šiek tiek skirtis.</p></div></section>
      #{notice(daily, date_label)}
      <nav class="horoscope-related" aria-label="Susiję kalendoriaus puslapiai"><a href="/2027/">2027 m. kalendorius</a><a href="/menulio-fazes/">Mėnulio fazės</a><a href="/saule/">Saulėtekis ir saulėlydis</a><a href="/horoskopai/">Visi dienos horoskopai</a></nav>
      <section class="horoscope-sign-selector" aria-labelledby="horoscope-sign-selector-title"><div class="horoscope-section-heading"><div><p class="horoscope-kicker">Dvylika ženklų</p><h2 id="horoscope-sign-selector-title">Kiti dienos horoskopai</h2></div><time datetime="#{date_iso}">#{escape(date_label)}</time></div><div class="horoscope-sign-links">#{@signs.map { |item| sign_link(item, daily, item['key'] == sign['key']) }.join}</div></section>
      <p class="horoscope-disclaimer">Horoskopas yra bendro pobūdžio pramoginis tekstas ir savirefleksijos pasiūlymas. Jis nėra mokslinė prognozė, asmeninė konsultacija ar patarimas priimant sveikatos, teisės, finansų ar kitus svarbius sprendimus.</p>
    </article>)
  end

  def sign_link(sign, daily, current = false)
    current_attr = current ? ' aria-current="page"' : ''
    %(<a class="horoscope-sign-link" href="/horoskopai/#{escape(sign['key'])}/" aria-label="#{escape(sign['genitive'])} dienos horoskopas"#{current_attr}><span class="horoscope-sign-link__mark">#{mark(sign['key'])}</span><span>#{escape(sign['name'])}</span></a>)
  end

  def run
    @signs = JSON.parse(File.read(SIGN_PATH, encoding: 'UTF-8'))
    daily = JSON.parse(File.read(DAILY_PATH, encoding: 'UTF-8'))
    validate(@signs, daily)
    forecasts = daily.fetch('forecasts').to_h { |record| [record.fetch('sign_key'), record] }
    date = Date.iso8601(daily.fetch('local_date'))
    date_label = local_date_label(daily.fetch('local_date'))
    month_title = "#{date.year} m. #{MONTHS[date.month - 1]} #{date.day} d."
    hub_description = "Dienos horoskopai #{month_title}: 12 Vakarų zodiako ženklų apžvalgos, santykių, veiklos ir apmąstymo skiltys. Bendro pobūdžio tekstai pramogai."
    cards = @signs.map { |sign| forecast_card(sign, forecasts.fetch(sign.fetch('key')), date_label) }.join
    hub = %(<div class="horoscope-hub"><section class="horoscope-hub-hero"><div class="horoscope-hub-hero__copy"><p class="horoscope-kicker">Dienos horoskopai <span aria-hidden="true">/</span> 12 Vakarų zodiako ženklų</p><h1>Horoskopai</h1><p class="horoscope-hub-hero__intro">Perskaitykite bendro pobūdžio dienos įžvalgas kiekvienam ženklui. Rinkinyje atskirtos santykių, veiklos ir asmeninio apmąstymo temos, o kiekvieno puslapio data pateikiama Lietuvos laiku.</p><p class="horoscope-hub-hero__date"><span>Tekstų data</span><time datetime="#{escape(daily['local_date'])}">#{escape(date_label)}</time></p></div><div class="horoscope-hub-hero__art"><img src="/assets/visuals/zodiac-wheel.svg" width="180" height="180" alt="" aria-hidden="true" decoding="async"><div><strong>12 ženklų</strong><span>Vienas aiškus dienos skaitymas kiekvienam</span></div></div></section>
      <div class="horoscope-hub-intro"><p><strong>Kaip skaityti:</strong> pasirinkite Vakarų tropinio zodiako ženklą ir peržiūrėkite tos dienos bendro pobūdžio tekstą. Ženklo datų ribos yra orientacinės; jei gimimo data patenka į ribinę dieną, vien pagal kalendorinę datą tikslaus astrologinio ženklo nustatyti negalima.</p></div>
      #{notice(daily, date_label)}
      <section class="horoscope-directory" aria-labelledby="horoscope-directory-title"><div class="horoscope-section-heading"><div><p class="horoscope-kicker">Pasirinkite ženklą</p><h2 id="horoscope-directory-title">Šios dienos horoskopai</h2></div><span class="horoscope-directory__count">12 ženklų</span></div><div class="horoscope-card-grid">#{cards}</div></section>
      <section class="horoscope-about" aria-labelledby="horoscope-about-title"><p class="horoscope-kicker">Apie šį puslapį</p><h2 id="horoscope-about-title">Dienos tekstai pramogai ir apmąstymui</h2><p>Vakarų tropinio zodiako ženklai šiame puslapyje pateikti kaip kultūrinė astrologijos sistema. Horoskopai nėra astronominiai matavimai ar mokslu pagrįstos asmeninės prognozės. Tekstuose nepateikiami išgalvoti planetų aspektai, sveikatos diagnozės, finansiniai nurodymai ar garantuotos baigtys.</p><p>Šiuo metu svetainėje nėra patvirtinto lietuviško horoskopų sindikavimo srauto. Todėl šis pirmasis rinkinys yra originalus ir pažymėtas DI pagalbos bei žmogaus kalbos redaktoriaus peržiūros būsena. Naujausi tekstai rodomi su tikrąja rinkinio data; kasdienis žmogaus redakcinis atnaujinimas nėra automatizuotas.</p></section>
      <nav class="horoscope-related" aria-label="Kiti kalendoriaus įrankiai"><a href="/sventes/">Lietuvos šventės</a><a href="/menulio-fazes/">Mėnulio fazės</a><a href="/saule/">Saulės laikai</a><a href="/atostogu-planavimas/">Atostogų planavimas</a></nav>
      <p class="horoscope-disclaimer">Horoskopas yra bendro pobūdžio pramoginis tekstas ir savirefleksijos pasiūlymas. Jis nėra mokslinė prognozė, asmeninė konsultacija ar patarimas priimant sveikatos, teisės, finansų ar kitus svarbius sprendimus.</p></div>)
    write_page('horoskopai', "Dienos horoskopai – #{month_title}", hub_description, hub)

    @signs.each do |sign|
      forecast = forecasts.fetch(sign.fetch('key'))
      title = "#{sign.fetch('genitive')} dienos horoskopas – #{month_title}"
      description = "#{sign.fetch('genitive')} dienos horoskopas #{month_title}: #{forecast.fetch('editorial_heading')}. Bendra dienos nuotaika, santykiai, veikla ir praktinis patarimas."
      body = sign_body(sign, forecast, daily, date_label)
      write_page("horoskopai/#{sign.fetch('key')}", title, description, body, 'sign_key' => sign.fetch('key'), 'content_date' => daily.fetch('local_date'))
    end
  end
end
