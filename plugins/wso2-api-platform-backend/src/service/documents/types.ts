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

import type { ReadableStream as WebReadableStream } from 'stream/web';

/**
 * Which underlying store owns an API's documents. `apim` is the existing
 * on-prem Publisher-backed, read-only path; `self-hosted` and `openchoreo`
 * are backed by this plugin's own database.
 */
export type ApiSourceKind = 'self-hosted' | 'openchoreo' | 'apim';

export type ApiDocumentType =
  | 'HOWTO'
  | 'SAMPLES'
  | 'PUBLIC_FORUM'
  | 'SUPPORT_FORUM'
  | 'API_MESSAGE_FORMAT'
  | 'OTHER';

export type ApiDocumentSourceType = 'INLINE' | 'MARKDOWN' | 'URL' | 'FILE';

/**
 * Logical identity of an API, independent of its catalog entity name (which
 * can change on a gateway API rename).
 */
export type ApiRef = {
  sourceKind: ApiSourceKind;
  /** gateway/environment name; '' for apim */
  gatewayId: string;
  apiId: string;
  apiVersion?: string;
  /** cached, e.g. 'api:wso2-gateways/orders-api' */
  entityRef: string;
};

/**
 * Wire DTO, deliberately field-compatible with the WSO2 Publisher v4
 * `Document` schema so the on-prem store can eventually implement the same
 * interface with no shape translation.
 */
export type ApiDocument = {
  documentId: string;
  name: string;
  type: ApiDocumentType;
  otherTypeName?: string;
  summary?: string;
  sourceType: ApiDocumentSourceType;
  sourceUrl?: string;
  fileName?: string;
  mimeType?: string;
  sizeBytes?: number;
  createdBy?: string;
  createdTime?: string;
  lastUpdatedBy?: string;
  lastUpdatedTime?: string;
};

export type ApiDocumentCapabilities = {
  read: boolean;
  create: boolean;
  updateMetadata: boolean;
  updateContent: boolean;
  delete: boolean;
};

export type ApiDocumentListResult = {
  count: number;
  list: ApiDocument[];
  capabilities: ApiDocumentCapabilities;
};

export type Actor = {
  userEntityRef?: string;
};

export type CreateDocumentInput = {
  name: string;
  type: ApiDocumentType;
  otherTypeName?: string;
  summary?: string;
  sourceType: ApiDocumentSourceType;
  sourceUrl?: string;
  inlineContent?: string;
  file?: {
    buffer: Buffer;
    originalName: string;
    mimeType?: string;
  };
};

export type UpdateDocumentMetadataInput = {
  name?: string;
  type?: ApiDocumentType;
  otherTypeName?: string;
  summary?: string;
  /** only honoured when the stored document's sourceType is URL */
  sourceUrl?: string;
};

export type DocumentContentResult =
  | { kind: 'text'; contentType: string; body: string; fileName?: string }
  | { kind: 'buffer'; contentType: string; body: Buffer; fileName: string }
  | {
      kind: 'stream';
      contentType: string;
      body: WebReadableStream;
      fileName?: string;
    }
  | { kind: 'redirect'; url: string };

export type ApiDefinitionFormat = 'YAML' | 'JSON';

export type ApiDefinition = {
  content: string;
  format: ApiDefinitionFormat;
  fileName?: string;
  sizeBytes?: number;
  createdBy?: string;
  createdTime?: string;
  lastUpdatedBy?: string;
  lastUpdatedTime?: string;
};

export type ApiDefinitionCapabilities = {
  read: boolean;
  write: boolean;
};

export type UpsertDefinitionInput = {
  fileName: string;
  content: string;
};
