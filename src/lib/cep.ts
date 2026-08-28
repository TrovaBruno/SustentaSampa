/**
 * Descoberta automática de CEP a partir da localização do aparelho.
 * O usuário nunca digita o CEP: usamos geocodificação reversa (Nominatim/OSM)
 * e depois o centroide do CEP para agrupar os reportes por região.
 */

export type CepLocation = {
  cep: string | null;
  /** Coordenada usada no reporte: centroide do CEP quando disponível. */
  lat: number;
  lng: number;
  label: string | null;
};

const cache = new Map<string, CepLocation>();

function normalizeCep(raw: string | undefined | null): string | null {
  if (!raw) return null;
  const digits = raw.replace(/\D/g, "").slice(0, 8);
  if (digits.length !== 8) return null;
  return `${digits.slice(0, 5)}-${digits.slice(5)}`;
}

async function reverseGeocode(lat: number, lng: number) {
  const url = `https://nominatim.openstreetmap.org/reverse?format=jsonv2&lat=${lat}&lon=${lng}&zoom=18&addressdetails=1`;
  const res = await fetch(url, { headers: { Accept: "application/json" } });
  if (!res.ok) throw new Error("reverse geocode failed");
  return (await res.json()) as {
    address?: { postcode?: string; suburb?: string; city_district?: string; city?: string; town?: string };
  };
}

async function cepCentroid(cep: string): Promise<{ lat: number; lng: number } | null> {
  const url = `https://nominatim.openstreetmap.org/search?format=jsonv2&country=Brazil&postalcode=${encodeURIComponent(
    cep,
  )}&limit=1`;
  const res = await fetch(url, { headers: { Accept: "application/json" } });
  if (!res.ok) return null;
  const arr = (await res.json()) as Array<{ lat: string; lon: string }>;
  const first = arr[0];
  if (!first) return null;
  return { lat: Number(first.lat), lng: Number(first.lon) };
}

/** Resolve o CEP (e o centroide dele) para uma coordenada do dispositivo. */
export async function resolveCepFromCoords(lat: number, lng: number): Promise<CepLocation> {
  const key = `${lat.toFixed(4)}:${lng.toFixed(4)}`;
  const cached = cache.get(key);
  if (cached) return cached;

  const fallback: CepLocation = { cep: null, lat, lng, label: null };
  try {
    const data = await reverseGeocode(lat, lng);
    const cep = normalizeCep(data.address?.postcode);
    if (!cep) {
      cache.set(key, fallback);
      return fallback;
    }
    const bairro =
      data.address?.suburb ?? data.address?.city_district ?? data.address?.town ?? data.address?.city ?? null;
    const centroid = await cepCentroid(cep);
    const result: CepLocation = {
      cep,
      lat: centroid?.lat ?? lat,
      lng: centroid?.lng ?? lng,
      label: bairro,
    };
    cache.set(key, result);
    return result;
  } catch {
    cache.set(key, fallback);
    return fallback;
  }
}
