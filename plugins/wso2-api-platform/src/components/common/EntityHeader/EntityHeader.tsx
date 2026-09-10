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

import Box from '@material-ui/core/Box';
import Breadcrumbs from '@material-ui/core/Breadcrumbs';
import Chip from '@material-ui/core/Chip';
import Typography from '@material-ui/core/Typography';
import HomeIcon from '@material-ui/icons/Home';
import { useStyles } from './styles';
import { Header, Link } from '@backstage/core-components';
import { useTheme } from '@material-ui/core/styles';
import { DEFAULT_NAMESPACE, Entity } from '@backstage/catalog-model';
import {
  FavoriteEntity,
  useAsyncEntity,
  entityRouteRef,
} from '@backstage/plugin-catalog-react';
import { useRouteRef, useRouteRefParams } from '@backstage/core-plugin-api';
import { getWso2EntityHeaderType } from '../../../utils';
import { rootRouteRef } from '../../../routes';
import { useGatewayStatus } from '../useGatewayStatus';

const getFallbackTitle = (
  namespace?: string,
  name?: string,
  entity?: Entity,
) => {
  const entityNamespace = namespace ?? entity?.metadata.namespace ?? '';
  const entityName =
    entity?.metadata.title ?? name ?? entity?.metadata.name ?? '';

  return `${entityName}${
    entityNamespace && entityNamespace !== DEFAULT_NAMESPACE
      ? ` in ${entityNamespace}`
      : ''
  }`;
};

const Wso2EntityTypeText = ({ label }: { label?: string }) => {
  if (!label) {
    return null;
  }

  return (
    <Box component="span" color="#ffffff">
      {label}
    </Box>
  );
};

const GatewayStatusBadge = ({ active }: { active: boolean }) => (
  <Chip
    label={active ? 'Active' : 'Inactive'}
    size="small"
    style={{
      height: 22,
      color: '#ffffff',
      backgroundColor: active ? '#28a745' : '#e74c3c',
      fontSize: '0.5rem',
    }}
  />
);

export const EntityHeader = (): JSX.Element => {
  useStyles();
  const theme = useTheme();

  const { entity } = useAsyncEntity();
  const { kind, namespace, name } = useRouteRefParams(entityRouteRef);
  const fallbackTitle = getFallbackTitle(namespace, name, entity);
  const headerType = entity ? getWso2EntityHeaderType(entity) : kind;
  const platformRoute = useRouteRef(rootRouteRef);
  const gatewayStatus = useGatewayStatus(entity);

  const version =
    entity?.metadata.annotations?.['wso2.com/api-version'] ||
    entity?.metadata.annotations?.['wso2-gateway.com/api-version'] ||
    entity?.metadata.annotations?.['wso2.com/service-version'] ||
    '1.0.0';

  const displayName =
    entity?.metadata.annotations?.['wso2.com/api-name'] ||
    entity?.metadata.annotations?.['wso2-gateway.com/api-name'] ||
    entity?.metadata.annotations?.['wso2.com/service-name'] ||
    entity?.metadata.title ||
    entity?.metadata.name ||
    name;

  return (
    <Box style={{ gridArea: 'pageHeader' }}>
      <Header
        pageTitleOverride={fallbackTitle}
        style={{
          backgroundImage: 'linear-gradient(90deg, #304271, #304271)',
        }}
        title={
          <Box
            display="inline-flex"
            alignItems="center"
            height="1em"
            maxWidth="100%"
            color="#ffffff"
          >
            <Box
              component="span"
              textOverflow="ellipsis"
              whiteSpace="nowrap"
              overflow="hidden"
            >
              {entity ? `${displayName} : ${version}` : fallbackTitle}
            </Box>
            {entity && <FavoriteEntity entity={entity} />}
            {gatewayStatus.applicable && (
              <GatewayStatusBadge active={gatewayStatus.active} />
            )}
          </Box>
        }
        type={(<Wso2EntityTypeText label={headerType} />) as unknown as string}
      />
      <Box
        px={3}
        pt={2}
        pb={1}
        bgcolor={theme.palette.type === 'dark' ? 'transparent' : '#ffffff'}
        borderBottom={`0.1px solid ${
          theme.palette.type === 'dark' ? theme.palette.divider : '#e0e0e0'
        }`}
      >
        <Breadcrumbs aria-label="breadcrumb">
          <Link
            to={platformRoute()}
            style={{ display: 'flex', alignItems: 'center' }}
          >
            <HomeIcon style={{ marginRight: '4px', fontSize: '1.2rem' }} />
          </Link>
          <Typography color="textPrimary" style={{ fontWeight: 500 }}>
            {displayName} : {version}
          </Typography>
        </Breadcrumbs>
      </Box>
    </Box>
  );
};
