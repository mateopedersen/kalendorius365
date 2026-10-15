# frozen_string_literal: true
require 'fileutils'
require 'json'
require 'digest'
require_relative '../lib/calendar'
ROOT=File.expand_path('..',__dir__)
Dir.chdir(ROOT) do
 system(RbConfig.ruby,'scripts/prepare.rb',exception:true)
 system(RbConfig.ruby,'scripts/pages.rb',exception:true)
 system('bundle','exec','jekyll','build','--source','site','--destination','public',exception:true)
 # Fail on accidentally exceeding the existing Free static hosting limits.
 files=Dir.glob('public/**/*').select { |p|File.file?(p) }
 abort 'Cloudflare Free file limit exceeded' if files.length>20_000
 abort 'Cloudflare static asset size limit exceeded' if files.any? { |p|File.size(p)>25*1024*1024 }
 urls=files.select { |p|p.end_with?('/index.html') }.map { |p|'https://kalendorius365.lt/'+p.delete_prefix('public/').delete_suffix('index.html') }
 # Preview remains noindex until the release gate has passed. Sitemap is intentionally empty.
 release=ENV['K365_RELEASE']=='1'
 if release
  manifest_check=JSON.parse(File.read('site/assets/data/manifest.json'))
  digest=Digest::SHA256.hexdigest(%w[scripts/render_prints.py data/calendar.json site/assets/data/years.json site/assets/fonts/Inter-Regular.ttf site/assets/fonts/Inter-Bold.ttf].map { |p|File.binread(p) }.join)
  abort 'Print assets are stale: renderer/data/font fingerprint changed' unless manifest_check['generator']==digest
  %w[docs/sample-preflight.json docs/print-preflight.json].each do |p|
   report=JSON.parse(File.read(p));abort "Missing or stale preflight: #{p}" unless report['status']=='passed' && report['generator']==digest
  end
 end
 if release
  files.select { |p|p.end_with?('.html') && p!='public/404.html' }.each { |p|s=File.read(p).sub('<meta name="robots" content="noindex, follow">','<meta name="robots" content="index, follow">');File.write(p,s) }
 end
 require 'cgi'
 xml='<?xml version="1.0" encoding="UTF-8"?><urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9" xmlns:image="http://www.google.com/schemas/sitemap-image/1.1">'
 manifest=JSON.parse(File.read('site/assets/data/manifest.json'))['assets']
 keys=%w[kind year month design name style layout stem landscape rows sunday pdf webp preview paper dimensions typography]
 File.write('public/assets/data/catalog.json',JSON.generate({'assets'=>manifest.map { |e|e.select { |k,v|keys.include?(k) } }}))
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
 headers+="  X-Robots-Tag: noindex\n" unless release
 headers+="/assets/*\n  Cache-Control: public, max-age=86400\n/downloads/*\n  Cache-Control: public, max-age=86400\n"
 headers+="/assets/*.js\n  Cache-Control: public, max-age=0, must-revalidate\n/assets/*.css\n  Cache-Control: public, max-age=0, must-revalidate\n"
 File.write('public/_headers',headers)
 puts "Built #{urls.length} canonical HTML pages; #{files.length} static files; release=#{release}"
end
