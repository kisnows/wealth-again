import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import { join } from "node:path";

const openapiPath = join(process.cwd(), "doc", "openapi.json");
const openapi = JSON.parse(readFileSync(openapiPath, "utf-8"));

describe("OpenAPI contract", () => {
  it("exposes basic document metadata", () => {
    expect(openapi.openapi).toBeDefined();
    expect(openapi.info?.title).toBe("Wealth Again API");
  });

  it("documents identity endpoints with responses", () => {
    const mePath = openapi.paths?.["/api/v1/identity/auth/me"];
    expect(mePath?.get?.responses?.["200"]).toBeDefined();
    expect(mePath?.patch?.responses?.["409"]).toBeDefined();
  });

  it("documents city change scheduling response", () => {
    const post = openapi.paths?.["/api/v1/identity/city-changes"]?.post;
    expect(post?.responses?.["202"]).toBeDefined();
    const schema =
      post?.responses?.["202"]?.content?.["application/json"]?.schema;
    expect(schema?.properties?.task).toBeDefined();
  });

  it("includes accounting endpoints", () => {
    const deposit =
      openapi.paths?.["/api/v1/accounts-ledger/entries/deposit"]?.post;
    expect(deposit?.requestBody).toBeDefined();
    const transfer =
      openapi.paths?.["/api/v1/accounts-ledger/entries/transfer"]?.post;
    expect(transfer?.responses?.["201"]).toBeDefined();
  });

  it("covers core reporting APIs", () => {
    const dashboard =
      openapi.paths?.["/api/v1/reporting/dashboard"]?.get;
    const income =
      openapi.paths?.["/api/v1/reporting/income/timeseries"]?.get;
    expect(dashboard?.responses?.["200"]).toBeDefined();
    expect(income?.responses?.["200"]).toBeDefined();
  });
});
