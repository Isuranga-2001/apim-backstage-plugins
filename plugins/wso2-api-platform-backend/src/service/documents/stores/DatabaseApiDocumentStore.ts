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

import { InputError, NotFoundError } from '@backstage/errors';
import { createHash } from 'crypto';
import {
  ArtifactContentRow,
  ArtifactDao,
  ArtifactMetadataPatch,
  ArtifactRow,
} from '../dao/ArtifactDao';
import { BinaryStorage } from '../storage/BinaryStorage';
import {
  Actor,
  ApiDocument,
  ApiDocumentCapabilities,
  ApiDocumentSourceType,
  ApiDocumentType,
  ApiRef,
  CreateDocumentInput,
  DocumentContentResult,
  UpdateDocumentMetadataInput,
} from '../types';
import { ApiDocumentStore } from './ApiDocumentStore';

type ContentMeta = Pick<
  ArtifactContentRow,
  'file_name' | 'mime_type' | 'size_bytes'
>;

function toIsoString(value: string | Date): string {
  const date = value instanceof Date ? value : new Date(value);
  return Number.isNaN(date.getTime()) ? String(value) : date.toISOString();
}

function toApiDocument(
  row: ArtifactRow,
  content?: ContentMeta | null,
): ApiDocument {
  return {
    documentId: row.id,
    name: row.name,
    type: row.doc_type as ApiDocumentType,
    otherTypeName: row.other_type_name ?? undefined,
    summary: row.summary ?? undefined,
    sourceType: row.source_type as ApiDocumentSourceType,
    sourceUrl: row.source_url ?? undefined,
    fileName: content?.file_name ?? undefined,
    mimeType: content?.mime_type ?? undefined,
    sizeBytes:
      content?.size_bytes !== undefined && content?.size_bytes !== null
        ? Number(content.size_bytes)
        : undefined,
    createdBy: row.created_by ?? undefined,
    createdTime: toIsoString(row.created_at),
    lastUpdatedBy: row.updated_by ?? undefined,
    lastUpdatedTime: toIsoString(row.updated_at),
  };
}

/**
 * The write-capable store backing self-hosted and OpenChoreo gateway APIs.
 * On-prem/APIM documents never reach this class — they are routed to
 * ApimPublisherDocumentStore by ApiDocumentStoreResolver.
 */
export class DatabaseApiDocumentStore implements ApiDocumentStore {
  readonly capabilities: ApiDocumentCapabilities = {
    read: true,
    create: true,
    updateMetadata: true,
    updateContent: false,
    delete: true,
  };

  constructor(
    private readonly dao: ArtifactDao,
    private readonly binaryStorage: BinaryStorage,
  ) {}

  async list(ref: ApiRef): Promise<ApiDocument[]> {
    const rows = await this.dao.list(ref);
    return rows.map(row => toApiDocument(row, row));
  }

  async get(ref: ApiRef, documentId: string): Promise<ApiDocument> {
    const row = await this.dao.get(ref, documentId);
    if (ref.entityRef && row.entity_ref !== ref.entityRef) {
      // Keeps the cached entity_ref honest across entity renames, without
      // paying an extra write on every list() row.
      await this.dao.refreshEntityRef(row.id, ref.entityRef);
      row.entity_ref = ref.entityRef;
    }
    const content = await this.dao.getContent(documentId);
    return toApiDocument(row, content);
  }

  async getContent(
    ref: ApiRef,
    documentId: string,
  ): Promise<DocumentContentResult> {
    const row = await this.dao.get(ref, documentId);

    if (row.source_type === 'URL') {
      if (!row.source_url) {
        throw new NotFoundError(`Document '${documentId}' has no source URL`);
      }
      return { kind: 'redirect', url: row.source_url };
    }

    const content = await this.dao.getContent(documentId);
    if (!content) {
      throw new NotFoundError(`Document '${documentId}' has no stored content`);
    }

    if (row.source_type === 'INLINE' || row.source_type === 'MARKDOWN') {
      return {
        kind: 'text',
        contentType:
          content.mime_type ??
          (row.source_type === 'MARKDOWN' ? 'text/markdown' : 'text/plain'),
        body: content.content_text ?? '',
      };
    }

    // FILE
    const buffer = await this.binaryStorage.read({
      storageBackend: content.storage_backend,
      storageRef: content.storage_ref,
      contentBlob: content.content_blob,
    });
    return {
      kind: 'buffer',
      contentType: content.mime_type ?? 'application/octet-stream',
      body: buffer,
      fileName: content.file_name ?? row.name,
    };
  }

