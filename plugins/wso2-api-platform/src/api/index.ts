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

import { createApiRef } from '@backstage/core-plugin-api';
import { Wso2ApiPlatformApi } from './types';

export const wso2ApiPlatformApiRef = createApiRef<Wso2ApiPlatformApi>({
  id: 'plugin.wso2-api-platform.service',
});

export { Wso2ApiPlatformClient } from './client';
export type {
  Wso2ApiSummary,
  Wso2GatewayInfo,
  Wso2ApiProductSummary,
  Wso2McpSummary,
  Wso2ApiDetail,
  Wso2ApiProductDetail,
  Wso2McpDetail,
  Wso2ApiProductResource,
  Wso2ApiProductOperation,
  Wso2ApiDocument,
  Wso2ApiDocumentType,
  Wso2ApiDocumentSourceType,
  Wso2ApiDocumentCapabilities,
  Wso2ApiDocumentListResponse,
  CreateWso2ApiDocumentRequest,
  UpdateWso2ApiDocumentMetadataRequest,
  Wso2ApiDefinitionFormat,
  Wso2ApiDefinition,
  Wso2ApiDefinitionCapabilities,
  Wso2ApiDefinitionResponse,
  UpsertWso2ApiDefinitionRequest,
  Wso2ApiRevision,
  Wso2ApiRevisionsResponse,
  Wso2McpTool,
} from './types';
