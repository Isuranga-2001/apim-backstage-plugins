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

import { useMemo, useState } from 'react';
import { InfoCard, WarningPanel, EmptyState } from '@backstage/core-components';
import { useEntity } from '@backstage/plugin-catalog-react';
import { useApi } from '@backstage/core-plugin-api';
import Box from '@material-ui/core/Box';
import Typography from '@material-ui/core/Typography';
import TextField from '@material-ui/core/TextField';
import CircularProgress from '@material-ui/core/CircularProgress';
import LinearProgress from '@material-ui/core/LinearProgress';

import { wso2ApiPlatformApiRef } from '../../../api';
import { useStyles } from './styles';
import { isAsyncType, isMcpEntity, isServiceEntity } from '../../../utils';
import { useApiKeyGenerator } from './hooks/useApiKeyGenerator';
import { useTryOutData } from './hooks/useTryOutData';
import { DisabledTryOutButton } from './components/DisabledTryOutButton';
import { TryOutApiKeyInput } from './components/api-key-generator/TryOutApiKeyInput';

import { SwaggerConsole } from './components/consoles/SwaggerConsole';
import { GraphQLConsole } from './components/consoles/GraphQLConsole';
import { WebSocketConsole } from './components/consoles/WebSocketConsole';
import { WebSubConsole } from './components/consoles/WebSubConsole';
import { SseConsole } from './components/consoles/SseConsole';
import { PlatformGatewayConsole } from './components/consoles/PlatformGatewayConsole';
import { EntityWso2ServiceDefinitionCard } from '../DefinitionTab';

const WSO2_API_ID_ANNOTATION = 'wso2.com/api-id';

const WSO2_GATEWAY_API_ID_ANNOTATION = 'wso2-gateway.com/api-id';

const DISCOVERY_TYPE_ANNOTATION = 'wso2.com/api-discovery-type';

/**
 * A specialized API Definition card for WSO2 APIs that enables Try out
 * and targets the WSO2 Gateway with automatic auth.
 */
