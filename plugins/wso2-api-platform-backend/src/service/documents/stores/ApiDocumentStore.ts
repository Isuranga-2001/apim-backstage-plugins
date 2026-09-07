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
  Actor,
  ApiDocument,
  ApiDocumentCapabilities,
  ApiRef,
  CreateDocumentInput,
  DocumentContentResult,
  UpdateDocumentMetadataInput,
} from '../types';

/**
 * The document provider abstraction. `DatabaseApiDocumentStore` implements
 * it for self-hosted/OpenChoreo gateway APIs (full CRUD); a future
 * `ApimPublisherDocumentStore` write implementation lights up the identical
 * UI for on-prem APIM with no frontend or schema change.
 */
export interface ApiDocumentStore {
  readonly capabilities: ApiDocumentCapabilities;

  list(ref: ApiRef): Promise<ApiDocument[]>;
  get(ref: ApiRef, documentId: string): Promise<ApiDocument>;
  getContent(ref: ApiRef, documentId: string): Promise<DocumentContentResult>;

  create(
    ref: ApiRef,
    input: CreateDocumentInput,
    actor: Actor,
  ): Promise<ApiDocument>;
  updateMetadata(
    ref: ApiRef,
    documentId: string,
    patch: UpdateDocumentMetadataInput,
    actor: Actor,
  ): Promise<ApiDocument>;
  delete(ref: ApiRef, documentId: string, actor: Actor): Promise<void>;
}
