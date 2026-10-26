# Ngā Manu · Birds of Aotearoa

A small, accessible website for exploring bird specimens from Te Papa's natural history collection. Birds are listed by their te reo Māori names, with English and scientific names alongside.

Data and images come from [Te Papa's Collections API](https://data.tepapa.govt.nz). This is an independent learning project and is not affiliated with Te Papa.

## How it works

- **[Astro](https://astro.build), fully static.** Pages are generated at build time from the Collections API, so the browser receives plain HTML and CSS with no JavaScript.
- **Validated at the boundary.** API responses and configuration are checked with [Zod](https://zod.dev). If the API's overall shape changes, the build fails instead of deploying an empty site. Individual malformed records are skipped and counted in the build log.
- **Licensing respected.** Only images whose rights allow download are shown, each with its licence and credit line.
- **Accessibility.** Te reo Māori is marked up with `lang="mi"` so screen readers pronounce it correctly. The site also has a skip link, visible keyboard focus, alt text and dark mode support.

The API client lives in [`src/lib/tepapa.ts`](src/lib/tepapa.ts).

## Running locally

Requires Node.js 22 or later.

```sh
npm install
npm run dev       # dev server at http://localhost:4321
npm run check     # type-check
npm run build     # static site in dist/
npm run preview   # serve dist/ locally
```

### Configuration

Set these as environment variables or in a `.env` file (which git ignores):

| Variable | Default | Purpose |
|---|---|---|
| `TEPAPA_API_KEY` | none | A registered API key. Without one, the build uses the API's one-hour guest token. |
| `BIRD_LIMIT` | `60` | Number of species to include. Must be a positive whole number. |

## Licence

Code: MIT. Collection data and images belong to Te Papa and are used under the licence shown on each image (for example, CC BY 4.0).
