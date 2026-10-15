# frozen_string_literal: true
require 'date'
require 'json'
module Kalendorius
  DATA = JSON.parse(File.read(File.expand_path('../data/calendar.json', __dir__))).freeze
  module_function
  # Meeus/Jones/Butcher Gregorian computus (Gregorian dates only).
  def easter(y)
    a = y % 19; b = y / 100; c = y % 100; d = b / 4; e = b % 4
    f = (b + 8) / 25; g = (b - f + 1) / 3; h = (19*a+b-d-g+15) % 30
    i = c / 4; k = c % 4; l = (32+2*e+2*i-h-k) % 7; m = (a+11*h+22*l) / 451
    n = h+l-7*m+114
    Date.new(y, n/31, n%31+1, Date::GREGORIAN)
  end
  def holidays(y)
    DATA['holidays'].map do |h|
      date = case h['rule']
      when 'easter' then easter(y) + h['offset']
      when 'first-sunday'
        first = Date.new(y, h['month'], 1, Date::GREGORIAN)
        first + ((7-first.wday)%7)
      else Date.new(y, h['month'], h['day'], Date::GREGORIAN)
      end
      h.merge('date'=>date.iso8601, 'classification'=>'statutory')
    end.sort_by { |h| [h['date'],h['id']] }
  end
  def month(y,m)
    first = Date.new(y,m,1,Date::GREGORIAN); last = Date.new(y,m,-1,Date::GREGORIAN)
    start = first - (first.cwday-1); hs = holidays(y).group_by { |h| h['date'] }
    {'year'=>y,'month'=>m,'length'=>last.day,'offset'=>first.cwday-1,
     'weeks'=>((last.day+first.cwday-2)/7)+1,
     'days'=>(first..last).map { |d| {'date'=>d.iso8601,'day'=>d.day,'weekday'=>d.cwday,'isoWeek'=>d.cweek,'isoYear'=>d.cwyear,'holidays'=>hs[d.iso8601]||[]} },
     'grid'=>(0...42).map { |i| d=start+i; {'date'=>d.iso8601,'day'=>d.day,'inMonth'=>d.month==m,'isoWeek'=>d.cweek} }}
  end
  def work_month(y,m,six=false)
    dates=(Date.new(y,m,1,Date::GREGORIAN)..Date.new(y,m,-1,Date::GREGORIAN)).to_a
    hs=(holidays(y)+holidays(y+1)).map { |h|h['date'] }
    scheduled=->(d) { six ? d.cwday<=6 : d.cwday<=5 }
    working=dates.select { |d|scheduled.call(d) && !hs.include?(d.iso8601) }
    shortened=working.select { |d|hs.include?((d+1).iso8601) }
    {'month'=>m,'days'=>working.length,'weekends'=>dates.count { |d|!scheduled.call(d) },
     'holidays'=>dates.count { |d|scheduled.call(d) && hs.include?(d.iso8601) },
     'shortened'=>shortened.map(&:iso8601),
     'hours'=>working.sum { |d|six ? (d.cwday==6 ? 5 : 7) : 8 }-shortened.length}
  end
  def year(y)
    {'year'=>y,'months'=>(1..12).map { |m|month(y,m) },'holidays'=>holidays(y),
     'work5'=>(1..12).map { |m|work_month(y,m) },'work6'=>(1..12).map { |m|work_month(y,m,true) }}
  end
end
