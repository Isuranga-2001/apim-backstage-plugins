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

import { ReactNode, useState } from 'react';
import { AboutField } from '@backstage/plugin-catalog';
import { InfoCard, Link } from '@backstage/core-components';
import { useEntity, entityRouteRef } from '@backstage/plugin-catalog-react';
import { configApiRef, useApi, useRouteRef } from '@backstage/core-plugin-api';
import Box from '@material-ui/core/Box';
import Button from '@material-ui/core/Button';
import CircularProgress from '@material-ui/core/CircularProgress';
import Divider from '@material-ui/core/Divider';
import Grid from '@material-ui/core/Grid';
import Tooltip from '@material-ui/core/Tooltip';
import Typography from '@material-ui/core/Typography';
import { green, grey, red } from '@material-ui/core/colors';
import CheckCircleIcon from '@material-ui/icons/CheckCircle';
import ErrorOutlineIcon from '@material-ui/icons/ErrorOutline';
import DescriptionIcon from '@material-ui/icons/Description';
import OpenInNewIcon from '@material-ui/icons/OpenInNew';
import PolicyIcon from '@material-ui/icons/Policy';
import PublishIcon from '@material-ui/icons/Publish';
import LinkIcon from '@material-ui/icons/Link';
import LabelOutlinedIcon from '@material-ui/icons/LabelOutlined';
import BusinessIcon from '@material-ui/icons/Business';
import RouterIcon from '@material-ui/icons/Router';
import FiberManualRecordIcon from '@material-ui/icons/FiberManualRecord';
import SpeedIcon from '@material-ui/icons/Speed';
import SecurityIcon from '@material-ui/icons/Security';
import {
  Wso2ApiPortalAuthConfig,
  Wso2ApiPortalPublishResult,
} from '../../../api';
import { formatLifecycleStatus, isServiceEntity } from '../../../utils';
import { EntityWso2ServiceOverviewCard } from './components/ServiceOverviewCard';
import { PublishToApiPortalDialog } from './components/PublishToApiPortalDialog';
import { ApiPortalSubscriptionPlans } from './components/ApiPortalSubscriptionPlans';
import { useApiPortalCapabilities } from './hooks/useApiPortalCapabilities';
import { useGatewayStatus } from '../../common/useGatewayStatus';
import { useApiDefinition } from '../DefinitionTab/hooks/useApiDefinition';
import { useApiDefinitionSource } from '../DefinitionTab/hooks/useApiDefinitionSource';

const DISCOVERY_TYPE_ANNOTATION = 'wso2.com/api-discovery-type';
const MANUAL_AUTH_CONFIG: Wso2ApiPortalAuthConfig = { mode: 'platform-login' };

/** Pairs an AboutField with a leading icon for quick visual scanning. */
const FieldRow = (props: { icon: ReactNode; children: ReactNode }) => (
  <Box display="flex" alignItems="flex-start">
    <Box color={grey[500]} display="flex" mr={1} mt={0.5}>
      {props.icon}
    </Box>
    <Box flex={1} minWidth={0}>
      {props.children}
    </Box>
  </Box>
);

type QuickLinkProps = { icon: ReactNode; label: string; href: string };

/** A horizontal <icon> <label> link, used for the card's quick links. */
const QuickLink = (props: QuickLinkProps) => (
  <Link
    to={props.href}
    style={{ display: 'flex', alignItems: 'center', gap: 6 }}
  >
    <Box display="flex" color="primary.main">
      {props.icon}
    </Box>
    <Typography variant="body2" color="primary" style={{ fontWeight: 600 }}>
      {props.label}
    </Typography>
  </Link>
);

/**
 * A custom About card for WSO2 APIs that shows WSO2 specific metadata.
 */
