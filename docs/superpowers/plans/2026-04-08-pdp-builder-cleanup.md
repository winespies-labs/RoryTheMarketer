# PDP Ad Builder — Cleanup & Completion Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Delete the dead HTML/Puppeteer ad system, fix the broken Review Brief step with a proper field-mapping table, add a Meta publish step, and leave one clean pipeline: wine feed → reference template → generated ads → Meta.

**Architecture:** The working system lives entirely in `app/creative/pdp/` and `app/creative/ad-builder/`. The dead system is `lib/assembler/`, `lib/template-*.ts`, `templates/`, and `app/ad-builder/`. Phase 1 deletes the dead system. Phase 2 upgrades `DataReview.tsx` to show per-template field mapping status using new types added to `wineAdContext.ts`. Phase 3 adds a publish step wired to the existing `lib/meta-publish.ts` functions.

**Tech Stack:** Next.js 15 App Router, React 19, TypeScript strict, Tailwind CSS 4, Prisma 6 (PostgreSQL), Meta Graph API (`lib/meta-publish.ts`, `lib/meta-graph.ts`)

---

## File Map

**Deleted:**
- `lib/assembler/` (entire dir)
- `lib/template-schema.ts`
- `lib/template-product.ts`
- `lib/template-registry.ts`
- `templates/` (entire dir)
- `app/ad-builder/` (entire dir)
- `app/api/ad-builder/assemble-brief/`
- `app/api/ad-builder/templates/`
- `app/api/creative/templates/`

**Modified:**
- `prisma/schema.prisma` — remove `PdpTemplate`, `PdpGeneratedAd` models
- `app/creative/ad-builder/_shared/wineAdContext.ts` — add `TemplateSchema` types, `TEMPLATE_SCHEMAS`, `resolveTemplateFields`, `resolveBatchMappings`
- `app/creative/pdp/page.tsx` — wire `useBatchMapping`, add Step 5, pass `batch` to DataReview
- `app/creative/pdp/components/DataReview.tsx` — full rebuild as field-mapping accordion
- `app/creative/pdp/components/ResultsGrid.tsx` — add selection checkboxes + Publish Selected button

**Created:**
- `app/creative/pdp/hooks/useBatchMapping.ts` — wraps `resolveBatchMappings`, exposes ready/blocked counts
- `app/creative/pdp/components/PublishPanel.tsx` — Meta copy fields, ad set picker, publish flow
- `app/api/pdp/publish/route.ts` — upload image → create creative → create ad per selected job

---

## Task 1: Delete the Dead Puppeteer System

**Files:**
- Delete: `lib/assembler/` (directory)
- Delete: `lib/template-schema.ts`
- Delete: `lib/template-product.ts`
- Delete: `lib/template-registry.ts`
- Delete: `templates/` (directory)
- Delete: `app/ad-builder/` (directory)
- Delete: `app/api/ad-builder/` (directory — contains `assemble-brief/` and `templates/`)
- Delete: `app/api/creative/templates/` (directory)

- [ ] **Step 1: Delete lib files**

```bash
rm -rf lib/assembler lib/template-schema.ts lib/template-product.ts lib/template-registry.ts
```

Expected: no output, no errors.

- [ ] **Step 2: Delete templates directory**

```bash
rm -rf templates
```

- [ ] **Step 3: Delete old app/ad-builder route**

```bash
rm -rf app/ad-builder
```

- [ ] **Step 4: Delete dead API routes**

```bash
rm -rf app/api/ad-builder app/api/creative/templates
```

- [ ] **Step 5: Verify build still compiles**

```bash
npm run build 2>&1 | tail -30
```

Expected: build succeeds. Fix any import errors referencing deleted files before continuing. Common culprits: anything in `app/wines/` or `app/context-hub/` that may have imported from `lib/template-*`. Search:

```bash
grep -r "template-schema\|template-product\|template-registry\|lib/assembler" app lib --include="*.ts" --include="*.tsx" -l
```

If any files appear, remove their imports of the deleted modules.

- [ ] **Step 6: Commit**

```bash
git add -A
git commit -m "chore: delete dead HTML/Puppeteer assembler system and old ad-builder route"
```

---

## Task 2: Remove Dead Prisma Models

**Files:**
- Modify: `prisma/schema.prisma` (lines 188–224 — `PdpTemplate` and `PdpGeneratedAd` models)

- [ ] **Step 1: Read the current schema around the dead models**

```bash
grep -n "PdpTemplate\|PdpGeneratedAd\|pdp_templates\|pdp_generated_ads" prisma/schema.prisma
```

- [ ] **Step 2: Remove both models from prisma/schema.prisma**

Delete the entire `PdpTemplate` block (lines ~188–202) and the entire `PdpGeneratedAd` block (lines ~204–224). The result should have no `PdpTemplate` or `PdpGeneratedAd` model definitions.

- [ ] **Step 3: Verify no TypeScript references remain**

```bash
grep -r "PdpTemplate\|PdpGeneratedAd" app lib --include="*.ts" --include="*.tsx"
```

Expected: no output. If any references exist, remove them.

- [ ] **Step 4: Generate Prisma client**

```bash
npm run db:generate
```

Expected: Prisma Client generated successfully.

- [ ] **Step 5: Create and apply migration**

```bash
npm run db:migrate
```

Expected: Migration applied — drops `pdp_templates` and `pdp_generated_ads` tables.

- [ ] **Step 6: Commit**

```bash
git add prisma/schema.prisma prisma/migrations
git commit -m "chore: drop unused PdpTemplate and PdpGeneratedAd Prisma models"
```

---

## Task 3: Add Template Schemas and Batch Resolver to wineAdContext.ts

**Files:**
- Modify: `app/creative/ad-builder/_shared/wineAdContext.ts`

This adds the data contract layer: each reference template declares what fields it needs, and `resolveBatchMappings` validates every wine × template combination before generation.

- [ ] **Step 1: Append the following types and functions to the end of wineAdContext.ts**

Add after the last line of the existing file:

