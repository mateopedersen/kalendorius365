#!/usr/bin/env python3
"""Full release check for print originals, imported calendars and previews."""
from pathlib import Path
import calendar
import json

from preflight import YEAR_DATA, preflight, verify_manifest_provenance
from calendar_package import TARGET_YEARS, expected_keys, manifest_key, validate_import_evidence
from verify_template_extension import verify_extension

ROOT = Path(__file__).resolve().parents[1]
manifest = json.loads((ROOT / "site/assets/data/manifest.json").read_text())
assets = manifest["assets"]
years = YEAR_DATA
print_calendars = [asset for asset in assets if asset["kind"] in {"monthly", "annual"}]

assert len(assets) == 546
assert sum(asset["kind"] == "monthly" for asset in assets) == 480
assert sum(asset["kind"] == "annual" for asset in assets) == 40
assert sum(asset["kind"] == "blank" for asset in assets) == 26
assert len({asset["stem"] for asset in assets}) == 546
verify_manifest_provenance(manifest)

package = validate_import_evidence(ROOT, manifest, check_files=False)
imported = [asset for asset in assets if asset["year"] in TARGET_YEARS and asset["kind"] in {"monthly", "annual"}]
assert len(imported) == 390
assert {manifest_key(asset) for asset in imported} == expected_keys()
for year in range(2027, 2031):
    for month in range(1, 13):
        rows = [asset for asset in print_calendars if asset["kind"] == "monthly" and asset["year"] == year and asset["month"] == month]
        assert len(rows) == 10 and {asset["design"] for asset in rows} == {f"{n:02}" for n in range(1, 11)}
    annual = [asset for asset in print_calendars if asset["kind"] == "annual" and asset["year"] == year]
    assert len(annual) == 10 and {asset["design"] for asset in annual} == {f"{n:02}" for n in range(1, 11)}

for fontpath in list((ROOT / "site/assets/fonts").glob("Inter-*.ttf")) + [ROOT / "site/assets/fonts" / name for name in ["Lato-Regular.ttf", "Lato-Bold.ttf", "Lato-Black.ttf"]]:
    from fontTools.ttLib import TTFont
    cmap = TTFont(fontpath).getBestCmap()
    assert all(ord(char) in cmap for char in "ĄČĘĖĮŠŲŪŽąčęėįšųūž")

count = 0
for year in years:
    for month_data in year["months"]:
        y, month = year["year"], month_data["month"]
        assert calendar.monthrange(y, month)[1] == month_data["length"]
        assert calendar.monthrange(y, month)[0] == month_data["offset"]
        for day in month_data["days"]:
            count += 1
assert count == 1461
verify_extension()

reports = [preflight(asset, ROOT / "site/downloads") for asset in assets]
assert len(reports) == 546 and all(row["status"] == "passed" for row in reports)
assert len([row for row in reports if row["paper"] == "A3"]) == 520
assert len(package["retiredPaths"]) == 1560 and len(package["newPaths"]) == 1560
print(f"PASS: {count} independent calendar dates; {len(print_calendars)} A3 calendars; "
      f"{len(reports)} one-page embedded-font PDFs; all package, preview and legacy-asset hashes verified.")
