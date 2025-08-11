import { OpenAPIRegistry, OpenApiGeneratorV3 } from "zod-to-openapi";
import { writeFileSync } from "fs";
import path from "path";
import {
  createTaxParamsRequest,
  createTaxParamsResponse,
  incomeMonthlyRequest,
  incomeForecastResponse,
  accountCreateRequest,
  accountCreateResponse,
  transactionCreateRequest,
  valuationSnapshotRequest,
  performanceResponse,
} from "./schemas";

const registry = new OpenAPIRegistry();

registry.registerPath({
  method: "post",
  path: "/api/config/tax-params",
  request: {
    body: {
      content: { "application/json": { schema: createTaxParamsRequest } },
    },
  },
  responses: {
    200: {
      description: "OK",
      content: { "application/json": { schema: createTaxParamsResponse } },
    },
  },
});
registry.registerPath({
  method: "post",
  path: "/api/income/monthly",
  request: {
    body: { content: { "application/json": { schema: incomeMonthlyRequest } } },
  },
  responses: { 200: { description: "OK" } },
});
registry.registerPath({
  method: "get",
  path: "/api/income/forecast",
  responses: {
    200: {
      description: "OK",
      content: { "application/json": { schema: incomeForecastResponse } },
    },
  },
});
registry.registerPath({
  method: "post",
  path: "/api/accounts",
  request: {
    body: { content: { "application/json": { schema: accountCreateRequest } } },
  },
  responses: {
    200: {
      description: "OK",
      content: { "application/json": { schema: accountCreateResponse } },
    },
  },
});
registry.registerPath({
  method: "post",
  path: "/api/transactions",
  request: {
    body: {
      content: { "application/json": { schema: transactionCreateRequest } },
    },
  },
  responses: { 200: { description: "OK" } },
});
registry.registerPath({
  method: "post",
  path: "/api/valuations/snapshot",
  request: {
    body: {
      content: { "application/json": { schema: valuationSnapshotRequest } },
    },
  },
  responses: { 200: { description: "OK" } },
});
registry.registerPath({
  method: "get",
  path: "/api/accounts/{id}/performance",
  responses: {
    200: {
      description: "OK",
      content: { "application/json": { schema: performanceResponse } },
    },
  },
});
registry.registerPath({
  method: "get",
  path: "/api/portfolio/performance",
  responses: {
    200: {
      description: "OK",
      content: { "application/json": { schema: performanceResponse } },
    },
  },
});

const generator = new OpenApiGeneratorV3(registry.definitions);
const doc = generator.generateDocument({
  openapi: "3.0.0",
  info: { title: "Wealth Manager API", version: "0.1.0" },
});
const outPath = path.join(process.cwd(), "openapi.json");
writeFileSync(outPath, JSON.stringify(doc, null, 2));
console.log("OpenAPI spec written to", outPath);
