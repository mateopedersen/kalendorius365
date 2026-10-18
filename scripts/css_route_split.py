#!/usr/bin/env python3
"""Build conservative, route-specific CSS bundles for the horoscope family.

The source stylesheets contain rules for several page families. This splitter
keeps a selector whenever its classes occur in the complete page markup or in
site JavaScript, then writes smaller bundles for the horoscope hub, individual
horoscopes, and the zodiac guide. Unknown CSS syntax is preserved unchanged.
"""

from __future__ import annotations

import html.parser
import re
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
ASSETS = ROOT / "site/assets"
PAGE_SPECS = {
    "homepage": ROOT / "site/index.html",
    "horoscope-detail": ROOT / "site/horoskopai/avinas/index.html",
    "horoscope-hub": ROOT / "site/horoskopai/index.html",
    "zodiac-guide": ROOT / "site/zodiakas/index.html",
}
PAGE_SCRIPTS = {
    "homepage": ("common.js", "cookie-notice.js", "search-engine.js", "app.js"),
    "horoscope-detail": ("common.js", "cookie-notice.js", "search-engine.js", "ascendant-calculator.js"),
    "horoscope-hub": ("common.js", "cookie-notice.js", "search-engine.js"),
    "zodiac-guide": ("common.js", "cookie-notice.js", "search-engine.js", "zodiac.js"),
}
PAGE_SAFELISTS = {
    "homepage": {"homepage-app", "dashboard-main"},
    "horoscope-detail": {"horoscope-app", "content-main"},
    "horoscope-hub": {"horoscope-app", "content-main"},
    "zodiac-guide": {"horoscope-app", "content-main"},
}
GROUPING_AT_RULES = {
    "@media", "@supports", "@container", "@layer", "@document", "@scope"
}


class ClassCollector(html.parser.HTMLParser):
    def __init__(self) -> None:
        super().__init__(convert_charrefs=True)
        self.classes: set[str] = set()

    def handle_starttag(self, _tag: str, attrs: list[tuple[str, str | None]]) -> None:
        raw_tag = self.get_starttag_text() or ""
        if "{%" in raw_tag or "{{" in raw_tag:
            return
        for key, value in attrs:
            # Liquid branches in a shared template describe several routes at
            # once. Route classes are supplied through PAGE_SAFELISTS instead.
            if key == "class" and _tag not in {"body", "main"} and value and "{%" not in value and "{{" not in value:
                self.classes.update(value.split())


def page_classes(paths: list[Path]) -> set[str]:
    classes: set[str] = set()
    for path in paths:
        if not path.is_file():
            continue
        parser = ClassCollector()
        parser.feed(path.read_text(encoding="utf-8"))
        classes.update(parser.classes)
    return classes


def javascript_classes(paths: tuple[str, ...], known_css_classes: set[str]) -> set[str]:
    classes: set[str] = set()
    for name in paths:
        path = ROOT / "site/assets" / name
        if not path.is_file():
            continue
        source = path.read_text(encoding="utf-8")
        # Include CSS class names written as complete strings or individual
        # arguments to classList/className helpers. Intersecting with the CSS
        # inventory avoids treating ordinary UI copy as selector coverage.
        literals = re.findall(r"\"((?:\\.|[^\"\\])*)\"|'((?:\\.|[^'\\])*)'", source, re.S)
        for double_quoted, single_quoted in literals:
            for token in re.findall(r"[A-Za-z_][\w-]*", double_quoted or single_quoted):
                if token in known_css_classes:
                    classes.add(token)
    return classes


def css_class_inventory() -> set[str]:
    classes: set[str] = set()
    for path in ASSETS.glob("*.css"):
        source = path.read_text(encoding="utf-8")
        classes.update(re.findall(r"\.([A-Za-z_][\w-]*)", source))
    return classes


