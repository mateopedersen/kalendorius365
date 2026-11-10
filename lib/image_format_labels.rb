# frozen_string_literal: true
# Translate presentation labels; MIME types, extensions and media URLs stay intact.
module ImageFormatLabels
  REPLACEMENTS = [["Atsisiųsti WebP", "Atsisiųsti vaizdą"], ["PDF ir WebP", "PDF ir vaizdai"], ["PDF arba WebP", "PDF arba vaizdą"], ["WebP formatu", "vaizdo formatu"], ["WebP failą", "vaizdo failą"], ["WebP failus", "vaizdo failus"], ["WebP failai", "vaizdo failai"], ["WebP kalendorius", "Kalendoriaus vaizdas"]].freeze
  def self.localize(text)
    REPLACEMENTS.each { |source, label| text = text.gsub(source, label) }
    text.gsub(/\bWebP\b/, "Vaizdas").gsub("Vaizdas failas", "Vaizdo failas").gsub("arba 600 PPI Vaizdas", "arba 600 PPI raiškos vaizdą").gsub("600 PPI Vaizdas", "600 PPI raiškos vaizdai").gsub("PDF rinkitės spausdinimui, Vaizdas – kaip visą vaizdo failą", "Spausdinimui rinkitės PDF, o viso dydžio paveikslėliui – vaizdo failą").gsub("Vaizdas ir PNG kuriami", "Vaizdo failai kuriami").gsub("JPEG, PNG ar Vaizdas nuotraukas", "nuotraukas palaikomais vaizdo formatais").gsub("Metų Vaizdas", "Metų kalendoriaus vaizdas").gsub("JPEG, PNG ir Vaizdas nuotraukos", "Palaikomų formatų nuotraukos").gsub("JPEG, PNG, Vaizdas.", "Palaikomi vaizdo formatai.").gsub("PDF ir vaizdai fail", "PDF ir vaizdo fail").gsub("PDF ir vaizdai kalend", "PDF ir vaizdo formato kalend").gsub("PDF arba vaizdą failą", "PDF arba vaizdo failą").gsub("PDF ir 600 PPI raiškos vaizdai.", "PDF ir 600 PPI raiškos vaizdus.").gsub("px Vaizdas variantai", "px vaizdo variantai").gsub("Vaizdas galite naudoti", "Vaizdą galite naudoti").gsub("didelės raiškos Vaizdas peržiūrai", "didelės raiškos vaizdą peržiūrai").gsub("PDF bei Vaizdas variantai", "PDF bei vaizdo variantai").gsub("PNG ar Vaizdas yra rastrinis rezultatas", "Vaizdo failas yra rastrinis rezultatas").gsub("Tikras PDF ir vaizdai turi", "PDF ir vaizdo failai turi").gsub("konvertuota į Vaizdas", "paruošta kaip vaizdo failas").gsub("Vaizdas matmenys", "Vaizdo matmenys").gsub("PDF ir vaizdai dizainai", "PDF ir vaizdo formato dizainai").gsub("o Vaizdas sukurtas", "o vaizdas sukurtas")
  end
  def self.rewrite!(directory)
    Dir.glob(File.join(directory, "**/*.html")).each do |path|
      source = File.read(path)
      localized = localize(source)
      File.write(path, localized) unless localized == source
    end
  end
end
