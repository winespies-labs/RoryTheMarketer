import fs from "fs";
import path from "path";
import type { TemplateSchema } from "./template-schema";

const TEMPLATES_DIR = path.join(process.cwd(), "templates");

/**
 * List all available HTML ad templates by scanning templates/{id}/schema.json.
 */
export function listTemplates(): { id: string; name: string }[] {
  if (!fs.existsSync(TEMPLATES_DIR)) return [];

  return fs
    .readdirSync(TEMPLATES_DIR, { withFileTypes: true })
    .filter((d) => d.isDirectory())
    .map((d) => {
      const schemaPath = path.join(TEMPLATES_DIR, d.name, "schema.json");
      if (!fs.existsSync(schemaPath)) return null;
      try {
        const raw = fs.readFileSync(schemaPath, "utf8");
        const schema = JSON.parse(raw) as TemplateSchema;
        return { id: schema.id || d.name, name: schema.name || d.name };
      } catch {
        return null;
      }
    })
    .filter((t): t is { id: string; name: string } => t !== null);
}

/**
 * Load a template's schema and HTML by id.
 */
export function getTemplate(id: string): {
  schema: TemplateSchema;
  html: string;
} | null {
  const dir = path.join(TEMPLATES_DIR, id);
  const schemaPath = path.join(dir, "schema.json");
  const htmlPath = path.join(dir, "template.html");

  if (!fs.existsSync(schemaPath) || !fs.existsSync(htmlPath)) return null;

  try {
    const schema = JSON.parse(
      fs.readFileSync(schemaPath, "utf8"),
    ) as TemplateSchema;
    const html = fs.readFileSync(htmlPath, "utf8");
    return { schema, html };
  } catch {
    return null;
  }
}
