// Small client for Te Papa's Collections API (https://data.tepapa.govt.nz).
// It only runs at build time, so the API key never reaches the browser.

import { z } from "zod";

const API = "https://data.tepapa.govt.nz/collection";

export interface Bird {
  id: number;
  maoriName: string;
  commonName?: string;
  scientificName: string;
  family?: string;
  image: {
    thumb: string;
    preview: string;
    width: number;
    height: number;
    licence: string;
    licenceUrl: string;
  };
  creditLine?: string;
  collectionsOnlineUrl: string;
}

// Only the parts of the API response we use. Zod checks the data at runtime,
// drops fields we don't list, and gives us the TypeScript types via z.infer.
const RawObjectSchema = z.object({
  id: z.number(),
  creditLine: z.string().optional(),
  identification: z
    .array(
      z.object({
        toTaxon: z
          .object({
            id: z.number(),
            scientificName: z.string().optional(),
            family: z.string().optional(),
            vernacularName: z
              .array(z.object({ title: z.string(), language: z.string().optional() }))
              .optional(),
          })
          .optional(),
      }),
    )
    .optional(),
  hasRepresentation: z
    .array(
      z.object({
        thumbnailUrl: z.url(),
        previewUrl: z.url(),
        width: z.number(),
        height: z.number(),
        rights: z
          .object({ title: z.string(), iri: z.url(), allowsDownload: z.boolean() })
          .optional(),
      }),
    )
    .optional(),
});

type RawObject = z.infer<typeof RawObjectSchema>;

// The outer shape must be right or nothing works, so it's checked strictly.
// Each record is checked separately in getBirds(), so one bad record can't sink the build.
const SearchResponseSchema = z.object({ results: z.array(z.unknown()) });
const GuestTokenSchema = z.object({ guestToken: z.string().min(1) });

async function authHeaders(): Promise<Record<string, string>> {
  const key = import.meta.env.TEPAPA_API_KEY;
  if (key) return { Accept: "application/json", "x-api-key": key };

  // Without a key, the API returns a one-hour guest token on an unauthorised request.
  const res = await fetch(`${API}/search/?q=kiwi&size=1`, { headers: { Accept: "application/json" } });
  const { guestToken } = GuestTokenSchema.parse(await res.json());
  return { Accept: "application/json", Authorization: `Bearer ${guestToken}` };
}

function toBird(raw: RawObject): Bird | undefined {
  const taxon = raw.identification?.[0]?.toTaxon;
  const image = raw.hasRepresentation?.find((r) => r.rights?.allowsDownload);
  const names = taxon?.vernacularName ?? [];
  const maoriName = names.find((n) => n.language === "Māori")?.title;

  if (!taxon?.scientificName || !image?.rights || !maoriName) return undefined;

  const commonName = names.find((n) => n.language === "English")?.title;

  return {
    id: raw.id,
    maoriName,
    commonName,
    scientificName: taxon.scientificName,
    family: taxon.family,
    image: {
      thumb: image.thumbnailUrl,
      preview: image.previewUrl,
      width: image.width,
      height: image.height,
      licence: image.rights.title,
      licenceUrl: image.rights.iri,
    },
    creditLine: raw.creditLine,
    collectionsOnlineUrl: `https://collections.tepapa.govt.nz/object/${raw.id}`,
  };
}

// Env vars are always strings, so coerce to a number before checking it.
// Unset → 60; "abc", "0" or "2.5" → the build fails with a clear message.
const limit = z.coerce
  .number()
  .int()
  .positive()
  .default(60)
  .safeParse(import.meta.env.BIRD_LIMIT);
if (!limit.success) {
  throw new Error(
    `BIRD_LIMIT must be a positive whole number, got "${import.meta.env.BIRD_LIMIT}"\n${z.prettifyError(limit.error)}`,
  );
}
const BIRD_LIMIT = limit.data;

let cached: Promise<Bird[]> | undefined;

// One bird per species: Te Papa holds many specimens of each, so keep the first
// downloadable image we find for each taxon.
export function getBirds(): Promise<Bird[]> {
  cached ??= (async () => {
    // Filters only apply to POST searches; the API ignores them on GET.
    const res = await fetch(`${API}/search`, {
      method: "POST",
      headers: { ...(await authHeaders()), "Content-Type": "application/json" },
      body: JSON.stringify({
        query: "*",
        size: 500,
        filters: [
          { field: "type", keyword: "Specimen" },
          { field: "collection", keyword: "Birds" },
          { field: "hasRepresentation.rights.allowsDownload", keyword: "true" },
        ],
      }),
    });
    if (!res.ok) throw new Error(`Te Papa API search returned ${res.status}`);

    const { results } = SearchResponseSchema.parse(await res.json());
    const bySpecies = new Map<string, Bird>();
    let invalid = 0;
    for (const item of results) {
      const parsed = RawObjectSchema.safeParse(item);
      if (!parsed.success) {
        invalid++;
        continue;
      }
      const bird = toBird(parsed.data);
      if (bird && !bySpecies.has(bird.scientificName)) bySpecies.set(bird.scientificName, bird);
    }
    if (invalid > 0) console.warn(`Skipped ${invalid} of ${results.length} records that didn't match the expected shape`);
    return [...bySpecies.values()]
      .sort((a, b) => a.maoriName.localeCompare(b.maoriName, "mi"))
      .slice(0, BIRD_LIMIT);
  })();
  return cached;
}
