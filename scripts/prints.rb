# frozen_string_literal: true
# Ruby owns orchestration and canonical data; ReportLab is the vector drawing backend.
require 'fileutils'
ROOT=File.expand_path('..',__dir__)
python=ENV.fetch('K365_PYTHON','python3')
def run!(*args);system(*args,exception:true);end
Dir.chdir(ROOT) do
 case ARGV.fetch(0,'verify')
 when 'samples'
  run!(RbConfig.ruby,'scripts/prepare.rb')
  run!(python,'scripts/render_prints.py','--samples')
  run!(python,'scripts/preflight.py','--samples')
  puts 'Inspect both PDFs and their real 600-PPI proof PNGs before accept-samples.'
 when 'accept-samples'
  run!(python,'scripts/preflight.py','--samples','--accept-visual')
  FileUtils.cp('../../outputs/print-samples/preflight.json','docs/sample-preflight.json')
 when 'all'
  run!(RbConfig.ruby,'scripts/prepare.rb')
  run!(python,'scripts/render_prints.py')
  run!(python,'scripts/preflight.py')
  run!(python,'scripts/responsive_previews.py')
  run!(python,'scripts/validate_assets.py')
 when 'verify'
  run!(python,'scripts/preflight.py')
  run!(python,'scripts/validate_assets.py')
 else
  abort 'Usage: ruby scripts/prints.rb samples|accept-samples|all|verify'
 end
end
