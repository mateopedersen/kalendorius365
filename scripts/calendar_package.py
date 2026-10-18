"""Pinned evidence checks for the supplied 2027–2029 calendar package."""
from __future__ import annotations

from pathlib import Path
import hashlib
import json

ROOT = Path(__file__).resolve().parents[1]
IMPORT_EVIDENCE_PATH = "docs/calendar-assets/2027-2029-package-import.json"
# Updated once the user-provided package is imported and the complete evidence
# record has been generated. This pins both the ZIP digest and every transition.
IMPORT_EVIDENCE_SHA256 = "7f6da5c8ea78c56e3028fca8813a3f1a801190ffe8e526a2af7a9367808373a5"
IMPORT_VERSION = "kalendorius365-2027-2029-package-v1"
TARGET_YEARS = (2027, 2028, 2029)
TARGET_MONTHS = 36
TARGET_ANNUAL = 3
TARGET_RECORDS = 390


def sha256_file(path: Path) -> str:
    digest = hashlib.sha256()
    with path.open("rb") as stream:
        for block in iter(lambda: stream.read(1024 * 1024), b""):
            digest.update(block)
    return digest.hexdigest()


def expected_keys() -> set[tuple[str, int, int, str]]:
    keys = {
        ("monthly", year, month, f"{design:02}")
        for year in TARGET_YEARS
        for month in range(1, 13)
        for design in range(1, 11)
    }
    keys.update(
        ("annual", year, 0, f"{design:02}")
        for year in TARGET_YEARS
        for design in range(1, 11)
    )
    return keys


def manifest_key(asset: dict) -> tuple[str, int, int, str]:
    return (
        asset["kind"],
        int(asset.get("year") or 0),
        int(asset.get("month") or 0),
        str(asset["design"]),
    )


def validate_import_evidence(root: Path = ROOT, manifest: dict | None = None,
                             check_files: bool = True) -> dict:
    """Verify the pinned package transition and return the archived evidence."""
    root = Path(root)
    manifest = manifest or json.loads((root / "site/assets/data/manifest.json").read_text())
    source = manifest.get("packageImport")
    if not isinstance(source, dict):
        raise ValueError("calendar package provenance is missing from the asset manifest")
    if source.get("version") != IMPORT_VERSION or source.get("evidence") != IMPORT_EVIDENCE_PATH:
        raise ValueError("calendar package provenance identity differs")
    evidence_path = root / IMPORT_EVIDENCE_PATH
    raw = evidence_path.read_bytes()
    evidence_sha = hashlib.sha256(raw).hexdigest()
    if evidence_sha != IMPORT_EVIDENCE_SHA256 or source.get("evidenceSha256") != evidence_sha:
        raise ValueError("calendar package import evidence hash differs")
    evidence = json.loads(raw)
    if evidence.get("version") != IMPORT_VERSION:
        raise ValueError("calendar package evidence version differs")
    if evidence.get("archive", {}).get("sha256") != source.get("archiveSha256"):
        raise ValueError("calendar ZIP digest differs between manifest and evidence")
    expected_source = {"years": list(TARGET_YEARS), "monthlyRecords": 360,
                       "annualRecords": 30, "pdfFiles": 390, "webpFiles": 390}
    if any(source.get(name) != value for name, value in expected_source.items()):
        raise ValueError("calendar package manifest counts differ")
    if evidence.get("counts") != {"monthly": 360, "annual": 30, "records": TARGET_RECORDS,
                                   "pdf": TARGET_RECORDS, "webp": TARGET_RECORDS}:
        raise ValueError("calendar package evidence counts differ")

    records = evidence.get("records")
    if not isinstance(records, list) or len(records) != TARGET_RECORDS:
        raise ValueError("calendar package evidence must contain exactly 390 records")
    keyed = {tuple(item.get("key", [])): item for item in records}
    if len(keyed) != len(records) or set(keyed) != expected_keys():
        raise ValueError("calendar package evidence does not cover exactly all 2027–2029 calendars")

    assets = [asset for asset in manifest.get("assets", [])
              if asset.get("year") in TARGET_YEARS and asset.get("kind") in {"monthly", "annual"}]
    current = {manifest_key(asset): asset for asset in assets}
    if len(current) != TARGET_RECORDS or set(current) != expected_keys():
        raise ValueError("current manifest does not contain the complete imported calendar set")

    retired_paths: dict[str, dict] = {}
    new_paths: set[str] = set()
    for key, item in keyed.items():
        asset = current[key]
        expected_asset = item.get("finalAsset")
        if not isinstance(expected_asset, dict):
            raise ValueError(f"missing post-import asset record for {key}")
        comparable = {name: value for name, value in asset.items() if name != "verification"}
        if comparable != expected_asset:
            raise ValueError(f"manifest metadata differs from pinned package evidence for {key}")
        for kind in ("pdf", "webp"):
            if item.get("sourceSha256", {}).get(kind) != expected_asset["files"][kind]["sha256"]:
                raise ValueError(f"archived {kind.upper()} digest differs from the manifest for {key}")
        expected_archive_paths = item.get("archivePaths", {})
        for kind in ("pdf", "webp"):
            if asset[kind] != "/downloads/" + expected_archive_paths.get(kind, ""):
                raise ValueError(f"manifest {kind.upper()} URL differs from its package member for {key}")

        for label, file_info in item.get("beforeFiles", {}).items():
            relative = file_info["path"]
            if relative in retired_paths:
                raise ValueError("duplicate retired path in package evidence")
            retired_paths[relative] = {"key": key, "label": label, **file_info}
            if (root / relative).exists():
                raise ValueError(f"superseded calendar asset still exists: {relative}")

        for label, file_info in item.get("afterFiles", {}).items():
            relative = file_info["path"]
            if relative in new_paths:
                raise ValueError("duplicate imported path in package evidence")
            new_paths.add(relative)
            manifest_url_key = {"smallPreview": "smallPreview"}.get(label, label)
            if relative != "site/" + asset[manifest_url_key].lstrip("/"):
                raise ValueError(f"evidence {label} path differs from the manifest for {key}")
            if check_files:
                path = root / relative
                if not path.is_file() or path.stat().st_size != file_info["bytes"]:
                    raise ValueError(f"imported file is absent or has a changed size: {relative}")
                if sha256_file(path) != file_info["sha256"]:
                    raise ValueError(f"imported file differs from the supplied package: {relative}")

    if len(retired_paths) != TARGET_RECORDS * 4 or len(new_paths) != TARGET_RECORDS * 4:
        raise ValueError("package import must replace four site files per calendar record")
    if retired_paths.keys() & new_paths:
        raise ValueError("new package paths overlap retired asset paths")
    return {"evidence": evidence, "retiredPaths": retired_paths, "newPaths": new_paths,
            "evidenceSha256": evidence_sha}
