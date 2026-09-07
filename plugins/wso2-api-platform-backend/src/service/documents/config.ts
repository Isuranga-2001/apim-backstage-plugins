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

import { RootConfigService } from '@backstage/backend-plugin-api';

export type DocumentStorageConfig = {
  enabled: boolean;
  maxFileSizeBytes: number;
  maxInlineSizeBytes: number;
  allowedExtensions: string[];
  allowedMimeTypes: string[];
  binaryBackend: 'database' | 's3' | 'filesystem';
};

const DEFAULT_MAX_FILE_SIZE_MB = 10;
const DEFAULT_MAX_INLINE_SIZE_KB = 512;
const DEFAULT_ALLOWED_EXTENSIONS = [
  'pdf',
  'txt',
  'doc',
  'docx',
  'xls',
  'xlsx',
  'odt',
  'ods',
  'json',
  'yaml',
  'yml',
  'md',
  'png',
  'jpg',
  'jpeg',
  'svg',
];

function getOptionalConfig(config: RootConfigService, key: string) {
  try {
    return config.getOptionalConfig(key);
  } catch {
    return undefined;
  }
}

function getOptionalNumber(config: RootConfigService, key: string) {
  try {
    return config.getOptionalNumber(key);
  } catch {
    return undefined;
  }
}

function getOptionalStringArray(config: RootConfigService, key: string) {
  try {
    return config.getOptionalStringArray(key);
  } catch {
    return undefined;
  }
}

export function readDocumentStorageConfig(
  config: RootConfigService,
): DocumentStorageConfig {
  const storageConfig = getOptionalConfig(config, 'wso2ApiPlatform.storage');
  const enabled = storageConfig?.getOptionalBoolean('enabled') ?? true;

  const maxFileSizeMb =
    getOptionalNumber(config, 'wso2ApiPlatform.storage.documents.maxFileSizeMb') ??
    DEFAULT_MAX_FILE_SIZE_MB;
  const maxInlineSizeKb =
    getOptionalNumber(
      config,
      'wso2ApiPlatform.storage.documents.maxInlineSizeKb',
    ) ?? DEFAULT_MAX_INLINE_SIZE_KB;

  const allowedExtensions = (
    getOptionalStringArray(
      config,
      'wso2ApiPlatform.storage.documents.allowedExtensions',
    ) ?? DEFAULT_ALLOWED_EXTENSIONS
  ).map(ext => ext.toLowerCase().replace(/^\./, ''));

  const allowedMimeTypes =
    getOptionalStringArray(
      config,
      'wso2ApiPlatform.storage.documents.allowedMimeTypes',
    ) ?? [];

  const binaryBackend =
    (getOptionalConfig(config, 'wso2ApiPlatform.storage.binary')?.getOptionalString(
      'backend',
    ) as DocumentStorageConfig['binaryBackend'] | undefined) ?? 'database';

  return {
    enabled: enabled ?? true,
    maxFileSizeBytes: Math.floor(maxFileSizeMb * 1024 * 1024),
    maxInlineSizeBytes: Math.floor(maxInlineSizeKb * 1024),
    allowedExtensions,
    allowedMimeTypes,
    binaryBackend,
  };
}

/**
 * Derives the express.json() body-size limit (bytes) from the configured
 * inline-content cap, with a floor so the existing non-document routes
 * (which never had a documented size requirement) keep working unchanged.
 */
export function deriveJsonBodyLimitBytes(
  documentStorage: DocumentStorageConfig,
): number {
  const FLOOR_BYTES = 10 * 1024 * 1024;
  return Math.max(documentStorage.maxInlineSizeBytes, FLOOR_BYTES);
}
