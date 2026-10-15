# frozen_string_literal: true
require_relative '../lib/calendar'
require 'fileutils'
ROOT=File.expand_path('..',__dir__)
FileUtils.mkdir_p("#{ROOT}/site/assets/data")
FileUtils.mkdir_p("#{ROOT}/site/_data")
File.write("#{ROOT}/site/assets/data/calendar.json",JSON.generate(Kalendorius::DATA))
File.write("#{ROOT}/site/_data/calendar.json",JSON.generate(Kalendorius::DATA))
File.write("#{ROOT}/site/assets/data/years.json",JSON.generate([2027,2028].map { |y| Kalendorius.year(y) }))
