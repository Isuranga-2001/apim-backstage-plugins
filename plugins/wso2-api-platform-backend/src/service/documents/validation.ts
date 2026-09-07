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

import { InputError } from '@backstage/errors';
import { z } from 'zod';
import { DocumentStorageConfig } from './config';

// SWAGGER_DOC is legacy/APIM-internal and intentionally excluded from the
// create/edit dropdown — it can still be read back on the on-prem path via
// ApimPublisherDocumentStore, which bypasses this schema.
const DOCUMENT_TYPE = z.enum([
  'HOWTO',
  'SAMPLES',
  'PUBLIC_FORUM',
  'SUPPORT_FORUM',
  'API_MESSAGE_FORMAT',
  'OTHER',
]);

const SOURCE_TYPE = z.enum(['INLINE', 'MARKDOWN', 'URL', 'FILE']);

const VISIBILITY = z.enum(['OWNER_ONLY', 'PRIVATE', 'API_LEVEL']);

const createDocumentMetadataSchema = z.object({
  name: z.string().trim().min(1).max(255),
  type: DOCUMENT_TYPE,
  otherTypeName: z.string().trim().max(255).optional(),
  summary: z.string().max(4000).optional(),
  visibility: VISIBILITY.optional().default('API_LEVEL'),
  sourceType: SOURCE_TYPE,
  sourceUrl: z.string().trim().optional(),
  inlineContent: z.string().optional(),
});

export type CreateDocumentMetadataBody = z.infer<
  typeof createDocumentMetadataSchema
>;

const updateDocumentMetadataSchema = z
  .object({
    name: z.string().trim().min(1).max(255).optional(),
    type: DOCUMENT_TYPE.optional(),
    otherTypeName: z.string().trim().max(255).optional(),
    summary: z.string().max(4000).optional(),
    visibility: VISIBILITY.optional(),
    sourceUrl: z.string().trim().optional(),
  })
  .strict();

export type UpdateDocumentMetadataBody = z.infer<
  typeof updateDocumentMetadataSchema
>;

function isHttpUrl(value: string): boolean {
  try {
    const url = new URL(value);
    return url.protocol === 'http:' || url.protocol === 'https:';
  } catch {
    return false;
  }
}

function assertBusinessRules(body: {
  type: string;
  otherTypeName?: string;
  sourceType: string;
  sourceUrl?: string;
  inlineContent?: string;
}) {
  if (body.type === 'OTHER' && !body.otherTypeName) {
    throw new InputError("otherTypeName is required when type is 'OTHER'");
  }
  if (body.sourceType === 'URL') {
    if (!body.sourceUrl || !isHttpUrl(body.sourceUrl)) {
      throw new InputError(
        "sourceUrl is required and must be an http(s) URL when sourceType is 'URL'",
      );
    }
  }
  if (
    (body.sourceType === 'INLINE' || body.sourceType === 'MARKDOWN') &&
    !body.inlineContent?.trim()
  ) {
    throw new InputError(
      `inlineContent is required and must be non-empty when sourceType is '${body.sourceType}'`,
    );
  }
}

export function parseCreateDocumentMetadata(
  raw: unknown,
): CreateDocumentMetadataBody {
  const result = createDocumentMetadataSchema.safeParse(raw);
  if (!result.success) {
    throw new InputError(`Invalid document metadata: ${result.error.message}`);
  }
  assertBusinessRules(result.data);
  return result.data;
}

export function parseUpdateDocumentMetadata(
  raw: unknown,
): UpdateDocumentMetadataBody {
  const result = updateDocumentMetadataSchema.safeParse(raw);
  if (!result.success) {
    throw new InputError(
      `Invalid document metadata patch: ${result.error.message}. Content fields ` +
        '(sourceType, inlineContent, fileName, file) are not editable — ' +
        'content updates are not supported in this release.',
    );
  }
  if (
    result.data.sourceUrl !== undefined &&
    !isHttpUrl(result.data.sourceUrl)
  ) {
    throw new InputError('sourceUrl must be an http(s) URL');
  }
  return result.data;
}

export function assertInlineSizeWithinLimit(
  content: string,
  config: DocumentStorageConfig,
) {
  const bytes = Buffer.byteLength(content, 'utf8');
  if (bytes > config.maxInlineSizeBytes) {
    throw new InputError(
      `Document content is ${bytes} bytes, exceeding the configured limit of ${config.maxInlineSizeBytes} bytes`,
    );
  }
}

export function assertFileAllowed(
  file: { originalname: string; mimetype?: string; size: number },
  config: DocumentStorageConfig,
) {
  if (file.size > config.maxFileSizeBytes) {
    throw new InputError(
      `File is ${file.size} bytes, exceeding the configured limit of ${config.maxFileSizeBytes} bytes`,
    );
  }
  const ext = file.originalname.split('.').pop()?.toLowerCase();
  if (
    config.allowedExtensions.length > 0 &&
    (!ext || !config.allowedExtensions.includes(ext))
  ) {
    throw new InputError(
      `File extension '${
        ext ?? ''
      }' is not in the allowed list: ${config.allowedExtensions.join(', ')}`,
    );
  }
  if (
    config.allowedMimeTypes.length > 0 &&
    file.mimetype &&
    !config.allowedMimeTypes.includes(file.mimetype)
  ) {
    throw new InputError(
      `File MIME type '${
        file.mimetype
      }' is not in the allowed list: ${config.allowedMimeTypes.join(', ')}`,
    );
  }
}
