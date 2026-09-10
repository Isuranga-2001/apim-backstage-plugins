import { CompoundEntityRef } from '@backstage/catalog-model';

export type Wso2GatewayInfo = {
  name?: string;
  displayName?: string;
  gatewayType: string;
};

export type Wso2ApiSummary = {
  id: string;
  name: string;
  displayName?: string;
  entityName?: string;
  namespace?: string;
  version?: string;
  provider?: string;
  context?: string;
  lifeCycleStatus?: string;
  type?: string;
  isDiscovered?: boolean;
  source?: string;
  gateways?: Wso2GatewayInfo[];
};
export type Wso2ApiProductSummary = {
  id: string;
  name: string;
  displayName?: string;
  entityName?: string;
  namespace?: string;
  version?: string;
  provider?: string;
  context?: string;
  lifeCycleStatus?: string;
  type?: string;
  isDiscovered?: boolean;
  gateways?: Wso2GatewayInfo[];
};

export type Wso2ApiProductOperation = {
  target: string;
  verb: string;
};

export type Wso2ApiProductResource = {
  apiId: string;
  name: string;
  version: string;
  operations: Wso2ApiProductOperation[];
};

export type Wso2ApiProductDetail = Wso2ApiProductSummary & {
  description?: string;
  apis: Wso2ApiProductResource[];
};

export type Wso2McpTool = {
  name: string;
  description?: string;
  authType?: string;
  throttlingPolicy?: string;
  schemaDefinition?: string;
  backendOperation?: {
    target?: string;
    verb?: string;
  };
  version?: string;
};

export type Wso2McpSummary = {
  id: string;
  name: string;
  namespace?: string;
  version?: string;
  provider?: string;
  context?: string;
  lifeCycleStatus?: string;
  lifecycleStatus?: string;
  lifecycleState?: string;
  description?: string;
  throttlingPolicy?: string;
  transport?: string[];
  visibility?: string;
  policies?: string[];
  securityScheme?: string[];
  maxTps?: number;
  authorizationHeader?: string;
  apiKeyHeader?: string;
  gateways?: Wso2GatewayInfo[];
};

export type Wso2McpDetail = Wso2McpSummary & {
  description?: string;
};

export type Wso2ApiDetail = Wso2ApiSummary & {
  description?: string;
  endpointURLs?: Array<{
    environmentName?: string;
    environmentType?: string;
    urls?: string[];
  }>;
  businessInformation?: {
    businessOwner?: string;
    businessOwnerEmail?: string;
    technicalOwner?: string;
    technicalOwnerEmail?: string;
  };
  apiThrottlingPolicy?: string;
  visibility?: string;
  transport?: string[];
  apiPolicies?: {
    request?: any[];
    response?: any[];
    fault?: any[];
  };
  operations?: any[];
  accessControlAllowHeaders?: string[];
  corsConfiguration?: {
    corsConfigurationEnabled?: boolean;
    accessControlAllowOrigins?: string[];
    accessControlAllowCredentials?: boolean;
    accessControlAllowHeaders?: string[];
    accessControlAllowMethods?: string[];
  };
  policies?: string[];
  securityScheme?: string[];
  apiKeyHeader?: string;
  authorizationHeader?: string;
};

export type Wso2ApiDocumentType =
  | 'HOWTO'
  | 'SAMPLES'
  | 'PUBLIC_FORUM'
  | 'SUPPORT_FORUM'
  | 'API_MESSAGE_FORMAT'
  | 'OTHER'
  | 'SWAGGER_DOC';
export type Wso2ApiDocumentSourceType = 'INLINE' | 'URL' | 'FILE' | 'MARKDOWN';

// Widened for the plugin-owned document store (self-hosted/OpenChoreo
// gateway APIs): every added field is optional so the on-prem
// annotation-parsing path (useDocuments.ts) keeps type-checking unchanged.
export type Wso2ApiDocument = {
  id: string;
  name: string;
  summary?: string;
  sourceType?: Wso2ApiDocumentSourceType;
  sourceUrl?: string;
  documentId?: string;
  type?: Wso2ApiDocumentType;
  otherTypeName?: string;
  fileName?: string;
  mimeType?: string;
  sizeBytes?: number;
  createdBy?: string;
  createdTime?: string;
  lastUpdatedBy?: string;
  lastUpdatedTime?: string;
};

