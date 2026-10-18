require 'minitest/autorun'
require 'tmpdir'
require 'fileutils'
require 'digest'
require_relative '../lib/static_asset_urls'

class StaticAssetUrlsTest < Minitest::Test
  def setup
    @root = Dir.mktmpdir('kalendorius-static-assets')
    FileUtils.mkdir_p(File.join(@root, 'assets/visuals'))
    FileUtils.mkdir_p(File.join(@root, 'assets/visuals/seasons'))
    FileUtils.mkdir_p(File.join(@root, 'assets/data'))
    FileUtils.mkdir_p(File.join(@root, 'assets/seasons-ics'))
    FileUtils.mkdir_p(File.join(@root, 'downloads'))
    File.binwrite(File.join(@root, 'assets/visuals/icon.svg'), '<svg/>')
    %w[spring summer].each { |season| File.binwrite(File.join(@root, "assets/visuals/seasons/#{season}-earth.svg"), "<svg>#{season}</svg>") }
    File.binwrite(File.join(@root, 'assets/data/index.json'), '{"ok":true}')
    File.binwrite(File.join(@root, 'assets/data/zodiac.json'), '{"art":"/assets/visuals/icon.svg"}')
    File.binwrite(File.join(@root, 'assets/data/manifest.json'), '{"pdf":"/downloads/print.pdf"}')
    File.binwrite(File.join(@root, 'downloads/print.pdf'), '%PDF-1.7')
    %w[2027-pavasario-lygiadienis 2028-pavasario-lygiadienis].each do |name|
      File.binwrite(File.join(@root, "assets/seasons-ics/#{name}.ics"), "BEGIN:VCALENDAR\\n#{name}")
    end
  end

  def teardown
    FileUtils.remove_entry(@root)
  end

  def test_rewrites_static_asset_urls_with_content_versions
    svg_hash = Digest::SHA256.file(File.join(@root, 'assets/visuals/icon.svg')).hexdigest[0, 12]
    json_hash = Digest::SHA256.file(File.join(@root, 'assets/data/index.json')).hexdigest[0, 12]
    pdf_hash = Digest::SHA256.file(File.join(@root, 'downloads/print.pdf')).hexdigest[0, 16]
    source = <<~HTML
      <img src="/assets/visuals/icon.svg#sun">
      <link href="/assets/visuals/icon.svg?v=old#calendar">
      <script>const data = "/assets/data/index.json"; const print = "/downloads/print.pdf";</script>
      <div data-source="/assets/data/zodiac.json"></div>
      <img src="https://external.example/assets/visuals/icon.svg">
    HTML
    File.write(File.join(@root, 'index.html'), source)
    File.write(File.join(@root, 'assets/seasons.js'), "import { load } from './loader.js';\nconst seasonImage = `/assets/visuals/seasons/${season}-earth.svg`;\nconst seasonCalendar = `/assets/seasons-ics/${year}-${slug}.ics`;\n")

    changed = Kalendorius::StaticAssetUrls.rewrite!(@root)
    output = File.read(File.join(@root, 'index.html'))
    javascript = File.read(File.join(@root, 'assets/seasons.js'))
    zodiac = File.read(File.join(@root, 'assets/data/zodiac.json'))
    manifest = File.read(File.join(@root, 'assets/data/manifest.json'))
    zodiac_hash = Digest::SHA256.hexdigest(zodiac)[0, 12]

    assert_equal 8, changed
    assert_includes output, "/assets/visuals/icon.svg?v=#{svg_hash}#sun"
    assert_includes output, "/assets/visuals/icon.svg?v=#{svg_hash}#calendar"
    assert_includes output, "/assets/data/index.json?v=#{json_hash}"
    assert_includes output, "/assets/data/zodiac.json?v=#{zodiac_hash}"
    assert_includes output, "/downloads/print.pdf?v=#{pdf_hash}"
    assert_match %r{`/assets/visuals/seasons/\$\{season\}-earth\.svg\?v=[a-f0-9]{12}`}, javascript
    assert_match %r{`/assets/seasons-ics/\$\{year\}-\$\{slug\}\.ics\?v=[a-f0-9]{12}`}, javascript
    assert_includes zodiac, "/assets/visuals/icon.svg?v=#{svg_hash}"
    assert_equal '{"pdf":"/downloads/print.pdf"}', manifest
    assert_includes output, 'https://external.example/assets/visuals/icon.svg'
    assert_equal 0, Kalendorius::StaticAssetUrls.rewrite!(@root)
  end

  def test_dependency_scanner_hashes_only_files_referenced_by_css_and_javascript
    FileUtils.mkdir_p(File.join(@root, 'assets/previews'))
    File.binwrite(File.join(@root, 'assets/previews/unreferenced.webp'), 'print preview')
    stylesheet = File.join(@root, 'assets/site.css')
    script = File.join(@root, 'assets/site.js')
    File.write(stylesheet, 'body{background-image:url("/assets/visuals/icon.svg")}')
    File.write(script, <<~JS)
      const art = "/assets/visuals/icon.svg#mark";
      const season = `/assets/visuals/seasons/${season}-earth.svg`;
      const calendar = `/assets/seasons-ics/${year}-${slug}.ics`;
      const data = fetch("/assets/data/index.json");
    JS

    paths = Kalendorius::StaticAssetUrls.referenced_asset_paths(@root, [stylesheet, script])

    assert_includes paths, 'assets/visuals/icon.svg'
    assert_includes paths, 'assets/visuals/seasons/spring-earth.svg'
    assert_includes paths, 'assets/visuals/seasons/summer-earth.svg'
    assert_includes paths, 'assets/seasons-ics/2027-pavasario-lygiadienis.ics'
    assert_includes paths, 'assets/data/index.json'
    refute_includes paths, 'assets/previews/unreferenced.webp'
    refute_includes paths, 'assets/data/manifest.json'
  end

  def test_unquoted_css_urls_keep_closing_parentheses_and_font_formats
    FileUtils.mkdir_p(File.join(@root, 'assets/fonts'))
    File.binwrite(File.join(@root, 'assets/fonts/font.woff2'), 'font bytes')
    font_hash = Digest::SHA256.file(File.join(@root, 'assets/fonts/font.woff2')).hexdigest[0, 12]
    svg_hash = Digest::SHA256.file(File.join(@root, 'assets/visuals/icon.svg')).hexdigest[0, 12]
    css = '@font-face{src:url(/assets/fonts/font.woff2?v=old) format("woff2")}.icon{mask:url(/assets/visuals/icon.svg?size=2&v=old#calendar)}'
    path = File.join(@root, 'assets/unquoted.css')
    File.write(path, css)
    Kalendorius::StaticAssetUrls.rewrite!(@root)
    output = File.read(path)
    assert_includes output, "url(/assets/fonts/font.woff2?v=#{font_hash}) format(\"woff2\")"
    assert_includes output, "url(/assets/visuals/icon.svg?size=2&v=#{svg_hash}#calendar)"
    assert_equal 0, Kalendorius::StaticAssetUrls.rewrite!(@root)
  end
end
