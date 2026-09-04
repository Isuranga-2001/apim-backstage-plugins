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

export type Wso2ApiSummary = {
  id: string;
  name: string;
  version?: string;
  provider?: string;
  context?: string;
  lifeCycleStatus?: string;
  type?: string;
};

export type Wso2ApiDetail = Wso2ApiSummary & {
  description?: string;
  endpointURLs?: Array<{
    environmentName?: string;
    environmentType?: string;
    urls?: string[];
  }>;
};

export type Wso2ApiDocument = {
  id: string;
  name: string;
  summary?: string;
  sourceType?: string;
  sourceUrl?: string;
  documentId?: string;
  type?: string;
  inlineContent?: string;
};

export type Wso2ApiRevision = {
  id: string;
  displayName: string;
  description?: string;
  createdTime?: string;
  deploymentInfo?: Array<{
    name: string;
    type: string;
    deployedTime: string;
  }>;
};

export type Wso2ApiRevisionsResponse = {
  count: number;
  list: Wso2ApiRevision[];
};

export type Wso2ApiPlatformConfig = {
  apiManager: {
    enabled: boolean;
  };
  platformGateway: {
    enabled: boolean;
  };
  baseUrl: string;
  publisherBasePath: string;
  developerBasePath: string;
  serviceCatalogBasePath?: string;
  auth: {
    clientId: string;
    clientSecret: string;
    tokenUrl?: string;
    username?: string;
    password?: string;
  };
  tls: {
    rejectUnauthorized: boolean;
  };
  selfHostedGateways: Array<{
    name: string;
    urls: string[];
    discoveryUrl?: string;
    discoveryAuth?: string;
    environmentType: string;
    description?: string;
    organizationId?: string;
    integration: 'self-hosted' | 'openchoreo';
  }>;
};

export type Wso2HealthStatus = 'Online' | 'Offline';

export type Wso2HealthReport = {
  apim: {
    status: Wso2HealthStatus;
  };
  platform: Array<{
    name: string;
    status: Wso2HealthStatus;
    type: string;
  }>;
  configs: Array<{
    name: string;
    status: Wso2HealthStatus;
  }>;
};
