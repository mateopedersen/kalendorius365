# frozen_string_literal: true
# Translate presentation labels; MIME types, extensions and media URLs stay intact.
module ImageFormatLabels
  REPLACEMENTS = [["Atsisiųsti WebP", "Atsisiųsti vaizdą"], ["PDF ir WebP", "PDF ir vaizdai"], ["PDF arba WebP", "PDF arba vaizdą"], ["WebP formatu", "vaizdo formatu"], ["WebP failą", "vaizdo failą"], ["WebP failus", "vaizdo failus"], ["WebP failai", "vaizdo failai"], ["WebP kalendorius", "Kalendoriaus vaizdas"]].freeze
  def self.localize(text)
    REPLACEMENTS.each { |source, label| text = text.gsub(source, label) }
    text.gsub(/\bWebP\b/, "Vaizdas")
  end
  def self.rewrite!(directory)
    Dir.glob(File.join(directory, "**/*.html")).each do |path|
      source = File.read(path)
      localized = localize(source)
      File.write(path, localized) unless localized == source
    end
  end
end
