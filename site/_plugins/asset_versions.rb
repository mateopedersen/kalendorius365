# frozen_string_literal: true

require 'digest'

module Jekyll
  class AssetVersions < Generator
    priority :highest

    def generate(site)
      lato_fonts = Dir.glob(File.join(site.source, 'assets/fonts/Lato-*.woff2')).sort.map do |path|
        path.delete_prefix(site.source + File::SEPARATOR)
      end
      javascript = Dir.glob(File.join(site.source, 'assets/**/*.js')).sort.map do |path|
        path.delete_prefix(site.source + File::SEPARATOR)
      end
      groups = {
        'css_version' => %w[assets/style.css assets/design-system.css assets/horoscope.css assets/lunar.css assets/monthly-holidays.css] + lato_fonts,
        'script_version' => javascript
      }

      groups.each do |key, paths|
        contents = paths.map do |path|
          absolute_path = File.expand_path(path, site.source)
          raise "Missing asset for cache version: #{path}" unless File.file?(absolute_path)

          File.binread(absolute_path)
        end
        site.config[key] = Digest::SHA256.hexdigest(contents.join("\0"))[0, 12]
      end
    end
  end
end
