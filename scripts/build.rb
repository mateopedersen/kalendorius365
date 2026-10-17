# frozen_string_literal: true
require 'fileutils'
require 'json'
require 'digest'
require 'base64'
require 'tempfile'
require_relative '../lib/calendar'
require_relative '../lib/build_policy'
ROOT=File.expand_path('..',__dir__)
Dir.chdir(ROOT) do
 # A release request is insufficient on a Cloudflare feature branch. Keep
 # preview HTML and response headers out of search even if its build command
 # uses the same K365_RELEASE flag as production.
 release=Kalendorius::BuildPolicy.release?(ENV)
 system(RbConfig.ruby,'scripts/prepare.rb',exception:true)
 system(RbConfig.ruby,'scripts/pages.rb',exception:true)
 Tempfile.create(['kalendorius-build-policy','.yml']) do |config|
  config.write(JSON.generate({'release'=>release}));config.flush
  system('bundle','exec','jekyll','build','--config',"site/_config.yml,#{config.path}",'--source','site','--destination','public',exception:true)
 end
 homepage=File.read('public/index.html')
 css_version=homepage[%r{/assets/style\.css\?v=([^"' >]+)},1]
 script_version=homepage[%r{/assets/common\.js\?v=([^"' >]+)},1]
 abort 'Generated CSS version was not found in the homepage' unless css_version
 abort 'Generated JavaScript version was not found in the homepage' unless script_version
 Dir.glob('public/assets/**/*.css').each do |path|
  css=File.read(path)
  css.gsub!(%r{(/assets/fonts/Lato-(?:Regular|Bold|Black)\.woff2)(?!\?v=)}) { "#{$1}?v=#{css_version}" }
  File.write(path,css)
 end
 Dir.glob('public/assets/**/*.js').each do |path|
  javascript=File.read(path)
  javascript.gsub!(/((?:\bfrom\s*|\bimport\s*(?:\(\s*)?)["'])([^"']+\.js)(?:\?[^"']*)?(["'])/) do
   prefix,specifier,quote=Regexp.last_match.values_at(1,2,3)
   specifier.start_with?('.', '/') ? "#{prefix}#{specifier}?v=#{script_version}#{quote}" : Regexp.last_match(0)
  end
  File.write(path,javascript)
 end
 # Fail on accidentally exceeding the existing Free static hosting limits.
 files=Dir.glob('public/**/*').select { |p|File.file?(p) }
 abort 'Cloudflare Free file limit exceeded' if files.length>20_000
 abort 'Cloudflare static asset size limit exceeded' if files.any? { |p|File.size(p)>25*1024*1024 }
 urls=files.select { |p|p.end_with?('/index.html') }.map { |p|'https://kalendorius365.lt/'+p.delete_prefix('public/').delete_suffix('index.html') }
 # Preview remains noindex until the release gate has passed. Sitemap is intentionally empty.
 if release
  manifest_check=JSON.parse(File.read('site/assets/data/manifest.json'))
  digest=Digest::SHA256.hexdigest(%w[scripts/render_prints.py data/calendar.json site/assets/data/years.json site/assets/fonts/Inter-Regular.ttf site/assets/fonts/Inter-Bold.ttf].map { |p|File.binread(p) }.join)
  abort 'Print assets are stale: renderer/data/font fingerprint changed' unless manifest_check['generator']==digest
  %w[docs/sample-preflight.json docs/print-preflight.json].each do |p|
   report=JSON.parse(File.read(p));abort "Missing or stale preflight: #{p}" unless report['status']=='passed' && report['generator']==digest
  end
 end
 require 'cgi'
 xml='<?xml version="1.0" encoding="UTF-8"?><urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9" xmlns:image="http://www.google.com/schemas/sitemap-image/1.1">'
 manifest=JSON.parse(File.read('site/assets/data/manifest.json'))['assets']
 abort 'Release requires every print asset to pass preflight' if release && manifest.any? { |e|e.dig('verification','status')!='passed' }
 if release
  urls.sort.each do |url|
   xml+="<url><loc>#{CGI.escapeHTML(url)}</loc>"
   manifest.select { |e|e['kind']=='monthly' && url=="https://kalendorius365.lt/#{e['year']}/#{Kalendorius::DATA['months'][e['month']-1][0]}/" }.each { |e|xml+="<image:image><image:loc>https://kalendorius365.lt#{e['webp']}</image:loc></image:image>" }
   xml+='</url>'
  end
 end
 File.write('public/sitemap.xml',xml+'</urlset>')
 File.write('public/robots.txt',"User-agent: *\nAllow: /\nSitemap: https://kalendorius365.lt/sitemap.xml\n")
 headers="/*\n  X-Content-Type-Options: nosniff\n  Referrer-Policy: strict-origin-when-cross-origin\n  Permissions-Policy: camera=(), microphone=(), geolocation=()\n"
 theme_script=File.read('site/_layouts/default.html')[/<script>(.*?)<\/script>/m,1]
 abort 'Inline theme initializer not found; update the CSP hash strategy' unless theme_script
 theme_hash=Base64.strict_encode64(Digest::SHA256.digest(theme_script))
 headers+="  Content-Security-Policy: default-src 'self'; base-uri 'self'; object-src 'none'; frame-ancestors 'none'; form-action 'self'; img-src 'self' data: blob:; font-src 'self' data:; style-src 'self' 'unsafe-inline'; script-src 'self' 'sha256-#{theme_hash}'; connect-src 'self'; upgrade-insecure-requests\n"
 headers+="  X-Robots-Tag: noindex\n" unless release
 one_day='Cache-Control: public, max-age=86400'
 immutable='Cache-Control: public, max-age=31536000, immutable'
 data_cache='Cache-Control: public, max-age=3600, stale-while-revalidate=86400'
 # Use exact paths for versioned code and data, so _headers never applies
 # multiple Cache-Control values to one response through overlapping globs.
 files.select { |path|path.end_with?('.js','.css') }.sort.each do |path|
  headers+="/#{path.delete_prefix('public/')}\n  #{immutable}\n"
 end
 files.grep(%r{public/assets/fonts/Lato-(?:Regular|Bold|Black)\.woff2\z}).sort.each do |path|
  headers+="/#{path.delete_prefix('public/')}\n  #{immutable}\n"
 end
 files.grep(%r{public/assets/data/.*\.json\z}).sort.each do |path|
  headers+="/#{path.delete_prefix('public/')}\n  #{data_cache}\n"
 end
 headers+="/assets/fonts/Inter-Regular.woff2\n  #{one_day}\n"
 files.grep(%r{public/assets/[^/]+\.svg\z}).sort.each do |path|
  headers+="/#{path.delete_prefix('public/')}\n  #{one_day}\n"
 end
 headers+="/assets/visuals/*\n  #{one_day}\n/assets/previews/*\n  #{one_day}\n/assets/previews-small/*\n  #{one_day}\n/assets/holiday-ics/*\n  #{one_day}\n/downloads/*\n  #{one_day}\n"
 headers+="/assets/seasons-ics/*\n  #{one_day}\n  Content-Type: text/calendar; charset=utf-8\n"
 headers+="/assets/namedays-ics/*\n  #{one_day}\n  Content-Type: text/calendar; charset=utf-8\n"
 headers+="/assets/holiday-guides-ics/*\n  #{one_day}\n"
 headers+="/assets/lunar/days/*\n  #{one_day}\n/assets/lunar/albedo-web.png\n  #{one_day}\n/assets/lunar/albedo.png\n  #{one_day}\n/assets/lunar/menulio-kalendorius-1200x630.png\n  #{one_day}\n"
 File.write('public/_headers',headers)
 system('python3','scripts/lunar/check_release.py',exception:true) if release
 system('python3','scripts/lunar/check_pages.py',exception:true) if release
 system('python3','scripts/monthly_holidays/check_release.py',exception:true) if release
 puts "Built #{urls.length} canonical HTML pages; #{files.length} static files; release=#{release}"
end
