# frozen_string_literal: true
require 'date'
require 'fileutils'

# Original, code-native seasonal artwork. Each miniature calendar uses the
# actual year/month rather than suggesting a fixed weekday for every year.
module MonthCalendarArt
 extend self
 THEMES = [
  ['Žiemos ramybė', '#487fa6', '#edf5fc', '#d7e8f4'],
  ['Šiluma žiemos viduryje', '#aa5274', '#fcf0f3', '#f5dce6'],
  ['Pirmieji pavasario ženklai', '#39837b', '#edf7f0', '#cfe8d8'],
  ['Pavasario spalvos', '#8a65a5', '#f6f0fc', '#e6d9ef'],
  ['Žydintys sodai', '#bc6687', '#fcf2f4', '#f3d9e4'],
  ['Ilgiausių dienų šviesa', '#4f8563', '#f1f7e9', '#dce9c7'],
  ['Vasaros horizontai', '#32899b', '#edf9fb', '#ccebf0'],
  ['Javų ir saulės metas', '#a4782f', '#fcf6e7', '#f4e6bc'],
  ['Naujo sezono planai', '#9b694b', '#faf3eb', '#efdcc9'],
  ['Auksinis ruduo', '#bc623c', '#fff2e8', '#f7ddc5'],
  ['Tylus atminimo laikas', '#756e98', '#f1f0f8', '#dedbed'],
  ['Šventinis laukimas', '#397765', '#edf7f2', '#d2e8dc']
 ].freeze

 def snow(x,y,s=1)
  %(<g transform="translate(#{x} #{y}) scale(#{s})" fill="none" stroke="#fff" stroke-width="2.2" stroke-linecap="round"><path d="M-10 0H10M0-10V10M-7-7L7 7M-7 7L7-7"/></g>)
 end
 def flower(x,y,color,s=1)
  %(<g transform="translate(#{x} #{y}) scale(#{s})"><g fill="#{color}"><ellipse cy="-10" rx="7" ry="11"/><ellipse cy="10" rx="7" ry="11"/><ellipse cx="-10" rx="11" ry="7"/><ellipse cx="10" rx="11" ry="7"/></g><circle r="5" fill="#e7b65c"/></g>)
 end
 def leaf(x,y,angle,color,s=1)
  %(<g transform="translate(#{x} #{y}) rotate(#{angle}) scale(#{s})"><path d="M0 0C-22-4-28-28-7-38C14-28 17-8 0 0Z" fill="#{color}"/><path d="M0 0L-7-31" fill="none" stroke="#fff" stroke-opacity=".45" stroke-width="1.5"/></g>)
 end
 def fir(x,y,s=1)
  %(<g transform="translate(#{x} #{y}) scale(#{s})"><path d="M0 2V75" stroke="#92694b" stroke-width="7"/><path d="M0-15L-25 20H-15L-35 47H-23L-44 76H44L23 47H35L15 20H25Z" fill="#326b5d"/><path d="M0-15L-25 20H-15L-35 47H-23L-44 76H0Z" fill="#438c77"/></g>)
 end
 def wheat(x,y,angle)
  %(<g transform="translate(#{x} #{y}) rotate(#{angle})"><path d="M0 0V-88" stroke="#ab7a32" stroke-width="2.5"/>#{[20,32,44,56,68].map { |h| %(<path d="M0-#{h}Q-22-#{h+4}-11-#{h+18}Q2-#{h+12}0-#{h}M0-#{h}Q22-#{h+4}11-#{h+18}Q-2-#{h+12}0-#{h}" fill="#dfb65e" stroke="#c49a4d" stroke-width=".8"/>) }.join}</g>)
 end
 def motif(month)
  case month
  when 1
   fir(184,28,0.9)+%(<path d="M147 95Q183 77 226 97" fill="none" stroke="#fff" stroke-width="6" stroke-linecap="round"/>)+snow(41,35,0.7)+snow(130,24,0.65)+snow(217,139,0.5)+%(<path d="M151 217Q195 192 226 213" fill="none" stroke="#fff" stroke-width="9" stroke-linecap="round"/>)
  when 2
   %(<path d="M184 97C172 82 142 64 151 44C162 20 183 35 184 44C190 23 215 25 222 43C233 66 199 87 184 97Z" fill="#ce7293"/><path d="M160 43Q169 34 178 43" fill="none" stroke="#f9bfd0" stroke-width="4" stroke-linecap="round"/><path d="M35 44H78V51H35Z" fill="#e4bd47"/><path d="M35 51H78V58H35Z" fill="#4f9470"/><path d="M35 58H78V65H35Z" fill="#bb5360"/>)+snow(214,123,0.5)+snow(118,31,0.5)
  when 3
   %(<g fill="none" stroke="#539274" stroke-width="4" stroke-linecap="round"><path d="M180 107Q163 20 197 31Q211 35 207 54M164 105Q137 33 165 34Q181 35 177 59M197 107Q225 49 213 43"/></g><g fill="#fff" stroke="#bdcfc7" stroke-width="1"><path d="M207 47Q188 49 192 69Q205 60 217 68Q225 51 207 47Z"/><path d="M177 52Q158 56 162 76Q175 67 188 74Q197 58 177 52Z"/></g>)+leaf(176,100,35,'#70a888',0.75)+leaf(199,104,80,'#97b779',0.75)+%(<path d="M32 42H68V48H32Z" fill="#e4bd47"/><path d="M32 48H68V54H32Z" fill="#4f9470"/><path d="M32 54H68V60H32Z" fill="#bb5360"/>)
  when 4
   %(<g transform="translate(181 59) rotate(16)"><path d="M0-35C-17-35-32-2-28 19C-23 47 24 47 29 18C33-3 17-35 0-35Z" fill="#a78bc4"/><path d="M-24-1Q0-16 25-1M-29 18Q0 2 29 18" fill="none" stroke="#f4e8fc" stroke-width="5"/><g fill="#f3c86b"><circle cy="-21" r="4"/><circle cx="-12" cy="12" r="4"/><circle cx="12" cy="12" r="4"/><circle cy="31" r="4"/></g></g><path d="M211 154V218M211 192Q188 174 192 162Q216 167 211 192" stroke="#5c927b" stroke-width="3" fill="#79a38a"/><path d="M198 144V130L210 138L222 128V143Q211 165 198 144Z" fill="#d896b1"/>)
  when 5
   %(<path d="M146 107Q168 61 220 29M181 66L177 24M194 53L227 62" fill="none" stroke="#8a7964" stroke-width="4" stroke-linecap="round"/>)+flower(184,40,'#e8a2b8',0.85)+flower(210,53,'#f4c8d3',0.8)+flower(156,83,'#e8a2b8',0.7)+leaf(209,84,65,'#84a783',0.7)+flower(215,204,'#eeb2c4',0.9)
  when 6
   %(<circle cx="184" cy="53" r="31" fill="#eacb79"/><circle cx="184" cy="53" r="22" fill="#f9df97"/><path d="M150 89Q188 113 222 78" fill="none" stroke="#59805a" stroke-width="4"/>)+[146,166,188,209].each_with_index.map { |x,i|leaf(x,90+(i==1 || i==2 ? 10 : 0),i.even? ? -25 : 45,i.even? ? '#64875a' : '#8ea35f',0.7) }.join+%(<path d="M177 225L194 194L205 224Z" fill="#d3944e"/><path d="M186 225L196 205L199 225Z" fill="#f2c766"/>)
  when 7
   %(<circle cx="184" cy="48" r="27" fill="#e9bd5d"/><g stroke="#dfb35a" stroke-width="3" stroke-linecap="round"><path d="M184 9V3M184 87V93M145 48H139M223 48H229M156 20L151 15M212 20L217 15M212 76L217 81"/></g><path d="M140 106Q160 90 181 103T225 101V120H140Z" fill="#79bbc6"/><path d="M171 95H212L202 108H180Z" fill="#397b90"/><path d="M190 46V94H163Z" fill="#fffaf0"/><path d="M195 56V94H214Z" fill="#e2bb83"/><path d="M173 215Q187 206 202 214T231 212" fill="none" stroke="#70b5c3" stroke-width="5" stroke-linecap="round"/>)
  when 8
   %(<circle cx="185" cy="56" r="34" fill="#f1d489"/>)+wheat(178,115,-18)+wheat(202,119,13)+wheat(218,221,-12)+leaf(35,46,-50,'#b0aa63',0.7)
  when 9
   %(<g transform="translate(160 29) rotate(14)"><rect width="57" height="76" rx="6" fill="#ba7e5d"/><rect x="7" y="4" width="50" height="69" rx="3" fill="#f8e7cc"/><path d="M13 23H46M13 34H46M13 45H39" stroke="#c6ad8c" stroke-width="2"/><path d="M7 5V71" stroke="#a96949" stroke-width="3"/></g><g transform="translate(210 30) rotate(23)"><path d="M0 0H9V61H0Z" fill="#dda94f"/><path d="M0 61L4.5 74L9 61" fill="#ead2aa"/><path d="M3 70L4.5 74L6 70" fill="#5c544e"/></g>)+leaf(214,219,40,'#c78b55',0.9)
  when 10
   %(<g transform="translate(182 59) rotate(-12)"><path d="M0-38L8-19L26-30L22-8L39-9L23 9L29 23L8 21L0 39L-8 21L-29 23L-23 9L-39-9L-22-8L-26-30L-8-19Z" fill="#d28a49"/><path d="M0 40V-25M0 9L23-8M0 9L-23-8" stroke="#f8cd89" stroke-width="2" fill="none"/></g><g transform="translate(210 207)"><path d="M0-15Q-15-31-26-14Q-38 8-17 20H13Q35 5 23-13Q14-25 0-15Z" fill="#ca7842"/><path d="M0-15Q-10 5-3 20M5-15Q18 6 10 20" stroke="#aa5b36" stroke-width="2" fill="none"/><path d="M0-15Q-3-28 6-30" stroke="#66805b" stroke-width="4" fill="none"/></g>)
  when 11
   %(<path d="M154 106Q170 66 152 26M160 58L137 43M162 74L184 54M155 42L169 24" fill="none" stroke="#8f839b" stroke-width="3" stroke-linecap="round"/><ellipse cx="207" cy="96" rx="24" ry="5" fill="#cdc6dd"/><rect x="191" y="49" width="31" height="47" rx="5" fill="#f7eee0"/><path d="M195 55H218V91H195Z" fill="#f2d9b6"/><path d="M206 50V41" stroke="#817276" stroke-width="2"/><path d="M206 43Q189 32 206 14Q223 32 206 43Z" fill="#e5b975"/><path d="M206 39Q200 32 206 25Q212 32 206 39Z" fill="#fff0c9"/>)+leaf(218,213,52,'#a89baf',0.8)
  when 12
   fir(181,28,0.94)+%(<path d="M181 3L185 14L197 15L187 22L190 34L181 27L171 34L175 22L165 15L177 14Z" fill="#e2b866"/><g fill="#d38778"><circle cx="168" cy="60" r="5"/><circle cx="197" cy="83" r="5"/></g><g fill="#e5c17a"><circle cx="187" cy="49" r="4"/><circle cx="158" cy="87" r="4"/></g><g transform="translate(194 187)"><rect y="5" width="38" height="29" rx="3" fill="#bb7271"/><rect x="-3" width="44" height="9" rx="2" fill="#d48e86"/><path d="M19 0V34M19 0C-3-15-3 8 19 0C41-15 41 8 19 0Z" fill="none" stroke="#f0d49c" stroke-width="4"/></g>)+snow(38,36,0.7)
  end
 end
 def svg(year,month,name)
  label,accent,bg,tint=THEMES.fetch(month-1)
  first=(Date.new(year,month,1).cwday-1)
  days=Date.new(year,month,-1).day
  dates=(1..days).map do |day|
   cell=first+day-1; col=cell%7; row=cell/7
   %(<text data-day="#{day}" x="#{52+col*20}" y="#{140+row*12}" fill="#{col>4 ? accent : '#4d5b64'}">#{day}</text>)
  end.join
  <<~SVG
   <svg xmlns="http://www.w3.org/2000/svg" width="240" height="240" viewBox="0 0 240 240" role="img" aria-labelledby="title desc">
   <title id="title">#{name} #{year}</title><desc id="desc">#{label}. Tikslus mėnesio tinklelis, savaitė prasideda pirmadienį.</desc>
   <defs><linearGradient id="back" x2="1" y2="1"><stop stop-color="#{bg}"/><stop offset="1" stop-color="#{tint}"/></linearGradient><linearGradient id="header" x2="1" y2="1"><stop stop-color="#{accent}"/><stop offset="1" stop-color="#{accent}" stop-opacity=".78"/></linearGradient><filter id="paper" x="-30%" y="-30%" width="170%" height="180%"><feDropShadow dx="0" dy="6" stdDeviation="6" flood-color="#{accent}" flood-opacity=".18"/></filter></defs>
   <rect x="2" y="2" width="236" height="236" rx="40" fill="url(#back)"/>
   <circle cx="193" cy="51" r="62" fill="#fff" opacity=".35"/>
   #{motif(month)}
   <g filter="url(#paper)"><rect x="28" y="76" width="166" height="139" rx="12" fill="#fffdf9"/><path d="M40 76H182Q194 76 194 88V113H28V88Q28 76 40 76Z" fill="url(#header)"/><path d="M40 209H182" stroke="#{tint}" stroke-width="2"/></g>
   <g fill="none" stroke="#e9e7dc" stroke-width="5" stroke-linecap="round"><path d="M56 69V83M166 69V83"/></g>
   <text x="44" y="100" font-family="Lato,Arial,sans-serif" font-size="16" font-weight="800" fill="#fff">#{format('%02d',month)}</text><text x="177" y="99" text-anchor="end" font-family="Lato,Arial,sans-serif" font-size="11" font-weight="700" fill="#fff">#{year}</text>
   <g font-family="Lato,Arial,sans-serif" text-anchor="middle" font-size="8" font-weight="700">#{%w[P A T K P Š S].each_with_index.map { |d,i|%(<text x="#{52+i*20}" y="125" fill="#{accent}" opacity=".75">#{d}</text>) }.join}</g>
   <g font-family="Lato,Arial,sans-serif" text-anchor="middle" font-size="9" font-weight="600">#{dates}</g>
   <path d="M38 227H132" stroke="#{accent}" stroke-opacity=".14" stroke-width="2" stroke-linecap="round"/>
   </svg>
  SVG
 end
 def generate(root,months)
  dir=File.join(root,'site/assets/visuals/month-calendars');FileUtils.mkdir_p(dir)
  [2027,2028,2029].each do |year|
   months.each_with_index { |month,i|File.write(File.join(dir,"#{year}-#{month[0]}.svg"),svg(year,i+1,month[1])) }
  end
 end
end
