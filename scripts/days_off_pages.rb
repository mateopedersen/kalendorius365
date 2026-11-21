# frozen_string_literal: true

module DaysOffPages
  MONTHS = Kalendorius::DATA.fetch('months')
  WEEKDAYS = Kalendorius::DATA.fetch('weekdays')

  def generate_days_off(year)
    days = (Date.new(year, 1, 1)..Date.new(year, 12, 31)).to_a
    holidays = Kalendorius.holidays(year).group_by { |holiday| Date.iso8601(holiday.fetch('date')) }
    weekdays = holidays.keys.count { |date| date.cwday <= 5 }
    off = days.select { |date| date.cwday >= 6 || holidays.key?(date) }
    weekends = off.slice_when { |left, right| right != left + 1 }.select { |period| period.size >= 3 }
    title = "Nedarbo Dienos #{year}"
    description = "Laisvos dienos #{year} m. Lietuvoje: #{holidays.size} šventinių datų, #{weekdays} iš jų darbo dienomis. Visų mėnesių kalendorius ir ilgieji savaitgaliai."
    art = Pages::EDITORIAL.fetch('media').fetch('statehood-gediminas')
    year_links = Pages::HOLIDAY_YEARS.map do |other|
      %(<a href="/nedarbo-dienos/#{other}/"#{' aria-current="page"' if other == year}>#{other}</a>)
    end.join

    html = <<~HTML
      <div class="days-off">
        <section class="days-off-hero" aria-labelledby="days-off-title">
          <img class="days-off-hero__photo" src="#{esc(art.fetch('src'))}" srcset="#{esc(art.fetch('srcset'))}" sizes="(max-width: 660px) 100vw, 52vw" width="#{art.fetch('width')}" height="#{art.fetch('height')}" alt="Gedimino prospektas Vilniuje, papuoštas Lietuvos vėliavomis Valstybės dienai." decoding="async" fetchpriority="high">
          <div class="days-off-hero__copy">
            <p class="days-off-hero__scope">Lietuva <span aria-hidden="true">·</span> 5 darbo dienų savaitė</p>
            <h1 id="days-off-title">Nedarbo Dienos <span>#{year}</span></h1>
            <p>Laisvos dienos #{year} m. vienoje vietoje. Raskite valstybinių švenčių datas, peržiūrėkite metų kalendorių ir susiplanuokite ilgesnį poilsį.</p>
            <nav class="days-off-hero__actions" aria-label="#{year} m. nedarbo dienų skyriai">
              <a href="#sventines-dienos">Švenčių sąrašas</a>
              <a href="#kalendorius">Metų kalendorius</a>
            </nav>
          </div>
          <p class="days-off-hero__credit">Vilnius, 2023 m. <a href="#saltiniai">Nuotraukos autorystė</a></p>
        </section>

        <nav class="days-off-years" aria-label="Nedarbo dienos pagal metus">
          <span>Pasirinkite metus</span><div>#{year_links}</div>
        </nav>

        <dl class="days-off-stats">
          <div><dt>Laisvos dienos</dt><dd><strong>#{off.size}</strong><small>Savaitgaliai ir šventinės dienos</small></dd></div>
          <div><dt>Šventinės datos</dt><dd><strong>#{holidays.size}</strong><small>Darbo kodekse nustatytos dienos</small></dd></div>
          <div><dt>Šventės per darbo savaitę</dt><dd><strong>#{weekdays}</strong><small>Pirmadienį–penktadienį</small></dd></div>
          <div><dt>Ilgieji savaitgaliai</dt><dd><strong>#{weekends.size}</strong><small>Nuo 3 laisvų dienų iš eilės</small></dd></div>
        </dl>

        <section class="days-off-section days-off-weekends" id="ilgieji-savaitgaliai" aria-labelledby="days-off-weekends-title">
          <header class="days-off-heading">
            <div><h2 id="days-off-weekends-title">Ilgieji savaitgaliai #{year} m.</h2><p>Trijų ar daugiau laisvų dienų laikotarpiai #{year} metais pagal penkių dienų darbo savaitę. Šiais laikotarpiais atostogų dienų imti nereikia.</p></div>
            <a class="days-off-link" href="/atostogu-planavimas/">Planuoti atostogas <span aria-hidden="true">↗</span></a>
          </header>
          <ul class="days-off-weekends__grid">
            #{weekends.map { |period| days_off_weekend(period, holidays) }.join}
          </ul>
        </section>

        <section class="days-off-section" id="sventines-dienos" aria-labelledby="days-off-holidays-title">
          <header class="days-off-heading">
            <div><h2 id="days-off-holidays-title">Šventinės nedarbo dienos #{year} m.</h2><p>Visos #{holidays.size} oficialios datos ir savaitės dienos. Pasirinkę šventę rasite jos istoriją ir reikšmę.</p></div>
            <a class="days-off-link" href="#kalendorius">Rodyti kalendorių <span aria-hidden="true">↓</span></a>
          </header>
          <ul class="days-off-holidays">
            #{holidays.map { |date, entries| days_off_holiday(date, entries) }.join}
          </ul>
        </section>

        <section class="days-off-section" id="kalendorius" aria-labelledby="days-off-calendar-title">
          <header class="days-off-heading">
            <div><h2 id="days-off-calendar-title">Laisvų dienų kalendorius #{year} m.</h2><p>Kiekviename mėnesyje pažymėti šeštadieniai, sekmadieniai ir šventinės datos. Pasirinkite šventinę dieną, kad rastumėte ją sąraše.</p></div>
            <a class="days-off-link" href="/#{year}/">Atsisiųsti metų kalendorių <span aria-hidden="true">↗</span></a>
          </header>
          <div class="days-off-legend" aria-label="Kalendoriaus žymėjimas"><span>Savaitgalis</span><span>Šventinė diena</span></div>
          <div class="days-off-months">
            #{(1..12).map { |month| days_off_month(year, month, off, holidays) }.join}
          </div>
        </section>

        #{days_off_notes(year, off.size, weekdays, holidays, weekends, art)}
      </div>
    HTML
    page("nedarbo-dienos/#{year}", "#{title} (laisvos dienos Lietuvoje)", description, html)
  end

  def days_off_date(date)
    "#{MONTHS.fetch(date.month - 1).fetch(2)} #{date.day} d."
  end

  def days_off_range(dates)
    first, last = dates.values_at(0, -1)
    return "#{days_off_date(first)} – #{days_off_date(last)}" unless first.month == last.month

    "#{MONTHS.fetch(first.month - 1).fetch(2)} #{first.day}–#{last.day} d."
  end

  def days_off_weekend(period, holidays)
    festive = period.flat_map { |date| holidays.fetch(date, []) }
    range = days_off_range(period)
    %(<li><article class="days-off-break"><div class="days-off-break__length"><strong>#{period.size}</strong><span>dienos</span></div><h3>#{range}</h3><p>#{esc(festive.map { |holiday| holiday.fetch('name') }.join(' · '))}</p><a href="#laisva-#{festive.first.fetch('date')}">Šventės datos <span aria-hidden="true">↓</span></a></article></li>)
  end

  def days_off_holiday(date, entries)
    names = entries.map do |holiday|
      name = esc(holiday.fetch('name'))
      url = holiday_page_url(holiday.fetch('id'))
      url ? %(<a href="#{esc(url)}">#{name}</a>) : name
    end.join(' · ')
    day = date.cwday >= 6 ? 'Savaitgalis' : 'Darbo savaitė'
    <<~HTML
      <li id="laisva-#{date.iso8601}" class="days-off-date">
        <time datetime="#{date.iso8601}"><strong>#{date.day}</strong><span>#{MONTHS.fetch(date.month - 1).fetch(2)}</span></time>
        <div><h3>#{names}</h3><p>#{Pages::WEEKDAY_NAMES.fetch(date.cwday - 1)}</p></div>
        <span class="days-off-date__type#{' days-off-date__type--weekend' if date.cwday >= 6}">#{day}</span>
      </li>
    HTML
  end

  def days_off_month(year, month, off, holidays)
    slug, name = MONTHS.fetch(month - 1)
    calendar = Kalendorius.month(year, month)
    cells = calendar.fetch('grid').take(calendar.fetch('weeks') * 7).map do |day|
      next '<td></td>' unless day.fetch('inMonth')

      date = Date.iso8601(day.fetch('date'))
      entries = holidays[date]
      label = "#{days_off_date(date)} #{Pages::WEEKDAY_NAMES.fetch(date.cwday - 1)}"
      time = %(<time datetime="#{date.iso8601}">#{date.day}</time>)
      if entries
        label += " · #{entries.map { |entry| entry.fetch('name') }.join(' · ')}"
        %(<td class="days-off-month__holiday"><a href="#laisva-#{date.iso8601}" aria-label="#{esc(label)}" title="#{esc(label)}">#{time}</a></td>)
      else
        %(<td#{' class="days-off-month__weekend"' if date.cwday >= 6}>#{time}</td>)
      end
    end
    rows = cells.each_slice(7).map { |week| "<tr>#{week.join}</tr>" }.join
    columns = WEEKDAYS.zip(Pages::WEEKDAY_NAMES).map { |short, long| %(<th scope="col" aria-label="#{long}">#{short}</th>) }.join
    <<~HTML
      <article class="days-off-month">
        <header><h3><a href="/#{year}/#{slug}/">#{name}</a></h3><span>#{off.count { |date| date.month == month }} laisv. d.</span></header>
        <table><caption class="visually-hidden">#{year} m. #{name}</caption><thead><tr>#{columns}</tr></thead><tbody>#{rows}</tbody></table>
      </article>
    HTML
  end

  def days_off_notes(year, total, weekdays, holidays, weekends, art)
    easter = Kalendorius.easter(year)
    winter = days_off_range((Date.new(year, 12, 24)..Date.new(year, 12, 26)).to_a)
    longest = weekends.max_by(&:size)
    bridge_dates = holidays.keys.filter_map do |date|
      case date.cwday
      when 2 then date - 1
      when 4 then date + 1
      end
    end
    bridge_date = bridge_dates.find { |date| date.year == year && !holidays.key?(date) }
    bridge_text = if bridge_date
      start = bridge_date.monday? ? bridge_date - 2 : bridge_date - 1
      finish = start + 3
      "<p>Jei galite pasiimti vieną atostogų dieną #{days_off_date(bridge_date).delete_suffix(' d.')} dieną, #{days_off_range([start, finish])} susidarys bent keturios laisvos dienos iš eilės.</p>"
    else
      ''
    end
    law_url = esc(Pages::EDITORIAL.fetch('sources').fetch('labour-code-2027').fetch('url'))
    <<~HTML
      <div class="days-off-extras">
        <section class="days-off-section" aria-labelledby="days-off-plan-title">
          <h2 id="days-off-plan-title">Kaip planuoti laisvas dienas #{year} m.?</h2>
          <p>Velykos bus #{days_off_date(easter)}, antroji Velykų diena – #{days_off_date(easter + 1)}. Kūčių ir Kalėdų šventinės dienos – #{winter}. Ilgiausias metų laisvų dienų laikotarpis trunka #{longest.size} d. (#{days_off_range(longest)}).</p>
          #{bridge_text}
          <nav class="days-off-related" aria-label="Susiję #{year} m. kalendoriai">
            <a class="days-off-link" href="/darbo-dienos/#{year}/">Darbo dienos ir valandos <span aria-hidden="true">↗</span></a>
            <a class="days-off-link" href="/sventes/#{year}/">Šventės ir atmintinos dienos <span aria-hidden="true">↗</span></a>
          </nav>
        </section>
        <section class="days-off-section" aria-labelledby="days-off-faq-title">
          <h2 id="days-off-faq-title">Dažniausi klausimai</h2>
          <details><summary>Kiek laisvų dienų yra #{year} metais?</summary><p>Dirbant pirmadienį–penktadienį yra #{total} laisvos dienos. Į šį skaičių įeina savaitgaliai ir #{weekdays} šventinės dienos, tenkančios darbo savaitei.</p></details>
          <details><summary>Ar savaitgalį sutapusi šventė perkeliama?</summary><p>Pagal bendrąją taisyklę savaitgalį sutapusi šventė į pirmadienį automatiškai neperkeliama. Skaičiuodami laisvas dienas tą pačią datą įtraukiame vieną kartą.</p></details>
          <details><summary>Ar visiems galioja tos pačios poilsio dienos?</summary><p>Kalendorius sudarytas pagal penkių dienų darbo savaitę. Dirbant pamainomis arba šešias dienas per savaitę, poilsio dienos gali skirtis. Savo grafiką galite palyginti su <a href="/darbo-dienos/#{year}/">darbo dienų suvestine</a>.</p></details>
        </section>
      </div>

      <section class="days-off-sources" id="saltiniai" aria-labelledby="days-off-sources-title">
        <h2 id="days-off-sources-title">Kaip sudarytas kalendorius</h2>
        <p>Šventinės dienos remiasi <a href="#{law_url}" rel="noopener">Darbo kodekso 123 straipsniu</a> pagal paskelbtą redakciją nuo 2027 m. sausio 1 d. Velykų, Motinos ir Tėvo dienų datos apskaičiuotos pagal #{year} m. kalendorių. Ilgieji savaitgaliai skaičiuojami #{year} m. ribose. Pasikeitus teisės aktams, būsimos datos gali keistis.</p>
        <p>Nuotrauka: #{esc(art.fetch('author'))}, <a href="#{esc(art.fetch('commons_url'))}" rel="noopener">Gedimino prospektas prieš 2023 m. Valstybės dieną</a>, <a href="#{esc(art.fetch('license_url'))}" rel="license noopener">#{esc(art.fetch('license_name'))}</a>. Nuotrauka sumažinta ir apkarpoma pagal ekrano plotį.</p>
      </section>
    HTML
  end
end
