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
    if daily['source_provider_id'] == 'astroway-public-calculations-original-lithuanian'
      raise 'Wrong AstroWay calculation endpoint' unless daily['source_url'] == 'https://api.astroway.info/v1/public/horoscope/daily'
      raise 'AstroWay terms URL must be recorded' unless daily['source_terms_url'] == 'https://api.astroway.info/en/terms/'
      raise 'Provider horoscope text must not be requested' unless daily['source_text_requested'] == false
      raise 'Original provider footer attribution must be retained' unless daily['provider_footer'].to_s.start_with?('Powered by astroway.api')
      raise 'The licensed calculations-only field set must be recorded' unless daily['source_data_fields'] == %w[sign date transits aspects events]
      raise 'Only original Lithuanian copy derived from calculations may be published' unless daily['original_text_or_licensed_translation'] == 'original-lithuanian-copy-from-calculation-data'
      provenance = daily['source_provenance']
      raise 'Calculation provenance must contain all twelve signs' unless provenance.is_a?(Array) && provenance.length == 12 && provenance.map { |item| item['sign_key'] }.sort == EXPECTED.sort
      provenance.each do |item|
        raise 'Calculation response hash is invalid' unless item['response_sha256'].to_s.match?(/\A[0-9a-f]{64}\z/)
        raise 'Calculation house is outside 1–12' unless (1..12).cover?(item['solar_house']) && (1..12).cover?(item['lunar_house'])
      end
    elsif daily['source_provider_id'] == 'kalendorius365-original-editorial'
      raise 'Legacy original content provenance is inconsistent' unless daily['source_url'].nil? && daily['original_text_or_licensed_translation'] == 'original-text'
    else
      raise 'Unknown horoscope source provider'
    end
    raise 'Horoscope publication requires self-canonical content' unless daily['canonical_requirement'] == 'self-canonical'
    if daily['automation']
      automation = daily.fetch('automation')
      raise 'Automated horoscope publication must pass both QA gates' unless automation['qa_status'] == 'passed' && automation['deterministic_gate'] == 'passed' && automation['independent_content_gate'] == 'passed'
      raise 'Automated source, engine and terms provenance must be recorded' unless automation['provider'] && automation['engine'] && automation['terms_url']
      raise 'External horoscope prose must not be requested or used' unless automation['provider_text_requested'] == false && automation['provider_text_used'] == false
      raise 'Provider source footer must be preserved' unless automation['provider_footer_preserved'] == daily['provider_footer']
      raise 'Calculation-only fallback must not claim machine translation' unless automation['translation_model'].nil?
      raise 'Output locale and human proofread status must be explicit' unless automation['locale_output'] == 'lt-LT' && automation['native_human_proofread'] == false
      raise 'Both QA passes must be recorded' unless automation['qa_passes'].is_a?(Array) && automation['qa_passes'].length == 2
      raise 'Automated publication requires original calculation-derived Lithuanian copy' unless daily['source_provider_id'] == 'astroway-public-calculations-original-lithuanian'
      records.each do |record|
        body_words = %w[lead overview relationships work reflection tip].sum { |field| record.fetch(field).scan(/[\p{L}\p{N}]+/u).length }
        raise "Automated horoscope body for #{record['sign_key']} must contain 150–300 words" unless (150..300).cover?(body_words)
      end
      raise 'Automated editorial status must disclose that no native Lithuanian editor proofread it' unless daily['editorial_review_status'] == 'automated-rule-based-two-pass-review; native-human-proofread-not-performed'
    end
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
    origin = if daily['source_provider_id'] == 'astroway-public-calculations-original-lithuanian'
      'Lietuviški tekstai originaliai sugeneruoti pagal datą atitinkančius astrologinius skaičiavimus. AstroWay horoskopo tekstas nebuvo paimtas ar verstas. Automatinė patikra apėmė šaltinio duomenis, turinio struktūrą, teksto saugą ir pasikartojimus; gimtakalbis redaktorius jų neperžiūrėjo.'
    elsif daily['automation'] && daily.dig('automation', 'qa_status') == 'passed'
      'Tekstai sukurti automatiniu procesu ir įvertinti kalbos, nuoseklumo bei saugaus turinio taisyklėmis; žmogaus lietuvių kalbos redaktorius jų neperžiūrėjo.'
    else
      'Tekstai sukurti Kalendorius365.lt, DI naudotas rengiant pirmąjį variantą; nepriklausomas lietuvių kalbos redaktorius jų neperžiūrėjo.'
    end
    credit = if daily['source_provider_id'] == 'astroway-public-calculations-original-lithuanian'
      %(<span class="horoscope-editorial-note__source">Skaičiavimų šaltinis: <a href="https://api.astroway.info/" rel="noopener noreferrer">AstroWay /api</a>. #{escape(daily['provider_footer'])}</span>)
    else
      ''
    end
    %(<aside class="horoscope-editorial-note" aria-label="Turinio, šaltinio ir datos pastaba"><span class="horoscope-editorial-note__icon" aria-hidden="true">i</span><p><strong>Turinio pastaba.</strong> #{escape(origin)} #{credit} Horoskopai yra bendro pobūdžio, skirti pramogai ir apmąstymui. <span>Turinio data: <time datetime="#{escape(daily['local_date'])}">#{escape(date_label)}</time>; parengta <time datetime="#{escape(daily['prepared_at_vilnius'])}">#{escape(daily['prepared_at_display_lt'])}</time>.</span></p></aside>)
  end

  def forecast_card(sign, forecast, date_label)
    %(<article class="horoscope-card" style="--sign-accent: #{escape(sign['theme'])}"><a class="horoscope-card__link" href="/horoskopai/#{escape(sign['key'])}/" aria-label="#{escape(sign['genitive'])} dienos horoskopas: #{escape(date_label)}"><span class="horoscope-card__mark">#{mark(sign['key'])}</span><span class="horoscope-card__content"><span class="horoscope-card__eyebrow">#{escape(sign['element'])} <span aria-hidden="true">·</span> #{escape(sign['range'])}</span><strong class="horoscope-card__title">#{escape(sign['name'])}</strong><span class="horoscope-card__heading">#{escape(forecast['editorial_heading'])}</span><span class="horoscope-card__excerpt">#{escape(forecast['lead'])}</span><span class="horoscope-card__cta">#{escape(sign['genitive'])} dienos horoskopas <span aria-hidden="true">↗</span></span></span></a></article>)
  end

  def ascendant_art
    %(<svg viewBox="0 0 72 72" focusable="false"><defs><linearGradient id="ascendant-sky" x1="0" y1="0" x2="1" y2="1"><stop stop-color="#f4f8ff"/><stop offset="1" stop-color="#fff0d4"/></linearGradient><radialGradient id="ascendant-sun" cx=".35" cy=".25"><stop stop-color="#ffe17b"/><stop offset="1" stop-color="#eea72f"/></radialGradient></defs><circle cx="36" cy="36" r="33" fill="url(#ascendant-sky)" stroke="#ffffff" stroke-width="2"/><circle cx="36" cy="36" r="28" fill="none" stroke="#8ba0b5" stroke-opacity=".32"/><path d="M17 44a19 19 0 0 1 38 0" fill="none" stroke="#8ba0b5" stroke-opacity=".34" stroke-width="1.2"/><path d="M36 12v4m17 7-3 3M19 23l3 3M12 36h4m44 0h-4" stroke="#7590a8" stroke-width="1.4" stroke-linecap="round"/><path d="m36 8 1.6 3.3L41 13l-3.4 1.6L36 18l-1.6-3.4L31 13l3.4-1.7L36 8Z" fill="#d9a63c"/><path d="M24 44a12 12 0 0 1 24 0v2H24Z" fill="url(#ascendant-sun)"/><path d="M19 44h34" stroke="#087854" stroke-width="2.3" stroke-linecap="round"/><path d="M13 49c7-3 13-3 20 0s13 3 26-1M19 54c6-2 11-2 17 0s11 2 17 0" fill="none" stroke="#5f9c8b" stroke-opacity=".82" stroke-width="1.8" stroke-linecap="round"/><circle cx="16" cy="19" r="1.3" fill="#d9a63c"/><circle cx="57" cy="20" r="1.2" fill="#d9a63c"/></svg>)
  end

  def ascendant_calculator(sign)
    %(<section class="ascendant-calculator" aria-labelledby="ascendant-title" style="--sign-accent: #{escape(sign['theme'])}">
      <header class="ascendant-calculator__header"><span class="ascendant-calculator__art" aria-hidden="true">#{ascendant_art}</span><div><p class="horoscope-kicker">Saulės ženklas: #{escape(sign['name'])}</p><h2 id="ascendant-title">Norite sužinoti savo ascendentą?</h2><p class="ascendant-calculator__intro">Ascendentui apskaičiuoti reikalinga gimimo data, tikslus vietos laikas ir miestas. Įveskite duomenis – skaičiavimas vyksta šiame įrenginyje.</p></div></header>
      <form class="ascendant-form" id="ascendant-form">
        <div class="ascendant-form__field"><label for="birth-date">Gimimo data</label><input id="birth-date" name="birth-date" type="date" min="1900-01-01" required autocomplete="bday"></div>
        <div class="ascendant-form__field"><label for="birth-time">Gimimo laikas</label><input id="birth-time" name="birth-time" type="time" step="60" required autocomplete="off"><small>Įveskite laiką, nurodytą gimimo dokumentuose.</small></div>
        <div class="ascendant-form__field ascendant-form__field--city"><label for="birth-city">Gimimo miestas</label><input id="birth-city" name="birth-city" type="text" list="birth-city-options" placeholder="Pvz., Vilnius" required autocomplete="off" aria-describedby="birth-city-help"><datalist id="birth-city-options"></datalist><small id="birth-city-help">Pasirinkite artimiausią miestą iš sąrašo. Naudojamos apytikslės miesto centro koordinatės ir jo laiko juosta.</small></div>
        <button class="ascendant-form__submit" type="submit"><span>Apskaičiuoti ascendentą</span><span aria-hidden="true">↗</span></button>
      </form>
      <div class="ascendant-result" id="ascendant-result" role="status" aria-live="polite" tabindex="-1" hidden></div>
      <div class="ascendant-calculator__notes"><p><strong>Privatumas:</strong> gimimo data, laikas ir miesto pasirinkimas niekur nesiunčiami ir neišsaugomi.</p><details><summary>Kaip skaičiuojama?</summary><p>Naudojama Vakarų tropinė sistema: gimimo vietos koordinatės, vietos laiku nurodytas gimimo momentas, vietinis siderinis laikas ir ekliptikos pasvirimas. Siderinio laiko formulė – apytikslė; rezultatas nėra pilnas gimimo horoskopas. Penkių Lietuvos miestų koordinačių šaltinis – <a href="https://www.geonames.org/export/" target="_blank" rel="noopener noreferrer">GeoNames (CC BY)</a>; kitų miestų centro koordinatės taip pat apytikslės.</p><a href="https://aa.usno.navy.mil/faq/GAST" target="_blank" rel="noopener noreferrer">JAV Karinio jūrų laivyno observatorija: apytikslis siderinis laikas ↗</a></details></div>
    </section>)
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
      #{ascendant_calculator(sign)}
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
      <section class="horoscope-about" aria-labelledby="horoscope-about-title"><p class="horoscope-kicker">Apie šį puslapį</p><h2 id="horoscope-about-title">Dienos tekstai pramogai ir apmąstymui</h2><p>Vakarų tropinio zodiako ženklai šiame puslapyje pateikti kaip kultūrinė astrologijos sistema. Horoskopai nėra mokslu pagrįstos asmeninės prognozės. Tekstuose nepateikiami sveikatos diagnozės, finansiniai nurodymai ar garantuotos baigtys.</p><p>#{if daily['source_provider_id'] == 'astroway-public-calculations-original-lithuanian'; 'Lietuviškas tekstas kuriamas pagal šaltinyje pateiktus datos skaičiavimus ir redakcines taisykles; tiekėjo horoskopo proza nepaimama, neverčiama ir nekaupiama. Tekstas automatiškai patikrinamas, tačiau gimtakalbis lietuvių kalbos redaktorius kiekvienos dienos rinkinio netikrina.'; elsif daily['automation']; 'Originalūs tekstai kuriami automatiniu procesu ir prieš publikavimą tikrinami atskirais automatiniais etapais. Gimtakalbis redaktorius jų neperžiūrėjo.'; else; 'Šis originalus rinkinys parengtas DI pagalba. Naujausi tekstai rodomi su tikrąja rinkinio data; kasdienis atnaujinimas nėra automatizuotas.'; end} Rinkinys rodomas su tikrąja paskelbimo data; pasenęs tekstas nėra žymimas nauju.</p></section>
      <nav class="horoscope-related" aria-label="Kiti kalendoriaus įrankiai"><a href="/sventes/">Lietuvos šventės</a><a href="/menulio-fazes/">Mėnulio fazės</a><a href="/saule/">Saulės laikai</a><a href="/atostogu-planavimas/">Atostogų planavimas</a></nav>
      <p class="horoscope-disclaimer">Horoskopas yra bendro pobūdžio pramoginis tekstas ir savirefleksijos pasiūlymas. Jis nėra mokslinė prognozė, asmeninė konsultacija ar patarimas priimant sveikatos, teisės, finansų ar kitus svarbius sprendimus.</p></div>)
    write_page('horoskopai', "Dienos horoskopai – #{month_title}", hub_description, hub)

    @signs.each do |sign|
      forecast = forecasts.fetch(sign.fetch('key'))
      title = "#{sign.fetch('genitive')} dienos horoskopas – #{month_title}"
      description = "#{sign.fetch('genitive')} dienos horoskopas #{month_title}: #{forecast.fetch('editorial_heading')}. Santykiai, veikla ir dienos patarimas."
      body = sign_body(sign, forecast, daily, date_label)
      write_page("horoskopai/#{sign.fetch('key')}", title, description, body, 'sign_key' => sign.fetch('key'), 'content_date' => daily.fetch('local_date'))
    end
  end
end
