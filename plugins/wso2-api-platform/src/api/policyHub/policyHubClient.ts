/*
 * Copyright (c) 2026, WSO2 LLC. (http://www.wso2.com).
 *
 * WSO2 LLC. licenses this file to you under the Apache License,
 * Version 2.0 (the "License"); you may not use this file except
 * in compliance with the License.
 * You may obtain a copy of the License at
 *
 * http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing,
 * software distributed under the License is distributed on an
 * "AS IS" BASIS, WITHOUT WARRANTIES OR CONDITIONS OF ANY
 * KIND, either express or implied.  See the License for the
 * specific language governing permissions and limitations
 * under the License.
 */

import * as yaml from 'js-yaml';
import type { ParameterSchema } from './policySchema';

/**
 * Default Policy Hub base URL, used when `wso2ApiPlatform.policyHub.baseUrl`
 * is not set in app-config.yaml. The Policy Hub is called directly from the
 * browser (no backend proxy).
 */
export const DEFAULT_POLICY_HUB_BASE_URL =
  'https://db720294-98fd-40f4-85a1-cc6a3b65bc9a-dev.e1-us-east-azure.choreoapis.dev/api-platform/policy-hub-api/policy-hub-public/v1.0';

/** Public Policy Hub website. */
export const POLICY_HUB_WEBSITE_URL =
  'https://wso2.com/api-platform/policy-hub/';

/** A policy as listed by the Policy Hub catalog. */
export type PolicySummary = {
  name: string;
  version: string;
  displayName: string;
  provider: string;
  categories: string[];
  tags: string[];
  isLatest: boolean;
  description?: string;
  iconUrl?: string;
};

export type PolicyListResult = {
  policies: PolicySummary[];
  total: number;
};

/** Parsed policy definition, used to render the config form. */
export type PolicyDefinition = {
  name: string;
  version: string;
  description?: string;
  /** Recursive JSON-Schema for the policy's parameters. */
  schema: ParameterSchema;
};

const asArray = (value: unknown): unknown[] =>
  Array.isArray(value) ? value : [];
const str = (value: unknown): string =>
  typeof value === 'string' ? value : value == null ? '' : String(value);
const asRecord = (value: unknown): Record<string, unknown> =>
  value && typeof value === 'object' ? (value as Record<string, unknown>) : {};

const toSummary = (value: unknown): PolicySummary => {
  const s = asRecord(value);
  return {
    name: str(s.name),
    version: str(s.version),
    displayName: str(s.displayName) || str(s.name),
    provider: str(s.provider),
    categories: asArray(s.categories).map(str),
    tags: asArray(s.tags).map(str),
    isLatest: s.isLatest !== false,
    description: str(s.description) || undefined,
    iconUrl: str(s.iconUrl) || undefined,
  };
};

/**
 * Builds the catalog query string. `page` is 1-based; the hub uses
 * offset/limit. Exported for testing.
 */
export const buildPolicyQuery = (
  page: number,
  pageSize: number,
  categories?: string[],
): string => {
  const params = new URLSearchParams();
  params.set('offset', String((page - 1) * pageSize));
  params.set('limit', String(pageSize));
  const cats = (categories || []).filter(Boolean);
  if (cats.length > 0) params.set('categories', cats.join(','));
  return params.toString();
};

async function hubGet<T>(baseUrl: string, path: string): Promise<T> {
  let response: Response;
  try {
    response = await fetch(`${baseUrl}${path}`, {
      headers: { Accept: 'application/json' },
    });
  } catch (error) {
    throw new Error(
      error instanceof Error ? error.message : 'Policy Hub is unreachable',
    );
  }
  if (!response.ok) {
    throw new Error(`Policy Hub request failed (${response.status})`);
  }
  return (await response.json()) as T;
}