```typescript
// =============================================================================
// TEMPLATE FIELD SCHEMA
// Each reference template declares the fields it needs from WineAdContext.
// This powers the Review Brief field-mapping table.
// =============================================================================

export type FieldSource = "feed" | "ai_copy" | "ai_image" | "static";

export type FallbackBehavior =
  | "hide_element"
  | "omit_field"
  | "required"
  | { default: string };

export interface TemplateField {
  key: string;
  context_key?: keyof WineAdContext;
  source: FieldSource;
  required: boolean;
  fallback: FallbackBehavior;
  description: string;
}

export interface TemplateSchema {
  template_id: string;   // must match the id returned by /api/pdp/styles
  template_name: string;
  fields: TemplateField[];
}

// =============================================================================
// TEMPLATE DEFINITIONS
// Add one entry per reference template in context/Examples/Ads/Static/.
// template_id must match the `id` field in the corresponding .md frontmatter.
// =============================================================================

export const TEMPLATE_SCHEMAS: TemplateSchema[] = [
  {
    template_id: "winespies_pdp_cult_1",
    template_name: "Wine Spies PDP Cult 1",
    fields: [
      {
        key: "wine_display_name",
        context_key: "display_name",
        source: "feed",
        required: true,
        fallback: "required",
        description: "Vintage + producer + wine name",
      },
      {
        key: "retail_price",
        context_key: "retail_price",
        source: "feed",
        required: true,
        fallback: "required",
        description: "Original retail price",
      },
      {
        key: "sale_price",
        context_key: "sale_price",
        source: "feed",
        required: true,
        fallback: "required",
        description: "Today's sale price",
      },
      {
        key: "score_badge",
        context_key: "score_label",
        source: "feed",
        required: false,
        fallback: "hide_element",
        description: "Points badge — hidden if no score, never defaulted",
      },
      {
        key: "bottle_image",
        context_key: "composite_image_url",
        source: "feed",
        required: true,
        fallback: "required",
        description: "Composite bottle image overlaid on background",
      },
      {
        key: "background_image",
        source: "ai_image",
        required: true,
        fallback: "required",
        description: "AI-generated styled background (Gemini)",
      },
      {
        key: "headline",
        source: "ai_copy",
        required: true,
        fallback: "required",
        description: "Ad headline — generated at runtime",
      },
      {
        key: "primary_text",
        source: "ai_copy",
        required: true,
        fallback: "required",
        description: "Primary ad body copy — generated at runtime",
      },
      {
        key: "cta_button",
        source: "static",
        required: true,
        fallback: { default: "GET THIS DEAL" },
        description: "CTA button text",
      },
    ],
  },
];

// =============================================================================
// FIELD MAPPING & VALIDATION
// =============================================================================

export type FieldStatus =
  | "ok"
  | "missing_optional"
  | "missing_required"
  | "ai_generated"
  | "static";

export interface ResolvedField {
  key: string;
  description: string;
  source: FieldSource;
  status: FieldStatus;
  value: string | number | boolean | null;
  fallback_behavior: FallbackBehavior;
  will_render: boolean;
}

export interface TemplateMappingResult {
  template_id: string;
  template_name: string;
  wine_display_name: string;
  sale_id: number;
  can_generate: boolean;
  blocking_fields: string[];
  fields: ResolvedField[];
}

/**
 * Resolves a WineAdContext against a TemplateSchema.
 * Returns a TemplateMappingResult that powers the Review Brief UI.
 */
export function resolveTemplateFields(
  context: WineAdContext,
  schema: TemplateSchema
): TemplateMappingResult {
  const resolvedFields: ResolvedField[] = [];
  const blockingFields: string[] = [];

  for (const field of schema.fields) {
    let value: string | number | boolean | null = null;
    let status: FieldStatus;
    let will_render = true;

    if (field.source === "static") {
      value =
        typeof field.fallback === "object" && "default" in field.fallback
          ? field.fallback.default
          : null;
      status = "static";
    } else if (field.source === "ai_copy" || field.source === "ai_image") {
      status = "ai_generated";
      value = null;
    } else {
      // feed source
      if (field.context_key) {
        const raw = context[field.context_key];
        value = raw !== undefined ? (raw as string | number | boolean | null) : null;
      }

      const isEmpty =
        value === null || value === undefined || value === "" || value === 0;

      if (isEmpty) {
        if (field.fallback === "required") {
          status = "missing_required";
          will_render = false;
          blockingFields.push(field.key);
        } else if (
          field.fallback === "hide_element" ||
          field.fallback === "omit_field"
        ) {
          status = "missing_optional";
          will_render = false;
        } else if (
          typeof field.fallback === "object" &&
          "default" in field.fallback
        ) {
          value = field.fallback.default;
          status = "ok";
        } else {
          status = "missing_optional";
          will_render = false;
        }
      } else {
        status = "ok";
      }
    }

    resolvedFields.push({
      key: field.key,
      description: field.description,
      source: field.source,
      status,
      value: value ?? null,
      fallback_behavior: field.fallback,
      will_render,
    });
  }

  return {
    template_id: schema.template_id,
    template_name: schema.template_name,
    wine_display_name: context.display_name,
    sale_id: context.sale_id,
    can_generate: blockingFields.length === 0,
    blocking_fields: blockingFields,
    fields: resolvedFields,
  };
}

export interface BatchMappingResult {
  wines: WineAdContext[];
  schemas: TemplateSchema[];
  /** keyed as `${sale_id}:${template_id}` */
  mappings: Record<string, TemplateMappingResult>;
  total_ads: number;
  ready_to_generate: number;
  blocked: number;
}

/**
 * Resolves N wines × M templates into a BatchMappingResult.
 * Call this after the user selects wines and templates.
 * Templates with no schema in TEMPLATE_SCHEMAS are silently skipped.
 */
export function resolveBatchMappings(
  contexts: WineAdContext[],
  templateIds: string[]
): BatchMappingResult {
  const schemas = TEMPLATE_SCHEMAS.filter((s) =>
    templateIds.includes(s.template_id)
  );

  const mappings: Record<string, TemplateMappingResult> = {};
  let ready = 0;
  let blocked = 0;

  for (const context of contexts) {
    for (const schema of schemas) {
      const key = `${context.sale_id}:${schema.template_id}`;
      const result = resolveTemplateFields(context, schema);
      mappings[key] = result;
      if (result.can_generate) ready++;
      else blocked++;
    }
  }

  return {
    wines: contexts,
    schemas,
    mappings,
    total_ads: contexts.length * schemas.length,
    ready_to_generate: ready,
    blocked,
  };
}
```

- [ ] **Step 2: Verify TypeScript compiles**

```bash
npx tsc --noEmit 2>&1 | head -30
```

Expected: no errors from `wineAdContext.ts`.

- [ ] **Step 3: Commit**

```bash
git add app/creative/ad-builder/_shared/wineAdContext.ts
git commit -m "feat: add TemplateSchema types, TEMPLATE_SCHEMAS, and batch resolver to wineAdContext"
```

---

## Task 4: Build useBatchMapping Hook

**Files:**
- Create: `app/creative/pdp/hooks/useBatchMapping.ts`

- [ ] **Step 1: Create the hook**

