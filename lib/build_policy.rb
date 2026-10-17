# frozen_string_literal: true
module Kalendorius
  module BuildPolicy
    # A Cloudflare build must identify the production branch explicitly.
    # Local and CI release checks may opt in without impersonating Cloudflare.
    def self.release?(env)
      env['K365_RELEASE'] == '1' &&
        (env['CF_PAGES'] != '1' || env['CF_PAGES_BRANCH'] == 'main')
    end
  end
end