const EntityWso2OverviewTabContent = () => {
  const { entity } = useEntity();
  const gatewayStatus = useGatewayStatus(entity);
  const { mode: definitionMode } = useApiDefinitionSource(entity);
  const { definition: storedDefinition } = useApiDefinition(
    entity,
    definitionMode,
  );
  const discoveryType = (entity.metadata.annotations ?? {})[
    DISCOVERY_TYPE_ANNOTATION
  ];
  const isGatewayDiscovered = discoveryType === 'api-platform-gateway';

  const entityRoute = useRouteRef(entityRouteRef);
  const entityUrl = entityRoute({
    namespace: entity.metadata.namespace || 'default',
    kind: entity.kind.toLowerCase(),
    name: entity.metadata.name,
  });

  const links: QuickLinkProps[] = [
    {
      label: 'View Documents',
      icon: <DescriptionIcon fontSize="small" />,
      href: `${entityUrl}/docs`,
    },
    {
      label: 'View Policies',
      icon: <PolicyIcon fontSize="small" />,
      href: `${entityUrl}/policies`,
    },
  ];

  const configApi = useApi(configApiRef);
  const apiPortalBaseUrl = configApi.getOptionalString(
    'wso2ApiPlatformApiPortal.baseUrl',
  );
  const { info: apiPortalInfo, loading: apiPortalLoading } =
    useApiPortalCapabilities(entity, isGatewayDiscovered);
  const [apiPortalDialogOpen, setApiPortalDialogOpen] = useState(false);
  const [apiPortalLastResult, setApiPortalLastResult] =
    useState<Wso2ApiPortalPublishResult | null>(null);

  const apiPortalEnabled = apiPortalInfo?.enabled ?? false;
  const apiPortalPublishAllowed = !!apiPortalInfo?.capabilities.publish;
  const apiPortalPublishDisabledReason = !apiPortalEnabled
    ? 'The API Portal integration is not enabled'
    : apiPortalInfo?.capabilities.reason ?? '';

  const handleApiPortalPublished = (result: Wso2ApiPortalPublishResult) => {
    setApiPortalLastResult(result);
    // The dialog itself decides whether to close — it stays open when
    // document attachment failed, so the warning isn't lost.
  };

  const annotations = entity.metadata.annotations || {};

  // Helper to get annotation value with fallback prefix
  const getAnnotation = (key: string) =>
    annotations[`wso2.com/${key}`] || annotations[`wso2-gateway.com/${key}`];
  const parseJsonAnnotation = (value?: string) => {
    if (!value) return undefined;
    try {
      return JSON.parse(value);
    } catch {
      return undefined;
    }
  };

  const lifecycle = formatLifecycleStatus(
    getAnnotation('api-lifecycle-status'),
  );
  const context = getAnnotation('api-context');
  const version = getAnnotation('api-version');
  const provider = getAnnotation('api-provider');
  const endpointsRaw = getAnnotation('api-endpoints');
  const gateway = getAnnotation('api-gateway')?.toUpperCase();
  const throttlingPolicy = getAnnotation('api-throttling-policy');
  const securityScheme = parseJsonAnnotation(
    getAnnotation('api-security-scheme'),
  );
  const gatewayValue = (() => {
    if (endpointsRaw) {
      try {
        const endpoints = JSON.parse(endpointsRaw);
        if (Array.isArray(endpoints) && endpoints.length > 0) {
          const ep = endpoints[0];
          const url = Array.isArray(ep.urls) ? ep.urls[0] : ep.urls;
          return `${ep.environmentName}${url ? ` (${url})` : ''}`;
        }
      } catch (e) {
        return 'Unknown';
      }
    }
    return gateway || undefined;
  })();

  const description =
    definitionMode === 'store'
      ? storedDefinition?.description
      : entity.metadata.description;

  const displayName = entity.metadata.title || entity.metadata.name;

  const hasGatewayDetails = Boolean(
    provider ||
      gatewayValue ||
      gatewayStatus.applicable ||
      throttlingPolicy ||
      securityScheme,
  );

  // When there's no Provider, widen Gateway to fill the row it would have shared with it.
  const gatewayColumnWidth = provider ? 4 : 8;

  return (
    <Grid container spacing={3}>
      <Grid item xs={12}>
        <InfoCard variant="gridItem" divider={false}>
          <Grid container spacing={3}>
            <Grid item xs={12} sm={7} md={8}>
              <Typography variant="h5" style={{ fontWeight: 700 }}>
                {displayName}
                {version ? ` : ${version}` : ''}
              </Typography>
              {description && (
                <Typography
                  variant="body2"
                  color="textSecondary"
                  style={{ marginTop: 12 }}
                >
                  {description}
                </Typography>
              )}
              <Box display="flex" flexWrap="wrap" gridGap={24} mt={3} mb={2}>
                {links.map(link => (
                  <QuickLink key={link.label} {...link} />
                ))}
              </Box>
            </Grid>
            {(context || lifecycle) && (
              <Grid item xs={12} sm={5} md={4}>
                <Grid container spacing={2}>
                  {context && (
                    <Grid item xs={12}>
                      <FieldRow icon={<LinkIcon fontSize="small" />}>
                        <AboutField label="Context" value={context} />
                      </FieldRow>
                    </Grid>
                  )}
                  {lifecycle && (
                    <Grid item xs={12}>
                      <FieldRow icon={<LabelOutlinedIcon fontSize="small" />}>
                        <AboutField label="Lifecycle" value={lifecycle} />
                      </FieldRow>
                    </Grid>
                  )}
                </Grid>
              </Grid>
            )}
          </Grid>
          {hasGatewayDetails && (
            <>
              <Grid container spacing={3}>
                {provider && (
                  <Grid item xs={12} sm={6} md={4}>
                    <FieldRow icon={<BusinessIcon fontSize="small" />}>
                      <AboutField label="Provider" value={provider} />
                    </FieldRow>
                  </Grid>
                )}
                {gatewayValue && (
                  <Grid item xs={12} sm={6} md={gatewayColumnWidth}>
                    <FieldRow icon={<RouterIcon fontSize="small" />}>
                      <AboutField label="Gateway" value={gatewayValue} />
                    </FieldRow>
                  </Grid>
                )}
                {gatewayStatus.applicable && (
                  <Grid item xs={12} sm={6} md={4}>
                    <FieldRow
                      icon={
                        <FiberManualRecordIcon
                          fontSize="small"
                          style={{
                            color: gatewayStatus.active ? green[500] : red[500],
                          }}
                        />
                      }
                    >
                      <AboutField
                        label="Gateway Status"
                        value={gatewayStatus.active ? 'Active' : 'Inactive'}
                      />
                    </FieldRow>
                  </Grid>
                )}
                {throttlingPolicy && (
                  <Grid item xs={12} sm={6} md={4}>
                    <FieldRow icon={<SpeedIcon fontSize="small" />}>
                      <AboutField
                        label="Throttling Policy"
                        value={throttlingPolicy}
                      />
                    </FieldRow>
                  </Grid>
                )}
                {securityScheme && (
                  <Grid item xs={12} sm={6} md={4}>
                    <FieldRow icon={<SecurityIcon fontSize="small" />}>
                      <AboutField
                        label="Security Scheme"
                        value={
                          Array.isArray(securityScheme)
                            ? securityScheme.join(', ')
                            : securityScheme
                        }
                      />
                    </FieldRow>
                  </Grid>
                )}
              </Grid>
            </>
          )}
          {isGatewayDiscovered && (
            <>
              <Box mt={3} mb={2}>
                <Divider />
              </Box>
              <Typography
                variant="subtitle2"
                color="textSecondary"
                style={{ fontWeight: 600, marginBottom: 8 }}
              >
                API Portal
              </Typography>
              {apiPortalLoading ? (
                <Box display="flex" justifyContent="center" py={2}>
                  <CircularProgress size={24} />
                </Box>
              ) : (
                <Box>
                  {!apiPortalBaseUrl && (
                    <Typography
                      variant="body2"
                      color="textSecondary"
                      gutterBottom
                    >
                      No API Portal base URL is configured.
                    </Typography>
                  )}
                  {!apiPortalPublishAllowed &&
                    apiPortalPublishDisabledReason && (
                      <Typography
                        variant="caption"
                        color="textSecondary"
                        display="block"
                        gutterBottom
                      >
                        {apiPortalPublishDisabledReason}
                      </Typography>
                    )}
                  {apiPortalLastResult && (
                    <Box
                      display="flex"
                      alignItems="flex-start"
                      mb={1}
                      color={
                        apiPortalLastResult.warnings.length > 0
                          ? 'error.main'
                          : green[700]
                      }
                    >
                      {apiPortalLastResult.warnings.length > 0 ? (
                        <ErrorOutlineIcon
                          fontSize="small"
                          style={{ marginRight: 6, marginTop: 2 }}
                        />
                      ) : (
                        <CheckCircleIcon
                          fontSize="small"
                          style={{ marginRight: 6, marginTop: 2 }}
                        />
                      )}
                      <Typography variant="caption" color="inherit">
                        API {apiPortalLastResult.operation} on the API Portal at{' '}
                        {new Date(
                          apiPortalLastResult.publishedAt,
                        ).toLocaleString()}
                        {apiPortalLastResult.warnings.length > 0
                          ? ', but attaching documents failed — see Publish to API Portal for details.'
                          : '.'}
                      </Typography>
                    </Box>
                  )}
                  <Box
                    display="flex"
                    flexWrap="wrap"
                    justifyContent="space-between"
                    alignItems="flex-start"
                    gridGap={24}
                    mt={1}
                  >
                    <Box display="flex" flexWrap="wrap" gridGap={8}>
                      <Tooltip title={apiPortalPublishDisabledReason}>
                        <span>
                          <Button
                            variant="contained"
                            color="primary"
                            startIcon={<PublishIcon />}
                            disabled={!apiPortalPublishAllowed}
                            onClick={() => setApiPortalDialogOpen(true)}
                          >
                            Publish to API Portal
                          </Button>
                        </span>
                      </Tooltip>
                      <Tooltip
                        title={
                          apiPortalBaseUrl
                            ? ''
                            : 'No API Portal base URL is configured'
                        }
                      >
                        <span>
                          <Button
                            variant="outlined"
                            startIcon={<OpenInNewIcon />}
                            disabled={!apiPortalBaseUrl}
                            component="a"
                            href={apiPortalBaseUrl}
                            target="_blank"
                            rel="noopener noreferrer"
                          >
                            Open API Portal
                          </Button>
                        </span>
                      </Tooltip>
                    </Box>
                    <ApiPortalSubscriptionPlans entity={entity} />
                  </Box>
                </Box>
              )}
              <PublishToApiPortalDialog
                entity={entity}
                open={apiPortalDialogOpen}
                onClose={() => setApiPortalDialogOpen(false)}
                onPublished={handleApiPortalPublished}
                authConfig={apiPortalInfo?.auth ?? MANUAL_AUTH_CONFIG}
              />
            </>
          )}
        </InfoCard>
      </Grid>
    </Grid>
  );
};

export const EntityWso2OverviewTab = () => {
  const { entity } = useEntity();

  if (isServiceEntity(entity)) {
    return <EntityWso2ServiceOverviewCard />;
  }

  return <EntityWso2OverviewTabContent />;
};
