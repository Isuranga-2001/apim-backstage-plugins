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

import { ConfigReader } from '@backstage/config';
import { mockServices } from '@backstage/backend-test-utils';
import { gatewayStatusTracker } from '@wso2/backstage-plugin-catalog-backend-module-wso2-api-platform';
import { startGatewayStatusWatchdog } from './gatewayStatusWatchdog';

describe('startGatewayStatusWatchdog', () => {
  beforeEach(() => {
    gatewayStatusTracker.reset();
    jest.restoreAllMocks();
  });

  it('does nothing when the schedule config is missing', () => {
    const config = new ConfigReader({});
    const scheduler = { createScheduledTaskRunner: jest.fn() } as any;

    startGatewayStatusWatchdog({
      scheduler,
      config,
      client: { getConfig: () => ({ selfHostedGateways: [] }) } as any,
      logger: mockServices.logger.mock(),
    });

    expect(scheduler.createScheduledTaskRunner).not.toHaveBeenCalled();
  });

  it('marks a gateway stale once its last success is older than the configured frequency', async () => {
    const config = new ConfigReader({
      catalog: {
        providers: {
          wso2ApiPlatform: {
            schedule: {
              frequency: { minutes: 1 },
              timeout: { minutes: 5 },
            },
          },
        },
      },
    });

    let scheduledFn: (() => Promise<void>) | undefined;
    const scheduler = {
      createScheduledTaskRunner: jest.fn().mockReturnValue({
        run: (task: { fn: () => Promise<void> }) => {
          scheduledFn = task.fn;
        },
      }),
    } as any;
    const client = {
      getConfig: () => ({ selfHostedGateways: [{ name: 'gw-1' }] }),
    } as any;

    jest.spyOn(Date, 'now').mockReturnValue(1_000);
    gatewayStatusTracker.recordSuccess('gw-1');

    startGatewayStatusWatchdog({
      scheduler,
      config,
      client,
      logger: mockServices.logger.mock(),
    });
    expect(scheduledFn).toBeDefined();

    (Date.now as jest.Mock).mockReturnValue(1_000 + 30_000);
    await scheduledFn!();
    expect(gatewayStatusTracker.getStatus('gw-1').active).toBe(true);

    (Date.now as jest.Mock).mockReturnValue(1_000 + 61_000);
    await scheduledFn!();
    expect(gatewayStatusTracker.getStatus('gw-1').active).toBe(false);
  });
});
