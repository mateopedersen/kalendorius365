# frozen_string_literal: true
require 'json'
require 'pathname'
require 'uri'
module AdvertisingRoutes
  def self.generate(root:, output:, existing_routes: [])
    output = Pathname.new(output)
    paths = Dir[output.join('**/index.html')].select { |file| File.read(file).include?('data-advertising-slot') }.map do |file|
      relative = Pathname.new(file).relative_path_from(output).to_s.delete_suffix('index.html')
      URI::DEFAULT_PARSER.escape('/' + relative)
    end.uniq.sort
    File.write(File.join(root, 'functions/advertising-routes.js'), "// Generated from public HTML containing an advertising slot.\nexport default " + JSON.generate(paths) + ";\n")
    includes = (existing_routes + paths.map { |path| path == '/' ? '/' : '/' + path.split('/')[1].to_s + '*' }).uniq.sort
    raise 'Cloudflare advertising route limit exceeded' if includes.size > 100
    File.write(output.join('_routes.json'), JSON.generate({version: 1, include: includes, exclude: []}) + "\n")
  end
end
