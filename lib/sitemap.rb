# frozen_string_literal: true

require 'cgi'
require 'fileutils'
require 'pathname'
require 'uri'

module Kalendorius
  module Sitemap
    URLSET_NS = 'http://www.sitemaps.org/schemas/sitemap/0.9'
    IMAGE_NS = 'http://www.google.com/schemas/sitemap-image/1.1'
    BASE_URL = 'https://kalendorius365.lt'
    MAX_BYTES = 50 * 1024 * 1024
    MAX_URLS = 50_000
    MAX_IMAGES_PER_URL = 1_000

    def self.write(public_dir:, page_paths:, release:, manifest:, months:)
      public_dir = File.expand_path(public_dir)
      canonical_urls = if release
                         page_paths.map { |path| canonical_indexable_url(path, public_dir) }.compact.sort
                       else
                         []
                       end
      abort 'Sitemap contains duplicate canonical URLs' unless canonical_urls.uniq == canonical_urls

      images_by_page = Hash.new { |hash, key| hash[key] = [] }
      if release
        manifest.select { |asset| %w[monthly annual].include?(asset['kind']) }.each do |asset|
          year = Integer(asset.fetch('year'))
          page_path = if asset['kind'] == 'monthly'
                        month_slug = months.fetch(Integer(asset.fetch('month')) - 1).fetch(0)
                        "/#{year}/#{month_slug}/"
                      else
                        "/#{year}/"
                      end
          page_url = "#{BASE_URL}#{page_path}"
          abort "Calendar image has no indexable page in the sitemap: #{page_url}" unless canonical_urls.include?(page_url)

          image_path = asset.fetch('webp')
          abort "Invalid calendar image URL: #{image_path}" unless image_path.start_with?('/') && !image_path.match?(/[?#]/)

          image_file = File.expand_path(image_path.delete_prefix('/'), public_dir)
          abort "Calendar sitemap image is missing: #{image_file}" unless image_file.start_with?("#{public_dir}/") && File.file?(image_file)

          images_by_page[page_url] << "#{BASE_URL}#{image_path}"
        end
      end

      records = canonical_urls.map do |url|
        images = images_by_page[url].uniq.sort
        abort "Too many image entries for #{url}" if images.length > MAX_IMAGES_PER_URL
        { url: url, images: images }
      end

      chunks = split_records(records)
      sitemap_files = write_sitemaps(public_dir, chunks)
      {
        canonical_urls: canonical_urls,
        image_urls: images_by_page.values.flatten.uniq,
        files: sitemap_files
      }
    end

    def self.canonical_indexable_url(path, public_dir)
      html = File.read(path, encoding: 'UTF-8')
      tags = html.scan(/<(?:link|meta)\b[^>]*>/i)
      canonical_tag = tags.find do |tag|
        tag.match?(/\A<link\b/i) && attributes(tag)['rel'].to_s.split.any? { |value| value.casecmp('canonical').zero? }
      end
      robots_tag = tags.find do |tag|
        tag.match?(/\A<meta\b/i) && attributes(tag)['name'].to_s.casecmp('robots').zero?
      end
      return unless canonical_tag && robots_tag

      canonical = attributes(canonical_tag)['href']
      directives = attributes(robots_tag)['content'].to_s.split(',').map(&:strip).map(&:downcase)
      return unless directives.include?('index') && !directives.include?('noindex')

      uri = URI.parse(canonical.to_s)
      unless uri.scheme == 'https' && uri.host == 'kalendorius365.lt' && uri.port == 443 && uri.query.nil? && uri.fragment.nil?
        abort "Sitemap canonical must be an absolute HTTPS site URL without query or fragment: #{canonical.inspect}"
      end

      relative_dir = Pathname.new(File.expand_path(path)).relative_path_from(Pathname.new(public_dir)).dirname
      route = relative_dir.to_s == '.' ? '/' : "/#{relative_dir}/"
      expected = "#{BASE_URL}#{route}"
      abort "Page is not self-canonical: #{path} points to #{canonical.inspect}, expected #{expected}" unless canonical == expected

      canonical
    rescue URI::InvalidURIError => error
      abort "Invalid canonical URL in #{path}: #{error.message}"
    end

    def self.attributes(tag)
      tag.scan(/([a-zA-Z_:][a-zA-Z0-9_.:-]*)\s*=\s*(["'])(.*?)\2/m).each_with_object({}) do |(name, _quote, value), result|
        result[name.downcase] = CGI.unescapeHTML(value)
      end
    end

    def self.split_records(records)
      chunks = []
      current = []
      current_bytes = urlset_header.bytesize + urlset_footer.bytesize

      records.each do |record|
        fragment = url_xml(record)
        if !current.empty? && (current.length >= MAX_URLS || current_bytes + fragment.bytesize > MAX_BYTES)
          chunks << current
          current = []
          current_bytes = urlset_header.bytesize + urlset_footer.bytesize
        end
        abort "A single sitemap URL entry exceeds Google's 50 MB limit: #{record[:url]}" if current_bytes + fragment.bytesize > MAX_BYTES

        current << fragment
        current_bytes += fragment.bytesize
      end
      chunks << current if !current.empty? || chunks.empty?
      chunks
    end

    def self.urlset_header
      "<?xml version=\"1.0\" encoding=\"UTF-8\"?>\n<urlset xmlns=\"#{URLSET_NS}\" xmlns:image=\"#{IMAGE_NS}\">\n"
    end

    def self.urlset_footer
      "</urlset>\n"
    end

    def self.url_xml(record)
      xml = +"  <url>\n    <loc>#{CGI.escapeHTML(record[:url])}</loc>\n"
      record[:images].each do |image_url|
        xml << "    <image:image>\n      <image:loc>#{CGI.escapeHTML(image_url)}</image:loc>\n    </image:image>\n"
      end
      xml << "  </url>\n"
    end

    def self.urlset_xml(fragments)
      urlset_header + fragments.join + urlset_footer
    end

    def self.write_sitemaps(public_dir, chunks)
      stale_parts = Dir.glob(File.join(public_dir, 'sitemap-[0-9]*.xml'))
      FileUtils.rm_f(stale_parts)

      if chunks.length == 1
        write_xml(File.join(public_dir, 'sitemap.xml'), urlset_xml(chunks.first))
        ['sitemap.xml']
      else
        part_names = chunks.each_index.map { |index| "sitemap-#{index + 1}.xml" }
        chunks.zip(part_names).each do |fragments, name|
          write_xml(File.join(public_dir, name), urlset_xml(fragments))
        end
        index_xml = +"<?xml version=\"1.0\" encoding=\"UTF-8\"?>\n<sitemapindex xmlns=\"#{URLSET_NS}\">\n"
        part_names.each do |name|
          index_xml << "  <sitemap>\n    <loc>#{BASE_URL}/#{name}</loc>\n  </sitemap>\n"
        end
        index_xml << "</sitemapindex>\n"
        abort "Sitemap index exceeds Google's size limit" if part_names.length > MAX_URLS || index_xml.bytesize > MAX_BYTES

        write_xml(File.join(public_dir, 'sitemap.xml'), index_xml)
        ['sitemap.xml', *part_names]
      end
    end

    def self.write_xml(path, xml)
      abort "Sitemap XML is not valid UTF-8: #{path}" unless xml.encoding == Encoding::UTF_8 && xml.valid_encoding?
      abort "Sitemap exceeds Google's 50 MB size limit: #{path}" if xml.bytesize > MAX_BYTES

      File.write(path, xml, encoding: 'UTF-8')
    end
  end
end