```typescript
// app/creative/pdp/hooks/useBatchMapping.ts
"use client";

import { useMemo } from "react";
import {
  resolveBatchMappings,
  type BatchMappingResult,
  type WineAdContext,
} from "../../ad-builder/_shared/wineAdContext";

/**
 * Wraps resolveBatchMappings. Re-runs whenever selected wines or template IDs change.
 * Returns null when either list is empty.
 */
export function useBatchMapping(
  contexts: WineAdContext[],
  templateIds: string[]
): BatchMappingResult | null {
  return useMemo(() => {
    if (contexts.length === 0 || templateIds.length === 0) return null;
    return resolveBatchMappings(contexts, templateIds);
  }, [contexts, templateIds]);
}
```

- [ ] **Step 2: Verify TypeScript compiles**

```bash
npx tsc --noEmit 2>&1 | head -20
```

Expected: no errors.

- [ ] **Step 3: Commit**

```bash
git add app/creative/pdp/hooks/useBatchMapping.ts
git commit -m "feat: add useBatchMapping hook wrapping resolveBatchMappings"
```

---

## Task 5: Rebuild DataReview.tsx as Field-Mapping Accordion

**Files:**
- Modify: `app/creative/pdp/components/DataReview.tsx`

The current component shows a flat editable row per wine. Replace it with an accordion per wine, each containing one sub-row per template, each sub-row showing the field-mapping table with status indicators and inline editable feed-sourced fields.

The component keeps the same external interface for `onOverride` (mapping to `WineOverrides` keys) so `page.tsx` doesn't need to change its override state shape.

- [ ] **Step 1: Replace DataReview.tsx entirely with the following**

