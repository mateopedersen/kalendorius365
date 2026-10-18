# frozen_string_literal: true

require 'digest'
require 'fileutils'
require 'json'

# A revision is a directory, rather than a query parameter: it remains a distinct
# cache key even if a zone cache rule ignores query strings. Keep the last two
# releases so a tab opened before deployment can still lazy-load its modules.
module AssetRelease
  extend self
  RETAIN_RELEASES = 3
  RELEASE_MANIFEST = 'assets/release-manifest.json'

  def fingerprint_paths(public_dir)
    Dir.glob(File.join(public_dir, 'assets/**/*')).select do |path|
      File.file?(path) && !path.include?('/assets/releases/') &&
        path.delete_prefix(public_dir + '/') != RELEASE_MANIFEST &&
        path.end_with?('.js', '.css', '.woff2', '.ttf', '.json')
    end.sort
  end

  def revision_for(public_dir, paths)
    digest = Digest::SHA256.new
    paths.each do |path|
      digest << path.delete_prefix(public_dir + '/') << "\0" << File.binread(path) << "\0"
    end
    digest.hexdigest[0, 20]
  end

  def previous_revisions(public_dir)
    path = File.join(public_dir, RELEASE_MANIFEST)
    return [] unless File.file?(path)
    Array(JSON.parse(File.read(path))['retained_revisions']).select { |value| value.match?(/\A[0-9a-f]{20}\z/) }
  rescue JSON::ParserError
    []
  end

  # Stage all retained releases until the new fingerprint is known. A rebuild
  # may produce the same current revision; discarding one here would lose an
  # older release on every unchanged build. publish applies the final limit.
  def stash_previous_releases(public_dir, stash_dir, previous)
    Array(previous).grep(/\A[0-9a-f]{20}\z/).first(RETAIN_RELEASES).each do |revision|
      source = File.join(public_dir, 'assets', 'releases', revision)
      FileUtils.cp_r(source, File.join(stash_dir, revision)) if File.directory?(source)
    end
  end

  def restore_previous_releases(public_dir, stash_dir, previous)
    restored = []
    Array(previous).grep(/\A[0-9a-f]{20}\z/).first(RETAIN_RELEASES).each do |revision|
      source = File.join(stash_dir, revision)
      next unless File.directory?(source)

      destination = File.join(public_dir, 'assets', 'releases', revision)
      FileUtils.rm_rf(destination)
      FileUtils.mkdir_p(File.dirname(destination))
      FileUtils.cp_r(source, destination)
      restored << revision
    end
    restored
  end

  def rewrite_references(content, urls)
    # Only known, generated files are changed. Download URLs, routes, API paths,
    # fragment IDs, unknown strings and user-generated data remain untouched.
    content.gsub(%r{/assets/(?!releases/)[^\s"'<>`\)]+}) do |reference|
      bare, fragment = reference.split('#', 2)
      bare = bare.split('?', 2).first
      replacement = urls[bare]
      replacement ? replacement + (fragment ? "##{fragment}" : '') : reference
    end
  end

  def publish(public_dir, previous: [])
    public_dir = File.expand_path(public_dir)
    paths = fingerprint_paths(public_dir)
    revision = revision_for(public_dir, paths)
    prefix = "/assets/releases/#{revision}"
    urls = paths.to_h do |path|
      original = '/' + path.delete_prefix(public_dir + '/')
      [original, prefix + original.delete_prefix('/assets')]
    end
    records = {}
    paths.each do |path|
      original = '/' + path.delete_prefix(public_dir + '/')
      destination = File.join(public_dir, urls.fetch(original))
      content = File.binread(path)
      if path.end_with?('.js', '.css')
        content = rewrite_references(content, urls)
        # Relative module specifiers keep the mirrored assets tree. The source
        # Jekyll query revision is unnecessary inside a revision directory.
        content = content.gsub(/((?:\bfrom\s*|\bimport\s*(?:\(\s*)?)["'])([^"']+\.js)(?:\?[^"']*)?(["'])/) do
          pre, specifier, quote = Regexp.last_match.values_at(1, 2, 3)
          "#{pre}#{specifier}#{quote}"
        end
      end
      FileUtils.mkdir_p(File.dirname(destination))
      File.binwrite(destination, content)
      records[original] = {'url' => urls.fetch(original), 'sha256' => Digest::SHA256.hexdigest(content)}
    end
    Dir.glob(File.join(public_dir, '**/*.html')).each do |path|
      File.write(path, rewrite_references(File.read(path), urls))
    end
    # Compatibility endpoints are mutable and revalidate. Give their module
    # imports the same immutable destination as the current HTML.
    paths.select { |path| path.end_with?('.js', '.css') }.each do |path|
      content = rewrite_references(File.read(path), urls)
      if path.end_with?('.js')
        original = '/' + path.delete_prefix(public_dir + '/')
        content = content.gsub(/((?:\bfrom\s*|\bimport\s*(?:\(\s*)?)["'])([^"']+\.js)(?:\?[^"']*)?(["'])/) do
          pre, specifier, quote = Regexp.last_match.values_at(1, 2, 3)
          absolute = specifier.start_with?('.') ? File.expand_path(specifier, File.dirname(original)) : specifier
          target = urls[absolute]
          target ? "#{pre}#{target}#{quote}" : Regexp.last_match(0)
        end
      end
      File.write(path, content)
    end
    retained = ([revision] + previous).uniq.take(RETAIN_RELEASES)
    Dir.glob(File.join(public_dir, 'assets/releases/*')).each do |directory|
      FileUtils.rm_rf(directory) unless retained.include?(File.basename(directory))
    end
    manifest = {'revision' => revision, 'retained_revisions' => retained, 'assets' => records}
    File.write(File.join(public_dir, RELEASE_MANIFEST), JSON.pretty_generate(manifest) + "\n")
    manifest
  end
end
