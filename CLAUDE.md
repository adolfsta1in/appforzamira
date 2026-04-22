# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Commands

```bash
npm run dev      # Next.js dev server on http://localhost:3000
npm run build    # Production build
npm run start    # Run production build
npm run lint     # ESLint (next/core-web-vitals preset)
```

There is no test runner configured.

## Required environment (`.env.local`)

- `DEEPSEEK_API_KEY` — DeepSeek chat completions, called via the OpenAI SDK pointed at `https://api.deepseek.com`. Without it `/api/parse` returns 500 and `/api/parse-quantity` silently no-ops.
- `NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_ANON_KEY` — Supabase project `tojikstandart-registry` (id `jjozlharjcbdfxchadpr`). Defaults to placeholder values if missing, so the app loads but every DB call fails.

## Architecture

### Domain
Web app for **Агентии Тоҷикстандарт** that digitises Tajik-language PDF certificates of conformity into a searchable registry and reprints them onto pre-printed A4 blanks. All UI text is Russian/Tajik; preserve that when editing copy.

### Data flow (the one thing to understand first)

`CertificateFormData` in [src/lib/certificateTypes.ts](src/lib/certificateTypes.ts) is the single source of truth that three very differently shaped representations flow through:

1. **PDF → form.** `/api/parse` uploads the PDF, runs `pdf-parse` server-side, sends extracted text to DeepSeek with a strict Russian-language system prompt that returns JSON keyed to form fields. Quantity is returned split into `quantity_value` + `quantity_unit`; a legacy `quantity: "1000кг"` string is split by regex as a fallback.
2. **Form → registry columns.** `formToRegistryRow()` maps form fields to a 23-column row `A..V` (plus a synthetic `N1` wedged between `N` and `O` for the unit). `ALL_COLUMNS` defines the column order and must be kept in sync with `COLUMN_LABELS` and the Excel export in [src/app/page.tsx](src/app/page.tsx) (`downloadExcel`). Array fields (`products`, `basis_documents`) are joined with a single space on write and never re-split — the DB stores them flat.
3. **Form → printed blank.** [CertificateEditor.tsx](src/app/components/CertificateEditor.tsx) renders the form as absolutely-positioned inputs layered on [public/blank.png](public/blank.png) inside a 210mm×297mm div, so what's on screen is what prints. Positions (`DEFAULT_LAYOUTS`) are in mm and tuned to the specific scanned blank — touching them will misalign every existing print calibration.

### Two layout systems, same concept
- [CertificateEditor.tsx](src/app/components/CertificateEditor.tsx) `DEFAULT_LAYOUTS` — the *live editor*, with drag/resize. This is the one actually used on `/`.
- [src/lib/printLayout.ts](src/lib/printLayout.ts) `DEFAULT_PRINT_LAYOUT` — a parallel config consumed by the `/settings` page and [PrintPreview.tsx](src/app/components/PrintPreview.tsx) component.
Don't assume one authoritative layout source — changes to blank positioning usually need to touch both.

### Array-indexed layout keys
Layout keys `products_1..products_3` and `basis_document_1..basis_document_2` are indices into the `products[]` / `basis_documents[]` arrays, mapped via `ARRAY_LAYOUT_MAP` in CertificateEditor. The form allows adding rows past index 2 — those extra rows exist in the data, join into the Excel export, but have no position on the blank.

### Calibration persistence & versioning
`DEFAULT_LAYOUTS` is cached in `localStorage` under `cert_field_layouts`, gated by `LAYOUT_VERSION` (currently `'3'`). **Bump `LAYOUT_VERSION` in [CertificateEditor.tsx](src/app/components/CertificateEditor.tsx) whenever `DEFAULT_LAYOUTS` changes** — otherwise existing users' stored layouts override your new defaults.

The form itself is also autosaved to `localStorage` (`cert_form_draft`, version `'1'`) and rehydrated on mount in [src/app/page.tsx](src/app/page.tsx). New fields get defaults via `EMPTY_FORM_DATA` merge; if you change the shape of array fields, update `loadDraft` accordingly.

### Auto-quantity side effect
`page.tsx` watches `formData.products` and calls `/api/parse-quantity` on a 1.5s debounce to compute a total quantity. It gates itself on `userEditedQuantityRef` — once the user types in either quantity field, auto-compute stops until the flag is reset (happens on PDF upload, template load, or adding a product row). Any new path that fills quantity programmatically should reset this ref to behave consistently.

### Templates
Stored in Supabase `templates` (`id`, `name`, `data jsonb`, `created_at`). Saving strips `UNIQUE_FIELDS` (cert number, dates, serial/copy, invoice) from the snapshot; loading clears those same fields on the target form. Keep these two lists in sync.

### Print mode
`window.print()` relies entirely on CSS in [src/app/globals.css](src/app/globals.css) under `@media print`: it uses `visibility: hidden` on `body *` then shows only `#print-area`, and relies on `.no-print` on every non-blank UI element. Any new top-level UI must either live inside `#print-area` or carry `.no-print`, or it will paint over the certificate.

### Supabase schema (production)
Three tables, all with RLS enabled but a blanket `qual: true / with_check: true` policy — effectively public. Two public storage buckets: `pdf-files` (certificate originals) and `appendix-files` (attachments from `/appendix`). All columns on `certificates` are `text`; dates, INN, and quantities are strings, so don't try to sort or filter by them at the DB level. No foreign key between `appendices.cert_number` and `certificates.cert_number`.

### `pdf-parse` quirk
`pdf-parse` is `require`'d (not imported) in [src/app/api/parse/route.ts](src/app/api/parse/route.ts) and must stay listed in `experimental.serverComponentsExternalPackages` in [next.config.mjs](next.config.mjs). Converting either to ESM imports breaks the build.