```typescript
// app/creative/pdp/components/DataReview.tsx
"use client";

import { useState } from "react";
import Image from "next/image";
import type {
  BatchMappingResult,
  ResolvedField,
  FieldStatus,
} from "../../ad-builder/_shared/wineAdContext";
import type { WineOverrides } from "../hooks/useGenerator";

// Maps field keys to WineOverrides keys for inline editing
const FIELD_TO_OVERRIDE: Partial<Record<string, keyof WineOverrides>> = {
  wine_display_name: "wineName",
  score_badge: "score",
  cta_button: "ctaText",
};

function statusIcon(status: FieldStatus): string {
  switch (status) {
    case "ok": return "✅";
    case "missing_optional": return "⚠️";
    case "missing_required": return "🚫";
    case "ai_generated": return "🤖";
    case "static": return "🔒";
  }
}

function statusLabel(status: FieldStatus): string {
  switch (status) {
    case "ok": return "Ready";
    case "missing_optional": return "Hidden";
    case "missing_required": return "Blocked";
    case "ai_generated": return "Will generate";
    case "static": return "Static";
  }
}

function valueDisplay(field: ResolvedField): string {
  if (field.status === "ai_generated") return "—";
  if (field.status === "static") return String(field.value ?? "—");
  if (!field.will_render) return "—";
  if (field.value === null || field.value === "") return "—";
  return String(field.value);
}

function FieldRow({
  field,
  overrideValue,
  onOverride,
}: {
  field: ResolvedField;
  overrideValue?: string;
  onOverride?: (value: string) => void;
}) {
  const [editing, setEditing] = useState(false);
  const isEditable =
    field.source === "feed" && onOverride !== undefined;
  const displayValue = overrideValue !== undefined ? overrideValue : valueDisplay(field);

  return (
    <tr className="border-t border-border/30">
      <td className="py-1.5 pr-3 text-xs text-foreground font-mono">{field.key}</td>
      <td className="py-1.5 pr-3 text-xs text-muted capitalize">{field.source}</td>
      <td className="py-1.5 pr-3 text-xs">
        <span title={statusLabel(field.status)}>
          {statusIcon(field.status)}{" "}
          <span className="text-muted">{statusLabel(field.status)}</span>
        </span>
      </td>
      <td className="py-1.5 text-xs text-foreground min-w-[120px]">
        {isEditable && editing ? (
          <input
            autoFocus
            type="text"
            defaultValue={displayValue}
            onBlur={(e) => {
              onOverride!(e.target.value);
              setEditing(false);
            }}
            onKeyDown={(e) => {
              if (e.key === "Enter") {
                onOverride!((e.target as HTMLInputElement).value);
                setEditing(false);
              }
              if (e.key === "Escape") setEditing(false);
            }}
            className="w-full px-1.5 py-0.5 border border-accent rounded text-xs bg-surface focus:outline-none"
          />
        ) : (
          <span
            className={isEditable ? "cursor-pointer hover:text-accent underline-offset-2 hover:underline" : ""}
            onClick={() => isEditable && setEditing(true)}
            title={isEditable ? "Click to edit" : field.description}
          >
            {displayValue || <span className="text-muted italic">empty</span>}
          </span>
        )}
      </td>
    </tr>
  );
}

function TemplateMappingRow({
  mappingKey,
  overrides,
  onOverride,
  batch,
}: {
  mappingKey: string;
  overrides: WineOverrides;
  onOverride: (field: keyof WineOverrides, value: string) => void;
  batch: BatchMappingResult;
}) {
  const [open, setOpen] = useState(false);
  const mapping = batch.mappings[mappingKey];
  if (!mapping) return null;

  const templateName = mapping.template_name;
  const canGenerate = mapping.can_generate;

  return (
    <div className="border border-border/40 rounded-lg overflow-hidden">
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        className="w-full flex items-center justify-between px-3 py-2 bg-background hover:bg-surface transition-colors text-left"
      >
        <div className="flex items-center gap-2">
          <span className="text-xs font-medium text-foreground">{templateName}</span>
          {canGenerate ? (
            <span className="text-[10px] text-success font-medium">✅ Ready</span>
          ) : (
            <span className="text-[10px] text-danger font-medium">
              🚫 Blocked — {mapping.blocking_fields.join(", ")}
            </span>
          )}
        </div>
        <svg
          className={`w-3.5 h-3.5 text-muted transition-transform ${open ? "rotate-180" : ""}`}
          fill="none" viewBox="0 0 24 24" stroke="currentColor"
        >
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
        </svg>
      </button>

      {open && (
        <div className="px-3 pb-3 pt-1 bg-surface overflow-x-auto">
          <table className="w-full">
            <thead>
              <tr>
                <th className="text-left text-[10px] text-muted uppercase tracking-wide pb-1 pr-3">Field</th>
                <th className="text-left text-[10px] text-muted uppercase tracking-wide pb-1 pr-3">Source</th>
                <th className="text-left text-[10px] text-muted uppercase tracking-wide pb-1 pr-3">Status</th>
                <th className="text-left text-[10px] text-muted uppercase tracking-wide pb-1">Value</th>
              </tr>
            </thead>
            <tbody>
              {mapping.fields.map((field) => {
                const overrideKey = FIELD_TO_OVERRIDE[field.key];
                const overrideValue =
                  overrideKey !== undefined ? overrides[overrideKey] : undefined;
                const handleOverride =
                  overrideKey !== undefined
                    ? (v: string) => onOverride(overrideKey, v)
                    : undefined;
                return (
                  <FieldRow
                    key={field.key}
                    field={field}
                    overrideValue={overrideValue}
                    onOverride={handleOverride}
                  />
                );
              })}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}

function WineAccordionRow({
  saleId,
  batch,
  overrides,
  onOverride,
}: {
  saleId: number;
  batch: BatchMappingResult;
  overrides: WineOverrides;
  onOverride: (field: keyof WineOverrides, value: string) => void;
}) {
  const [open, setOpen] = useState(true);
  const context = batch.wines.find((w) => w.sale_id === saleId);
  if (!context) return null;

  const mappingKeys = batch.schemas.map(
    (s) => `${saleId}:${s.template_id}`
  );
  const allReady = mappingKeys.every(
    (k) => batch.mappings[k]?.can_generate
  );

  return (
    <div className="border border-border rounded-xl overflow-hidden">
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        className="w-full flex items-center gap-3 px-4 py-3 bg-surface hover:bg-background transition-colors text-left"
      >
        {context.composite_image_url && (
          <div className="w-10 h-14 shrink-0 relative rounded overflow-hidden bg-background">
            <Image
              src={context.composite_image_url}
              alt={context.display_name}
              fill
              className="object-contain"
              sizes="40px"
            />
          </div>
        )}
        <div className="flex-1 min-w-0">
          <div className="text-sm font-semibold text-foreground truncate">
            {context.display_name}
          </div>
          <div className="text-xs text-muted mt-0.5">
            {context.sale_price} <span className="line-through">{context.retail_price}</span>{" "}
            · {context.discount_pct}% off
            {context.has_score && (
              <span className="ml-1 text-success">· {context.score_label}</span>
            )}
          </div>
        </div>
        <div className="flex items-center gap-2 shrink-0">
          {allReady ? (
            <span className="text-xs text-success font-medium">✅ Ready</span>
          ) : (
            <span className="text-xs text-danger font-medium">🚫 Issues</span>
          )}
          <svg
            className={`w-4 h-4 text-muted transition-transform ${open ? "rotate-180" : ""}`}
            fill="none" viewBox="0 0 24 24" stroke="currentColor"
          >
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
          </svg>
        </div>
      </button>

      {open && (
        <div className="px-4 pb-4 pt-2 flex flex-col gap-2">
          {mappingKeys.map((key) => (
            <TemplateMappingRow
              key={key}
              mappingKey={key}
              overrides={overrides}
              onOverride={onOverride}
              batch={batch}
            />
          ))}
        </div>
      )}
    </div>
  );
}

interface DataReviewProps {
  batch: BatchMappingResult;
  overrides: Record<number, WineOverrides>;
  onOverride: (saleId: number, field: keyof WineOverrides, value: string) => void;
  onBack: () => void;
  onGenerate: () => void;
}

export default function DataReview({
  batch,
  overrides,
  onOverride,
  onBack,
  onGenerate,
}: DataReviewProps) {
  const canGenerate = batch.blocked === 0;

  return (
    <div className="flex flex-col gap-4">
      {/* Header */}
      <div className="flex items-start justify-between gap-4">
        <div>
          <h2 className="text-lg font-semibold">Review Brief</h2>
          <p className="text-sm text-muted mt-0.5">
            Confirm what will be populated before generating. Click any feed value to edit it.
          </p>
        </div>
        <div className="flex items-center gap-3 shrink-0">
          <button
            onClick={onBack}
            className="px-3 py-2 text-sm text-muted hover:text-foreground transition-colors"
          >
            ← Back
          </button>
          <button
            onClick={onGenerate}
            disabled={!canGenerate}
            className={`px-4 py-2 text-sm font-medium rounded-lg transition-colors ${
              canGenerate
                ? "bg-accent text-white hover:bg-accent/90"
                : "bg-border text-muted cursor-not-allowed"
            }`}
          >
            Generate {batch.total_ads} Ad{batch.total_ads !== 1 ? "s" : ""} →
          </button>
        </div>
      </div>

      {/* Summary bar */}
      <div className="rounded-lg border border-border bg-surface px-4 py-3 flex items-center justify-between gap-4 text-sm">
        <div>
          <span className="font-medium text-foreground">{batch.wines.length} wine{batch.wines.length !== 1 ? "s" : ""}</span>
          {" × "}
          <span className="font-medium text-foreground">{batch.schemas.length} template{batch.schemas.length !== 1 ? "s" : ""}</span>
          {" = "}
          <span className="font-bold text-accent">{batch.total_ads} ads</span>
        </div>
        {batch.blocked > 0 ? (
          <span className="text-xs text-danger font-medium">
            🚫 {batch.blocked} blocked — fix required fields to enable generation
          </span>
        ) : (
          <span className="text-xs text-success font-medium">
            ✅ {batch.ready_to_generate} ads ready to generate
          </span>
        )}
      </div>

      {/* Wine accordions */}
      <div className="flex flex-col gap-3">
        {batch.wines.map((ctx) => (
          <WineAccordionRow
            key={ctx.sale_id}
            saleId={ctx.sale_id}
            batch={batch}
            overrides={overrides[ctx.sale_id] ?? {}}
            onOverride={(field, value) => onOverride(ctx.sale_id, field, value)}
          />
        ))}
      </div>
    </div>
  );
}
```

- [ ] **Step 2: Verify TypeScript compiles**

```bash
npx tsc --noEmit 2>&1 | head -30
```

Expected: errors referencing `DataReview` props in `page.tsx` — those are fixed in the next task.

- [ ] **Step 3: Commit**

```bash
git add app/creative/pdp/components/DataReview.tsx
git commit -m "feat: rebuild DataReview as field-mapping accordion with status indicators"
```

---

## Task 6: Update page.tsx — Wire Batch Mapping, Fix DataReview Props, Add Step 5

**Files:**
- Modify: `app/creative/pdp/page.tsx`

Changes:
1. Import `useBatchMapping`
2. Call `useBatchMapping(feed.selectedContexts, selectedStyleIds)` to get `batch`
3. Pass `batch` to `DataReview` (new prop shape)
4. Add Step 5 to `STEPS` array
5. Add `PublishPanel` import and render for step 5
6. Pass completed jobs to PublishPanel

- [ ] **Step 1: Replace page.tsx with the following**

