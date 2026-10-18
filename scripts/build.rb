# frozen_string_literal: true
require 'fileutils'
require 'json'
require 'digest'
require 'base64'
require 'tempfile'
require 'tmpdir'
require_relative '../lib/calendar'
require_relative '../lib/asset_release'
require_relative '../lib/build_policy'
require_relative '../lib/css_minifier'
require_relative '../lib/static_asset_urls'
ROOT=File.expand_path('..',__dir__)
Dir.chdir(ROOT) do
 previous_revisions=AssetRelease.previous_revisions(File.join(ROOT,'public'))
 release_manifest=nil
 release=false
 Dir.mktmpdir('kalendorius-previous-releases') do |release_backup|
  AssetRelease.stash_previous_releases(File.join(ROOT,'public'),release_backup,previous_revisions)
 # A release request is insufficient on a Cloudflare feature branch. Keep
 # preview HTML and response headers out of search even if its build command
 # uses the same K365_RELEASE flag as production.
 release=Kalendorius::BuildPolicy.release?(ENV)
 system(RbConfig.ruby,'scripts/prepare.rb',exception:true)
 system(RbConfig.ruby,'scripts/pages.rb',exception:true)
 system('python3','scripts/css_route_split.py',exception:true)
 Tempfile.create(['kalendorius-build-policy','.yml']) do |config|
  config.write(JSON.generate({'release'=>release}));config.flush
  system('bundle','exec','jekyll','build','--config',"site/_config.yml,#{config.path}",'--source','site','--destination','public',exception:true)
 end
 homepage=File.read('public/index.html')
 css_version=homepage[%r{/assets/(?:style|homepage-bundle)\.css\?v=([^"' >]+)},1]
 script_version=homepage[%r{/assets/common\.js\?v=([^"' >]+)},1]
 abort 'Generated CSS version was not found in the homepage' unless css_version
 abort 'Generated JavaScript version was not found in the homepage' unless script_version
 Dir.glob('public/assets/**/*.css').each do |path|
  css=File.read(path)
  css.gsub!(%r{(/assets/fonts/Lato-(?:Regular|Bold|Black)\.woff2)(?!\?v=)}) { "#{$1}?v=#{css_version}" }
  File.write(path,Kalendorius::CssMinifier.minify(css))
 end
 system('node','scripts/minify_css.mjs','public/assets',exception:true)
 Dir.glob('public/assets/**/*.js').each do |path|
  javascript=File.read(path)
  javascript.gsub!(/((?:\bfrom\s*|\bimport\s*(?:\(\s*)?)["'])([^"']+\.js)(?:\?[^"']*)?(["'])/) do
   prefix,specifier,quote=Regexp.last_match.values_at(1,2,3)
   specifier.start_with?('.', '/') ? "#{prefix}#{specifier}?v=#{script_version}#{quote}" : Regexp.last_match(0)
  end
  File.write(path,javascript)
 end
 system('python3','scripts/inline_route_css.py',exception:true)
 versioned_asset_references=Kalendorius::StaticAssetUrls.rewrite!('public')
 puts "Content-versioned #{versioned_asset_references} static image, data and print URLs"
 system('python3','scripts/inline_lcp_image.py',exception:true)
 # Run after URL rewriting and CSS runtime-class discovery, which operate on
 # readable modules. Hashes include the compiler and its pinned dependency lock.
 system('node','scripts/minify_js.mjs','public/assets',exception:true)
 # Cloudflare cache rules may ignore query strings. Keep the editor bundle on
 # a content-versioned sibling path so even query-blind caches fetch the build
 # that the page references. AssetRelease then mirrors this path into its
 # immutable release directory alongside every other static asset.
 editor_release_version=Digest::SHA256.hexdigest("#{script_version}\0#{css_version}")[0,12]
 editor_path_references=Kalendorius::StaticAssetUrls.version_calendar_editor_paths!('public',editor_release_version)
 puts "Path-versioned #{editor_path_references} calendar-editor references for cache-safe deployment"
  previous_revisions=AssetRelease.restore_previous_releases(File.join(ROOT,'public'),release_backup,previous_revisions)
  release_manifest=AssetRelease.publish(File.join(ROOT,'public'),previous:previous_revisions)
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
   manifest.select { |e|e['kind']=='monthly' && url=="https://kalendorius365.lt/#{e['year']}/#{Kalendorius::DATA['months'][e['month']-1][0]}/" }.each { |e|xml+="<image:image><image:loc>https://kalendorius365.lt#{e['webp']}?v=#{e.dig('files','webp','sha256')[0,16]}</image:loc></image:image>" }
   xml+='</url>'
  end
 end
 File.write('public/sitemap.xml',xml+'</urlset>')
 File.write('public/robots.txt',"User-agent: *\nAllow: /\nSitemap: https://kalendorius365.lt/sitemap.xml\n")
 headers="/*\n  X-Content-Type-Options: nosniff\n  Referrer-Policy: strict-origin-when-cross-origin\n  Permissions-Policy: camera=(), microphone=(), geolocation=()\n"
 theme_script=File.read('site/_layouts/default.html')[/<script>(.*?)<\/script>/m,1]
 abort 'Inline theme initializer not found; update the CSP hash strategy' unless theme_script
 theme_hash=Base64.strict_encode64(Digest::SHA256.digest(theme_script))
 header_script=File.read('site/_layouts/default.html')[/<script data-header-boot>(.*?)<\/script>/m,1]
 abort 'Inline header initializer not found; update the CSP hash strategy' unless header_script
 header_hash=Base64.strict_encode64(Digest::SHA256.digest(header_script))
 headers+="  Content-Security-Policy: default-src 'self'; base-uri 'self'; object-src 'none'; frame-ancestors 'none'; frame-src https://docs.google.com; form-action 'self'; img-src 'self' data: blob:; font-src 'self' data:; style-src 'self' 'unsafe-inline'; script-src 'self' 'sha256-#{theme_hash}' 'sha256-#{header_hash}'; connect-src 'self'; upgrade-insecure-requests\n"
 headers+="  X-Robots-Tag: noindex\n" unless release
 immutable='Cache-Control: public, max-age=31536000, immutable'
 # The editor's isolated versioned copy is also immutable before the main
 # release rewrite, so one wildcard rule covers its modules and JSON payload.
 headers+="/assets/calendar-editor-release-*/*\n  #{immutable}\n"
 revalidate='Cache-Control: public, no-cache, max-age=0, must-revalidate'
 # Trailing-slash page patterns never overlap file assets. Cloudflare Pages
 # accepts at most 100 rules; avoid one rule per each of the 185 HTML routes.
 %w[/ /:section/ /:section/:child/ /:section/:child/:page/ /*.html /404 /robots.txt /sitemap.xml /assets/release-manifest.json].each do |route|
  headers+="#{route}\n  #{revalidate}\n"
 end
 headers+="/assets/releases/*\n  #{immutable}\n"
 data_cache=revalidate
 # Use exact paths for versioned code and data, so _headers never applies
 # multiple Cache-Control values to one response through overlapping globs.
 files.select { |path|path.end_with?('.js','.css') && !path.include?('/assets/releases/') && !path.start_with?('public/assets/calendar-editor/') && !path.start_with?('public/assets/calendar-editor-release-') }.sort.each do |path|
  headers+="/#{path.delete_prefix('public/')}\n  #{revalidate}\n"

 end
 headers+="/assets/calendar-editor/*\n  #{revalidate}\n"
 headers+="/assets/fonts/*\n  #{immutable}\n"
 files.select { |path|path.end_with?('.json') && !path.include?('/assets/releases/') && !path.start_with?('public/assets/calendar-editor/') && !path.start_with?('public/assets/calendar-editor-release-') && !path.start_with?('public/assets/visuals/') && path!='public/assets/release-manifest.json' }.sort.each do |path|
  headers+="/#{path.delete_prefix('public/')}\n  #{data_cache}\n"
 end
 files.grep(%r{public/assets/[^/]+\.svg\z}).sort.each do |path|
  headers+="/#{path.delete_prefix('public/')}\n  #{immutable}\n"
 end
 headers+="/assets/visuals/*\n  #{immutable}\n/assets/previews/*\n  #{immutable}\n/assets/previews-small/*\n  #{immutable}\n/assets/holiday-ics/*\n  #{immutable}\n/downloads/*\n  #{immutable}\n"
 headers+="/assets/seasons-ics/*\n  #{immutable}\n  Content-Type: text/calendar; charset=utf-8\n"
 headers+="/assets/namedays-ics/*\n  #{immutable}\n  Content-Type: text/calendar; charset=utf-8\n"
 headers+="/assets/holiday-guides-ics/*\n  #{immutable}\n"
 headers+="/assets/lunar/days/*\n  #{immutable}\n/assets/lunar/albedo-web.png\n  #{immutable}\n/assets/lunar/albedo-web.webp\n  #{immutable}\n/assets/lunar/albedo.png\n  #{immutable}\n/assets/lunar/menulio-kalendorius-1200x630.png\n  #{immutable}\n"
 abort 'Cloudflare Pages header rule limit exceeded' if headers.lines.count { |line|line.start_with?('/') }>100
 File.write('public/_headers',headers)
 system('python3','scripts/lunar/check_release.py',exception:true) if release
 system('python3','scripts/lunar/check_pages.py',exception:true) if release
 system('python3','scripts/monthly_holidays/check_release.py',exception:true) if release
 puts "Asset release #{release_manifest.fetch('revision')}; retained #{release_manifest.fetch('retained_revisions').length} revision(s)"
 puts "Built #{urls.length} canonical HTML pages; #{files.length} static files; release=#{release}"
end
