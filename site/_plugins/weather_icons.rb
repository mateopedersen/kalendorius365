# frozen_string_literal: true

module Jekyll
  class WeatherIcons < Generator
    def generate(site)
      # Use the same artwork as the external icons. Namespace local paint servers
      # and shapes so they cannot reference another illustration in the document.
      source = File.read(File.join(site.source, 'assets/visuals/weather-atlas-icons.svg'))
      sprite = source.gsub(/(id="|href="#|url\(#)([\w-]+)/) { "#{$1}wx-sky-#{$2}" }
      site.data['weather_icons'] = sprite.sub('<svg ', '<svg class="wx-instrument-definitions" width="0" height="0" aria-hidden="true" focusable="false" ')
    end
  end
end
