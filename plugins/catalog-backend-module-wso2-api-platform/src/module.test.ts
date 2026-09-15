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

import { catalogModuleWso2ApiPlatform, apiCatalogSyncTrigger } from './module';
import { mockServices } from '@backstage/backend-test-utils';
import { Wso2ApiEntityProvider } from './providers/Wso2ApiEntityProvider';

jest.mock('./providers/Wso2ApiEntityProvider', () => ({
  Wso2ApiEntityProvider: {
    fromConfig: jest.fn(),
  },
}));

describe('catalogModuleWso2ApiPlatform', () => {
  const formatTestCaseDoc = (details: string) => {
    return `\n================================================================================\nTEST CASE: ${
      expect.getState().currentTestName
    }\n================================================================================\n${details.trim()}\n================================================================================\n`;
  };

  const addEntityProvider = jest.fn();
  const addProcessor = jest.fn();
  const mockProvider = {
    getProviderName: jest.fn().mockReturnValue('wso2-publisher-apis'),
    run: jest.fn().mockResolvedValue(undefined),
  };

  beforeEach(() => {
    jest.clearAllMocks();
    (Wso2ApiEntityProvider.fromConfig as jest.Mock).mockReturnValue(
      mockProvider,
    );
  });

  it('should register provider at catalog processing extension point and start schedule task runner with defaults', async () => {
    const runMock = jest.fn();
    const createScheduledTaskRunnerMock = jest
      .fn()
      .mockReturnValue({ run: runMock });
    const schedulerMock = mockServices.scheduler.mock({
      createScheduledTaskRunner: createScheduledTaskRunnerMock,
    });

    const config = mockServices.rootConfig({
      data: {
        backend: {
          listen: {
            host: '127.0.0.1',
            port: 0,
          },
        },
        catalog: {
          providers: {
            wso2ApiPlatform: {
              baseUrl: 'https://apim.wso2.com',
              schedule: {
                frequency: 'PT30M',
                timeout: 'PT5M',
                initialDelay: 'PT5S',
              },
            },
          },
        },
        wso2ApiPlatform: {
          auth: { clientId: 'id', clientSecret: 'secret' },
          publisherBasePath: '/api/am/publisher/v3',
        },
      },
    });

    const [registration] = (
      catalogModuleWso2ApiPlatform as any
    ).getRegistrations();
    await registration.init.func({
      catalog: { addEntityProvider, addProcessor },
      config,
      logger: mockServices.logger.mock(),
      scheduler: schedulerMock,
    });

    expect(Wso2ApiEntityProvider.fromConfig).toHaveBeenCalledTimes(1);
    expect(addEntityProvider).toHaveBeenCalledWith(mockProvider);
    expect(addProcessor).toHaveBeenCalledWith(
      expect.objectContaining({ getProcessorName: expect.any(Function) }),
    );
    expect(createScheduledTaskRunnerMock).toHaveBeenCalledWith(
      expect.objectContaining({
        frequency: expect.objectContaining({ minutes: 30 }),
        timeout: expect.objectContaining({ minutes: 5 }),
        initialDelay: expect.objectContaining({ seconds: 5 }),
      }),
    );
    expect(runMock).toHaveBeenCalledWith(
      expect.objectContaining({
        id: 'wso2-publisher-apis',
        fn: expect.any(Function),
      }),
    );
    expect(mockProvider.run).not.toHaveBeenCalled();

    // Call the run function to verify it calls provider.run()
    const taskFn = runMock.mock.calls[0][0].fn;
    await taskFn();
    expect(mockProvider.run).toHaveBeenCalledTimes(1);

    await apiCatalogSyncTrigger.runNow();
    expect(mockProvider.run).toHaveBeenCalledTimes(2);

    console.log(
      formatTestCaseDoc(`
=== [Backend Catalog Module: APIM Integration with Schedule] ===
Wiring:
  - Provider Name: "${mockProvider.getProviderName()}"
  - Extension point: Registered successfully
  - Task Runner Schedule:
      Frequency: 30 minutes
      Timeout: 5 minutes
      Initial Delay: 5 seconds
`),
    );
  });
});
