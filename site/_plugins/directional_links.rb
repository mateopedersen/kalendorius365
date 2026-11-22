# frozen_string_literal: true

# Keep a decorative suffix out of the link's text decoration, including on hover.
Jekyll::Hooks.register :pages, :post_render do |page|
  next unless page.output_ext == '.html'

  page.output.gsub!(%r{(<a\b[^>]*>[^<>]+)<span aria-hidden="true">([→↓↗←↑›«»])</span>(\s*</a>)}u) do
    "#{$1}<span class=\"link-arrow\" aria-hidden=\"true\">#{$2}</span>#{$3}"
  end
end
