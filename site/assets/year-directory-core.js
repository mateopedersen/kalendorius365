const DAY_MS = 86400000;

function validYearMonth(year, month) {
  if (!Number.isInteger(year) || year < 1900 || year > 9999 || !Number.isInteger(month) || month < 1 || month > 12) {
    throw new RangeError("Nurodykite galiojančius metus ir mėnesį.");
  }
}

/** Monday-first calendar grid for date-only arithmetic; never depends on local time. */
export function monthGrid(year, month) {
  validYearMonth(year, month);
  const first = Date.UTC(year, month - 1, 1);
  const days = new Date(Date.UTC(year, month, 0)).getUTCDate();
  const mondayOffset = (new Date(first).getUTCDay() + 6) % 7;
  const rowCount = Math.ceil((mondayOffset + days) / 7);
  const cells = Array.from({ length: rowCount * 7 }, (_, index) => {
    const day = index - mondayOffset + 1;
    return day < 1 || day > days ? null : day;
  });
  return { year, month, days, mondayOffset, rowCount, cells };
}

export function yearFacts(year) {
  validYearMonth(year, 1);
  const firstDay = new Date(Date.UTC(year, 0, 1)).getUTCDay();
  const lastDay = new Date(Date.UTC(year, 11, 31)).getUTCDay();
  const days = (new Date(Date.UTC(year + 1, 0, 1)) - Date.UTC(year, 0, 1)) / DAY_MS;
  return { year, days, leap: days === 366, firstDay, lastDay };
}

/** Printable annual designs exposed by the verified file inventory only. */
export function yearPrintAssets(manifest, year) {
  validYearMonth(year, 1);
  if (!manifest || !Array.isArray(manifest.assets)) return [];
  return manifest.assets
    .filter((asset) => asset?.kind === "annual" && asset.year === year &&
      asset.verification?.status === "passed" &&
      typeof asset.pdf === "string" && asset.pdf.startsWith(`/downloads/metiniai/${year}/`) && asset.pdf.endsWith(".pdf") &&
      typeof asset.webp === "string" && asset.webp.startsWith(`/downloads/metiniai/${year}/`) && asset.webp.endsWith(".webp"))
    .sort((a, b) => String(a.name).localeCompare(String(b.name), "lt"));
}
