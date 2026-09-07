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
import Router from 'express-promise-router';
import {
  AuthService,
  DatabaseService,
  HttpAuthService,
  LoggerService,
  RootConfigService,
} from '@backstage/backend-plugin-api';
import type { CatalogService } from '@backstage/plugin-catalog-node';

import { Wso2ApiPlatformClient, readWso2ApiPlatformConfig } from './client';
import { registerApiRoutes } from './routes/apiRoutes';
import { registerConfigRoutes } from './routes/configRoutes';
import { registerStreamingRoutes } from './routes/streamingRoutes';
import { registerGatewayRoutes } from './routes/gatewayRoutes';
import { registerDocumentRoutes } from './routes/documentRoutes';
import { RouteContext } from './routes/types';
import {
  deriveJsonBodyLimitBytes,
  readDocumentStorageConfig,
} from './documents/config';
import { ArtifactDao } from './documents/dao/ArtifactDao';
import { applyDatabaseMigrations } from './documents/dao/migrations';
import { DatabaseBinaryStorage } from './documents/storage/DatabaseBinaryStorage';
import { ApiDocumentStoreResolver } from './documents/stores/ApiDocumentStoreResolver';
import { ApimPublisherDocumentStore } from './documents/stores/ApimPublisherDocumentStore';
import { DatabaseApiDocumentStore } from './documents/stores/DatabaseApiDocumentStore';

export interface RouterOptions {
  auth?: AuthService;
  catalog?: CatalogService;
  database?: DatabaseService;
  logger: LoggerService;
  httpAuth: HttpAuthService;
  config: RootConfigService;
}

export async function createRouter(
  options: RouterOptions,
): Promise<express.Router> {
  const { logger, httpAuth, catalog, database, config } = options;
  const wso2Config = readWso2ApiPlatformConfig(config);
  const client = new Wso2ApiPlatformClient({
    config: wso2Config,
    rawConfig: config,
    logger,
  });
  const documentStorage = readDocumentStorageConfig(config);

  async function ensureAuthenticated(
    req: express.Request,
  ): Promise<string | undefined> {
    await httpAuth.credentials(req, { allow: ['user'] });

    return req.headers['x-wso2-access-token'] as string | undefined;
  }

  const router = Router();
  router.use(
    express.json({ limit: deriveJsonBodyLimitBytes(documentStorage) }),
  );

  const routeContext: RouteContext = {
    client,
    ensureAuthenticated,
    logger,
  };

  registerConfigRoutes(router, routeContext);
  registerApiRoutes(router, routeContext);
  registerStreamingRoutes(router, routeContext);
  registerGatewayRoutes(router, routeContext);

  // Document storage is only wired up once both a database and a catalog
  // client are available — both are optional on RouterOptions for backward
  // compatibility with existing test doubles.
  if (database && catalog) {
    const knex = await database.getClient();
    if (!database.migrations?.skip) {
      await applyDatabaseMigrations(knex);
    }

    const dao = new ArtifactDao(knex);
    const binaryStorage = new DatabaseBinaryStorage();
    const databaseStore = new DatabaseApiDocumentStore(dao, binaryStorage);
    const apimStore = new ApimPublisherDocumentStore(client);
    const storeResolver = new ApiDocumentStoreResolver(
      catalog,
      databaseStore,
      apimStore,
    );

    registerDocumentRoutes(router, {
      ...routeContext,
      storeResolver,
      httpAuth,
      catalog,
      documentStorage,
    });
  } else {
    logger.warn(
      'WSO2 API Platform document storage routes are disabled: database and/or catalog service not provided to createRouter',
    );
  }

  logger.info('WSO2 API Manager backend router initialized');
  return router;
}
