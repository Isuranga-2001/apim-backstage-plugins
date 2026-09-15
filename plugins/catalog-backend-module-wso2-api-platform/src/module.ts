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
  createBackendModule,
  coreServices,
  readSchedulerServiceTaskScheduleDefinitionFromConfig,
} from '@backstage/backend-plugin-api';
import { catalogProcessingExtensionPoint } from '@backstage/plugin-catalog-node';
import { Wso2ApiEntityProvider } from './providers/Wso2ApiEntityProvider';
import { DefinitionDescriptionProcessor } from './lib/apiDescriptionOverride';

export const apiCatalogSyncTrigger = {
  runNow: async (): Promise<void> => {},
};

export const catalogModuleWso2ApiPlatform = createBackendModule({
  pluginId: 'catalog',
  moduleId: 'wso2-apim',
  register(reg) {
    reg.registerInit({
      deps: {
        catalog: catalogProcessingExtensionPoint,
        config: coreServices.rootConfig,
        logger: coreServices.logger,
        scheduler: coreServices.scheduler,
      },
      async init({ catalog, config, logger, scheduler }) {
        logger.info('Initializing WSO2 API Catalog Module');

        // Instantiate the provider using the static factory method
        const provider = Wso2ApiEntityProvider.fromConfig(config, {
          id: 'wso2-publisher-apis',
          logger,
        });

        // Add the provider to the catalog
        catalog.addEntityProvider(provider);
        apiCatalogSyncTrigger.runNow = () => provider.run();

        // Applies definition-derived descriptions to gateway/OpenChoreo API
        // entities, which the discovery response itself never carries.
        catalog.addProcessor(new DefinitionDescriptionProcessor());

        // Schedule the provider to run periodically
        const schedule = scheduler.createScheduledTaskRunner(
          readSchedulerServiceTaskScheduleDefinitionFromConfig(
            config.getConfig('catalog.providers.wso2ApiPlatform.schedule'),
          ),
        );

        // Run the scheduled task
        schedule.run({
          id: provider.getProviderName(),
          fn: async () => {
            await provider.run();
          },
        });

        logger.info('WSO2 API Catalog Module Initialized Successfully');
      },
    });
  },
});

export default catalogModuleWso2ApiPlatform;