```typescript
// app/creative/pdp/page.tsx
"use client";

import { useCallback, useState, Suspense } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import Link from "next/link";

import { useFeed } from "./hooks/useFeed";
import { useStyles } from "./hooks/useStyles";
import { useGenerator, type WineOverrides } from "./hooks/useGenerator";
import { useBatchMapping } from "./hooks/useBatchMapping";
import WineSelector from "./components/WineSelector";
import StyleSelector from "./components/StyleSelector";
import DataReview from "./components/DataReview";
import ResultsGrid from "./components/ResultsGrid";
import PublishPanel from "./components/PublishPanel";

const STEPS = [
  { num: 1, label: "Select Wines" },
  { num: 2, label: "Select Styles" },
  { num: 3, label: "Review Brief" },
  { num: 4, label: "Generate" },
  { num: 5, label: "Publish" },
];

function StepIndicator({
  current,
  maxReached,
  onNavigate,
}: {
  current: number;
  maxReached: number;
  onNavigate: (n: number) => void;
}) {
  return (
    <nav className="flex items-center gap-1 mb-6 overflow-x-auto pb-1">
      {STEPS.map((s, i) => {
        const isActive = current === s.num;
        const isComplete = s.num < current;
        const canNav = s.num <= maxReached;
        return (
          <div key={s.num} className="flex items-center gap-1">
            <button
              type="button"
              disabled={!canNav}
              onClick={() => canNav && onNavigate(s.num)}
              className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-sm whitespace-nowrap transition-colors ${
                isActive
                  ? "bg-accent text-white font-medium"
                  : isComplete
                  ? "bg-accent/10 text-accent font-medium hover:bg-accent/20"
                  : canNav
                  ? "text-muted hover:text-foreground hover:bg-background"
                  : "text-muted/40 cursor-not-allowed"
              }`}
            >
              <span
                className={`w-4 h-4 rounded-full flex items-center justify-center text-[10px] font-bold ${
                  isActive
                    ? "bg-white/20 text-white"
                    : isComplete
                    ? "bg-accent text-white"
                    : "bg-border text-muted"
                }`}
              >
                {isComplete ? "✓" : s.num}
              </span>
              {s.label}
            </button>
            {i < STEPS.length - 1 && (
              <svg className="w-3 h-3 text-muted/30 shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
              </svg>
            )}
          </div>
        );
      })}
    </nav>
  );
}

function PDPBuilderInner() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const currentStep = Math.max(1, Math.min(5, parseInt(searchParams.get("step") ?? "1", 10)));
  const [maxReached, setMaxReached] = useState(currentStep);
  const [selectedStyleIds, setSelectedStyleIds] = useState<string[]>([]);
  const [overrides, setOverrides] = useState<Record<number, WineOverrides>>({});

  const feed = useFeed();
  const { styles, loading: stylesLoading, error: stylesError } = useStyles();
  const generator = useGenerator();
  const batch = useBatchMapping(feed.selectedContexts, selectedStyleIds);

  const goToStep = useCallback(
    (step: number) => {
      setMaxReached((prev) => Math.max(prev, step));
      const params = new URLSearchParams(searchParams.toString());
      params.set("step", String(step));
      router.push(`?${params.toString()}`);
    },
    [router, searchParams]
  );

  const toggleStyle = useCallback((id: string) => {
    setSelectedStyleIds((prev) =>
      prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id]
    );
  }, []);

  const setOverride = useCallback(
    (saleId: number, field: keyof WineOverrides, value: string) => {
      setOverrides((prev) => ({
        ...prev,
        [saleId]: { ...prev[saleId], [field]: value },
      }));
    },
    []
  );

  const handleGenerate = useCallback(async () => {
    goToStep(4);
    const selectedStyles = styles.filter((s) => selectedStyleIds.includes(s.id));
    await generator.startBatch(feed.selectedContexts, selectedStyles, overrides);
  }, [goToStep, styles, selectedStyleIds, feed.selectedContexts, overrides, generator]);

  const handleRegenerate = useCallback(
    async (jobId: string) => {
      const job = generator.jobs.find((j) => j.id === jobId);
      if (!job) return;
      const ctx = feed.selectedContexts.find((c) => c.sale_id === job.saleId);
      const style = styles.find((s) => s.id === job.styleId);
      if (!ctx || !style) return;
      await generator.regenerate(jobId, ctx, style, overrides[job.saleId] ?? {});
    },
    [generator, feed.selectedContexts, styles, overrides]
  );

  return (
    <div>
      <div className="flex items-center gap-2 text-sm text-muted mb-4">
        <Link href="/creative" className="hover:text-foreground transition-colors">
          Creative
        </Link>
        <span>/</span>
        <span className="text-foreground font-medium">PDP Ad Builder</span>
      </div>

      <StepIndicator current={currentStep} maxReached={maxReached} onNavigate={goToStep} />

      {currentStep === 1 && (
        <WineSelector
          filtered={feed.filtered}
          loading={feed.loading}
          error={feed.error}
          selected={feed.selected}
          onToggle={feed.toggleSelect}
          onSelectAll={feed.selectAll}
          onClearSelection={feed.clearSelection}
          channelFilter={feed.channelFilter}
          classificationFilter={feed.classificationFilter}
          inStockOnly={feed.inStockOnly}
          search={feed.search}
          onChannelFilter={feed.setChannelFilter}
          onClassificationFilter={feed.setClassificationFilter}
          onInStockOnly={feed.setInStockOnly}
          onSearch={feed.setSearch}
          onNext={() => goToStep(2)}
        />
      )}

      {currentStep === 2 && (
        <StyleSelector
          styles={styles}
          loading={stylesLoading}
          error={stylesError}
          selected={selectedStyleIds}
          onToggle={toggleStyle}
          onBack={() => goToStep(1)}
          onNext={() => goToStep(3)}
          selectedWineCount={feed.selected.length}
        />
      )}

      {currentStep === 3 && batch && (
        <DataReview
          batch={batch}
          overrides={overrides}
          onOverride={setOverride}
          onBack={() => goToStep(2)}
          onGenerate={handleGenerate}
        />
      )}

      {currentStep === 3 && !batch && (
        <div className="text-center py-16 text-muted text-sm">
          Select wines and styles first to review the brief.
        </div>
      )}

      {currentStep === 4 && (
        <ResultsGrid
          jobs={generator.jobs}
          running={generator.running}
          progress={generator.progress}
          onRegenerate={handleRegenerate}
          onBack={() => goToStep(3)}
          onPublish={() => goToStep(5)}
        />
      )}

      {currentStep === 5 && (
        <PublishPanel
          jobs={generator.jobs.filter((j) => j.status === "complete")}
          onBack={() => goToStep(4)}
        />
      )}
    </div>
  );
}

