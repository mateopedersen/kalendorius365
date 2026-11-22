# frozen_string_literal: true

require 'json'

module Kalendorius
  module WeatherSitemap
    FILE = 'sitemap-orai.xml'
    BASE = 'https://kalendorius365.lt/orai/'
    ORIGIN = 'https://kalendorius365.lt'
    IMAGE_NS = 'http://www.google.com/schemas/sitemap-image/1.1'

    def self.write(public_dir:, registry_file:, release:)
      paths = []
      if release
        registry = JSON.parse(File.read(registry_file))
        paths = %w[miestai/ savivaldybes/]
        paths.concat(registry.fetch('municipalities').values.map { |entry| "savivaldybes/#{entry.fetch(0)}/" })
        paths.concat(registry.fetch('places').map { |entry| "#{entry.fetch(0)}/" })
        unless paths.uniq.size == paths.size && paths.size < 50_000 &&
               paths.all? { |path| path.match?(%r{\A(?:[a-z0-9-]+/){1,2}\z}) }
          abort 'Invalid or duplicate weather sitemap routes'
        end
      end
      city_images = JSON.parse(File.read(File.join(File.dirname(registry_file), '../../_data/weather_city_images.json')))
      entries = paths.map do |path|
        route = path.delete_suffix('/')
        photo = city_images[route]
        images = if photo
                   ["/assets/visuals/weather-share/#{route}-v1.jpg", photo.fetch('src')]
                 else
                   ["/oru-vaizdai/v1/#{route}.png"]
                 end
        photos = images.map { |image| "<image:image><image:loc>#{ORIGIN}#{image}</image:loc></image:image>" }.join
        "  <url><loc>#{BASE}#{path}</loc>#{photos}</url>"
      end
      File.write(File.join(public_dir, FILE), <<~XML)
        <?xml version="1.0" encoding="UTF-8"?>
        <urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9" xmlns:image="#{IMAGE_NS}">
        #{entries.join("\n")}
        </urlset>
      XML
      paths.length
    end
  end
end
