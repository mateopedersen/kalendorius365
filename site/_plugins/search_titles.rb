# frozen_string_literal: true

module Kalendorius
  module SearchTitles
    SIGN_GENITIVES = {
      'Avinas' => 'Avino', 'Jautis' => 'Jaučio', 'Dvyniai' => 'Dvynių', 'Vėžys' => 'Vėžio',
      'Liūtas' => 'Liūto', 'Mergelė' => 'Mergelės', 'Svarstyklės' => 'Svarstyklių',
      'Skorpionas' => 'Skorpiono', 'Šaulys' => 'Šaulio', 'Ožiaragis' => 'Ožiaragio',
      'Vandenis' => 'Vandenio', 'Žuvys' => 'Žuvų'
    }.freeze

    def lithuanian_search_title(title, route, editorial, share_pages)
      return editorial.fetch(route) if editorial.key?(route)

      case route
      when %r{\A/dalintis/kalendorius/tuscias-}
        label = title.split(' · ').first
        rows = route[%r{-(\d+)-eilutes/\z}, 1]
        rows ? "#{label} su #{rows} savaičių eilutėmis" : "#{label} spausdinti"
      when %r{\A/dalintis/kalendorius/}
        calendar, design = title.split(' · ')
        "#{calendar} „#{design}“"
      when %r{\A/horoskopai/[^/]+/\d{4}-\d{2}-\d{2}/v-}
        sign, date, version = title.split(' · ')
        label = "#{date} #{SIGN_GENITIVES.fetch(sign)} horoskopas"
        versions_path = route.sub(%r{/v-[^/]+/\z}, '/v-')
        another_edition = share_pages.each_key.any? { |key| key != route && key.start_with?(versions_path) }
        another_edition ? "#{label} (#{version})" : label
      when %r{\A/\d{4}/(?:[^/]+/)?\z}
        "#{title.split(' – ').first} spausdinti"
      when %r{\A/(?:sventes|vardadieniai)/[^/]+/\z}
        title.split(' – ').first
      else
        title
      end
    end
  end
end

Liquid::Template.register_filter(Kalendorius::SearchTitles)