export default function PDPBuilderPage() {
  return (
    <Suspense
      fallback={
        <div className="flex items-center justify-center py-24 text-muted text-sm">
          Loading…
        </div>
      }
    >
      <PDPBuilderInner />
    </Suspense>
  );
}
```

- [ ] **Step 2: Verify TypeScript — expect errors only for missing PublishPanel and missing ResultsGrid `onPublish` prop**

```bash
npx tsc --noEmit 2>&1 | grep -v "node_modules" | head -20
```

Those are resolved in the next two tasks.

- [ ] **Step 3: Commit**

```bash
git add app/creative/pdp/page.tsx
git commit -m "feat: wire useBatchMapping to DataReview, add Step 5 scaffold to PDP wizard"
```

---

## Task 7: Update ResultsGrid — Add Publish Selected Button

**Files:**
- Modify: `app/creative/pdp/components/ResultsGrid.tsx`

Add an `onPublish` prop. The "Publish Selected" button appears once at least one complete job exists and generation is done.

- [ ] **Step 1: Add `onPublish` to `ResultsGridProps` and the header button**

In `ResultsGrid.tsx`, change the `ResultsGridProps` interface and add the Publish button:

```typescript
interface ResultsGridProps {
  jobs: GenerationJob[];
  running: boolean;
  progress: { total: number; complete: number; error: number; generating: number };
  onRegenerate: (id: string) => void;
  onBack: () => void;
  onPublish: () => void;   // ← add this
}

