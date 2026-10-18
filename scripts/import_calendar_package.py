#!/usr/bin/env python3
"""Import and verify the supplied 2027–2029 PDF/WebP calendar collection.

The ZIP stays outside the repository. The imported original PDF/WebP files,
small responsive previews, and a pinned migration record are written into the
site tree. Run this once from a clean pre-import checkout.
"""
from __future__ import annotations

import argparse
import csv
import hashlib
import io
import json
import shutil
import unicodedata
import zipfile
from pathlib import Path, PurePosixPath
from urllib.parse import quote

from PIL import Image

from calendar_package import IMPORT_EVIDENCE_PATH, IMPORT_VERSION, ROOT, TARGET_YEARS, expected_keys, manifest_key

CSV_NAME = "seo-importas.csv"
JSON_NAME = "seo-metaduomenys.json"
README_NAME = "naudojimo-instrukcija.txt"
PREVIEW_SIZE = 680
SMALL_PREVIEW_SIZE = 340


def sha256_bytes(data: bytes) -> str:
    return hashlib.sha256(data).hexdigest()


def sha256_file(path: Path) -> str:
    digest = hashlib.sha256()
    with path.open("rb") as stream:
        for block in iter(lambda: stream.read(1024 * 1024), b""):
            digest.update(block)
    return digest.hexdigest()


def zip_sha256(path: Path) -> str:
    return sha256_file(path)


def local_path(url_path: str) -> str:
    return "site/" + url_path.lstrip("/")


def original_file_info(path: Path, relative: str) -> dict:
    return {"path": relative, "bytes": path.stat().st_size, "sha256": sha256_file(path)}


