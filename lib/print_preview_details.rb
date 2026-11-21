# frozen_string_literal: true

require 'json'

module PrintPreviewDetails
  ROOT = File.expand_path('..', __dir__)
  INDEX = File.join(ROOT, 'data/print-preview-details.json')

  def self.srcset(asset, include_thumbnail: false)
    @entries ||= File.file?(INDEX) ? JSON.parse(File.read(INDEX, encoding: 'UTF-8')) : {}
    entry = @entries[asset.fetch('stem')]
    return unless entry && entry.fetch('pdf_sha256') == asset.dig('files', 'pdf', 'sha256')

    sources = entry.fetch('variants').map { |variant| "#{variant.fetch('url')} #{variant.fetch('width')}w" }
    sources.unshift("#{asset.fetch('preview')} #{entry.fetch('thumbnail_width')}w") if include_thumbnail
    sources.join(', ')
  end
end
