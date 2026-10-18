# frozen_string_literal: true

require 'digest'
require_relative '../../lib/static_asset_urls'

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
      stylesheets = Dir.glob(File.join(site.source, 'assets/**/*.css')).sort
      css_dependencies = Kalendorius::StaticAssetUrls.referenced_asset_paths(site.source, stylesheets)
      script_documents = javascript.map { |path| File.join(site.source, path) }
      script_dependencies = Kalendorius::StaticAssetUrls.referenced_asset_paths(site.source, script_documents)
      # The search index is loaded relative to search-engine.js at runtime.
      script_dependencies |= ['assets/data/search.json']
      weather_images = %w[assets/visuals/weather-320.webp assets/visuals/weather-480.webp assets/visuals/weather-640.webp]
      image_contents = weather_images.map { |path| File.binread(File.join(site.source, path)) }
      site.config['weather_image_version'] = Digest::SHA256.hexdigest(image_contents.join("\0"))[0, 12]
      groups = {
        'css_version' => stylesheets.map { |path| path.delete_prefix(site.source + File::SEPARATOR) } + lato_fonts + css_dependencies,
        'script_version' => javascript + script_dependencies
      }

      discovery_visuals = Dir.glob(File.join(site.source, 'assets/visuals/discovery-*.svg')).sort
      visual_contents = discovery_visuals.map { |path| File.binread(path) }
      site.config['visual_version'] = Digest::SHA256.hexdigest(visual_contents.join("\0"))[0, 12]

      groups.each do |key, paths|
        contents = paths.map do |path|
          absolute_path = File.expand_path(path, site.source)
          raise "Missing asset for cache version: #{path}" unless File.file?(absolute_path)

          File.binread(absolute_path)
        end
        contents << File.binread(File.expand_path('../lib/css_minifier.rb', site.source)) if key == 'css_version'
        contents << File.binread(File.expand_path('../scripts/css_route_split.py', site.source)) if key == 'css_version'
        contents << File.binread(File.expand_path('../scripts/inline_route_css.py', site.source)) if key == 'css_version'
        contents << File.binread(File.expand_path('../lib/static_asset_urls.rb', site.source))
        contents << File.binread(File.expand_path('../scripts/build.rb', site.source))
        if key == 'script_version'
          %w[scripts/minify_js.mjs package-lock.json].each do |path|
            contents << File.binread(File.expand_path('../' + path, site.source))
          end
        end
        contents << File.binread(File.expand_path('_plugins/asset_versions.rb', site.source))
        site.config[key] = Digest::SHA256.hexdigest(contents.join("\0"))[0, 12]
      end
    end
  end
end
