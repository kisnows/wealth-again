import { mkdirSync, readFileSync, writeFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const root = path.resolve(__dirname, "..");
const docPath = path.join(root, "doc", "openapi.json");
const outputPath = path.join(root, "src", "types", "openapi.ts");
const outputDir = path.dirname(outputPath);

const indentUnit = "  ";

const isIdentifier = (key) => /^[A-Za-z_][A-Za-z0-9_]*$/.test(key);

const indent = (level) => indentUnit.repeat(level);

const formatPropertyName = (key) => (isIdentifier(key) ? key : JSON.stringify(key));

const loadDocument = () => {
  const raw = readFileSync(docPath, "utf-8");
  return JSON.parse(raw);
};

const resolveRef = (ref) => ref.split("/").pop() ?? "unknown";

const convertSchema = (schema = {}, options) => {
  if (schema.$ref) {
    return resolveRef(schema.$ref);
  }

  if (schema.anyOf && schema.anyOf.length > 0) {
    return schema.anyOf.map((variant) => convertSchema(variant, options)).join(" | ");
  }

  if (schema.allOf && schema.allOf.length > 0) {
    return schema.allOf.map((part) => convertSchema(part, options)).join(" & ");
  }

  const schemaType = schema.type;

  if (Array.isArray(schemaType)) {
    const union = schemaType.map((t) => {
      if (t === "null") return "null";
      return convertSchema({ ...schema, type: t }, options);
    });
    return Array.from(new Set(union)).join(" | ");
  }

  if (schema.enum && schema.enum.length > 0) {
    const values = schema.enum.map((value) => {
      if (value === null) return "null";
      if (typeof value === "string") return JSON.stringify(value);
      return String(value);
    });
    return Array.from(new Set(values)).join(" | ");
  }

  switch (schemaType) {
    case "object":
      return convertObject(schema, options);
    case "array": {
      const itemSchema = schema.items ?? {};
      const resolved = convertSchema(itemSchema, options);
      return `Array<${resolved}>`;
    }
    case "string":
      return "string";
    case "integer":
    case "number":
      return "number";
    case "boolean":
      return "boolean";
    case undefined: {
      if (schema.properties) {
        return convertObject(schema, options);
      }
      return "unknown";
    }
    default:
      return "unknown";
  }
};

const convertObject = (schema, options) => {
  const props = schema.properties ?? {};
  const required = new Set(schema.required ?? []);
  const keys = Object.keys(props).sort();
  if (keys.length === 0 && !schema.additionalProperties) {
    return "Record<string, unknown>";
  }
  const lines = ["{"];

  keys.forEach((key) => {
    const propSchema = props[key];
    const optional = !required.has(key);
    const propType = convertSchema(propSchema, { indent: options.indent + 1 });
    const propertyLine = `${indent(options.indent + 1)}${formatPropertyName(key)}${optional ? "?" : ""}: ${propType};`;
    lines.push(propertyLine);
  });

  if (schema.additionalProperties) {
    if (schema.additionalProperties === true) {
      lines.push(`${indent(options.indent + 1)}[key: string]: unknown;`);
    } else if (schema.additionalProperties !== false) {
      const apType = convertSchema(schema.additionalProperties, {
        indent: options.indent + 1,
      });
      lines.push(`${indent(options.indent + 1)}[key: string]: ${apType};`);
    }
  }

  lines.push(`${indent(options.indent)}}`);
  return lines.join("\n");
};

const generate = () => {
  const doc = loadDocument();
  const schemas = doc.components?.schemas ?? {};
  const entries = Object.entries(schemas).sort(([a], [b]) => a.localeCompare(b));

  mkdirSync(outputDir, { recursive: true });

  const chunks = [];
  chunks.push("/* eslint-disable */");
  chunks.push("// 此文件由 scripts/generate-openapi-types.mjs 自动生成，请勿手动修改。");
  chunks.push("");

  entries.forEach(([name, schema]) => {
    const typeBody = convertSchema(schema, { indent: 0 });
    chunks.push(`export type ${name} = ${typeBody};`);
    chunks.push("");
  });

  if (entries.length > 0) {
    chunks.push("export interface OpenAPISchemas {");
    entries.forEach(([name]) => {
      chunks.push(`${indent(1)}${name}: ${name};`);
    });
    chunks.push("}");
  } else {
    chunks.push("export type OpenAPISchemas = Record<string, never>;");
  }
  chunks.push("");
  chunks.push("// 生成时间戳：" + new Date().toISOString());

  const content = `${chunks.join("\n")}\n`;
  writeFileSync(outputPath, content, "utf-8");
};

generate();
