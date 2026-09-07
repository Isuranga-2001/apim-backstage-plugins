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
import { BinaryStorage } from './BinaryStorage';

/**
 * Default binary backend: the file's bytes are written straight into
 * `wso2_artifact_content.content_blob` as a Buffer — never a base64 string
 * or a string-concatenated value — SQLite and PostgreSQL both return
 * Buffers for their respective blob/BYTEA types, but the bind side differs
 * for large payloads if you build the value any other way.
 */
export class DatabaseBinaryStorage implements BinaryStorage {
  readonly backend = 'database' as const;

  async write(input: { buffer: Buffer }) {
    return { blobForDb: input.buffer };
  }

  async read(row: {
    storageBackend: string;
    storageRef: string | null;
    contentBlob: Buffer | null;
  }): Promise<Buffer> {
    if (!row.contentBlob) {
      throw new InputError('Document has no stored binary content');
    }
    return row.contentBlob;
  }

  async delete(): Promise<void> {
    // No-op: the blob lives in wso2_artifact_content, which ArtifactDao
    // already deletes as part of the transactional document delete.
  }
}
