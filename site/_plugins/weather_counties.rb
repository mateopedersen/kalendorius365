# frozen_string_literal: true

require 'json'

module Jekyll
  class WeatherCounties < Generator
    def generate(site)
      registry = JSON.parse(File.read(File.join(site.source, 'assets/data/weather-places.json')))
      municipalities = registry.fetch('municipalities').values
      site.data['weather_counties'] = municipalities.group_by { |entry| entry.fetch(2).delete_suffix(' apskr.') }
                                                  .transform_values do |entries|
        entries.sort_by { |entry| entry.fetch(1) }.map do |slug, name|
          {
            'slug' => slug,
            'name' => name.sub(/ m\. sav\.\z/, ' miesto savivaldybė')
                          .sub(/ r\. sav\.\z/, ' rajono savivaldybė')
                          .sub(/ sav\.\z/, ' savivaldybė')
          }
        end
      end
    end
  end
end
