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

import express from 'express';
import { HttpAuthService, LoggerService } from '@backstage/backend-plugin-api';
import type { CatalogService } from '@backstage/plugin-catalog-node';
import { Wso2ApiPlatformClient } from '../client';
import { DocumentStorageConfig } from '../documents/config';
import { ApiDocumentStoreResolver } from '../documents/stores/ApiDocumentStoreResolver';

export type EnsureAuthenticated = (
  req: express.Request,
) => Promise<string | undefined>;

export type RouteContext = {
  client: Wso2ApiPlatformClient;
  ensureAuthenticated: EnsureAuthenticated;
  logger: LoggerService;
  // Present only once the router has database + catalog support wired up
  // (see router.ts); registerDocumentRoutes no-ops without them so older
  // test doubles that build a bare RouteContext keep working unmodified.
  storeResolver?: ApiDocumentStoreResolver;
  httpAuth?: HttpAuthService;
  catalog?: CatalogService;
  documentStorage?: DocumentStorageConfig;
};
