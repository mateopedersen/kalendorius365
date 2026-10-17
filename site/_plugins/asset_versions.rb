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
      weather_images = %w[assets/visuals/weather-320.webp assets/visuals/weather-480.webp assets/visuals/weather-640.webp]
      image_contents = weather_images.map { |path| File.binread(File.join(site.source, path)) }
      site.config['weather_image_version'] = Digest::SHA256.hexdigest(image_contents.join("\0"))[0, 12]
      groups = {
        'css_version' => %w[assets/style.css assets/design-system.css assets/homepage.css assets/horoscope.css assets/zodiac.css assets/namedays.css assets/lunar.css assets/monthly-holidays.css assets/holiday-phase2.css assets/seasons.css assets/contact.css] + lato_fonts,
        # Search data is fetched lazily. Tie its long-lived URL to its content.
        'script_version' => javascript + %w[assets/data/search.json]
      }

      groups.each do |key, paths|
        contents = paths.map do |path|
          absolute_path = File.expand_path(path, site.source)
          raise "Missing asset for cache version: #{path}" unless File.file?(absolute_path)

          File.binread(absolute_path)
        end
        contents << File.binread(File.expand_path('../lib/css_minifier.rb', site.source)) if key == 'css_version'
        site.config[key] = Digest::SHA256.hexdigest(contents.join("\0"))[0, 12]
      end
    end
  end
end