  async create(
    ref: ApiRef,
    input: CreateDocumentInput,
    actor: Actor,
  ): Promise<ApiDocument> {
    const contentRow = await this.buildContentRow(input);

    const row = await this.dao.create(
      {
        source_kind: ref.sourceKind,
        gateway_id: ref.gatewayId,
        api_id: ref.apiId,
        api_version: ref.apiVersion ?? null,
        entity_ref: ref.entityRef || null,
        name: input.name,
        doc_type: input.type,
        other_type_name: input.otherTypeName ?? null,
        summary: input.summary ?? null,
        source_type: input.sourceType,
        source_url: input.sourceType === 'URL' ? input.sourceUrl ?? null : null,
        created_by: actor.userEntityRef ?? null,
        updated_by: actor.userEntityRef ?? null,
      },
      contentRow,
    );

    const content = await this.dao.getContent(row.id);
    return toApiDocument(row, content);
  }

  async updateMetadata(
    ref: ApiRef,
    documentId: string,
    patch: UpdateDocumentMetadataInput,
    actor: Actor,
  ): Promise<ApiDocument> {
    const existing = await this.dao.get(ref, documentId);

    const mergedType = patch.type ?? existing.doc_type;
    const mergedOtherTypeName =
      patch.otherTypeName !== undefined
        ? patch.otherTypeName
        : existing.other_type_name ?? undefined;
    if (mergedType === 'OTHER' && !mergedOtherTypeName) {
      throw new InputError("otherTypeName is required when type is 'OTHER'");
    }
    if (patch.sourceUrl !== undefined && existing.source_type !== 'URL') {
      throw new InputError(
        "sourceUrl can only be edited for documents whose sourceType is 'URL'",
      );
    }

    const daoPatch: ArtifactMetadataPatch = {
      updated_by: actor.userEntityRef ?? null,
    };
    if (patch.name !== undefined) daoPatch.name = patch.name;
    if (patch.type !== undefined) daoPatch.doc_type = patch.type;
    if (patch.otherTypeName !== undefined)
      daoPatch.other_type_name = patch.otherTypeName;
    if (patch.summary !== undefined) daoPatch.summary = patch.summary;
    if (patch.sourceUrl !== undefined) daoPatch.source_url = patch.sourceUrl;

    const updated = await this.dao.updateMetadata(ref, documentId, daoPatch);
    const content = await this.dao.getContent(documentId);
    return toApiDocument(updated, content);
  }

  async delete(ref: ApiRef, documentId: string, _actor: Actor): Promise<void> {
    const content = await this.dao.getContent(documentId);
    await this.dao.delete(ref, documentId);
    if (content) {
      await this.binaryStorage.delete({
        storageBackend: content.storage_backend,
        storageRef: content.storage_ref,
      });
    }
  }

  private async buildContentRow(input: CreateDocumentInput): Promise<
    | {
        storage_backend: string;
        storage_ref: string | null;
        mime_type: string | null;
        file_name: string | null;
        size_bytes: number;
        checksum: string;
        content_text: string | null;
        content_blob: Buffer | null;
      }
    | undefined
  > {
    if (input.sourceType === 'URL') {
      return undefined;
    }

    if (input.sourceType === 'INLINE' || input.sourceType === 'MARKDOWN') {
      const text = input.inlineContent ?? '';
      return {
        storage_backend: this.binaryStorage.backend,
        storage_ref: null,
        mime_type:
          input.sourceType === 'MARKDOWN' ? 'text/markdown' : 'text/plain',
        file_name: null,
        size_bytes: Buffer.byteLength(text, 'utf8'),
        checksum: createHash('sha256').update(text, 'utf8').digest('hex'),
        content_text: text,
        content_blob: null,
      };
    }

    // FILE
    if (!input.file) {
      throw new InputError("A file is required when sourceType is 'FILE'");
    }
    const { buffer, originalName, mimeType } = input.file;
    const written = await this.binaryStorage.write({ buffer });
    return {
      storage_backend: this.binaryStorage.backend,
      storage_ref: written.storageRef ?? null,
      mime_type: mimeType ?? null,
      file_name: originalName,
      size_bytes: buffer.length,
      checksum: createHash('sha256').update(buffer).digest('hex'),
      content_text: null,
      content_blob: written.blobForDb ?? null,
    };
  }
}
