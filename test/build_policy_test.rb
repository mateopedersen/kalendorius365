# frozen_string_literal: true
require 'minitest/autorun'
require_relative '../lib/build_policy'

class BuildPolicyTest < Minitest::Test
  def test_preview_and_unknown_cloudflare_branch_remain_noindex
    [nil, '', 'audit/sitewide-lithuanian-seo', 'preview', 'Main'].each do |branch|
      refute Kalendorius::BuildPolicy.release?({'K365_RELEASE'=>'1', 'CF_PAGES'=>'1', 'CF_PAGES_BRANCH'=>branch})
    end
  end

  def test_production_main_explicit_release_is_indexable
    assert Kalendorius::BuildPolicy.release?({'K365_RELEASE'=>'1', 'CF_PAGES'=>'1', 'CF_PAGES_BRANCH'=>'main'})
    refute Kalendorius::BuildPolicy.release?({'CF_PAGES'=>'1', 'CF_PAGES_BRANCH'=>'main'})
  end

  def test_local_ci_release_requires_explicit_flag
    assert Kalendorius::BuildPolicy.release?({'K365_RELEASE'=>'1'})
    refute Kalendorius::BuildPolicy.release?({})
    refute Kalendorius::BuildPolicy.release?({'K365_RELEASE'=>'true'})
  end
end
