import "server-only";

const NOMINATIM_ENDPOINT = "https://nominatim.openstreetmap.org/search";
const USER_AGENT = "TripCancil/0.1 (https://tripcancil.vercel.app)";

export type NominatimResult = {
  place_id: number;
  display_name: string;
  lat: string;
  lon: string;
  type?: string;
  class?: string;
  name?: string;
  osm_type?: string;
  osm_id?: number;
};

/**
 * Nominatim's usage policy is one request per second and a real User-Agent, so
 * this module is the single place that talks to it: the browser never sees the
 * endpoint, and concurrent searches from one server instance queue up instead of
 * hammering a shared free API.
 */
const MIN_INTERVAL_MS = 1100;
let lastRequestAt = 0;

async function waitForSlot(): Promise<void> {
  const wait = lastRequestAt + MIN_INTERVAL_MS - Date.now();
  if (wait > 0) await new Promise((resolve) => setTimeout(resolve, wait));
  lastRequestAt = Date.now();
}

export async function searchPlaces(query: string): Promise<NominatimResult[]> {
  const q = query.trim();
  if (q.length < 2) return [];

  const url = new URL(NOMINATIM_ENDPOINT);
  url.searchParams.set("q", q);
  url.searchParams.set("format", "jsonv2");
  url.searchParams.set("limit", "8");
  url.searchParams.set("addressdetails", "1");

  await waitForSlot();

  const res = await fetch(url, {
    headers: {
      "User-Agent": USER_AGENT,
      Accept: "application/json",
    },
    cache: "no-store",
  });

  if (!res.ok) return [];
  const data = (await res.json()) as NominatimResult[];
  return data.filter((r) => r.lat && r.lon);
}