/** GET /policies - paginated catalog, optionally filtered by category. */
export async function listPolicies(
  baseUrl: string,
  page: number,
  pageSize: number,
  categories?: string[],
): Promise<PolicyListResult> {
  const data = await hubGet<{
    data?: unknown[];
    count?: number;
    pagination?: { total?: number };
  }>(baseUrl, `/policies?${buildPolicyQuery(page, pageSize, categories)}`);
  return {
    policies: asArray(data.data).map(toSummary),
    total: data.pagination?.total ?? data.count ?? 0,
  };
}

/** GET /policies/categories - available category names. */
export async function listPolicyCategories(baseUrl: string): Promise<string[]> {
  const data = await hubGet<{ data?: unknown[] }>(
    baseUrl,
    '/policies/categories',
  );
  return asArray(data.data).map(str);
}

/** GET /policies/{name}/versions - all versions of a policy. */
export async function listPolicyVersions(
  baseUrl: string,
  name: string,
): Promise<PolicySummary[]> {
  const data = await hubGet<unknown>(
    baseUrl,
    `/policies/${encodeURIComponent(name)}/versions`,
  );
  const list = Array.isArray(data)
    ? data
    : asArray((data as { data?: unknown[] })?.data);
  return list.map(toSummary);
}

const EMPTY_SCHEMA: ParameterSchema = { type: 'object', properties: {} };

/** Normalizes a raw YAML node into a recursive ParameterSchema. */
const toSchema = (raw: unknown): ParameterSchema => {
  const s = asRecord(raw);
  const type = str(s.type) as ParameterSchema['type'];
  const schema: ParameterSchema = {
    type: type || 'string',
    title: str(s.title) || undefined,
    description: str(s.description) || undefined,
    default: s.default,
    enum: asArray(s.enum).map(str),
    required: asArray(s.required).map(str),
  };
  if (schema.enum && schema.enum.length === 0) delete schema.enum;
  if (schema.required && schema.required.length === 0) delete schema.required;
  if (typeof s['x-wso2-policy-advanced-param'] === 'boolean') {
    schema.advanced = s['x-wso2-policy-advanced-param'] as boolean;
  }
  const props = asRecord(s.properties);
  if (Object.keys(props).length > 0) {
    schema.properties = Object.fromEntries(
      Object.entries(props).map(([k, v]) => [k, toSchema(v)]),
    );
  }
  if (s.items) schema.items = toSchema(s.items);
  // A dynamic key-value map: object with `additionalProperties` as a value
  // schema (the boolean form is ignored). Renders as a key-value editor.
  if (s.additionalProperties && typeof s.additionalProperties === 'object') {
    schema.additionalProperties = toSchema(s.additionalProperties);
  }
  return schema;
};

/**
 * GET /policies/{name}/versions/{version}/definition - raw YAML definition,
 * parsed into a PolicyDefinition carrying the recursive parameter schema.
 */
export async function getPolicyDefinition(
  baseUrl: string,
  name: string,
  version: string,
): Promise<PolicyDefinition> {
  let response: Response;
  try {
    response = await fetch(
      `${baseUrl}/policies/${encodeURIComponent(
        name,
      )}/versions/${encodeURIComponent(version)}/definition`,
      { headers: { Accept: 'text/yaml, application/json' } },
    );
  } catch (error) {
    throw new Error(
      error instanceof Error ? error.message : 'Policy Hub is unreachable',
    );
  }
  if (!response.ok) {
    throw new Error(`Policy definition request failed (${response.status})`);
  }
  const text = await response.text();
  let doc: Record<string, unknown>;
  try {
    doc = asRecord(yaml.load(text));
  } catch (error) {
    throw new Error(
      `Unable to parse policy definition: ${
        error instanceof Error ? error.message : 'invalid YAML'
      }`,
    );
  }
  return {
    name: str(doc.name) || name,
    version: str(doc.version) || version,
    description: str(doc.description) || undefined,
    schema: doc.parameters ? toSchema(doc.parameters) : EMPTY_SCHEMA,
  };
}
