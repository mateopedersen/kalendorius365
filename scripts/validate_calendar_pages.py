#!/usr/bin/env python3
"""Verify all rendered 2027–2029 calendar collection pages and legacy routes."""
from html.parser import HTMLParser
from pathlib import Path
from urllib.parse import quote, unquote, urlsplit
import json
import xml.etree.ElementTree as ET

from calendar_package import ROOT, TARGET_YEARS, validate_import_evidence


class Page(HTMLParser):
    def __init__(self, source: str):
        super().__init__(convert_charrefs=True)
        self.h1 = []
        self.title = ""
        self.description = ""
        self.canonical = []
        self.robots = []
        self.cards = []
        self.options = []
        self.filters = []
        self.print_sizes = []
        self.print_roots = []
        self.text = []
        self.current = None
        self.current_text = []
        self.card = None
        self.feed(source)

    def handle_starttag(self, tag, raw_attrs):
        attrs = dict(raw_attrs)
        if tag == "h1":
            self.current = "h1"
            self.current_text = []
        elif tag == "title":
            self.current = "title"
            self.current_text = []
        elif tag == "meta" and attrs.get("name") == "description":
            self.description = attrs.get("content", "")
        elif tag == "meta" and attrs.get("name") == "robots":
            self.robots.append(attrs.get("content", ""))
        elif tag == "link" and "canonical" in attrs.get("rel", "").split():
            self.canonical.append(attrs.get("href", ""))
        if tag == "article" and "design-card" in attrs.get("class", "").split():
            self.card = {"attrs": attrs, "images": [], "anchors": []}
            self.cards.append(self.card)
        elif tag == "img" and self.card is not None:
            self.card["images"].append(attrs)
        elif tag == "a" and self.card is not None:
            self.card["anchors"].append(attrs)
        elif tag == "option" and attrs.get("value"):
            self.options.append(attrs)
        elif tag == "button" and attrs.get("data-design-filter"):
            self.filters.append(attrs["data-design-filter"])
        if attrs.get("data-print-root") == "art":
            self.print_sizes.append((attrs.get("data-print-paper"), attrs.get("data-print-size")))
        if attrs.get("data-print-root"):
            self.print_roots.append(attrs["data-print-root"])

    def handle_data(self, data):
        self.text.append(data)
        if self.current:
            self.current_text.append(data)

    def handle_endtag(self, tag):
        if (tag == "h1" and self.current == "h1") or (tag == "title" and self.current == "title"):
            value = "".join(self.current_text).strip()
            if self.current == "h1":
                self.h1.append(value)
            else:
                self.title = value
            self.current = None
        if tag == "article" and self.card is not None:
            self.card = None


def path_of(url: str) -> str:
    return unquote(urlsplit(url).path)


