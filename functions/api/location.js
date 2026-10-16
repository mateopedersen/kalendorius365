import { cityForRequest } from "../../shared/weather-cities.js";

export function onRequestGet({ request }) {
  return Response.json(
    { city: cityForRequest(request.cf || {}) },
    {
      headers: {
        "Cache-Control": "private, no-store, max-age=0",
        "CDN-Cache-Control": "no-store",
        "Surrogate-Control": "no-store",
        "X-Content-Type-Options": "nosniff",
      },
    },
  );
}
