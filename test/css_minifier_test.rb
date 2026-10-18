# frozen_string_literal: true

require 'minitest/autorun'
require_relative '../lib/css_minifier'

class CssMinifierTest < Minitest::Test
  def test_collapses_formatting_without_changing_selector_or_string_spaces
    css = <<~CSS
      .card :hover,
      .card [data-label="a  b"] {
        content: "keep  two spaces";
        margin: 0   2px;
      }
    CSS

    minified = Kalendorius::CssMinifier.minify(css)

    assert_includes minified, '.card :hover,.card [data-label="a  b"]{'
    assert_includes minified, 'content: "keep  two spaces";'
    assert_includes minified, 'margin: 0 2px;'
    assert_equal minified.count('{'), minified.count('}')
  end

  def test_preserves_comments_nested_rules_and_calc_operators
    css = <<~CSS
      /* license note */
      @media (max-width: 760px) {
        .panel > .body { width: calc(100% - 2rem); }
      }
    CSS

    minified = Kalendorius::CssMinifier.minify(css)

    assert_includes minified, '/* license note */'
    assert_includes minified, '@media (max-width: 760px){'
    assert_includes minified, '.panel > .body{width: calc(100% - 2rem);}'
    assert_equal minified.count('{'), minified.count('}')
  end
end