const EntityWso2TryOutTabContent = () => {
  const classes = useStyles();
  const { entity } = useEntity();
  const apiClient = useApi(wso2ApiPlatformApiRef);

  const apiId =
    entity.metadata.annotations?.[WSO2_API_ID_ANNOTATION] ||
    entity.metadata.annotations?.[WSO2_GATEWAY_API_ID_ANNOTATION];

  const isApiPlatform =
    !!entity.metadata.annotations?.['wso2.com/platform-gateway-endpoints'];
  const isSelfHostedGateway =
    !!entity.metadata.annotations?.['wso2-gateway.com/api-endpoints'];
  const isApiPlatformGateway =
    entity.metadata.annotations?.[DISCOVERY_TYPE_ANNOTATION] ===
    'api-platform-gateway';

  const isDiscovered =
    entity.metadata.annotations?.['wso2.com/is-discovered'] === 'true';
  const isMcp = isMcpEntity(entity);

  const skipKeyGeneration = isApiPlatform || isSelfHostedGateway || isMcp;

  // 1. Auth Hook
  const {
    apiKeyRef,
    lastUpdated,
    isKeyLoading,
    generateKeyError,
    applyManualKey,
    customKeyName,
    setCustomKeyName,
  } = useApiKeyGenerator({ apiId, isApiPlatform: skipKeyGeneration });

  // 2. Definition Hook
  const {
    details,
    definition,
    isDefinitionLoading,
    hasOperationsOnly,
    gatewayOperations,
    gatewayApiPolicies,
    gatewayUrls,
    isDeployed,
    swaggerSpec,
    isPlaceholder,
    isRevisionsLoading,
    hasLiveOpenApiSpec,
  } = useTryOutData({
    entity,
    apiId,
    isApiPlatform: skipKeyGeneration,
  });

  const apiType = (details?.type || '').toUpperCase();

  const hasSwaggerTab =
    !isMcp && apiType !== 'GRAPHQL' && !isAsyncType(apiType);
  const hasConsoleTab =
    !isMcp &&
    hasOperationsOnly &&
    swaggerSpec &&
    typeof swaggerSpec === 'object' &&
    (swaggerSpec as any).openapi;

  const [manualKeyInput, setManualKeyInput] = useState('');
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [generatedKey, setGeneratedKey] = useState<string | null>(null);
  const [externalApiKey, setExternalApiKey] = useState('');

  const hasApiKeyHeader = useMemo(() => {
    if (!details) return true;

    // Check the official WSO2 securityScheme array if present
    const securityScheme = details.securityScheme;
    if (Array.isArray(securityScheme) && securityScheme.length > 0) {
      return securityScheme.includes('api_key');
    }

    // Fallback to CORS headers
    const headers =
      details.corsConfiguration?.accessControlAllowHeaders ||
      details.accessControlAllowHeaders;
    if (!headers || !Array.isArray(headers)) return true;
    return headers.some(h => h.toLowerCase() === 'apikey');
  }, [details]);

  const hasSubscriptionlessPolicies = useMemo(() => {
    if (!details || !Array.isArray(details.policies)) return false;
    return details.policies.some((p: string) => {
      const lower = p.toLowerCase().trim();
      return (
        lower === 'defaultsubscriptionless' ||
        lower === 'asyncdefaultsubscriptionless'
      );
    });
  }, [details]);

  const apiKeyAuthPolicy = useMemo(() => {
    // Check API level
    const globalOps = Array.isArray(gatewayApiPolicies)
      ? gatewayApiPolicies
      : [];
    const global = globalOps.find((p: any) => p.name === 'api-key-auth');
    if (global) return global;

    // Check operation level
    const localOps = Array.isArray(gatewayOperations) ? gatewayOperations : [];
    for (const op of localOps) {
      const local = (op.policies || []).find(
        (p: any) => p.name === 'api-key-auth',
      );
      if (local) return local;
    }

    // Fallback for subscriptionless API with an API key header
    if (hasSubscriptionlessPolicies && hasApiKeyHeader) {
      return { name: 'API Key', params: { in: 'header', key: 'ApiKey' } };
    }

    return null;
  }, [
    gatewayApiPolicies,
    gatewayOperations,
    hasSubscriptionlessPolicies,
    hasApiKeyHeader,
  ]);

  const tryOutPlugin = useMemo(() => {
    const type = (details?.type || '').toUpperCase();
    const isAsync = isAsyncType(type);

    const isWso2Api = !isDiscovered && !skipKeyGeneration;
    const hasRequiredWso2Auth =
      hasSubscriptionlessPolicies && Boolean(apiKeyAuthPolicy);

    const canTry =
      isDeployed &&
      (!isWso2Api || hasRequiredWso2Auth) &&
      (!isDiscovered || skipKeyGeneration);
    if (canTry) return {};

    let message = 'Try out is not available for this API';
    if (isAsync) message = 'Try out is not supported for Async APIs';
    else if (isDiscovered && !skipKeyGeneration)
      message = 'Try out is not enabled for discovered APIs';
    else if (!isDeployed) message = 'API is not deployed to any gateway';
    else if (isWso2Api && hasSubscriptionlessPolicies && !apiKeyAuthPolicy)
      message =
        'Try out is only supported for APIs with API key authentication enabled';

    return {
      components: {
        TryItOutButton: () => <DisabledTryOutButton message={message} />,
      },
    };
  }, [
    isDeployed,
    details,
    isDiscovered,
    hasSubscriptionlessPolicies,
    apiKeyAuthPolicy,
    skipKeyGeneration,
  ]);

  if (!apiId) return null;

  const isLoading = isDefinitionLoading;

  const renderAuthSection = (padding = '20px') => (
    <Box style={{ paddingLeft: padding, paddingRight: padding }}>
      {isDeployed &&
        !isDiscovered &&
        !skipKeyGeneration &&
        hasSubscriptionlessPolicies &&
        hasApiKeyHeader && (
          <TryOutApiKeyInput
            manualKeyInput={manualKeyInput}
            setManualKeyInput={setManualKeyInput}
            applyManualKey={applyManualKey}
            isModalOpen={isModalOpen}
            setIsModalOpen={setIsModalOpen}
            customKeyName={customKeyName}
            setCustomKeyName={setCustomKeyName}
            generatedKey={generatedKey}
            setGeneratedKey={setGeneratedKey}
            apiClient={apiClient}
            apiId={apiId!}
            isKeyLoading={isKeyLoading}
          />
        )}
      {isApiPlatformGateway && isDeployed && apiKeyAuthPolicy && (
        <Box display="flex" justifyContent="center" width="100%" my={2}>
          <TextField
            label={
              apiKeyAuthPolicy.params?.key
                ? `API Key (${apiKeyAuthPolicy.params.key})`
                : 'API Key'
            }
            placeholder="Paste your API key here..."
            value={externalApiKey}
            onChange={e => setExternalApiKey(e.target.value)}
            variant="outlined"
            size="small"
            style={{ width: '400px' }}
          />
        </Box>
      )}
    </Box>
  );

  const renderTryItOutSection = () => {
    if (isApiPlatformGateway && hasLiveOpenApiSpec) {
      return (
        <div className={classes.root}>
          {renderAuthSection()}
          <Box p={2}>
            <SwaggerConsole
              key={`swagger-console-openchoreo-${isDeployed}`}
              swaggerSpec={swaggerSpec}
              tryOutPlugin={tryOutPlugin}
              apiKeyRef={apiKeyRef}
              externalApiKey={externalApiKey}
              apiKeyAuthPolicy={apiKeyAuthPolicy}
              details={details}
            />
          </Box>
        </div>
      );
    }

    if (isApiPlatform || isSelfHostedGateway) {
      return (
        <div className={classes.root}>
          {renderAuthSection('8px')}
          <PlatformGatewayConsole
            operations={gatewayOperations}
            gatewayUrls={gatewayUrls}
            apiKey={apiKeyRef.current}
            externalApiKey={externalApiKey}
            apiKeyAuthPolicy={apiKeyAuthPolicy}
          />
        </div>
      );
    }

    if (apiType === 'GRAPHQL') {
      return (
        <div className={classes.root}>
          {renderAuthSection('8px')}
          <GraphQLConsole
            definition={definition}
            gatewayUrls={gatewayUrls}
            apiKeyRef={apiKeyRef}
            externalApiKey={externalApiKey}
            apiKeyAuthPolicy={apiKeyAuthPolicy}
            isDeployed={isDeployed}
            details={details}
          />
        </div>
      );
    }

    if (apiType === 'WS') {
      return (
        <div className={classes.root}>
          {renderAuthSection('8px')}
          <WebSocketConsole
            operations={gatewayOperations}
            gatewayUrls={gatewayUrls}
            apiKeyRef={apiKeyRef}
            externalApiKey={externalApiKey}
            apiKeyAuthPolicy={apiKeyAuthPolicy}
            isDeployed={isDeployed}
            details={details}
          />
        </div>
      );
    }

    if (apiType === 'WEBSUB') {
      return (
        <div className={classes.root}>
          {renderAuthSection('8px')}
          <WebSubConsole
            operations={gatewayOperations}
            gatewayUrls={gatewayUrls}
            apiKeyRef={apiKeyRef}
            externalApiKey={externalApiKey}
            apiKeyAuthPolicy={apiKeyAuthPolicy}
            isDeployed={isDeployed}
            details={details}
          />
        </div>
      );
    }

    if (apiType === 'SSE') {
      return (
        <div className={classes.root}>
          {renderAuthSection('8px')}
          <SseConsole
            operations={gatewayOperations}
            gatewayUrls={gatewayUrls}
            apiKeyRef={apiKeyRef}
            externalApiKey={externalApiKey}
            apiKeyAuthPolicy={apiKeyAuthPolicy}
            isDeployed={isDeployed}
            details={details}
          />
        </div>
      );
    }

    if (hasSwaggerTab || hasConsoleTab) {
      return (
        <div className={classes.root}>
          {renderAuthSection()}
          <Box p={2}>
            <SwaggerConsole
              key={`swagger-console-${lastUpdated}-${isDeployed}`}
              swaggerSpec={swaggerSpec}
              tryOutPlugin={tryOutPlugin}
              apiKeyRef={apiKeyRef}
              externalApiKey={externalApiKey}
              apiKeyAuthPolicy={apiKeyAuthPolicy}
              details={details}
            />
          </Box>
        </div>
      );
    }

    return (
      <EmptyState
        title="Try Out Unavailable"
        missing="info"
        description="Try out is not available for this API."
      />
    );
  };

  return (
    <InfoCard>
      {isDiscovered && (
        <Box
          mb={2}
          px={1}
          py={0.5}
          display="inline-flex"
          bgcolor="#e6f7ff"
          border={1}
          borderColor="#91d5ff"
          borderRadius={4}
        >
          <Typography
            variant="caption"
            style={{
              color: '#0050b3',
              fontWeight: 'bold',
              textTransform: 'uppercase',
            }}
          >
            Discovered API
          </Typography>
        </Box>
      )}

      {/* Progressive loading bar for background API requests */}
      {!isLoading && !isPlaceholder && isRevisionsLoading && (
        <Box
          style={{
            position: 'relative',
            marginTop: '-8px',
            marginBottom: '8px',
          }}
        >
          <LinearProgress style={{ height: 2 }} color="primary" />
        </Box>
      )}

      {(isLoading || isPlaceholder) && (
        <Box
          display="flex"
          justifyContent="center"
          alignItems="center"
          height={200}
          flexDirection="column"
        >
          <CircularProgress
            size={40}
            thickness={4}
            style={{ color: '#ff5000' }}
          />
          <Box mt={2}>
            <Typography variant="body2" color="textSecondary">
              {isPlaceholder
                ? 'Syncing with WSO2 Gateway...'
                : 'Loading API Definition...'}
            </Typography>
          </Box>
        </Box>
      )}

      {!isLoading && !isPlaceholder && definition === null && !isMcp && (
        <EmptyState
          title="No Definition"
          missing="info"
          description="This API does not have a definition available in the catalog."
        />
      )}

      {(definition || isMcp) && !isPlaceholder && (
        <>
          {/* Gateway Error for 'Try out' - Only for non-discovered APIs */}
          {!isDiscovered && generateKeyError && (
            <Box mb={2}>
              <WarningPanel
                title="Gateway Access Failed"
                message="Failed to generate a temporary access key for the WSO2 Gateway. Please try refreshing the page or checking your connectivity."
              />
            </Box>
          )}

          {renderTryItOutSection()}
        </>
      )}
    </InfoCard>
  );
};

export const EntityWso2TryOutTab = () => {
  const { entity } = useEntity();

  if (isServiceEntity(entity)) {
    return <EntityWso2ServiceDefinitionCard />;
  }

  return <EntityWso2TryOutTabContent />;
};
