# frozen_string_literal: true
# Two isolated future publications exercise the actual production generators.
# No provider calls and no modification of the real published daily dataset.
require 'tmpdir'
require 'fileutils'
require 'digest'
require 'json'
require_relative '../lib/zodiac_pages'
require_relative '../lib/horoscopes_pages'
source_root = File.expand_path('..', __dir__)
before = Digest::SHA256.file(File.join(source_root, 'site/_data/horoscope_current.json')).hexdigest
report = []
Dir.mktmpdir('zodiac-generator-', ENV.fetch('K365_QA_TMP') { Dir.tmpdir }) do |sandbox|
  %w[site/_data site/assets/data site/assets/visuals site/assets/visuals/zodiac].each { |dir| FileUtils.mkdir_p(File.join(sandbox, dir)) }
  %w[horoscope_signs.json zodiac_profiles.json horoscope_current.json].each { |name| FileUtils.cp(File.join(source_root, 'site/_data', name), File.join(sandbox, 'site/_data', name)) }
  FileUtils.cp(Dir.glob(File.join(source_root, 'site/assets/visuals/zodiac/*.svg')), File.join(sandbox, 'site/assets/visuals/zodiac'))
  [ZodiacPages, HoroscopesPages].each { |mod| mod.send(:remove_const, :ROOT); mod.const_set(:ROOT, sandbox) }
  HoroscopesPages.send(:remove_const, :SIGN_PATH)
  HoroscopesPages.const_set(:SIGN_PATH, File.join(sandbox, 'site/_data/horoscope_signs.json'))
  HoroscopesPages.send(:remove_const, :DAILY_PATH)
  HoroscopesPages.const_set(:DAILY_PATH, File.join(sandbox, 'site/_data/horoscope_current.json'))
  ZodiacPages.run
  guide_hash = Digest::SHA256.file(File.join(sandbox, 'site/zodiakas/index.html')).hexdigest
  profiles = ZodiacPages.catalog.to_h { |sign| [sign['key'], ZodiacPages.evergreen_profile(sign['key'])] }
  base = JSON.parse(File.read(HoroscopesPages::DAILY_PATH))
  %w[2026-10-18 2027-01-01].each_with_index do |date, index|
    daily = Marshal.load(Marshal.dump(base))
    daily['local_date'] = daily['source_publication_date'] = date
    daily['display_date_lt'] = HoroscopesPages.local_date_label(date)
    ENV['TZ'] = 'Europe/Vilnius'
    d = Date.iso8601(date); time = Time.local(d.year, d.month, d.day, 6, 20)
    daily['prepared_at_vilnius'] = time.iso8601
    daily['generated_at_utc'] = time.utc.iso8601
    daily['forecasts'].each { |forecast| forecast['tip'] += " Patikros scenarijus #{index + 1}." }
    daily['content_checksum'] = HoroscopesPages.checksum(daily['forecasts'])
    File.write(HoroscopesPages::DAILY_PATH, JSON.generate(daily))
    ZodiacPages.run
    HoroscopesPages.run
    raise 'Evergreen guide changed with daily forecast' unless Digest::SHA256.file(File.join(sandbox, 'site/zodiakas/index.html')).hexdigest == guide_hash
    profiles.each do |key, profile|
      page = File.read(File.join(sandbox, 'site/horoskopai', key, 'index.html'))
      raise "Mobile-safe sign artwork lost: #{key}" unless page.include?(%(src="/assets/visuals/zodiac/#{key}.svg?v=)) && !page.include?("zodiac-signs.svg#zodiac-#{key}")
      raise "Evergreen profile lost: #{key}" unless page.include?(profile)
      raise "Daily date lost: #{key}" unless page.include?(%(datetime="#{date}"))
      raise "Source metadata lost: #{key}" unless page.include?(%(content_date: "#{date}"))
      raise "Ascendant calculator lost: #{key}" unless page.include?('id="ascendant-form"')
      raise "Daily text lost: #{key}" unless page.include?("Patikros scenarijus #{index + 1}.")
      raise "Uppercase month after date label: #{key}" if page.match?(/Orientacinės datos: <strong>[A-ZĄČĘĖĮŠŲŪŽ]/)
      raise "Double date-abbreviation period: #{key}" if page.include?('d..')
      raise "Malformed Lithuanian Moon sentence returned: #{key}" if page.include?('Mėnulio akcentas: dėmesį')
      raise "Source-methodology link lost: #{key}" unless page.include?('href="/horoskopai/#horoscope-about-title"')
    end
    hub = File.read(File.join(sandbox, 'site/horoskopai/index.html'))
    raise 'Daily hub lost guide CTA' unless hub.include?('href="/zodiakas/"')
    raise 'Honest automation-method disclosure lost' unless hub.include?('Kaip parengiami dienos tekstai?') && hub.include?('Nepriklausomas gimtakalbis redaktorius jų neperžiūri.')
    report << { date: date, detail_pages: profiles.length, hub: true, guide_sha256: guide_hash,
                unchanged_profiles: profiles.length, real_daily_dataset_modified: false }
  end
end
raise 'Real daily data changed during fixture test' unless before == Digest::SHA256.file(File.join(source_root, 'site/_data/horoscope_current.json')).hexdigest
puts JSON.pretty_generate({ status: 'passed', isolated_future_publications: report })
