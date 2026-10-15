# frozen_string_literal: true
require_relative '../lib/calendar'
require 'fileutils'
ROOT=File.expand_path('..',__dir__)
FileUtils.mkdir_p("#{ROOT}/site/assets/data")
FileUtils.mkdir_p("#{ROOT}/site/_data")
File.write("#{ROOT}/site/assets/data/calendar.json",JSON.generate(Kalendorius::DATA))
File.write("#{ROOT}/site/_data/calendar.json",JSON.generate(Kalendorius::DATA))
File.write("#{ROOT}/site/assets/data/years.json",JSON.generate([2027,2028,2029].map { |y| Kalendorius.year(y) }))
FileUtils.mkdir_p("#{ROOT}/site/assets/data/astronomy")
%w[moon-phases-utc.json seasons-utc.json cities.json].each do |name|
 FileUtils.cp("#{ROOT}/data/astronomy/#{name}","#{ROOT}/site/assets/data/astronomy/#{name}")
end
FileUtils.mkdir_p("#{ROOT}/site/assets/data/lt")
FileUtils.cp("#{ROOT}/data/lt/work-rest-rules.json","#{ROOT}/site/assets/data/lt/work-rest-rules.json")
