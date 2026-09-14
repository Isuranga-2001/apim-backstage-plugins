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

import { useState } from 'react';
import { InfoCard, EmptyState } from '@backstage/core-components';
import { useEntity } from '@backstage/plugin-catalog-react';
import Box from '@material-ui/core/Box';
import CircularProgress from '@material-ui/core/CircularProgress';
import LinearProgress from '@material-ui/core/LinearProgress';
import Typography from '@material-ui/core/Typography';

import { isMcpEntity, isServiceEntity } from '../../../utils';
import { useWso2ApiPolicies } from './hooks/useApiPolicies';
import { usePolicyAccessMode } from './hooks/usePolicyAccessMode';
import { usePolicyEditorModel } from './hooks/usePolicyEditorModel';
import { usePolicyArtifact } from './hooks/usePolicyArtifact';
import { usePolicyMutations } from './hooks/usePolicyMutations';
import { Wso2PublisherPoliciesList } from './components/PublisherPoliciesList';
import { PolicyEditorView } from './components/PolicyEditor';
import { EntityWso2ServiceDefinitionCard } from '../DefinitionTab';

const WSO2_API_ID_ANNOTATION = 'wso2.com/api-id';
const WSO2_GATEWAY_API_ID_ANNOTATION = 'wso2-gateway.com/api-id';

export const EntityWso2ApiPoliciesTab = (): React.JSX.Element | null => {
  const { entity } = useEntity();

  const apiId =
    entity.metadata.annotations?.[WSO2_API_ID_ANNOTATION] ||
    entity.metadata.annotations?.[WSO2_GATEWAY_API_ID_ANNOTATION];

  const isApiPlatform =
    !!entity.metadata.annotations?.['wso2.com/platform-gateway-endpoints'];
  const isSelfHostedGateway =
    !!entity.metadata.annotations?.['wso2-gateway.com/api-endpoints'];

  const isDiscovered =
    entity.metadata.annotations?.['wso2.com/is-discovered'] === 'true';
  const isMcp = isMcpEntity(entity);
  const isService = isServiceEntity(entity);

  const apiType = String(
    entity.metadata.annotations?.['wso2.com/api-type'] ||
      entity.spec?.type ||
      '',
  ).toUpperCase();

  const skipKeyGeneration = isApiPlatform || isSelfHostedGateway || isMcp;

  const { mode, editingDisabledReason } = usePolicyAccessMode(entity);

  const {
    details,
    definition,
    isDefinitionLoading,
    gatewayOperations,
    gatewayApiPolicies,
    isPlaceholder,
    isRevisionsLoading,
  } = useWso2ApiPolicies({
    entity,
    apiId,
    isApiPlatform: skipKeyGeneration,
    skip: isService,
  });

  const {
    artifact: liveArtifact,
    loading: isArtifactLoading,
    error: artifactError,
    refresh: refreshArtifact,
  } = usePolicyArtifact(entity, {
    skip: mode !== 'editable' || !apiId || isService,
  });

  const {
    submitting,
    previewing,
    snackbar,
    closeSnackbar,
    upsertPolicies,
    previewDiff,
  } = usePolicyMutations(entity);

  const [artifactVersion, setArtifactVersion] = useState(0);

  const { initialModel } = usePolicyEditorModel(
    mode === 'editable'
      ? {
          gatewayApiPolicies: liveArtifact?.apiPolicies,
          gatewayOperations: liveArtifact?.operations,
        }
      : { details, gatewayOperations, gatewayApiPolicies },
  );

  if (isService) {
    return <EntityWso2ServiceDefinitionCard />;
  }

  if (!apiId) {
    return null;
  }

  const isPublisherApi = !skipKeyGeneration;
  const isEditable = mode === 'editable';

  const hasPolicyDetails = isEditable
    ? Boolean(
        liveArtifact?.apiPolicies &&
          (Array.isArray(liveArtifact.apiPolicies)
            ? liveArtifact.apiPolicies.length > 0
            : Object.keys(liveArtifact.apiPolicies as object).length > 0),
      )
    : Boolean(details?.apiPolicies);
  const hasOperationPolicies = isEditable
    ? Boolean(liveArtifact?.operations && liveArtifact.operations.length > 0)
    : Boolean(
        (details?.operations && details.operations.length > 0) ||
          (gatewayOperations && gatewayOperations.length > 0),
      );
  const hasGatewayApiPolicies =
    !isEditable &&
    Boolean(
      gatewayApiPolicies &&
        ((gatewayApiPolicies as any).request?.length > 0 ||
          (gatewayApiPolicies as any).response?.length > 0 ||
          (gatewayApiPolicies as any).fault?.length > 0),
    );
  const showPublisherPoliciesTab = isEditable
    ? !isMcp && Boolean(liveArtifact)
    : !isMcp &&
      (isPublisherApi || skipKeyGeneration) &&
      (hasPolicyDetails || hasOperationPolicies || hasGatewayApiPolicies);

  const isLoading =
    isDefinitionLoading || (mode === 'editable' && isArtifactLoading);

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
                : 'Loading Policies...'}
            </Typography>
          </Box>
        </Box>
      )}

      {!isLoading &&
        !isPlaceholder &&
        !isEditable &&
        definition === null &&
        !isMcp && (
          <EmptyState
            title="No Definition"
            missing="info"
            description="This API does not have a definition available in the catalog."
          />
        )}

      {isEditable && artifactError && !isLoading && (
        <EmptyState
          title="Failed to load policies"
          missing="data"
          description={artifactError.message}
        />
      )}

      {((isEditable ? Boolean(liveArtifact) : Boolean(definition)) || isMcp) &&
        !isPlaceholder &&
        !(isEditable && artifactError) && (
          <>
            {showPublisherPoliciesTab ? (
              isEditable ? (
                <PolicyEditorView
                  key={artifactVersion}
                  apiType={apiType}
                  initialModel={initialModel}
                  editingDisabledReason={editingDisabledReason}
                  onPreviewDiff={artifact => previewDiff(artifact)}
                  onSaveClick={async artifact => {
                    await upsertPolicies(artifact);
                    await refreshArtifact();
                    setArtifactVersion(v => v + 1);
                  }}
                  submitting={submitting}
                  previewing={previewing}
                  snackbar={snackbar}
                  onCloseSnackbar={closeSnackbar}
                />
              ) : (
                <Wso2PublisherPoliciesList
                  details={details}
                  gatewayOperations={gatewayOperations}
                  gatewayApiPolicies={gatewayApiPolicies}
                  apiType={apiType}
                />
              )
            ) : (
              <EmptyState
                title="No Policies"
                missing="info"
                description="This API does not have policies available."
              />
            )}
          </>
        )}
    </InfoCard>
  );
};