export default function ResultsGrid({
  jobs,
  running,
  progress,
  onRegenerate,
  onBack,
  onPublish,              // ← add this
}: ResultsGridProps) {
```

Then in the header buttons section, replace the existing button group with:

```typescript
<div className="flex items-center gap-3">
  <button
    onClick={onBack}
    className="px-3 py-2 text-sm text-muted hover:text-foreground transition-colors"
  >
    ← Back
  </button>
  {completedJobs.length > 0 && (
    <button
      onClick={downloadAll}
      className="px-4 py-2 bg-surface border border-border text-foreground text-sm font-medium rounded-lg hover:bg-background transition-colors"
    >
      Download All ({completedJobs.length})
    </button>
  )}
  {completedJobs.length > 0 && !running && (
    <button
      onClick={onPublish}
      className="px-4 py-2 bg-accent text-white text-sm font-medium rounded-lg hover:bg-accent/90 transition-colors"
    >
      Publish to Meta ({completedJobs.length}) →
    </button>
  )}
</div>
```

- [ ] **Step 2: Verify TypeScript compiles**

```bash
npx tsc --noEmit 2>&1 | grep -v "node_modules" | head -20
```

Expected: only the missing `PublishPanel` error remains.

- [ ] **Step 3: Commit**

```bash
git add app/creative/pdp/components/ResultsGrid.tsx
git commit -m "feat: add Publish to Meta button to ResultsGrid"
```

---

## Task 8: Build PublishPanel Component

**Files:**
- Create: `app/creative/pdp/components/PublishPanel.tsx`

Shows each completed ad with editable Meta copy fields (headline, primary_text, description pre-filled from wine data). Fetches existing ad sets from Meta. On confirm, calls `POST /api/pdp/publish`.

- [ ] **Step 1: Create PublishPanel.tsx**

```typescript
// app/creative/pdp/components/PublishPanel.tsx
"use client";

import { useEffect, useState } from "react";
import type { GenerationJob } from "../hooks/useGenerator";

interface AdSet {
  id: string;
  name: string;
  status: string;
  effective_status: string;
}

interface AdCopy {
  headline: string;
  primary_text: string;
  description: string;
}

type PublishStatus = "idle" | "publishing" | "done" | "error";

interface JobPublishState {
  copy: AdCopy;
  status: PublishStatus;
  error?: string;
  metaAdId?: string;
}

function buildDefaultCopy(job: GenerationJob): AdCopy {
  return {
    headline: job.wineName,
    primary_text: `Now just ${job.wineName}. Limited time — don't miss it.`,
    description: "Shop Wine Spies today →",
  };
}

interface PublishPanelProps {
  jobs: GenerationJob[];
  onBack: () => void;
}

export default function PublishPanel({ jobs, onBack }: PublishPanelProps) {
  const [adSets, setAdSets] = useState<AdSet[]>([]);
  const [adSetsLoading, setAdSetsLoading] = useState(true);
  const [adSetsError, setAdSetsError] = useState<string | null>(null);
  const [selectedAdSetId, setSelectedAdSetId] = useState<string>("");
  const [newAdSetName, setNewAdSetName] = useState("");
  const [useNewAdSet, setUseNewAdSet] = useState(false);
  const [jobStates, setJobStates] = useState<Record<string, JobPublishState>>(
    () =>
      Object.fromEntries(
        jobs.map((j) => [j.id, { copy: buildDefaultCopy(j), status: "idle" as PublishStatus }])
      )
  );
  const [publishing, setPublishing] = useState(false);

  useEffect(() => {
    async function loadAdSets() {
      try {
        const res = await fetch("/api/pdp/publish?action=adsets&brand=winespies");
        if (!res.ok) throw new Error(`HTTP ${res.status}`);
        const data = await res.json() as { adSets: AdSet[] };
        setAdSets(data.adSets ?? []);
        if (data.adSets?.length > 0) setSelectedAdSetId(data.adSets[0].id);
      } catch (err) {
        setAdSetsError(err instanceof Error ? err.message : "Failed to load ad sets");
      } finally {
        setAdSetsLoading(false);
      }
    }
    loadAdSets();
  }, []);

  function updateCopy(jobId: string, field: keyof AdCopy, value: string) {
    setJobStates((prev) => ({
      ...prev,
      [jobId]: {
        ...prev[jobId],
        copy: { ...prev[jobId].copy, [field]: value },
      },
    }));
  }

  async function handlePublish() {
    const adSetId = useNewAdSet ? null : selectedAdSetId;
    if (!useNewAdSet && !adSetId) return;
    if (useNewAdSet && !newAdSetName.trim()) return;

    setPublishing(true);

    const publishJobs = jobs.map((job) => ({
      jobId: job.id,
      imageBase64: job.imageBase64!,
      mimeType: job.mimeType,
      wineName: job.wineName,
      ...jobStates[job.id].copy,
      saleUrl: `https://winespies.com/sales/${job.saleId}`,
    }));

    // Update all to publishing
    setJobStates((prev) =>
      Object.fromEntries(
        Object.entries(prev).map(([id, state]) => [
          id,
          { ...state, status: "publishing" as PublishStatus },
        ])
      )
    );

    try {
      const res = await fetch("/api/pdp/publish", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          brand: "winespies",
          adSetId: useNewAdSet ? null : adSetId,
          newAdSetName: useNewAdSet ? newAdSetName.trim() : null,
          jobs: publishJobs,
        }),
      });

      const data = await res.json() as {
        results: Array<{ jobId: string; success: boolean; adId?: string; error?: string }>;
      };

      setJobStates((prev) => {
        const next = { ...prev };
        for (const r of data.results ?? []) {
          next[r.jobId] = {
            ...next[r.jobId],
            status: r.success ? "done" : "error",
            metaAdId: r.adId,
            error: r.error,
          };
        }
        return next;
      });
    } catch (err) {
      setJobStates((prev) =>
        Object.fromEntries(
          Object.entries(prev).map(([id, state]) => [
            id,
            { ...state, status: "error" as PublishStatus, error: err instanceof Error ? err.message : "Failed" },
          ])
        )
      );
    } finally {
      setPublishing(false);
    }
  }

  const allDone = jobs.every((j) => jobStates[j.id]?.status === "done");
  const anyPublishing = jobs.some((j) => jobStates[j.id]?.status === "publishing");

  return (
    <div className="flex flex-col gap-4">
      <div className="flex items-start justify-between gap-4">
        <div>
          <h2 className="text-lg font-semibold">Publish to Meta</h2>
          <p className="text-sm text-muted mt-0.5">
            Review copy for each ad, choose an ad set, and publish.
          </p>
        </div>
        <button
          onClick={onBack}
          className="px-3 py-2 text-sm text-muted hover:text-foreground transition-colors shrink-0"
        >
          ← Back
        </button>
      </div>

      {/* Ad set selection */}
      <div className="border border-border rounded-xl p-4 flex flex-col gap-3 bg-surface">
        <div className="text-sm font-medium text-foreground">Destination Ad Set</div>
        <div className="flex items-center gap-3">
          <button
            type="button"
            onClick={() => setUseNewAdSet(false)}
            className={`px-3 py-1.5 text-sm rounded-lg border transition-colors ${
              !useNewAdSet ? "border-accent bg-accent/10 text-accent" : "border-border text-muted hover:text-foreground"
            }`}
          >
            Existing
          </button>
          <button
            type="button"
            onClick={() => setUseNewAdSet(true)}
            className={`px-3 py-1.5 text-sm rounded-lg border transition-colors ${
              useNewAdSet ? "border-accent bg-accent/10 text-accent" : "border-border text-muted hover:text-foreground"
            }`}
          >
            New Ad Set
          </button>
        </div>

        {!useNewAdSet && (
          adSetsLoading ? (
            <div className="text-sm text-muted">Loading ad sets…</div>
          ) : adSetsError ? (
            <div className="text-sm text-danger">{adSetsError}</div>
          ) : (
            <select
              value={selectedAdSetId}
              onChange={(e) => setSelectedAdSetId(e.target.value)}
              className="px-3 py-2 text-sm border border-border rounded-lg bg-background focus:outline-none focus:ring-1 focus:ring-accent"
            >
              {adSets.map((s) => (
                <option key={s.id} value={s.id}>
                  {s.name} ({s.effective_status})
                </option>
              ))}
            </select>
          )
        )}

        {useNewAdSet && (
          <input
            type="text"
            placeholder="New ad set name"
            value={newAdSetName}
            onChange={(e) => setNewAdSetName(e.target.value)}
            className="px-3 py-2 text-sm border border-border rounded-lg bg-background focus:outline-none focus:ring-1 focus:ring-accent"
          />
        )}
      </div>

      {/* Per-ad copy review */}
      <div className="flex flex-col gap-3">
        {jobs.map((job) => {
          const state = jobStates[job.id];
          if (!state) return null;
          return (
            <div key={job.id} className="border border-border rounded-xl overflow-hidden">
              <div className="flex gap-4 p-4">
                {job.imageBase64 && (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img
                    src={`data:${job.mimeType};base64,${job.imageBase64}`}
                    alt={job.wineName}
                    className="w-20 h-20 object-contain rounded-lg bg-background shrink-0"
                  />
                )}
                <div className="flex-1 flex flex-col gap-2 min-w-0">
                  <div className="text-sm font-semibold text-foreground">{job.wineName}</div>
                  <div className="text-xs text-muted">{job.styleName}</div>

                  <div>
                    <label className="text-[10px] font-semibold text-muted uppercase tracking-wide block mb-1">Headline</label>
                    <input
                      type="text"
                      value={state.copy.headline}
                      onChange={(e) => updateCopy(job.id, "headline", e.target.value)}
                      disabled={state.status === "done"}
                      className="w-full px-2.5 py-1.5 text-sm border border-border rounded-lg bg-surface focus:outline-none focus:ring-1 focus:ring-accent disabled:opacity-50"
                    />
                  </div>
                  <div>
                    <label className="text-[10px] font-semibold text-muted uppercase tracking-wide block mb-1">Primary Text</label>
                    <textarea
                      value={state.copy.primary_text}
                      onChange={(e) => updateCopy(job.id, "primary_text", e.target.value)}
                      disabled={state.status === "done"}
                      rows={2}
                      className="w-full px-2.5 py-1.5 text-sm border border-border rounded-lg bg-surface focus:outline-none focus:ring-1 focus:ring-accent resize-none disabled:opacity-50"
                    />
                  </div>
                  <div>
                    <label className="text-[10px] font-semibold text-muted uppercase tracking-wide block mb-1">Description</label>
                    <input
                      type="text"
                      value={state.copy.description}
                      onChange={(e) => updateCopy(job.id, "description", e.target.value)}
                      disabled={state.status === "done"}
                      className="w-full px-2.5 py-1.5 text-sm border border-border rounded-lg bg-surface focus:outline-none focus:ring-1 focus:ring-accent disabled:opacity-50"
                    />
                  </div>
                </div>
                <div className="shrink-0 flex items-start pt-1">
                  {state.status === "idle" && <span className="text-xs text-muted">Ready</span>}
                  {state.status === "publishing" && (
                    <span className="text-xs text-accent animate-pulse">Publishing…</span>
                  )}
                  {state.status === "done" && (
                    <span className="text-xs text-success font-medium">✅ Published</span>
                  )}
                  {state.status === "error" && (
                    <span className="text-xs text-danger" title={state.error}>Failed</span>
                  )}
                </div>
              </div>
            </div>
          );
        })}
      </div>

      {/* Publish button */}
      {!allDone && (
        <div className="flex justify-end">
          <button
            onClick={handlePublish}
            disabled={publishing || anyPublishing || (!useNewAdSet && !selectedAdSetId) || (useNewAdSet && !newAdSetName.trim())}
            className="px-6 py-2.5 bg-accent text-white text-sm font-medium rounded-lg hover:bg-accent/90 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {publishing ? "Publishing…" : `Publish ${jobs.length} Ad${jobs.length !== 1 ? "s" : ""} to Meta`}
          </button>
        </div>
      )}

      {allDone && (
        <div className="text-center py-6 text-success font-medium">
          ✅ All {jobs.length} ads published to Meta successfully.
        </div>
      )}
    </div>
  );
}
```

- [ ] **Step 2: Verify TypeScript compiles**

```bash
npx tsc --noEmit 2>&1 | grep -v "node_modules" | head -20
```

Expected: only the missing `/api/pdp/publish` route errors (if any). No component errors.

- [ ] **Step 3: Commit**

```bash
git add app/creative/pdp/components/PublishPanel.tsx
git commit -m "feat: build PublishPanel with Meta copy fields and ad set picker"
```

---

## Task 9: Build /api/pdp/publish API Route

**Files:**
- Create: `app/api/pdp/publish/route.ts`

Handles two things:
- `GET ?action=adsets&brand=winespies` → returns existing Meta ad sets
- `POST` with jobs array → upload image, create creative, create ad for each job

Uses existing `lib/meta-publish.ts` functions: `uploadAdImage`, `createAdCreative`, `createAd`, `fetchAdSetsLive`.

- [ ] **Step 1: Create app/api/pdp/publish/route.ts**

```typescript
// app/api/pdp/publish/route.ts
import { NextRequest, NextResponse } from "next/server";
import {
  uploadAdImage,
  createAdCreative,
  createAd,
  fetchAdSetsLive,
} from "@/lib/meta-publish";

