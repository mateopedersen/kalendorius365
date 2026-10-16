const EUROPEAN_COUNTRIES = new Set([
  "AD", "AL", "AM", "AT", "AZ", "BA", "BE", "BG", "BY", "CH", "CY",
  "AX", "CZ", "DE", "DK", "EE", "ES", "EU", "FI", "FO", "FR", "GB",
  "GE", "GG", "GI", "GR", "HR", "HU", "IE", "IM", "IS", "IT", "JE",
  "LI", "LT",
  "LU", "LV", "MC", "MD", "ME", "MK", "MT", "NL", "NO", "PL", "PT",
  "RO", "RS", "RU", "SE", "SI", "SJ", "SK", "SM", "TR", "UA", "VA",
  "XK",
]);

export async function onRequestGet({ request }) {
  const country = String(
    request.cf?.country ?? request.headers.get("CF-IPCountry") ?? "",
  ).toUpperCase();

  // When Cloudflare cannot determine a country, show the notice as the safer fallback.
  const showNotice =
    !country || country === "XX" || country === "T1"
      ? true
      : EUROPEAN_COUNTRIES.has(country);

  return Response.json(
    { showNotice },
    {
      headers: {
        "Cache-Control": "private, no-store, max-age=0",
        "X-Content-Type-Options": "nosniff",
        "Referrer-Policy": "no-referrer",
      },
    },
  );
}
