"""Build the Lithuanian weather gazetteer from Address Register open data.

Pass the directory of WGS84 GeoJSON layers exported from the official SSVA
Address Register archive (https://data.gov.lt/datasets/3160/).
Export gyv_vietoves, adr_gyvenamosios_vietoves, savivaldybes, apskritys and
seniunijos, for example with:
ogr2ogr -t_srs EPSG:4326 gyv_vietoves.geojson RC_atviri_adresai.gdb gyv_vietoves
For the text-only adr_gyvenamosios_vietoves layer, omit the projection option.

Only public settlement and municipality reference points are retained.
"""
import argparse
import json
import re
import unicodedata
from collections import defaultdict
from pathlib import Path

ROOT = Path(__file__).resolve().parents[2]
REGISTER = "https://data.gov.lt/datasets/3160/"


def slug(value):
    name = unicodedata.normalize("NFKD", value.lower()).encode("ascii", "ignore").decode()
    return re.sub(r"[^a-z0-9]+", "-", name).strip("-")


def centroid(rings):
    # Polygon rings preserve the source orientation, including interior holes.
    area, x_sum, y_sum = 0, 0, 0
    for ring in rings:
        for (x0, y0), (x1, y1) in zip(ring, ring[1:]):
            section = x0 * y1 - x1 * y0
            area += section
            x_sum += (x0 + x1) * section
            y_sum += (y0 + y1) * section
    return (y_sum / (3 * area), x_sum / (3 * area))


class Boundary:
    def __init__(self, rings, indexed=False):
        self.rings = rings
        self.edges = [(*a, *b) for ring in rings for a, b in zip(ring, ring[1:]) if a[1] != b[1]]
        self.strips = None
        if indexed:
            self.strips = defaultdict(list)
            for edge in self.edges:
                first, last = sorted((int(edge[1] * 100), int(edge[3] * 100)))
                for band in range(first, last + 1):
                    self.strips[band].append(edge)

    def crossings(self, lat):
        edges = self.edges if self.strips is None else self.strips.get(int(lat * 100), ())
        return [x0 + (x1 - x0) * (lat - y0) / (y1 - y0) for x0, y0, x1, y1 in edges
                if (y0 > lat) != (y1 > lat)]

    def contains(self, lat, lon):
        return sum(crossing > lon for crossing in self.crossings(lat)) % 2 == 1

    def point(self, preferred, parent=None):
        def valid(lat, lon):
            return self.contains(lat, lon) and (parent is None or parent.contains(lat, lon))

        # Retain the existing centroid precision when it lands inside both polygons.
        rounded = tuple(round(value, 3) for value in preferred)
        if valid(*rounded):
            return rounded
        # Concave, multipart and narrow polygons can have centroids in holes or outside.
        # Sample interior spans and retain a point sufficiently inside after rounding.
        spans = []
        for ring in self.rings:
            bottom, top = min(p[1] for p in ring), max(p[1] for p in ring)
            for step in range(1, 20):
                lat = round(bottom + (top - bottom) * step / 20, 4)
                xs = sorted(self.crossings(lat))
                for left, right in zip(xs[::2], xs[1::2]):
                    spans.append((right - left, lat, round((left + right) / 2, 4)))
        for _, lat, lon in sorted(spans, reverse=True):
            rounded = (round(lat, 3), round(lon, 3))
            if valid(*rounded):
                return rounded
            if valid(lat, lon):
                return lat, lon
        raise ValueError(f"No interior weather reference point near {preferred!r}")


def layer(directory, name):
    return json.loads((directory / f"{name}.geojson").read_text())["features"]


def geometry_rings(feature):
    geometry = feature["geometry"]
    coordinates = geometry["coordinates"]
    if geometry["type"] == "Polygon":
        return coordinates
    if geometry["type"] == "MultiPolygon":
        return [ring for polygon in coordinates for ring in polygon]
    raise ValueError(f"Unexpected geometry {geometry['type']}")


def index_features(features, field):
    indexed = {int(row["properties"][field]): row for row in features}
    if len(indexed) != len(features):
        raise ValueError(f"Repeated registry identifiers in {field}")
    return indexed