export const maxDuration = 120;

export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url);
  const action = searchParams.get("action");
  const brand = searchParams.get("brand") ?? "winespies";

  if (action === "adsets") {
    try {
      const adSets = await fetchAdSetsLive(brand);
      return NextResponse.json({ adSets });
    } catch (err) {
      const msg = err instanceof Error ? err.message : "Failed to fetch ad sets";
      return NextResponse.json({ error: msg }, { status: 500 });
    }
  }

  return NextResponse.json({ error: "Unknown action" }, { status: 400 });
}

interface PublishJob {
  jobId: string;
  imageBase64: string;
  mimeType: string;
  wineName: string;
  headline: string;
  primary_text: string;
  description: string;
  saleUrl: string;
}

interface PublishRequest {
  brand: string;
  adSetId: string | null;
  newAdSetName: string | null;
  jobs: PublishJob[];
}

export async function POST(req: NextRequest) {
  let body: PublishRequest;
  try {
    body = await req.json() as PublishRequest;
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  const { brand, adSetId, jobs } = body;

  if (!adSetId) {
    // New ad set creation is out of scope for now — requires campaign ID
    return NextResponse.json(
      { error: "New ad set creation requires a campaign ID. Please select an existing ad set." },
      { status: 400 }
    );
  }

  if (!jobs?.length) {
    return NextResponse.json({ error: "No jobs provided" }, { status: 400 });
  }

  const results: Array<{
    jobId: string;
    success: boolean;
    adId?: string;
    error?: string;
  }> = [];

  for (const job of jobs) {
    try {
      // 1. Upload image to Meta
      const { hash } = await uploadAdImage(brand, job.imageBase64);

      // 2. Create ad creative
      const { id: creativeId } = await createAdCreative(brand, {
        name: `PDP — ${job.wineName}`,
        imageHash: hash,
        primaryText: job.primary_text,
        headline: job.headline,
        description: job.description,
        link: job.saleUrl,
        ctaType: "SHOP_NOW",
      });

      // 3. Create ad in the selected ad set
      const { id: adId } = await createAd(brand, {
        name: `PDP — ${job.wineName}`,
        adsetId: adSetId,
        creativeId,
        status: "ACTIVE",
      });

      results.push({ jobId: job.jobId, success: true, adId });
    } catch (err) {
      const msg = err instanceof Error ? err.message : "Publish failed";
      results.push({ jobId: job.jobId, success: false, error: msg });
    }
  }

  return NextResponse.json({ results });
}
```

- [ ] **Step 2: Verify TypeScript compiles**

```bash
npx tsc --noEmit 2>&1 | grep -v "node_modules" | head -20
```

Expected: no errors.

- [ ] **Step 3: Start dev server and smoke-test the GET endpoint**

```bash
npm run dev
```

In a separate terminal:

```bash
curl "http://localhost:3000/api/pdp/publish?action=adsets&brand=winespies"
```

Expected: `{ "adSets": [...] }` or `{ "error": "Missing META_AD_ACCOUNT_ID..." }` if Meta env vars aren't set locally — both are acceptable. The route is wired correctly either way.

- [ ] **Step 4: Commit**

```bash
git add app/api/pdp/publish/route.ts
git commit -m "feat: add /api/pdp/publish route for Meta image upload, creative, and ad creation"
```

---

## Task 10: End-to-End Smoke Test

- [ ] **Step 1: Start dev server**

```bash
npm run dev
```

- [ ] **Step 2: Navigate to the PDP builder**

Open `http://localhost:3000/creative/pdp` in a browser.

- [ ] **Step 3: Verify Step 1 — wine feed loads**

Expected: wine cards appear with names, prices, score badges where applicable. No console errors.

- [ ] **Step 4: Select 2 wines, proceed to Step 2**

Click "Next". Expected: style selector loads with thumbnail cards.

- [ ] **Step 5: Select 1 template, proceed to Step 3**

Expected: Review Brief shows accordion. One section per wine. Expanding a wine shows the Cult Dark template sub-row. Expanding that shows the field mapping table with ✅/⚠️/🤖/🔒 status indicators. Score badge shows ⚠️ Hidden for wines without scores.

- [ ] **Step 6: Verify Generate button is enabled**

Expected: "Generate 2 Ads →" button is active (not grayed out) since all required fields are present. If any wine is missing `composite_image_url` or `display_name`, the button should be disabled with a 🚫 indicator.

- [ ] **Step 7: Click Generate and verify Step 4**

Expected: generation starts, spinner appears per card, images appear on completion.

- [ ] **Step 8: Verify "Publish to Meta" button appears**

Expected: once generation completes, "Publish to Meta (2) →" button appears in the header.

- [ ] **Step 9: Verify Step 5 loads**

Click "Publish to Meta". Expected: PublishPanel shows. Ad sets dropdown loads (or shows error if Meta env vars aren't set). Each generated ad has editable headline/primary_text/description fields.

- [ ] **Step 10: Verify nav links to old /ad-builder return 404**

Open `http://localhost:3000/ad-builder`. Expected: 404 page (route deleted).

- [ ] **Step 11: Final build check**

```bash
npm run build 2>&1 | tail -20
```

Expected: build succeeds with no errors.

- [ ] **Step 12: Commit**

```bash
git add -A
git commit -m "chore: post-cleanup smoke test — all steps verified"
```