def check_page(route: str, assets: list[dict], expected_h1: str, print_asset: dict) -> None:
    page_path = ROOT / "public" / route.lstrip("/") / "index.html"
    page = Page(page_path.read_text())
    assert page.h1 == [expected_h1], (route, "H1", page.h1)
    assert page.title and page.description, (route, "title or description missing")
    canonical = "https://kalendorius365.lt" + route
    assert page.canonical == [canonical], (route, "canonical", page.canonical)
    assert len(page.cards) == 10, (route, "exactly ten designs", len(page.cards))
    assert len(page.options) == 10, (route, "design selector options", len(page.options))
    if route.strip("/").isdigit():
        assert page.print_roots.count("annual") == 1, (route, "annual overview print root", page.print_roots)
    else:
        assert page.print_sizes == [("landscape" if print_asset["landscape"] else "portrait", "A3")], (route, "A3 browser print size", page.print_sizes)
    by_stem = {asset["stem"]: asset for asset in assets}
    assert {card["attrs"].get("id", "").removeprefix("dizainas-") for card in page.cards} == set(by_stem)
    assert {option["value"] for option in page.options} == set(by_stem)
    for card in page.cards:
        attrs = card["attrs"]
        stem = attrs["id"].removeprefix("dizainas-")
        asset = by_stem[stem]
        assert attrs.get("data-paper") == "A3" and asset["paper"] == "A3", (route, stem, "paper size")
        assert attrs.get("data-layout") == asset["layout"], (route, stem, "orientation filter")
        assert attrs.get("data-holidays") == str(asset["holidayInformation"]).lower(), (route, stem, "holiday filter")
        assert attrs.get("data-pdf-name") == Path(asset["pdf"]).name
        assert attrs.get("data-webp-name") == Path(asset["webp"]).name
        assert len(card["images"]) == 1, (route, stem, "preview count")
        image = card["images"][0]
        assert image.get("alt") == asset["alt"], (route, stem, "image alternative text")
        assert "width" in image and "height" in image
        assert path_of(image.get("src", "")) == asset["preview"]
        candidates = {path_of(part.strip().split()[0]) for part in image.get("srcset", "").split(",") if part.strip()}
        assert candidates == {asset["preview"], asset["smallPreview"]}, (route, stem, "responsive preview sources", candidates)
        href_paths = {path_of(anchor.get("href", "")) for anchor in card["anchors"] if anchor.get("href")}
        assert asset["pdf"] in href_paths and asset["webp"] in href_paths, (route, stem, "download or preview link")
        pdf_links = [anchor for anchor in card["anchors"] if path_of(anchor.get("href", "")) == asset["pdf"] and anchor.get("download")]
        webp_links = [anchor for anchor in card["anchors"] if path_of(anchor.get("href", "")) == asset["webp"] and anchor.get("download")]
        assert len(pdf_links) == len(webp_links) == 1
        assert pdf_links[0]["download"] == Path(asset["pdf"]).name
        assert webp_links[0]["download"] == Path(asset["webp"]).name


manifest = json.loads((ROOT / "site/assets/data/manifest.json").read_text())
package = validate_import_evidence(ROOT, manifest, check_files=True)
assets = [asset for asset in manifest["assets"] if asset["year"] in TARGET_YEARS and asset["kind"] in {"monthly", "annual"}]
alt_texts = [asset.get("alt", "").strip() for asset in assets]
assert len(alt_texts) == 390 and len(set(alt_texts)) == 390, "all 390 calendar images need distinct Lithuanian alt text"
assert all(70 <= len(alt) <= 160 and "kalendorius" in alt.lower() for alt in alt_texts), "calendar alt text must describe the product concisely"
assert all(str(asset["year"]) in asset["alt"] for asset in assets), "calendar alt text must identify its year"
months = json.loads((ROOT / "data/calendar.json").read_text())["months"]
for year in TARGET_YEARS:
    for month, values in enumerate(months, 1):
        route = f"/{year}/{values[0]}/"
        expected = [asset for asset in assets if asset["kind"] == "monthly" and asset["year"] == year and asset["month"] == month]
        design = "06" if year == 2027 and month == 1 else "02" if year == 2028 and month == 2 else "01"
        first = next(asset for asset in expected if asset["design"] == design)
        check_page(route, expected, f"{year} m. {values[2]} kalendorius", first)
    annual = [asset for asset in assets if asset["kind"] == "annual" and asset["year"] == year]
    design = "06" if year == 2027 else "01"
    first = next(asset for asset in annual if asset["design"] == design)
    check_page(f"/{year}/", annual, f"{year} metų kalendorius", first)

redirects = (ROOT / "public/_redirects").read_text().splitlines()
redirect_map = {}
for line in redirects:
    source, target, status = line.split()
    assert status == "301" and source not in redirect_map
    redirect_map[source] = target
expected_redirects = {}
for record in package["evidence"]["records"]:
    asset = record["finalAsset"]
    for key, old_url in asset["legacyPaths"].items():
        target_key = "smallPreview" if key == "smallPreview" else key
        expected_redirects[quote(old_url, safe="/")] = quote(asset[target_key], safe="/")
assert redirect_map == expected_redirects and len(redirect_map) == 1560

tree = ET.parse(ROOT / "public/sitemap.xml")
image_locations = [element.text for element in tree.iter() if element.tag.endswith("}loc") and element.text and "/downloads/" in element.text]
assert len(image_locations) == 390
print("PASS: all 36 monthly and 3 annual pages expose ten A3 designs, localized downloads, responsive alt-text previews, working filters, 1,560 legacy redirects, and 390 sitemap images.")
