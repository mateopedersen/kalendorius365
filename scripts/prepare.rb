# frozen_string_literal: true
require_relative '../lib/calendar'
require 'fileutils'
ROOT=File.expand_path('..',__dir__)
FileUtils.mkdir_p("#{ROOT}/site/assets/data")
FileUtils.mkdir_p("#{ROOT}/site/_data")
File.write("#{ROOT}/site/assets/data/calendar.json",JSON.generate(Kalendorius::DATA))
File.write("#{ROOT}/site/_data/calendar.json",JSON.generate(Kalendorius::DATA))
editorial=JSON.parse(File.read("#{ROOT}/data/holiday-editorial.json"))
articles=editorial.fetch('articles')+editorial.fetch('commemorations')
source_ids=%w[labour-code labour-code-future labour-code-2027 memoriam-law e-tar-versions flag-law]
editorial['records']=Kalendorius::DATA.fetch('holidays').map do |holiday|
 article=articles.find { |candidate|Array(candidate['holiday_ids']).include?(holiday['id']) }
 next unless article
 ids=Array(article['sources'])
 legal_sources=ids.select { |id|source_ids.include?(id) }
 cultural_sources=ids-legal_sources
 {
  'id'=>holiday['id'],'canonical_slug'=>article['slug'],'title_lt'=>holiday['legalName']||holiday['name'],
  'grammatical_forms_lt'=>{'nominative'=>holiday['legalName']||holiday['name']},'aliases_lt'=>Array(article['aliases_lt']),
  'category_tags'=>['statutory_public_holiday']+Array(article['category_tags']),
  'statutory_public_holiday'=>true,'exact_legal_label'=>holiday['legalName']||holiday['name'],
  'public_holiday_effect'=>'paprastai nedirbama; taikomos įstatymo išimtys',
  'recurrence_rule'=>holiday.select { |key,_|%w[rule month day offset].include?(key) },
  'legal_basis'=>legal_sources.map { |id|editorial['sources'][id]['url'] },
  'legal_effective_from'=>'2027-01-01','legal_effective_to'=>nil,
  'legal_reference_periods'=>{'current_reviewed'=>'2026-06-07/2026-10-31','upcoming_2026'=>'2026-11-01/2026-12-31','planning_years'=>'2027-01-01/'},
  'flag_requirement_verified'=>article.fetch('flag_requirement_verified',nil),
  'historical_source_urls'=>cultural_sources.filter_map { |id|editorial['sources'][id]['url'] if %w[feb16 mar11 jan13-history statehood-culture labour-history mothers-day-research fathers-day-research].include?(id) },
  'cultural_source_urls'=>cultural_sources.filter_map { |id|editorial['sources'][id]['url'] if id.end_with?('-culture','-vėlinės','-research') },
  'reference_licensing'=>'Nuorodos į teisės aktus ir institucijų paaiškinimus; originalus apibendrinimas, be perpublikuotų ištraukų.',
  'editorial_status'=>article.fetch('editorial_status','ai-reviewed; native-human-proofread-not-performed'),
  'updated_at'=>editorial['research_date'],'verified_at'=>editorial['research_date'],
  'reviewer_notes'=>'DK 123 str. tekstas tiesiogiai tikrintas Seimo oficialioje 2026 m. ir nuo 2027-01-01 numatytoje redakcijoje. AI turinio peržiūra atlikta 2026-10-16; gimtakalbio lietuvių redaktoriaus peržiūra neatlikta.',
  'related_holidays'=>Array(article['related']),'media_asset_ids'=>Array(article['documentary_image']).compact
 }
end.compact
editorial['records']+=editorial.fetch('commemorations').map do |article|
 ids=Array(article['sources'])
 legal_sources=ids.select { |id|source_ids.include?(id) }
 cultural_sources=ids-legal_sources
 {
  'id'=>article['id'],'canonical_slug'=>article['slug'],'title_lt'=>article['title'],
  'grammatical_forms_lt'=>{'nominative'=>article['title']},'aliases_lt'=>Array(article['aliases_lt']),
  'category_tags'=>['commemoration']+Array(article['category_tags']),
  'statutory_public_holiday'=>false,'exact_legal_label'=>article['title'],
  'public_holiday_effect'=>'atmintinos dienos statusas savaime nesuteikia nedarbo dienos',
  'recurrence_rule'=>{'rule'=>'fixed','month'=>article['month'],'day'=>article['day']},
  'legal_basis'=>legal_sources.map { |id|editorial['sources'][id]['url'] },
  'legal_effective_from'=>editorial.dig('legal_version','memoriam_days_act').split('/').first,
  'legal_effective_to'=>nil,'flag_requirement_verified'=>article.fetch('flag_requirement_verified',nil),
  'historical_source_urls'=>cultural_sources.filter_map { |id|editorial['sources'][id]['url'] if id=='jan13-history' },
  'cultural_source_urls'=>cultural_sources.filter_map { |id|editorial['sources'][id]['url'] },
  'reference_licensing'=>'Nuorodos į teisės aktus ir institucijų paaiškinimus; originalus apibendrinimas, be perpublikuotų ištraukų.',
  'editorial_status'=>article.fetch('editorial_status','ai-reviewed; native-human-proofread-not-performed'),
  'updated_at'=>editorial['research_date'],'verified_at'=>editorial['research_date'],
  'reviewer_notes'=>'Atmintinos dienos teisinis statusas atskirtas nuo DK 123 straipsnio; vėliavos pareigos nedaromos prielaida. AI turinio peržiūra atlikta 2026-10-16; gimtakalbio lietuvių redaktoriaus peržiūra neatlikta.',
  'related_holidays'=>Array(article['related']),'media_asset_ids'=>Array(article['documentary_image']).compact
 }
end
File.write("#{ROOT}/site/assets/data/holiday-editorial.json",JSON.generate(editorial))
File.write("#{ROOT}/site/_data/holiday-editorial.json",JSON.generate(editorial))
home_editorial = {
 'articles' => editorial.fetch('articles').map { |item|item.select { |key,_|%w[id slug holiday_ids title category].include?(key) } },
 'commemorations' => editorial.fetch('commemorations').map { |item|item.select { |key,_|%w[id slug holiday_ids title category month day].include?(key) } }
}
File.write("#{ROOT}/site/assets/data/home-holiday-data.json",JSON.generate(home_editorial))
File.write("#{ROOT}/site/assets/data/years.json",JSON.generate([2027,2028,2029].map { |y| Kalendorius.year(y) }))
FileUtils.mkdir_p("#{ROOT}/site/assets/data/astronomy")
FileUtils.cp("#{ROOT}/shared/weather-cities.js", "#{ROOT}/site/assets/data/weather-cities.js")
%w[moon-phases-utc.json seasons-utc.json cities.json].each do |name|
 FileUtils.cp("#{ROOT}/data/astronomy/#{name}","#{ROOT}/site/assets/data/astronomy/#{name}")
end
FileUtils.mkdir_p("#{ROOT}/site/assets/data/lt")
FileUtils.cp("#{ROOT}/data/lt/work-rest-rules.json","#{ROOT}/site/assets/data/lt/work-rest-rules.json")
