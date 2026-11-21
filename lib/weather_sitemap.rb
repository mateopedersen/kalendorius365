# frozen_string_literal: true

require 'json'

module Kalendorius
  module WeatherSitemap
    FILE = 'sitemap-orai.xml'
    BASE = 'https://kalendorius365.lt/orai/'

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
      File.write(File.join(public_dir, FILE), <<~XML)
        <?xml version="1.0" encoding="UTF-8"?>
        <urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">
        #{paths.map { |path| "  <url><loc>#{BASE}#{path}</loc></url>" }.join("\n")}
        </urlset>
      XML
      paths.length
    end
  end
end
