# frozen_string_literal: true

module Kalendorius
  module CssMinifier
    COMPACT_PUNCTUATION = '{};,'.freeze

    def self.minify(css)
      output = +''
      index = 0
      quote = nil
      comment = false
      pending_space = false

      while index < css.length
        char = css[index]
        following = css[index + 1]

        if comment
          output << char
          if char == '*' && following == '/'
            output << '/'
            index += 2
            comment = false
          else
            index += 1
          end
          next
        end

        if quote
          output << char
          if char == '\\' && following
            output << following
            index += 2
          else
            quote = nil if char == quote
            index += 1
          end
          next
        end

        if char == '/' && following == '*'
          if pending_space && !output.empty? && !COMPACT_PUNCTUATION.include?(output[-1])
            output << ' '
          end
          pending_space = false
          output << '/*'
          index += 2
          comment = true
          next
        end

        if char == '"' || char == "'"
          if pending_space && !output.empty? && !COMPACT_PUNCTUATION.include?(output[-1])
            output << ' '
          end
          pending_space = false
          quote = char
          output << char
          index += 1
          next
        end

        if char.match?(/\s/)
          pending_space = true
          index += 1
          next
        end

        if pending_space && !output.empty? &&
           !COMPACT_PUNCTUATION.include?(output[-1]) &&
           !COMPACT_PUNCTUATION.include?(char) && char != '{'
          output << ' '
        end
        pending_space = false
        output << char
        index += 1
      end

      output
    end
  end
end
