# frozen_string_literal: true

require 'digest'

module Jekyll
  class AssetVersions < Generator
    priority :highest

    def generate(site)
      groups = {
        'css_version' => %w[assets/style.css assets/design-system.css],
        'script_version' => %w[assets/common.js assets/app.js assets/tools.js assets/leave-planner.js assets/phase-5-6-8.js assets/weather.js]
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