export type Wso2ApiDocumentCapabilities = {
  read: boolean;
  create: boolean;
  updateMetadata: boolean;
  updateContent: boolean;
  delete: boolean;
};

export type Wso2ApiDocumentListResponse = {
  count: number;
  list: Wso2ApiDocument[];
  capabilities: Wso2ApiDocumentCapabilities;
};

export type CreateWso2ApiDocumentRequest = {
  name: string;
  type: Wso2ApiDocumentType;
  otherTypeName?: string;
  summary?: string;
  sourceType: Wso2ApiDocumentSourceType;
  sourceUrl?: string;
  inlineContent?: string;
  file?: File;
};

export type UpdateWso2ApiDocumentMetadataRequest = {
  name?: string;
  type?: Wso2ApiDocumentType;
  otherTypeName?: string;
  summary?: string;
  /** only honoured when the stored document's sourceType is URL */
  sourceUrl?: string;
};
export type Wso2ApiDefinitionFormat = 'YAML' | 'JSON';

export type Wso2ApiDefinition = {
  content: string;
  format: Wso2ApiDefinitionFormat;
  fileName?: string;
  sizeBytes?: number;
  createdBy?: string;
  createdTime?: string;
  lastUpdatedBy?: string;
  lastUpdatedTime?: string;
};

export type Wso2ApiDefinitionCapabilities = {
  read: boolean;
  write: boolean;
};

export type Wso2ApiDefinitionResponse = {
  definition: Wso2ApiDefinition | null;
  capabilities: Wso2ApiDefinitionCapabilities;
};

export type UpsertWso2ApiDefinitionRequest = {
  fileName: string;
  content: string;
};

export type Wso2RestApiArtifactDiff = {
  displayNameChange?: { from: string; to: string };
  versionChange?: { from: string; to: string };
  addedOperations: Array<{ method: string; path: string }>;
  removedOperations: Array<{ method: string; path: string }>;
  hasChanges: boolean;
};

export type Wso2DefinitionDiffResponse = {
  diff: Wso2RestApiArtifactDiff | null;
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

export type Wso2ApiPlatformRuntimeConfig = {
  apiManager: {
    enabled: boolean;
  };
  platformGateway: {
    enabled: boolean;
    gatewayCount: number;
  };
};

export type Wso2GenerateApiKeyOptions = {
  keyName?: string;
  keyType?: string;
  validityPeriod?: number;
  additionalProperties?: {
    permittedIP?: string;
    permittedReferer?: string;
  };
};

export interface Wso2ApiPlatformApi {
  generateApiKey(
    apiId: string,
    options?: Wso2GenerateApiKeyOptions,
  ): Promise<any>;
  getRevisions(
    apiId: string,
    options?: { query?: string; token?: string },
  ): Promise<Wso2ApiRevisionsResponse>;
  getGateways(token?: string): Promise<any[]>;
  getRuntimeConfig(token?: string): Promise<Wso2ApiPlatformRuntimeConfig>;
  getApiWsdl(apiId: string, token?: string): Promise<Blob>;
  listDocuments(
    entityRef: CompoundEntityRef,
  ): Promise<Wso2ApiDocumentListResponse>;
  getDocument(
    entityRef: CompoundEntityRef,
    documentId: string,
  ): Promise<Wso2ApiDocument>;
  createDocument(
    entityRef: CompoundEntityRef,
    input: CreateWso2ApiDocumentRequest,
  ): Promise<Wso2ApiDocument>;
  updateDocumentMetadata(
    entityRef: CompoundEntityRef,
    documentId: string,
    patch: UpdateWso2ApiDocumentMetadataRequest,
  ): Promise<Wso2ApiDocument>;
  deleteDocument(
    entityRef: CompoundEntityRef,
    documentId: string,
  ): Promise<void>;
  getDocumentContentUrl(
    entityRef: CompoundEntityRef,
    documentId: string,
  ): Promise<string>;
  getDefinition(
    entityRef: CompoundEntityRef,
  ): Promise<Wso2ApiDefinitionResponse>;
  upsertDefinition(
    entityRef: CompoundEntityRef,
    input: UpsertWso2ApiDefinitionRequest,
  ): Promise<Wso2ApiDefinitionResponse>;
  previewDefinitionDiff(
    entityRef: CompoundEntityRef,
    content: string,
  ): Promise<Wso2DefinitionDiffResponse>;
}
