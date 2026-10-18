# frozen_string_literal: true

module Pages
 # Mark the document at build time so browser-menu printing and site buttons
 # share a layout without cloning or moving personal data.
 def print_html(path, html)
  case path
  when /\A202[789]\z/
   html=html.sub('<div class="year-grid annual-sheet">',"<div class=\"year-grid annual-sheet\" data-print-root=\"annual\" data-print-title=\"#{path} metų kalendorius\">")
  when 'kurti-kalendoriu'
   html=html.sub('<div id="generator-preview">','<div id="generator-preview" data-print-root="generator">')
  when %r{\Adarbo-dienos/202[789]\z}
   html=html.gsub('<section data-work-table=','<section data-print-root="table" data-work-table=')
  when 'atostogu-planavimas'
   html=html.gsub(/<section id="leave-(summary|results|detail)"/) { |tag|tag+' data-print-root="result"' }
  when 'pamainu-grafikas'
   html=html.sub('<section class="panel"><h2>Grafiko suvestinė', '<section class="panel" data-print-root="result"><h2>Grafiko suvestinė')
  when 'pamoku-tvarkarastis'
   html=html.sub('<section class="panel"><h2>Savaitės pamokos', '<section class="panel" data-print-root="school"><h2>Savaitės pamokos')
  else
   if html.include?('id="selected-preview"')
    html=html.sub(/<section class="[^"]*\blarge-preview\b[^"]*"/) { |tag|tag+' data-print-root="art"' }
   elsif %w[savaitiniai-planuokliai dienos-planuoklis seimos-kalendorius pamoku-tvarkarascio-sablonai darbo-grafiko-sablonai].include?(path)
    html=html.sub('<a class="preview-link"','<a class="preview-link" data-print-root="art"')
   end
  end
  # Only selected artwork gets a full-resolution print source. Hidden galleries
  # must not download dozens of 600 PPI images when print preview opens.
  if html.include?('data-print-root="art"')
   artwork=html[/<a [^>]*(?:id="preview-full"|data-print-root="art")[^>]*href="([^"]+)"[^>]*>(<img [^>]+>)/,0]
   if artwork
    href=artwork[/href="([^"]+)"/,1]
    image=artwork[/<img [^>]+>/]
    asset=MANIFEST.find { |entry|href.split('?').first==entry['webp'] }
    html=html.sub('data-print-root="art"',"data-print-root=\"art\" data-print-paper=\"#{asset && asset['landscape'] ? 'landscape' : 'portrait'}\"")
    html=html.sub(image,"<picture><source id=\"selected-print-source\" media=\"print\" srcset=\"#{href}\">#{image}</picture>")
   end
  end
  html
 end
end