def _find_delimiter(css: str, start: int) -> tuple[int, str] | None:
    quote: str | None = None
    comment = False
    parens = brackets = 0
    index = start
    while index < len(css):
        char = css[index]
        following = css[index + 1] if index + 1 < len(css) else ""
        if comment:
            if char == "*" and following == "/":
                comment = False
                index += 2
                continue
        elif quote:
            if char == "\\":
                index += 2
                continue
            if char == quote:
                quote = None
        elif char == "/" and following == "*":
            comment = True
            index += 2
            continue
        elif char in "'\"":
            quote = char
        elif char == "(":
            parens += 1
        elif char == ")":
            parens = max(0, parens - 1)
        elif char == "[":
            brackets += 1
        elif char == "]":
            brackets = max(0, brackets - 1)
        elif not parens and not brackets and char in "{};":
            return index, char
        index += 1
    return None


def _matching_brace(css: str, opening: int) -> int | None:
    depth = 1
    quote: str | None = None
    comment = False
    index = opening + 1
    while index < len(css):
        char = css[index]
        following = css[index + 1] if index + 1 < len(css) else ""
        if comment:
            if char == "*" and following == "/":
                comment = False
                index += 2
                continue
        elif quote:
            if char == "\\":
                index += 2
                continue
            if char == quote:
                quote = None
        elif char == "/" and following == "*":
            comment = True
            index += 2
            continue
        elif char in "'\"":
            quote = char
        elif char == "{":
            depth += 1
        elif char == "}":
            depth -= 1
            if depth == 0:
                return index
        index += 1
    return None


def _selector_branches(selector: str) -> list[str]:
    branches: list[str] = []
    start = 0
    parens = brackets = 0
    quote: str | None = None
    comment = False
    index = 0
    while index < len(selector):
        char = selector[index]
        following = selector[index + 1] if index + 1 < len(selector) else ""
        if comment:
            if char == "*" and following == "/":
                comment = False
                index += 2
                continue
        elif quote:
            if char == "\\":
                index += 2
                continue
            if char == quote:
                quote = None
        elif char == "/" and following == "*":
            comment = True
            index += 2
            continue
        elif char in "'\"":
            quote = char
        elif char == "(":
            parens += 1
        elif char == ")":
            parens = max(0, parens - 1)
        elif char == "[":
            brackets += 1
        elif char == "]":
            brackets = max(0, brackets - 1)
        elif char == "," and not parens and not brackets:
            branches.append(selector[start:index])
            start = index + 1
        index += 1
    branches.append(selector[start:])
    return branches


def _branch_matches(branch: str, available: set[str]) -> bool:
    # Keep advanced relational/alternative selectors conservatively. This
    # avoids dropping a rule when one arm of :is(), :where(), or :has() is live.
    if re.search(r":(?:is|where|has)\s*\(", branch, re.I):
        return True
    branch = re.sub(r":not\s*\([^)]*\)", "", branch, flags=re.I)
    branch = re.sub(r"/\*.*?\*/", "", branch, flags=re.S)
    branch = re.sub(r"\[[^\]]*\]", "", branch)
    branch = re.sub(r"(['\"])(?:\\.|(?!\1).)*\1", "", branch)
    selector_classes = set(re.findall(r"\.([A-Za-z_][\w-]*)", branch))
    return not selector_classes or selector_classes.issubset(available)


