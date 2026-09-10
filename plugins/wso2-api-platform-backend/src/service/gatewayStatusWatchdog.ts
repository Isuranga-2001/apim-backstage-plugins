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
  LoggerService,
  RootConfigService,
  SchedulerService,
  readSchedulerServiceTaskScheduleDefinitionFromConfig,
} from '@backstage/backend-plugin-api';
import { gatewayStatusTracker } from '@wso2/backstage-plugin-catalog-backend-module-wso2-api-platform';
import { Wso2ApiPlatformClient } from './client';

const SCHEDULE_CONFIG_KEY = 'catalog.providers.wso2ApiPlatform.schedule';
const DEFAULT_MAX_AGE_MS = 2 * 60 * 1000;
const WATCHDOG_TASK_ID = 'wso2-gateway-status-watchdog';

type HumanDurationLike = {
  years?: number;
  months?: number;
  weeks?: number;
  days?: number;
  hours?: number;
  minutes?: number;
  seconds?: number;
  milliseconds?: number;
};

function isHumanDuration(value: unknown): value is HumanDurationLike {
  return (
    typeof value === 'object' &&
    value !== null &&
    !('cron' in value) &&
    !('trigger' in value)
  );
}

/** Converts a human duration to milliseconds; returns `undefined` for a cron/manual schedule (no fixed duration to convert). */
function humanDurationToMs(value: unknown): number | undefined {
  if (!isHumanDuration(value)) {
    return undefined;
  }
  const {
    years = 0,
    months = 0,
    weeks = 0,
    days = 0,
    hours = 0,
    minutes = 0,
    seconds = 0,
    milliseconds = 0,
  } = value;
  const daysTotal = years * 365 + months * 30 + weeks * 7 + days;
  return (
    ((daysTotal * 24 + hours) * 60 + minutes) * 60 * 1000 +
    seconds * 1000 +
    milliseconds
  );
}

/**
 * A gateway is considered stale once it's gone longer than `frequency + timeout` without a successful sync
 */
function maxAgeMsFromSchedule(scheduleDefinition: {
  frequency: unknown;
  timeout: unknown;
}): number {
  const frequencyMs = humanDurationToMs(scheduleDefinition.frequency);
  const timeoutMs = humanDurationToMs(scheduleDefinition.timeout);
  if (frequencyMs === undefined) {
    return DEFAULT_MAX_AGE_MS;
  }
  return frequencyMs + (timeoutMs ?? 0);
}

/** Starts the gateway status watchdog. */
export function startGatewayStatusWatchdog(options: {
  scheduler: SchedulerService;
  config: RootConfigService;
  client: Wso2ApiPlatformClient;
  logger: LoggerService;
}): void {
  const { scheduler, config, client, logger } = options;

  if (!config.has(SCHEDULE_CONFIG_KEY)) {
    logger.warn(
      `[GatewayStatusWatchdog] '${SCHEDULE_CONFIG_KEY}' is not configured; gateway status will not be tracked.`,
    );
    return;
  }

  const scheduleDefinition =
    readSchedulerServiceTaskScheduleDefinitionFromConfig(
      config.getConfig(SCHEDULE_CONFIG_KEY),
    );
  const maxAgeMs = maxAgeMsFromSchedule(scheduleDefinition);

  const schedule = scheduler.createScheduledTaskRunner(scheduleDefinition);
  schedule.run({
    id: WATCHDOG_TASK_ID,
    fn: async () => {
      for (const gw of client.getConfig().selfHostedGateways) {
        gatewayStatusTracker.markStaleIfNeeded(gw.name, maxAgeMs);
      }
    },
  });

  logger.info(
    `[GatewayStatusWatchdog] Started (maxAge=${maxAgeMs}ms) using schedule from '${SCHEDULE_CONFIG_KEY}'.`,
  );
}
