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

export async function searchPlaces(query: string): Promise<NominatimResult[]> {
  const q = query.trim();
  if (q.length < 2) return [];

  const url = new URL(NOMINATIM_ENDPOINT);
  url.searchParams.set("q", q);
  url.searchParams.set("format", "jsonv2");
  url.searchParams.set("limit", "10");
  url.searchParams.set("addressdetails", "1");

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
