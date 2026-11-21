# frozen_string_literal: true

require 'cgi'
require 'date'
require 'json'

module Jekyll
  class RelatedReading < Generator
    MOON_PHASES = 'https://aa.usno.navy.mil/data/MoonPhases'
    SUN_AND_MOON = 'https://aa.usno.navy.mil/data/RS_OneDay'
    LEAP_YEARS = 'https://aa.usno.navy.mil/faq/leap_years'
    ICALENDAR = 'https://www.rfc-editor.org/rfc/rfc5545.html'
    PDF_PRINT = 'https://helpx.adobe.com/acrobat/desktop/print-documents/set-up-and-print-pdfs/page-size.html'
    WEATHER_WARNINGS = 'https://www.meteo.lt/prognozes/pavojingi-reiskiniai/'
    ISO_DATE = 'https://www.iso.org/standard/70907.html'
    COMMEMORATION_LAW = 'https://e-seimas.lrs.lt/portal/legalAct/lt/TAD/TAIS.41597/asr'

    HOLIDAY_TOPICS = [
      %w[lietuvos-zydu-genocido-atminimo-diena lietuvos-zydu-gelbetoju-diena tarptautine-holokausto-auku-atminimo-diena],
      %w[gedulo-ir-vilties-diena okupacijos-ir-genocido-diena laisves-diena],
      %w[vasario-16-oji kovo-11-oji valstybes-diena lietuvos-veliavos-diena],
      %w[1791-metu-konstitucijos-diena konstitucijos-diena abieju-tautu-tarpusavio-izado-diena],
      %w[baltijos-kelio-diena laisves-diena baltu-vienybes-diena],
      %w[knygnesio-diena spaudos-atgavimo-kalbos-ir-knygos-diena lituanistines-mokyklos-diena],
      %w[velykos velyku-antroji-diena atvelykis verbos didysis-penktadienis],
      %w[adventas kucios kaledos trys-karaliai],
      %w[jonines sv-jono-diena vasaros-saulegriza],
      %w[visu-sventuju-diena velines antrojo-pasaulinio-karo-auku-atminimo-diena]
    ].freeze

    HOLIDAY_REFERENCES = {
      'lietuvos-istojimo-i-europos-sajunga-diena' => ['https://european-union.europa.eu/principles-countries-history/eu-countries/lithuania_lt', 'Lietuva Europos Sąjungoje (ES šalies profilis)'],
      'lietuvos-istojimo-i-nato-diena' => ['https://www.nato.int/en/news-and-events/articles/news/2004/03/29/seven-new-members-join-nato', 'NATO pranešimas apie Lietuvos įstojimą'],
      'lietuvos-istojimo-i-jungtines-tautas-diena' => ['https://digitallibrary.un.org/record/282468', 'JT Saugumo Tarybos rezoliucija dėl Lietuvos (1991 m.)'],
      'pasauline-sveikatos-diena' => ['https://www.who.int/campaigns/world-health-day', 'Pasaulinė sveikatos diena (PSO)'],
      'pasauline-intelektines-nuosavybes-diena' => ['https://www.wipo.int/en/web/ipday', 'Pasaulinė intelektinės nuosavybės diena (WIPO)']
    }.freeze

    HOLIDAY_COMPANIONS = {
      'baltijos-kelio-diena' => '/blogas/baltijos-kelias-rugpjucio-23/',
      'gandrines' => '/blogas/gandrines-ir-pavasario-stebejimai/',
      'jonines' => '/vasaros-saulegriza/',
      'kaledos' => '/renginiai/kaledos-sostineje/',
      'velines' => '/blogas/veliniu-lapkricio-kalendorius/'
    }.freeze

    GUIDE_LINKS = {
      'baltijos-kelias-rugpjucio-23' => %w[/sventes/baltijos-kelio-diena/ /sventes/2027/rugpjutis/ /sventes/laisves-diena/],
      'gandrines-ir-pavasario-stebejimai' => %w[/sventes/gandrines/ /pavasario-lygiadienis/ /dienos-ilgumas/],
      'juros-sventes-savaitgalio-planas' => [
        ['/orai/klaipeda/#savaitgalio-orai', 'Savaitgalio orai Klaipėdoje'],
        ['/orai/klaipeda/#orai-keliuose', 'Kelių būklė Klaipėdos apylinkėse'],
        '/saule/klaipeda/'
      ],
      'kaziuko-muges-kalendorius' => %w[/renginiai/kaziuko-muge/ /orai/vilnius/ /saule/vilnius/],
      'veliniu-lapkricio-kalendorius' => %w[/sventes/velines/ /sventes/visu-sventuju-diena/ /sventes/2027/lapkritis/ /orai/miestai/]
    }.freeze

    TOOL_LINKS = {
      '/atgalinis-skaiciavimas/' => %w[/datos-skaiciuokle/ /metu-diena/ /mano-diena/],
      '/duk/' => %w[/pdf-kalendoriai/ /oru-saltiniai/ /nuotrauku-licencijos/],
      '/keliamieji-metai/' => %w[/2028/vasaris/ /metu-diena/ /datos-skaiciuokle/],
      '/mano-diena/' => %w[/dienos-planuoklis/ /seimos-kalendorius/ /savaites/],
      '/metu-diena/' => %w[/keliamieji-metai/ /savaites/ /atgalinis-skaiciavimas/],
      '/nuotrauku-licencijos/' => %w[/oru-saltiniai/#miestu-nuotraukos /orai/miestai/ /redakcine-politika/],
      '/pdf-kalendoriai/' => %w[/menesiai/ /kurti-kalendoriu/ /tuscias-kalendorius/],
      '/sejos-kalendorius/' => %w[/orai/savivaldybes/ /dienos-ilgumas/ /menulio-fazes/],
      '/svetaines-zemelapis/' => %w[/orai/miestai/ /oru-saltiniai/ /nuotrauku-licencijos/],
      '/atmintinos-dienos/' => %w[/sventes/ /blogas/sventines-ir-atmintinos-dienos/ /sventes/2027/],
      '/renginiai/' => %w[/orai/miestai/ /saule/ /ilgieji-savaitgaliai/],
      '/blogas/' => %w[/renginiai/ /atmintinos-dienos/ /sventes/2027/]
    }.freeze

    CIVIC_LINKS = {
      'hub' => %w[/seimos-kalendorius/ /datos-skaiciuokle/],
      'pension' => %w[/datos-skaiciuokle/ /atgalinis-skaiciavimas/],
      'tax' => %w[/darbo-dienos/2027/ /pamainu-grafikas/],
      'child' => %w[/seimos-kalendorius/ /mano-diena/],
      'birth' => %w[/datos-skaiciuokle/ /seimos-kalendorius/],
      'childcare' => %w[/datos-skaiciuokle/ /seimos-kalendorius/],
      'parents' => %w[/darbo-dienos/2027/ /atostogu-planavimas/],
      'nanny' => %w[/seimos-kalendorius/ /savaitiniai-planuokliai/],
      'job' => %w[/datos-skaiciuokle/ /mano-diena/],
      'sick' => %w[/datos-skaiciuokle/ /darbo-dienos/2027/],
      'social' => %w[/mano-diena/ /datos-skaiciuokle/],
      'heating' => %w[/metu-laikai/ /mano-diena/]
    }.freeze

    def generate(site)
      @data = site.data
      @pages = site.pages.to_h { |page| [page.url.sub(/index\.html\z/, ''), page] }
      @months = @data.fetch('calendar').fetch('months')
      @years = @data.fetch('calendar_years')
      registry = JSON.parse(File.read(File.join(site.source, 'assets/data/weather-places.json')))
      cities = registry.fetch('places').reject { |row| row[6].to_s.empty? }
      @cities = cities.to_h { |row| [row.fetch(6), row] }
      @cities_by_name = cities.to_h { |row| [row.fetch(1), row] }
      @weather_labels = cities.to_h { |row| ["/orai/#{row.fetch(0)}/", "Orai #{row.fetch(5)}"] }.merge(
        '/orai/miestai/' => 'Lietuvos miestų orai', '/orai/savivaldybes/' => 'Orai pagal savivaldybes'
      )
      @weather_labels['/orai/uzulenio-29832/'] = 'Orai Užulėnio kaime' if registry.fetch('places').any? { |row| row.first == 'uzulenio-29832' }
      @sun_weather_aliases = @cities.filter_map { |id, row| [id, row.first] if id != row.first }.to_h
      @holidays = @pages.filter_map do |route, page|
        next unless route.match?(%r{\A/sventes/[^/]+/\z})

        occurrences = occurrences_for(page)
        date = occurrences.find { |day| day.year == @years.first } || occurrences.first
        [route, date] if date
      end.to_h
      @holidays_by_month = @holidays.group_by { |_, date| date.month }
      @festivals = @data.fetch('lithuanian_dates').fetch('festivals').to_h { |event| [event.fetch('slug'), event] }

      @pages.each do |route, page|
        title, entries = links_for(route, page)
        next unless entries

        existing = page.content.scan(/<a\b[^>]*\bhref=["']([^"']+)["']/i).flatten.map { |href| CGI.unescapeHTML(href) }
        links = entries.filter_map do |href, label, marker|
          next if route == href || existing.include?(href)
          destination = href.split(/[?#]/, 2).first
          next unless href.start_with?('https://') || @pages.key?(destination) || @weather_labels.key?(destination)

          { 'href' => href, 'label' => label || page_label(href), 'marker' => marker }
        end.uniq { |item| item.fetch('href') }
        page.data['related_reading'] = { 'title' => title, 'links' => links } unless links.empty?
      end
    end

    private

    def occurrences_for(page)
      occurrences = page.data['event_calendar_occurrences'] ||
                    @data.fetch('local_date_calendar')[page.data['local_date_slug']]
      Array(occurrences).map { |occurrence| Date.iso8601(occurrence.fetch('start').to_s) }
    end

    def page_label(href)
      destination = href.split(/[?#]/, 2).first
      return @weather_labels.fetch(destination) if @weather_labels.key?(destination)

      data = @pages.fetch(destination).data
      data['breadcrumb_label'] || data.fetch('title')
    end

    def holiday_links(route, date, page)
      slug = route.split('/').last
      month, _name, genitive = @months.fetch(date.month - 1)
      topic = HOLIDAY_TOPICS.find { |slugs| slugs.include?(slug) } || []
      links = topic.filter_map do |related|
        href = "/sventes/#{related}/"
        [href] if href != route && @pages.key?(href)
      end
      if links.size < 2
        month_neighbours = @holidays_by_month.fetch(date.month).reject { |href, other| href == route || other.day == date.day }
        links.concat(month_neighbours.sort_by { |href, other| [(date.day - other.day).abs, href] }
          .first(2 - links.size).map { |href, _| [href] })
      end
      links.concat([
        ["/#{date.year}/#{month}/", "#{date.year} m. #{genitive} kalendorius"],
        ["/sventes/#{date.year}/#{month}/", "Kitos #{genitive} šventės ir atmintinos dienos"]
      ])
      links << [HOLIDAY_COMPANIONS.fetch(slug)] if HOLIDAY_COMPANIONS.key?(slug)
      source = HOLIDAY_REFERENCES[slug]
      source ||= [COMMEMORATION_LAW, 'Lietuvos Respublikos atmintinų dienų įstatymas'] if
        page.data['local_date_type'] == 'commemorations' || page.content.include?('TAR.D570962773F8')
      links << source if source
      ['Susijusios datos ir šaltiniai', links]
    end

    def festival_links(page, event)
      city = @cities_by_name[event.fetch('city')]
      city ||= @cities['ukmerge'] if event.fetch('slug') == 'kilkim-zaibu'
      date = occurrences_for(page).find { |day| @years.include?(day.year) }
      local = city ? [
        ["/orai/#{city[0]}/#oru-prognoze", "Orų prognozė #{city[5]}"],
        ["/saule/#{city[6]}/", "Saulėlydžio laikas #{city[5]}"]
      ] : [['/orai/miestai/', 'Orų prognozės renginio miestui']]
      if event.fetch('slug') == 'kilkim-zaibu'
        local[0] = ['/orai/uzulenio-29832/#oru-prognoze', 'Orų prognozė Užulėnio kaime']
      end
      nearby = @festivals.values.select { |other| other['city'] == event['city'] && other != event }
      if (related = nearby.min_by { |other| [(other['start'].to_s[5, 2].to_i - event['start'].to_s[5, 2].to_i).abs, other['slug']] })
        local << ["/renginiai/#{related.fetch('slug')}/", related.fetch('title')]
      end
      local << ["/#{date.year}/#{@months.fetch(date.month - 1).first}/"] if date
      ['Planuojant išvyką į renginį', local]
    end

    def month_links(year, slug)
      index = @months.index { |month| month.first == slug }
      return [] unless index

      month, _name, genitive = @months.fetch(index)
      start = Date.new(year.to_i, index + 1, 1)
      finish = start.next_month - 1
      [
        ["/#{year}/#{month}/", "#{year} m. #{genitive} kalendorius"],
        ["/sventes/#{year}/#{month}/", "#{genitive.capitalize} šventės ir atmintinos dienos"],
        ["/menulio-kalendorius/#{year}/#{month}/", "#{genitive.capitalize} Mėnulio kalendorius"],
        ["/datos-skaiciuokle/?nuo=#{start}&iki=#{finish}&imtinai=1", "Skaičiuoti #{genitive} dienas ir darbo laiką"]
      ]
    end

    def year_links(year)
      [
        ["/#{year}/", "#{year} metų kalendorius"],
        ["/sventes/#{year}/", "#{year} m. šventės ir atmintinos dienos"],
        ["/menulio-kalendorius/#{year}/", "#{year} m. Mėnulio kalendorius"],
        ["/darbo-dienos/#{year}/", "#{year} m. darbo dienos ir valandos"],
        ["/savaites/#{year}/", "#{year} m. ISO savaitės"],
        ["/datos-skaiciuokle/?nuo=#{year}-01-01&iki=#{year}-12-31&imtinai=1", "Skaičiuoti #{year} m. dienas"]
      ]
    end

    def links_for(route, page)
      return holiday_links(route, @holidays.fetch(route), page) if @holidays.key?(route)
      if page.data['local_date_type'] == 'festivals'
        return festival_links(page, @festivals.fetch(page.data.fetch('local_date_slug')))
      end
      if CIVIC_LINKS.key?(page.data['civic'])
        return ['Planavimo priemonės', CIVIC_LINKS.fetch(page.data['civic']).map { |href| [href] }]
      end
      if route == '/saule/' || (route.start_with?('/saule/') && @cities.key?(route.split('/').last))
        city = @cities.fetch(route == '/saule/' ? 'vilnius' : route.split('/').last)
        page.data['sun_weather_aliases'] = @sun_weather_aliases
        return ['Orai ir dienos šviesa', [
          ["/orai/#{city[0]}/", "Orai #{city[5]}", 'sun-weather'],
          ['/dienos-ilgumas/', 'Dienos ilgumo palyginimas'],
          [SUN_AND_MOON, 'JAV karinio jūrų laivyno observatorijos laikų patikra']
        ]]
      end
      if page.data['horoscope']
        entries = [['/zodiakas/#palyginti', 'Palyginti Zodiako ženklus'], ['/zodiakas/#astrologija-ir-astronomija', 'Astrologija ir astronomija']]
        docs = @data.fetch('horoscope_current')['source_docs_url']
        entries << [docs, '„AstroWay“ skaičiavimų dokumentacija'] if docs
        return ['Zodiako ženklai ir tekstų metodika', entries]
      end
      if (match = route.match(%r{\A/(?:sventes/|menulio-kalendorius/)?(202[789]|2030)/([^/]+)/\z}))
        return ['To paties mėnesio kalendoriai', month_links(match[1], match[2])]
      end
      if (match = route.match(%r{\A/(?:sventes/|menulio-kalendorius/|darbo-dienos/|savaites/)?(202[789]|2030)/\z}))
        entries = year_links(match[1])
        entries << [ISO_DATE, 'ISO 8601 datos ir laiko standartas'] if route.start_with?('/savaites/')
        return ["Kiti #{match[1]} m. kalendoriai", entries]
      end
      if route == '/savaites/'
        return ['Kalendoriai pagal savaites', year_links(@years.last) + [[ISO_DATE, 'ISO 8601 datos ir laiko standartas']]]
      end
      if route == '/menulio-kalendorius/'
        return ['Mėnulio stebėjimo planas', [['/orai/miestai/', 'Debesuotumas Lietuvos miestuose'], ['/saule/', 'Saulėlydis ir prieblanda'], [MOON_PHASES, 'Pirminė Mėnulio fazių lentelė (USNO)']]]
      end
      if (paths = GUIDE_LINKS[page.data['blog_slug']])
        return ['Datos ir įrankiai iš šio gido', paths.map { |link| Array(link) }]
      end
      return unless (paths = TOOL_LINKS[route])

      entries = paths.map { |href| [href] }
      case route
      when '/keliamieji-metai/', '/metu-diena/'
        entries << [LEAP_YEARS, 'Grigaliaus kalendoriaus keliamųjų metų taisyklė (USNO)']
      when '/mano-diena/'
        entries << [ICALENDAR, 'Kalendoriaus įrašų formatas „iCalendar“ (RFC 5545)']
      when '/pdf-kalendoriai/', '/duk/'
        entries << [PDF_PRINT, 'PDF spausdinimo parinktys („Adobe Acrobat“)']
      when '/renginiai/', '/sejos-kalendorius/'
        entries << [WEATHER_WARNINGS, 'LHMT perspėjimai apie pavojingus orus']
      when '/svetaines-zemelapis/'
        entries << ['https://www.sitemaps.org/protocol.html', 'XML svetainių žemėlapių protokolas']
      end
      ['Susiję puslapiai ir šaltiniai', entries]
    end
  end
end
