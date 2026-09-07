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

export type BinaryBackendKind = 'database' | 's3' | 'filesystem';

/**
 * Where FILE-document bytes are written on create, keyed off the
 * `storage_backend` column. Only the 'database' backend is implemented in
 * this phase; 's3'/'filesystem' are reserved extension points — the schema
 * already supports them via `storage_ref`.
 */
export interface BinaryStorage {
  readonly backend: BinaryBackendKind;

  /**
   * Persists a file's bytes. Returns the value to store in `storage_ref`
   * (undefined for the 'database' backend, which stores the bytes directly
   * in `wso2_artifact_content.content_blob` instead) plus, for the
   * 'database' backend, the buffer to write into that column.
   */
  write(input: { buffer: Buffer }): Promise<{
    storageRef?: string;
    blobForDb?: Buffer;
  }>;

  read(row: {
    storageBackend: string;
    storageRef: string | null;
    contentBlob: Buffer | null;
  }): Promise<Buffer>;

  delete(row: { storageBackend: string; storageRef: string | null }): Promise<void>;
}