def build(directory, previous):
    cities = json.loads((ROOT / "data/astronomy/sun-cities.json").read_text())["cities"]
    author_city = {int(city["registryId"]): city for city in cities}
    city_identity = {slug(city["name"]): identity for identity, city in author_city.items()}
    old_places = {city_identity[row[0]] if row[6] else int(row[0].rsplit("-", 1)[1]): row for row in previous["places"]}
    counties = index_features(layer(directory, "apskritys"), "APS_KODAS")
    municipalities = index_features(layer(directory, "savivaldybes"), "SAV_KODAS")
    wards = index_features(layer(directory, "seniunijos"), "SEN_KODAS")
    active = index_features(layer(directory, "adr_gyvenamosios_vietoves"), "GYV_KODAS")
    spatial = index_features(layer(directory, "gyv_vietoves"), "GYV_KODAS")

    regions, boundaries = {}, {}
    for district, row in municipalities.items():
        attrs = row["properties"]
        name = attrs["SAV_PAV"]
        county = counties[int(attrs["APS_KODAS"])]["properties"]["APS_PAV"]
        rings = geometry_rings(row)
        boundary = boundaries[district] = Boundary(rings, indexed=True)
        prior = previous["municipalities"].get(str(district))
        preferred = prior[3:5] if prior else centroid(rings)
        lat, lon = boundary.point(preferred)
        regions[district] = [prior[0] if prior else slug(name.removesuffix(" sav.")), name, county, lat, lon]
    if len(regions) != 60 or len({r[0] for r in regions.values()}) != 60 or len(counties) != 10:
        raise ValueError("Unexpected municipality or county coverage")
    if set(spatial) - set(active):
        raise ValueError("Found spatial rows missing from the active Address Register")
    dates = {row["properties"]["formav_dat"][:10].replace("/", "-") for row in spatial.values()}
    if len(dates) != 1:
        raise ValueError("Unexpected Address Register snapshot dates")

    rows, unmapped, keys = [], [], set()
    for identity, row in active.items():
        attrs = row["properties"]
        suffix = attrs["TIPO_SANTRUMPA"]
        label = f"{attrs['VARDAS_K']} {suffix}"
        district = int(attrs["SAV_KODAS"])
        ward = int(attrs["SEN_KODAS"]) if attrs.get("SEN_KODAS") else None
        prior = old_places.get(identity)
        city = author_city.get(identity)
        if (suffix == "m.") != bool(city):
            raise ValueError(f"Review city status for Address Register identity {identity}: {label}")
        if city:
            key, name, grammar, sun = slug(city["name"]), city["name"], city["locative"], city["id"]
        else:
            base = attrs["VARDAS_K"] + (" st." if suffix == "glž. st." else "")
            key = prior[0] if prior else f"{slug(base)}-{identity}"
            name, grammar, sun = label, "", ""
        if key in keys or district not in regions:
            raise ValueError(f"Invalid or duplicate place {attrs!r}")
        feature = spatial.get(identity)
        if feature is None:
            # Older maps and the text register can still list legally abolished
            # places. Do not turn those entries into local forecasts.
            unmapped.append([identity, label, district, ward])
            continue
        if int(feature["properties"]["SAV_KODAS"]) != district:
            raise ValueError(f"Municipality mismatch for Address Register identity {identity}")
        rings = geometry_rings(feature)
        polygon = Boundary(rings)
        preferred = prior[3:5] if prior and polygon.contains(*prior[3:5]) else centroid(rings)
        reference = polygon.point(preferred, boundaries[district])
        keys.add(key)
        rows.append([key, name, district, *reference, grammar, sun, attrs["VARDAS_K"] if city else "", ward])
    rows.sort(key=lambda row: (slug(row[1]), row[1], row[0]))
    return {
        "source": REGISTER,
        "registry": "https://data.gov.lt/datasets/1347/",
        "license": "CC BY 4.0",
        "snapshot": dates.pop(),
        "municipalities": dict(sorted(regions.items())),
        "wards": {key: [row["properties"]["SEN_PAV"], int(row["properties"]["SAV_KODAS"])]
                  for key, row in sorted(wards.items())},
        "places": rows,
        "unmapped": sorted(unmapped),
    }


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("layers", type=Path, help="Directory containing the official WGS84 GeoJSON exports")
    parser.add_argument("--check", action="store_true", help="Validate the local catalogue against the supplied register snapshot")
    args = parser.parse_args()
    out = ROOT / "site/assets/data/weather-places.json"
    data = build(args.layers, json.loads(out.read_text()))
    serialized = json.dumps(data, ensure_ascii=False, separators=(",", ":")) + "\n"
    if args.check:
        if out.read_text() != serialized:
            raise SystemExit("Weather catalogue differs from the verified Address Register snapshot")
    else:
        staged = out.with_suffix(".json.next")
        staged.write_text(serialized)
        staged.replace(out)
    print(f"Verified {len(data['places'])} settlements and {len(data['municipalities'])} municipalities")
    print(f"Registry settlements without a verified point: {len(data['unmapped'])}")


if __name__ == "__main__":
    main()
