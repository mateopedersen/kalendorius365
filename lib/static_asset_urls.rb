# frozen_string_literal: true

require 'digest'
require 'json'
require 'pathname'

module Kalendorius
  module StaticAssetUrls
    IMAGE_EXTENSIONS = %w[.svg .png .webp .jpg .jpeg .avif].freeze
    FONT_EXTENSIONS = %w[.woff .woff2].freeze
    STATIC_ASSET_EXTENSIONS = (IMAGE_EXTENSIONS + FONT_EXTENSIONS).freeze
    DOWNLOAD_EXTENSIONS = (IMAGE_EXTENSIONS + %w[.pdf .csv .json .ics]).freeze
    JSON_DOCUMENTS_WITH_ASSET_REFERENCES = %w[assets/data/zodiac.json].freeze
    REFERENCE_PATTERN = %r{(?<prefix>^|[\s"'=(])(?<path>/(?:assets|downloads)/[^"'<>\s?#()]+\.(?:svg|png|webp|jpe?g|avif|woff2?|pdf|csv|json|ics))(?<query>\?[^"'<>\s#]*)?(?<fragment>\#[^"'<>\s]*)?}i
    DYNAMIC_TEMPLATE_PATTERN = %r{`(?<url>/(?:assets|downloads)/[^`\s]*\.(?:svg|png|webp|jpe?g|avif|woff2?|pdf|csv|json|ics))`}

    module_function

    def rewrite!(public_root)
      root = Pathname.new(public_root).expand_path
      changed_references = 0

      # A small runtime dataset contains artwork URLs. Version its references
      # first, then recalculate its own version so the page fetches that exact
      # transformed document. Large print manifests stay byte-for-byte intact.
      json_paths = JSON_DOCUMENTS_WITH_ASSET_REFERENCES.map { |relative_path| root.join(relative_path) }.select(&:file?)
      versions = version_map(root, referenced_asset_paths(root, json_paths))
      JSON_DOCUMENTS_WITH_ASSET_REFERENCES.each do |relative_path|
        path = root.join(relative_path)
        next unless path.file?

        source = path.read(encoding: 'UTF-8')
        updated, changed = rewrite_static_references(source, versions)
        changed_references += changed
        path.write(updated, encoding: 'UTF-8') unless updated == source
      end

      documents = Dir.glob(root.join('**/*').to_s).select do |filename|
        path = Pathname.new(filename)
        path.file? && %w[.html .css .js].include?(path.extname.downcase)
      end
      versions = version_map(root, referenced_asset_paths(root, documents))

      documents.each do |filename|
        path = Pathname.new(filename)
        source = path.read(encoding: 'UTF-8')
        updated, changed = rewrite_static_references(source, versions)
        changed_references += changed
        if path.extname.downcase == '.js'
          updated, dynamic_count = rewrite_dynamic_templates(updated, root)
          changed_references += dynamic_count
        end

        path.write(updated, encoding: 'UTF-8') unless updated == source
      end

      changed_references
    end

    def rewrite_static_references(source, versions)
      changed = 0
      updated = source.gsub(REFERENCE_PATTERN) do |match|
        prefix = Regexp.last_match(:prefix)
        asset_path = Regexp.last_match(:path)
        query = Regexp.last_match(:query)
        fragment = Regexp.last_match(:fragment)
        version = versions[asset_path]
        next match unless version

        versioned_query = replace_version(query, version)
        changed += 1 if "#{prefix}#{asset_path}#{versioned_query}#{fragment}" != match
        "#{prefix}#{asset_path}#{versioned_query}#{fragment}"
      end
      [updated, changed]
    end

    def rewrite_dynamic_templates(source, root)
      count = 0
      updated = source.gsub(DYNAMIC_TEMPLATE_PATTERN) do |match|
        url = Regexp.last_match(:url)
        next match unless url.include?('${')

        glob = url.gsub(/\$\{[^}]+\}/, '*').delete_prefix('/')
        matched_files = Dir.glob(root.join(glob).to_s).select do |filename|
          path = Pathname.new(filename)
          directory = path.relative_path_from(root).each_filename.first
          path.file? && versionable?(directory, path.extname.downcase)
        end.sort
        next match if matched_files.empty?

        version_inputs = matched_files.map do |filename|
          path = Pathname.new(filename)
          "#{path.relative_path_from(root)}\0#{Digest::SHA256.file(path).hexdigest}"
        end
        version = Digest::SHA256.hexdigest(version_inputs.join("\0"))[0, 12]
        count += 1
        "`#{versioned_url(url, version)}`"
      end
      [updated, count]
    end

    def version_map(root, relative_paths = nil)
      versions = {}
      filenames = if relative_paths
        relative_paths.map { |relative| root.join(relative) }
      else
        %w[assets downloads].flat_map { |directory| Dir.glob(root.join(directory, '**/*').to_s) }
      end
      filenames.each do |filename|
        path = Pathname.new(filename)
        relative = path.relative_path_from(root).to_s
        directory = relative.split('/', 2).first
        next unless path.file? && versionable?(directory, path.extname.downcase)

        # Preserve the existing print-manifest URL convention, also used by
        # the sitemap and download metadata embedded in the page.
        length = directory == 'downloads' ? 16 : 12
        versions['/' + relative] = Digest::SHA256.file(path).hexdigest[0, length]
      end
      versions
    end

    # Return only files that a stylesheet or script can request. The release
    # contains a large print manifest and thousands of previews; hashing those
    # into every CSS/JS version would cause unrelated cache churn.
    def referenced_asset_paths(asset_root, document_paths)
      root = Pathname.new(asset_root).expand_path
      referenced = {}

      document_paths.each do |filename|
        source = Pathname.new(filename).read(encoding: 'UTF-8')
        source.to_enum(:scan, REFERENCE_PATTERN).each do
          asset_path = Regexp.last_match(:path)
          relative = asset_path.delete_prefix('/')
          candidate = root.join(relative)
          directory = relative.split('/', 2).first
          next unless candidate.file? && versionable?(directory, candidate.extname.downcase)

          referenced[relative] = candidate
        end

        source.to_enum(:scan, DYNAMIC_TEMPLATE_PATTERN).each do
          url = Regexp.last_match(:url)
          next unless url.include?('${')

          glob = url.gsub(/\$\{[^}]+\}/, '*').delete_prefix('/')
          Dir.glob(root.join(glob).to_s).each do |match|
            candidate = Pathname.new(match)
            relative = candidate.relative_path_from(root).to_s
            directory = relative.split('/', 2).first
            next unless candidate.file? && versionable?(directory, candidate.extname.downcase)

            referenced[relative] = candidate
          end
        end
      end

      referenced.keys.sort
    end

    def versionable?(directory, extension)
      if directory == 'downloads'
        DOWNLOAD_EXTENSIONS.include?(extension)
      else
        STATIC_ASSET_EXTENSIONS.include?(extension) || %w[.ics .json].include?(extension)
      end
    end

    def replace_version(query, version)
      return "?v=#{version}" unless query

      parts = query.delete_prefix('?').split('&')
      if parts.any? { |part| part.start_with?('v=') }
        parts.map! { |part| part.start_with?('v=') ? "v=#{version}" : part }
      else
        parts << "v=#{version}"
      end
      "?#{parts.join('&')}"
    end

    def versioned_url(url, version)
      path, query = url.split('?', 2)
      "#{path}#{replace_version(query && "?#{query}", version)}"
    end
  end
end