def validate_archive(archive: Path, manifest: dict) -> tuple[list[dict], dict]:
    archive_sha = zip_sha256(archive)
    with zipfile.ZipFile(archive) as zf:
        names = set(zf.namelist())
        expected_documents = {CSV_NAME, JSON_NAME, README_NAME}
        if not expected_documents <= names:
            raise ValueError("ZIP is missing its CSV, JSON metadata, or usage notes")
        csv_bytes = zf.read(CSV_NAME)
        json_bytes = zf.read(JSON_NAME)
        readme_bytes = zf.read(README_NAME)
        rows = list(csv.DictReader(io.TextIOWrapper(io.BytesIO(csv_bytes), encoding="utf-8-sig", newline="")))
        metadata = json.loads(json_bytes)
        if metadata.get("calendar_pairs") != 390 or metadata.get("monthly_pairs") != 360 or metadata.get("annual_pairs") != 30:
            raise ValueError("package JSON counts are not 360 monthly and 30 annual pairs")
        if len(rows) != 390:
            raise ValueError(f"expected 390 CSV rows, found {len(rows)}")
        required = {"kind", "year", "month", "design_id", "design_name_lt", "filename_stem",
                    "pdf_path", "webp_path", "pdf_sha256", "webp_sha256", "pdf_url_path",
                    "webp_url_path", "title_lt", "alt_text_lt", "description_lt", "caption_lt",
                    "width_px", "height_px", "raster_dpi", "pdf_color_space", "webp_color_space",
                    "webp_compression", "holiday_information", "marked_holiday_count"}
        if not required <= set(rows[0]):
            raise ValueError(f"CSV is missing required fields: {sorted(required-set(rows[0]))}")

        seen = set()
        archived_files = set()
        for index, row in enumerate(rows, 1):
            year = int(row["year"])
            month = int(row["month"] or 0)
            key = (row["kind"], year, month, row["design_id"])
            if key in seen:
                raise ValueError(f"duplicate package record at CSV row {index}: {key}")
            seen.add(key)
            if row["kind"] not in {"monthly", "annual"} or year not in TARGET_YEARS:
                raise ValueError(f"out-of-scope package record at CSV row {index}: {key}")
            if row["design_id"] not in {f"{number:02}" for number in range(1, 11)}:
                raise ValueError(f"unexpected design identifier at CSV row {index}: {key}")
            if row["kind"] == "monthly" and month not in range(1, 13):
                raise ValueError(f"monthly record has an invalid month: {key}")
            if row["kind"] == "annual" and month != 0:
                raise ValueError(f"annual record unexpectedly specifies a month: {key}")
            stem = row["filename_stem"]
            if not stem or unicodedata.normalize("NFC", stem) != stem:
                raise ValueError(f"filename is empty or not NFC-normalized: {key}")
            if row["pdf_filename"] != stem + ".pdf" or row["webp_filename"] != stem + ".webp":
                raise ValueError(f"package filename fields do not match the stem: {key}")
            for kind in ("pdf", "webp"):
                archive_name = row[f"{kind}_path"]
                parts = PurePosixPath(archive_name).parts
                if PurePosixPath(archive_name).is_absolute() or ".." in parts or "\\" in archive_name:
                    raise ValueError(f"unsafe archive path: {archive_name}")
                expected_root = "mėnesiniai" if row["kind"] == "monthly" else "metiniai"
                if not parts or parts[0] != expected_root or archive_name not in names:
                    raise ValueError(f"archive member missing or has wrong category: {archive_name}")
                if unicodedata.normalize("NFC", archive_name) != archive_name:
                    raise ValueError(f"archive path is not NFC-normalized: {archive_name}")
                if Path(archive_name).name != row[f"{kind}_filename"]:
                    raise ValueError(f"archive filename and CSV differ: {archive_name}")
                if row[f"{kind}_url_path"] != quote(archive_name, safe="/"):
                    raise ValueError(f"percent-encoded URL path differs: {archive_name}")
                archived_files.add(archive_name)
                payload = zf.read(archive_name)
                if sha256_bytes(payload) != row[f"{kind}_sha256"]:
                    raise ValueError(f"{kind.upper()} checksum mismatch: {archive_name}")
                if len(payload) == 0:
                    raise ValueError(f"empty package file: {archive_name}")
            width, height = int(row["width_px"]), int(row["height_px"])
            if (width, height) not in {(7016, 9922), (9922, 7016)} or int(row["raster_dpi"]) != 600:
                raise ValueError(f"unexpected A3 600-PPI dimensions: {key} {(width, height)}")
            if row["pdf_color_space"] != "CMYK" or row["webp_color_space"] != "sRGB" or row["webp_compression"] != "lossless":
                raise ValueError(f"unexpected print/image color or compression metadata: {key}")
        if seen != expected_keys():
            raise ValueError("CSV does not cover all 36 monthly and 3 annual sets with ten designs each")
        if len(archived_files) != 780 or names != archived_files | expected_documents:
            raise ValueError("ZIP must contain exactly 780 calendar files plus its three metadata documents")

    by_key = {manifest_key(asset): asset for asset in manifest["assets"]}
    if len([asset for asset in manifest["assets"] if asset["kind"] == "blank"]) != 26:
        raise ValueError("the existing 26 blank planner designs are not intact")
    rows_by_key = {(r["kind"], int(r["year"]), int(r["month"] or 0), r["design_id"]): r for r in rows}
    if not expected_keys() <= by_key.keys():
        raise ValueError("existing manifest does not contain all 390 replacement slots")
    retired = {}
    for key in sorted(expected_keys()):
        old = by_key[key]
        if old.get("paper") != "A4":
            raise ValueError(f"replacement slot is not the expected prior A4 asset: {key}")
        for label, url in (("pdf", old["pdf"]), ("webp", old["webp"]),
                           ("preview", old["preview"]),
                           ("smallPreview", "/assets/previews-small/" + Path(old["preview"]).name)):
            path = ROOT / local_path(url)
            if not path.is_file():
                raise ValueError(f"old asset is missing before import: {path}")
            retired[label] = retired.get(label, 0) + 1
    return rows, {"sha256": archive_sha, "name": archive.name,
                  "documents": {CSV_NAME: sha256_bytes(csv_bytes), JSON_NAME: sha256_bytes(json_bytes),
                                README_NAME: sha256_bytes(readme_bytes)},
                  "rowCount": len(rows)}


