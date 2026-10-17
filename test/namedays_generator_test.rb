# frozen_string_literal: true
require 'tmpdir'
require 'fileutils'
require 'digest'
require 'json'
require_relative '../lib/namedays_pages'
real_root=NamedaysPages::ROOT
snapshot=File.join(real_root,'data/namedays/cc-by-sa-4.0/snapshot.json')
before=Digest::SHA256.file(snapshot).hexdigest
Dir.mktmpdir('k365-namedays-',ENV['K365_QA_TMP']) do |dir|
  FileUtils.mkdir_p(File.join(dir,'data/namedays'))
  FileUtils.cp_r(File.join(real_root,'data/namedays/cc-by-sa-4.0'),File.join(dir,'data/namedays/cc-by-sa-4.0'))
  NamedaysPages.send(:remove_const,:ROOT)
  NamedaysPages.const_set(:ROOT,dir)
  begin
    results=[]
    2.times do
      NamedaysPages.run
      results << Dir.glob(File.join(dir,'site/**/*')).select { |p|File.file?(p) }.to_h { |p|[p.delete_prefix(dir),Digest::SHA256.file(p).hexdigest] }
    end
    raise 'Name-day regeneration changed the snapshot or output' unless results[0]==results[1]
    raise 'Missing canonical pages' unless Dir.glob(File.join(dir,'site/vardadieniai/**/index.html')).length==13
    raise 'Missing static ICS exports' unless Dir.glob(File.join(dir,'site/assets/namedays-ics/*.ics')).length==366
    raise 'Real source dataset was modified' unless Digest::SHA256.file(snapshot).hexdigest==before
    puts JSON.generate({'status'=>'passed','isolated_regenerations'=>2,'pages'=>13,'ics'=>366,'source_modified'=>false})
  ensure
    NamedaysPages.send(:remove_const,:ROOT)
    NamedaysPages.const_set(:ROOT,real_root)
  end
end
