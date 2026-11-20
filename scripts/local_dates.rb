# frozen_string_literal: true

require 'date'
require 'fileutils'
require 'json'
require 'uri'

root = File.expand_path('..', __dir__)
catalog = JSON.parse(File.read(File.join(root, 'site/_data/lithuanian_dates.json')))
phase = JSON.parse(File.read(File.join(root, 'data/holiday-phase2.json')))
editorial = JSON.parse(File.read(File.join(root, 'data/holiday-editorial.json')))
published_days = (editorial.fetch('articles') + editorial.fetch('commemorations') + phase.fetch('articles')).to_h do |entry|
  [entry.fetch('slug'), entry.fetch('id')]
end

def escape_ics(value)
  value.gsub(/[\\,;]/) { |char| "\\#{char}" }.gsub(/\r?\n/, '\\n')
end

def write_event(root, folder, entry, start_date, last_date)
  slug = entry.fetch('slug')
  uid = "lt-#{slug}-#{start_date}@kalendorius365.lt"
  end_date = last_date + 1
  lines = [
    'BEGIN:VCALENDAR', 'VERSION:2.0', 'PRODID:-//Kalendorius365//LT//LT',
    'CALSCALE:GREGORIAN', 'METHOD:PUBLISH', 'BEGIN:VEVENT', "UID:#{uid}",
    'DTSTAMP:20261120T120000Z', "DTSTART;VALUE=DATE:#{start_date.strftime('%Y%m%d')}",
    "DTEND;VALUE=DATE:#{end_date.strftime('%Y%m%d')}", "SUMMARY:#{escape_ics(entry.fetch('title'))}",
    "DESCRIPTION:#{escape_ics(entry.fetch('summary'))}",
    "URL:https://kalendorius365.lt/#{folder}/#{slug}/", 'TRANSP:TRANSPARENT'
  ]
  lines << "LOCATION:#{escape_ics(entry['location'])}" if entry['location']
  lines.concat(%w[END:VEVENT END:VCALENDAR])
  folded = lines.flat_map do |line|
    parts = ['']
    line.each_char do |char|
      parts << ' ' if parts.last.bytesize + char.bytesize > 75
      parts[-1] += char
    end
    parts
  end
  destination = "assets/local-date-ics/#{slug}-#{start_date}.ics"
  path = File.join(root, 'site', destination)
  FileUtils.mkdir_p(File.dirname(path))
  File.binwrite(path, folded.join("\r\n") + "\r\n")
  { 'start' => start_date.iso8601, 'end_exclusive' => end_date.iso8601, 'ics' => "/#{destination}" }
end

groups = { 'festivals' => 'renginiai', 'commemorations' => 'sventes' }
dates = {}
credits = published_days.filter_map do |slug, id|
  image = phase.fetch('media')[id]
  next unless image
  {
    'id' => slug, 'page' => "/sventes/#{slug}/", 'src' => image.fetch('src'),
    'caption' => image.fetch('caption'), 'credit' => [image['author'], image['license']].join(' · '),
    'source' => image.fetch('commons_url'), 'license' => image.fetch('license_url'), 'changes' => image['changes']
  }
end

groups.each do |collection, folder|
  entries = catalog.fetch(collection)
  abort "Duplicate slug in #{collection}" unless entries.map { |entry| entry.fetch('slug') }.uniq.length == entries.length
  entries.each do |entry|
    slug = entry.fetch('slug')
    abort "Invalid slug: #{slug}" unless slug.match?(/\A[a-z0-9]+(?:-[a-z0-9]+)*\z/)
    entry.fetch('sources').each do |source|
      url = URI.parse(source.fetch('url'))
      abort "Invalid source: #{url}" unless url.scheme == 'https' && url.host
    end

    if collection == 'commemorations'
      month, day = entry.values_at('month', 'day')
      Date.new(2028, month, day)
      # These dates already have guides and calendar downloads in the holiday catalogue.
      next if published_days.key?(slug)
      dates[slug] = (2026..2030).map do |year|
        date = Date.new(year, month, day)
        write_event(root, folder, entry, date, date)
      end
    elsif entry['start']
      start_date = Date.iso8601(entry.fetch('start'))
      end_date = Date.iso8601(entry.fetch('end'))
      abort "Invalid event span: #{slug}" unless start_date <= end_date && start_date.year == entry.fetch('year')
      dates[slug] = [write_event(root, folder, entry, start_date, end_date)]
    end

    image = entry['image']
    if image
      abort "Missing image: #{slug}" unless File.file?(File.join(root, 'site', image.fetch('src').delete_prefix('/')))
      credits << image.merge('id' => slug, 'caption' => image.fetch('alt'), 'page' => "/#{folder}/#{slug}/")
    end
    front_matter = {
      'title' => "#{entry.fetch('title')}. Kada ir kur?",
      'description' => entry.fetch('summary'),
      'local_date_type' => collection,
      'local_date_slug' => slug,
      'preserve_source' => true,
      'hero_share' => true
    }
    front_matter.merge!(
      'og_image' => image.fetch('src'),
      'og_image_type' => 'image/webp',
      'og_image_alt' => image.fetch('alt'),
      'og_image_width' => image.fetch('width'),
      'og_image_height' => image.fetch('height')
    ) if image
    path = File.join(root, 'site', folder, slug, 'index.html')
    FileUtils.mkdir_p(File.dirname(path))
    File.write(path, "---\n#{front_matter.map { |key, value| "#{key}: #{value.to_json}" }.join("\n")}\n---\n{% include lithuanian-date.html %}\n")
  end
end
File.write(File.join(root, 'site/_data/local_date_calendar.json'), JSON.pretty_generate(dates) + "\n")
File.write(File.join(root, 'site/_data/photo_credits.json'), JSON.pretty_generate(credits) + "\n")