def make_preview(source: Path, target: Path, maximum: int) -> None:
    target.parent.mkdir(parents=True, exist_ok=True)
    with Image.open(source) as image:
        image.load()
        if image.mode != "RGB" or "transparency" in image.info:
            raise ValueError(f"source WebP must be opaque RGB: {source}")
        profile = image.info.get("icc_profile")
        image.thumbnail((maximum, maximum), Image.Resampling.LANCZOS)
        image.save(target, format="WEBP", quality=86, method=6, icc_profile=profile)


def import_package(archive: Path) -> None:
    manifest_path = ROOT / "site/assets/data/manifest.json"
    manifest = json.loads(manifest_path.read_text())
    if manifest.get("packageImport"):
        raise ValueError("a calendar package is already imported; this script only runs once")
    if manifest.get("reviewedTransition") != "docs/language-audit/2026-10-17/annual-monochrome-legend-v2.json":
        raise ValueError("starting print asset state is not the reviewed main-branch baseline")
    rows, archive_meta = validate_archive(archive, manifest)
    old_assets = {manifest_key(asset): asset for asset in manifest["assets"]}
    records = []
    replacements = {}
    with zipfile.ZipFile(archive) as zf:
        for row in rows:
            key = (row["kind"], int(row["year"]), int(row["month"] or 0), row["design_id"])
            old = old_assets[key]
            stem = row["filename_stem"]
            pdf_url = "/downloads/" + row["pdf_path"]
            webp_url = "/downloads/" + row["webp_path"]
            preview_url = "/assets/previews/" + stem + ".webp"
            small_url = "/assets/previews-small/" + stem + ".webp"
            legacy = {
                "pdf": old["pdf"], "webp": old["webp"], "preview": old["preview"],
                "smallPreview": "/assets/previews-small/" + Path(old["preview"]).name,
            }
            before_files = {
                label: original_file_info(ROOT / local_path(url), local_path(url))
                for label, url in legacy.items()
            }
            new_asset = {name: value for name, value in old.items()
                         if name not in {"dateLayout", "style", "typography", "generator",
                                         "renderCompatibility", "verification"}}
            new_asset.update({
                "design": row["design_id"],
                "name": row["design_name_lt"],
                "monthLt": row["month_lt"] or None,
                "monthGenitiveLt": row["month_genitive_lt"] or None,
                "layout": "landscape" if int(row["width_px"]) > int(row["height_px"]) else "portrait",
                "landscape": int(row["width_px"]) > int(row["height_px"]),
                "stem": old["stem"],
                "filenameStem": stem,
                "title": row["title_lt"],
                "alt": row["alt_text_lt"],
                "description": row["description_lt"],
                "caption": row["caption_lt"],
                "primaryQuery": row["primary_query_lt"],
                "holidayInformation": row["holiday_information"].lower() == "true",
                "markedHolidayCount": int(row["marked_holiday_count"]),
                "pdfColorSpace": row["pdf_color_space"],
                "webpColorSpace": row["webp_color_space"],
                "webpCompression": row["webp_compression"],
                "colorMode": "CMYK PDF (FOGRA39) / sRGB WebP",
                "paper": "A3",
                "renderPPI": 600,
                "dimensions": {"width": int(row["width_px"]), "height": int(row["height_px"])},
                "pdf": pdf_url,
                "webp": webp_url,
                "preview": preview_url,
                "smallPreview": small_url,
                "legacyPaths": legacy,
                "files": {
                    "pdf": {"bytes": zf.getinfo(row["pdf_path"]).file_size, "sha256": row["pdf_sha256"]},
                    "webp": {"bytes": zf.getinfo(row["webp_path"]).file_size, "sha256": row["webp_sha256"]},
                },
            })
            for label, url in (("pdf", pdf_url), ("webp", webp_url)):
                relative = local_path(url)
                destination = ROOT / relative
                destination.parent.mkdir(parents=True, exist_ok=True)
                with zf.open(row[f"{label}_path"]) as source, destination.open("wb") as target:
                    shutil.copyfileobj(source, target, 1024 * 1024)
            make_preview(ROOT / local_path(webp_url), ROOT / local_path(preview_url), PREVIEW_SIZE)
            make_preview(ROOT / local_path(webp_url), ROOT / local_path(small_url), SMALL_PREVIEW_SIZE)
            for label, url in (("preview", preview_url), ("smallPreview", small_url)):
                file_path = ROOT / local_path(url)
                new_asset["files"][label] = {"bytes": file_path.stat().st_size, "sha256": sha256_file(file_path)}
            new_files = {
                label: original_file_info(ROOT / local_path(url), local_path(url))
                for label, url in {"pdf": pdf_url, "webp": webp_url,
                                   "preview": preview_url, "smallPreview": small_url}.items()
            }
            replacements[key] = new_asset
            records.append({
                "key": list(key),
                "archivePaths": {"pdf": row["pdf_path"], "webp": row["webp_path"]},
                "sourceSha256": {"pdf": row["pdf_sha256"], "webp": row["webp_sha256"]},
                "beforeFiles": before_files,
                "afterFiles": new_files,
                "finalAsset": new_asset,
            })

    manifest["assets"] = [replacements.get(manifest_key(asset), asset) for asset in manifest["assets"]]
    manifest["sourceReviewed"] = "2026-10-18"
    manifest.pop("reviewedTransition", None)
    manifest.pop("generatorScope", None)
    evidence = {
        "schema": 1,
        "version": IMPORT_VERSION,
        "archive": archive_meta,
        "counts": {"monthly": 360, "annual": 30, "records": 390, "pdf": 390, "webp": 390},
        "years": list(TARGET_YEARS),
        "previewPolicy": {"format": "WebP", "maximumDimensions": [680, 680],
                          "smallMaximumDimensions": [340, 340], "quality": 86},
        "records": records,
    }
    evidence_path = ROOT / IMPORT_EVIDENCE_PATH
    evidence_path.parent.mkdir(parents=True, exist_ok=True)
    evidence_bytes = (json.dumps(evidence, ensure_ascii=False, indent=2) + "\n").encode("utf-8")
    evidence_path.write_bytes(evidence_bytes)
    manifest["packageImport"] = {
        "version": IMPORT_VERSION,
        "archive": archive.name,
        "archiveSha256": archive_meta["sha256"],
        "years": list(TARGET_YEARS),
        "monthlyRecords": 360,
        "annualRecords": 30,
        "pdfFiles": 390,
        "webpFiles": 390,
        "evidence": IMPORT_EVIDENCE_PATH,
        "evidenceSha256": sha256_bytes(evidence_bytes),
    }
    manifest_path.write_text(json.dumps(manifest, ensure_ascii=False, indent=2) + "\n")

    # Remove the superseded files only after all 780 new originals and 780
    # generated previews have been written successfully.
    retired = {file_info["path"] for record in records for file_info in record["beforeFiles"].values()}
    for relative in retired:
        path = ROOT / relative
        path.unlink()
        parent = path.parent
        while parent != ROOT and parent.name in {"downloads", "previews", "previews-small"}:
            try:
                parent.rmdir()
            except OSError:
                break
            parent = parent.parent
    print(json.dumps({"importedRecords": len(records), "newOriginalFiles": 780,
                      "newPreviews": 780, "removedOldFiles": len(retired),
                      "archiveSha256": archive_meta["sha256"],
                      "evidenceSha256": manifest["packageImport"]["evidenceSha256"]}, ensure_ascii=False))


if __name__ == "__main__":
    parser = argparse.ArgumentParser()
    parser.add_argument("archive", type=Path, help="path to the supplied calendar ZIP")
    args = parser.parse_args()
    import_package(args.archive.expanduser().resolve())
