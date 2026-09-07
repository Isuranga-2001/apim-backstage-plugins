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

import { NotAllowedError, NotFoundError } from '@backstage/errors';
import { Wso2ApiPlatformClient } from '../../client';
import { Wso2ApiDocument } from '../../types';
import {
  Actor,
  ApiDocument,
  ApiDocumentCapabilities,
  ApiDocumentSourceType,
  ApiDocumentType,
  ApiDocumentVisibility,
  ApiRef,
  CreateDocumentInput,
  DocumentContentResult,
  UpdateDocumentMetadataInput,
} from '../types';
import { ApiDocumentStore } from './ApiDocumentStore';

function toApiDocument(doc: Wso2ApiDocument): ApiDocument {
  return {
    documentId: doc.documentId || doc.id,
    name: doc.name,
    type: (doc.type as ApiDocumentType) ?? 'OTHER',
    summary: doc.summary,
    sourceType: (doc.sourceType as ApiDocumentSourceType) ?? 'INLINE',
    sourceUrl: doc.sourceUrl,
    visibility: 'API_LEVEL' as ApiDocumentVisibility,
  };
}

/**
 * Read-only wrapper over the existing on-prem Publisher client. This is a
 * pre-wired extension point: implementing the four mutators against
 * `POST/PUT/DELETE /apis/{apiId}/documents` and flipping `capabilities` to
 * `true` lights up write support for on-prem APIM with no route/schema/
 * frontend change.
 */
export class ApimPublisherDocumentStore implements ApiDocumentStore {
  readonly capabilities: ApiDocumentCapabilities = {
    read: true,
    create: false,
    updateMetadata: false,
    updateContent: false,
    delete: false,
  };

  constructor(private readonly client: Wso2ApiPlatformClient) {}

  async list(ref: ApiRef): Promise<ApiDocument[]> {
    const { list } = await this.client.getDocuments(ref.apiId);
    return list.map(toApiDocument);
  }

  async get(ref: ApiRef, documentId: string): Promise<ApiDocument> {
    const doc = await this.client.getDocument(ref.apiId, documentId);
    return toApiDocument(doc);
  }

  async getContent(
    ref: ApiRef,
    documentId: string,
  ): Promise<DocumentContentResult> {
    const doc = await this.client.getDocument(ref.apiId, documentId);

    if (doc.sourceType === 'URL' && doc.sourceUrl) {
      return { kind: 'redirect', url: doc.sourceUrl };
    }

    const response = await this.client.getDocumentContentStream(
      ref.apiId,
      documentId,
    );

    if (!response.ok) {
      if (
        response.status === 404 &&
        (doc.sourceType === 'INLINE' || doc.sourceType === 'MARKDOWN')
      ) {
        return {
          kind: 'text',
          contentType:
            doc.sourceType === 'MARKDOWN' ? 'text/markdown' : 'text/plain',
          body: doc.inlineContent ?? '',
          fileName: doc.name,
        };
      }
      throw new NotFoundError(
        `Failed to fetch content for document '${documentId}' (status ${response.status})`,
      );
    }

    const contentType = response.headers.get('content-type') || '';
    if (!response.body) {
      return {
        kind: 'text',
        contentType: contentType || 'text/plain',
        body: '',
      };
    }

    if (contentType.includes('application/json')) {
      const json = (await response.json()) as { inlineContent?: string };
      return {
        kind: 'text',
        contentType: 'text/plain',
        body: json.inlineContent ?? JSON.stringify(json, null, 2),
        fileName: doc.name,
      };
    }

    return {
      kind: 'stream',
      contentType: contentType || 'application/octet-stream',
      body: response.body,
      fileName: doc.name,
    };
  }

  async create(
    _ref: ApiRef,
    _input: CreateDocumentInput,
    _actor: Actor,
  ): Promise<ApiDocument> {
    throw new NotAllowedError(
      'Creating documents for on-prem APIM APIs is not supported in this release',
    );
  }

  async updateMetadata(
    _ref: ApiRef,
    _documentId: string,
    _patch: UpdateDocumentMetadataInput,
    _actor: Actor,
  ): Promise<ApiDocument> {
    throw new NotAllowedError(
      'Editing documents for on-prem APIM APIs is not supported in this release',
    );
  }

  async delete(
    _ref: ApiRef,
    _documentId: string,
    _actor: Actor,
  ): Promise<void> {
    throw new NotAllowedError(
      'Deleting documents for on-prem APIM APIs is not supported in this release',
    );
  }
}
