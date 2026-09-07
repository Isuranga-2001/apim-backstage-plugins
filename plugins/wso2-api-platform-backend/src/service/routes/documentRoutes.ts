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

import {
  BackstageCredentials,
  BackstageUserPrincipal,
} from '@backstage/backend-plugin-api';
import {
  InputError,
  NotAllowedError,
  NotImplementedError,
} from '@backstage/errors';
import express from 'express';
import multer, { MulterError } from 'multer';
import { pipeWebStreamToResponse } from './streamUtils';
import { RouteContext } from './types';
import {
  assertFileAllowed,
  assertInlineSizeWithinLimit,
  parseCreateDocumentMetadata,
  parseUpdateDocumentMetadata,
} from '../documents/validation';
import { Actor, CreateDocumentInput } from '../documents/types';

const BASE_PATH = '/entities/:kind/:namespace/:name/documents';
const DOCUMENT_PATH = `${BASE_PATH}/:documentId`;
const CONTENT_PATH = `${DOCUMENT_PATH}/content`;

function actorFor(
  credentials: BackstageCredentials<BackstageUserPrincipal>,
): Actor {
  return { userEntityRef: credentials.principal.userEntityRef };
}

/** Strips characters that would let a document name break out of the
 * Content-Disposition header value. */
function sanitizeFileName(name: string): string {
  return name.replace(/["\r\n]/g, '_');
}

// @types/multer's own @types/express dependency floats to an Express 5
// major, which is structurally incompatible with this package's Express 4
// Request/Response types even though multer itself works fine with either
// at runtime — so the handler is invoked through an untyped signature here.
type NodeStyleMiddleware = (
  req: express.Request,
  res: express.Response,
  cb: (err: unknown) => void,
) => void;

function uploadSingleFile(upload: multer.Multer, field: string) {
  const middleware = upload.single(field) as unknown as NodeStyleMiddleware;
  return (
    req: express.Request,
    res: express.Response,
    next: express.NextFunction,
  ) => {
    middleware(req, res, (err: unknown) => {
      if (!err) {
        next();
        return;
      }
      if (err instanceof MulterError && err.code === 'LIMIT_FILE_SIZE') {
        const inputError = new InputError(
          'Uploaded file exceeds the configured maximum size',
        );
        (inputError as InputError & { statusCode?: number }).statusCode = 413;
        next(inputError);
        return;
      }
      next(err);
    });
  };
}

export function registerDocumentRoutes(
  router: express.Router,
  context: RouteContext,
) {
  if (
    !context.storeResolver ||
    !context.httpAuth ||
    !context.catalog ||
    !context.documentStorage
  ) {
    // Document routes are only wired up once router.ts has database/catalog
    // support; older test doubles that construct RouteContext without them
    // simply don't get these routes registered.
    return;
  }
  const { storeResolver, httpAuth, catalog, documentStorage, logger } =
    context as Required<RouteContext>;

  const upload = multer({
    storage: multer.memoryStorage(),
    limits: { fileSize: documentStorage.maxFileSizeBytes, files: 1 },
  });

  async function resolve(req: express.Request) {
    const credentials = await httpAuth.credentials(req, { allow: ['user'] });
    const { kind, namespace, name } = req.params;
    const { apiRef, store } = await storeResolver.resolve(
      { kind, namespace, name },
      credentials,
    );
    return { credentials, apiRef, store };
  }

  function assertStorageEnabled() {
    if (!documentStorage.enabled) {
      throw new NotImplementedError(
        'Document storage is disabled (wso2ApiPlatform.storage.enabled=false)',
      );
    }
  }

  async function refreshCatalogEntityAdvisory(
    entityRef: string,
    credentials: BackstageCredentials,
  ) {
    try {
      await catalog.refreshEntity(entityRef, { credentials });
    } catch (e) {
      logger.debug(
        `Catalog refresh after document mutation is advisory; ignored: ${e}`,
      );
    }
  }

  router.get(BASE_PATH, async (req, res) => {
    const { apiRef, store } = await resolve(req);
    const list = await store.list(apiRef);
    res.json({ count: list.length, list, capabilities: store.capabilities });
  });

  router.post(BASE_PATH, uploadSingleFile(upload, 'file'), async (req, res) => {
    assertStorageEnabled();
    const { apiRef, store, credentials } = await resolve(req);
    if (!store.capabilities.create) {
      throw new NotAllowedError(
        "This API's document store does not support creating documents",
      );
    }

    const isMultipart = Boolean(req.file) || req.is('multipart/form-data');
    const rawMetadata = isMultipart
      ? JSON.parse((req.body as { metadata?: string }).metadata ?? '{}')
      : req.body;
    const metadata = parseCreateDocumentMetadata(rawMetadata);

    let input: CreateDocumentInput;
    if (metadata.sourceType === 'FILE') {
      const file = req.file;
      if (!file) {
        throw new InputError(
          "A 'file' part is required when sourceType is 'FILE'",
        );
      }
      assertFileAllowed(
        {
          originalname: file.originalname,
          mimetype: file.mimetype,
          size: file.size,
        },
        documentStorage,
      );
      input = {
        ...metadata,
        file: {
          buffer: file.buffer,
          originalName: file.originalname,
          mimeType: file.mimetype,
        },
      };
    } else {
      if (metadata.inlineContent) {
        assertInlineSizeWithinLimit(metadata.inlineContent, documentStorage);
      }
      input = metadata;
    }

    const created = await store.create(apiRef, input, actorFor(credentials));
    await refreshCatalogEntityAdvisory(apiRef.entityRef, credentials);
    res.status(201).json(created);
  });

  router.get(DOCUMENT_PATH, async (req, res) => {
    const { apiRef, store } = await resolve(req);
    const doc = await store.get(apiRef, req.params.documentId);
    res.json(doc);
  });

  router.put(DOCUMENT_PATH, async (req, res) => {
    const { apiRef, store, credentials } = await resolve(req);
    if (!store.capabilities.updateMetadata) {
      throw new NotAllowedError(
        "This API's document store does not support editing document metadata",
      );
    }
    const patch = parseUpdateDocumentMetadata(req.body);
    const updated = await store.updateMetadata(
      apiRef,
      req.params.documentId,
      patch,
      actorFor(credentials),
    );
    await refreshCatalogEntityAdvisory(apiRef.entityRef, credentials);
    res.json(updated);
  });

  router.delete(DOCUMENT_PATH, async (req, res) => {
    const { apiRef, store, credentials } = await resolve(req);
    if (!store.capabilities.delete) {
      throw new NotAllowedError(
        "This API's document store does not support deleting documents",
      );
    }
    await store.delete(apiRef, req.params.documentId, actorFor(credentials));
    await refreshCatalogEntityAdvisory(apiRef.entityRef, credentials);
    res.status(204).send();
  });

  router.get(CONTENT_PATH, async (req, res) => {
    const { apiRef, store } = await resolve(req);
    const result = await store.getContent(apiRef, req.params.documentId);

    if (result.kind === 'redirect') {
      res.redirect(303, result.url);
      return;
    }

    res.setHeader('X-Content-Type-Options', 'nosniff');
    res.setHeader('Content-Security-Policy', 'sandbox');
    res.setHeader('Content-Type', result.contentType);
    if (result.fileName) {
      res.setHeader(
        'Content-Disposition',
        `attachment; filename="${sanitizeFileName(result.fileName)}"`,
      );
    }

    if (result.kind === 'stream') {
      pipeWebStreamToResponse({
        body: result.body,
        res,
        errorMessage: 'Error streaming document content',
        logMessage: 'Document content stream error',
        logger,
      });
      return;
    }

    res.send(result.body);
  });
}
