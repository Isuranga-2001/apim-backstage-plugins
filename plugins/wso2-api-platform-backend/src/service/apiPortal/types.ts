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

export type PortalApiEndpoints = {
  productionURL?: string;
  sandboxURL?: string;
};

export type PortalApiOwners = {
  technicalOwner?: string;
  businessOwner?: string;
  technicalOwnerEmail?: string;
  businessOwnerEmail?: string;
};

export type PortalApiMetadataPayload = {
  id: string;
  name: string;
  version: string;
  description?: string;
  type: 'REST';
  status: 'PUBLISHED' | 'DEPRECATED';
  referenceId?: string;
  tags?: string[];
  labels?: string[];
  owners?: PortalApiOwners;
  endPoints?: PortalApiEndpoints;
  subscriptionPlans?: Array<{ id: string }>;
  agentVisibility?: 'VISIBLE' | 'HIDDEN';
};

export type PortalApiMetadataResponse = {
  id: string;
  refId?: string | null;
  name: string;
  version: string;
  status: string;
  description?: string;
  type: string;
  tags?: string[];
  labels?: string[];
  endPoints?: PortalApiEndpoints;
  subscriptionPlans?: Array<{ id: string }>;
};

export type PortalApiForm = {
  metadata: PortalApiMetadataPayload;
  definitionContent: string;
  definitionFileName: string;
};

export type PortalSubscriptionPlan = {
  id: string;
  displayName?: string;
};

export type PortalSubscriptionPlansResponse = {
  list: PortalSubscriptionPlan[];
  count: number;
  pagination: { total: number; limit: number; offset: number };
};

export type PortalApiPublishOverrides = {
  displayName: string;
  productionEndpoint: string;
  sandboxEndpoint?: string;
};

/** The four built-in plan IDs; mirrored in the frontend's `utils/subscriptionPlans.ts`. */
export const DEFAULT_SUBSCRIPTION_PLAN_IDS = [
  'Bronze',
  'Silver',
  'Gold',
  'Unlimited',
];

export type PublishableDocument = { name: string; content: string };

export type SkippedDocument = {
  name: string;
  sourceType: string;
  reason: string;
};

export type PublishResult = {
  portalApiId: string;
  portalUrl: string;
  operation: 'created' | 'updated';
  publishedAt: string;
  documents: { published: number; skipped: SkippedDocument[] };
  warnings: string[];
};

export type PublishCapabilities = {
  publish: boolean;
  reason?: string;
};