def filter_css(css: str, available: set[str]) -> str:
    """Keep selectors that may match the route; preserve unknown syntax safely."""
    output: list[str] = []
    index = 0
    while index < len(css):
        while index < len(css) and css[index].isspace():
            index += 1
        if index >= len(css):
            break
        if css.startswith("/*", index):
            close = css.find("*/", index + 2)
            if close < 0:
                return css
            # Keep source comments, including license notices.
            output.append(css[index : close + 2])
            index = close + 2
            continue
        delimiter = _find_delimiter(css, index)
        if delimiter is None:
            return css
        boundary, kind = delimiter
        prelude = css[index:boundary].strip()
        if kind == ";":
            output.append(css[index : boundary + 1])
            index = boundary + 1
            continue
        if kind == "}":
            # A close brace at this parsing level means the input is malformed.
            return css
        closing = _matching_brace(css, boundary)
        if closing is None:
            return css
        body = css[boundary + 1 : closing]
        if prelude.startswith("@"):
            at_rule_match = re.match(r"@[-\w]+", prelude)
            at_rule = at_rule_match.group(0).lower() if at_rule_match else prelude.lower()
            if at_rule in GROUPING_AT_RULES:
                nested = filter_css(body, available)
                if nested.strip():
                    output.append(f"{prelude}{{{nested}}}")
            else:
                # Keyframes, fonts, property declarations and unknown at-rules
                # are retained because selector pruning cannot reason about them.
                output.append(css[index : closing + 1])
        else:
            kept_branches = [branch.strip() for branch in _selector_branches(prelude) if _branch_matches(branch, available)]
            if kept_branches:
                output.append(f"{','.join(kept_branches)}{{{body}}}")
        index = closing + 1
    return "\n".join(output)


def main() -> None:
    layout = ROOT / "site/_layouts/default.html"
    shared = [layout]
    # Follow literal Jekyll includes used by each page and the shared layout.
    # If a dynamic include is introduced later, conservatively include every
    # partial rather than pruning selectors that the runtime may need.
    include_pattern = re.compile(r"{%[- ]+include\s+(['\"])([^'\"]+)\1")

    def include_paths(seeds: list[Path]) -> list[Path]:
        found: set[Path] = set()
        pending = list(seeds)
        dynamic = False
        while pending:
            path = pending.pop()
            if not path.is_file() or path in found:
                continue
            found.add(path)
            source = path.read_text(encoding="utf-8")
            if re.search(r"{%[- ]+include\s+{{", source):
                dynamic = True
            for _, name in include_pattern.findall(source):
                pending.append(ROOT / "site/_includes" / name)
        if dynamic:
            found.update((ROOT / "site/_includes").rglob("*.html"))
        return sorted(found)

    known_css_classes = css_class_inventory()
    contexts: dict[str, set[str]] = {}
    for name, page in PAGE_SPECS.items():
        classes = page_classes([page, *include_paths([page, *shared])])
        contexts[name] = classes | PAGE_SAFELISTS[name] | javascript_classes(PAGE_SCRIPTS[name], known_css_classes)

    route_sources = {
        "homepage-bundle": ("homepage", ("style.css", "design-system.css", "homepage.css")),
        "horoscope-detail": ("horoscope-detail", ("style.css", "design-system.css", "horoscope.css", "zodiac.css")),
        "horoscope-hub": ("horoscope-hub", ("style.css", "design-system.css", "horoscope.css", "zodiac.css")),
        # The zodiac guide shares the narrow horoscope page-width rule.
        "zodiac-guide": ("zodiac-guide", ("style.css", "design-system.css", "horoscope.css", "zodiac.css")),
    }
    # Remove names written by the first development iteration of this
    # generator so they cannot accidentally be copied into the release.
    for stale_name in (
        "style-horoscope-detail.css", "style-horoscope-hub.css", "style-zodiac-guide.css",
        "design-system-horoscope-detail.css", "design-system-horoscope-hub.css", "design-system-zodiac-guide.css",
        "zodiac-profile.css", "zodiac-cta.css",
    ):
        (ASSETS / stale_name).unlink(missing_ok=True)

    for output_name, (family, source_names) in route_sources.items():
        parts = []
        for name in source_names:
            source = ASSETS / name
            filtered = filter_css(source.read_text(encoding="utf-8"), contexts[family])
            if filtered.strip():
                parts.append(filtered.strip())
        output = ASSETS / f"{output_name}.css"
        output.write_text("\n".join(parts) + "\n", encoding="utf-8")

    print("Generated single-request route CSS bundles:")
    for name in route_sources:
        path = ASSETS / f"{name}.css"
        print(f"  {path.name}: {path.stat().st_size:,} bytes")


if __name__ == "__main__":
    main()
