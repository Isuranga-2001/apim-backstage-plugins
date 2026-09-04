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

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useAsyncRetry } from 'react-use';
import Tabs from '@material-ui/core/Tabs';
import Tab from '@material-ui/core/Tab';
import Box from '@material-ui/core/Box';
import Typography from '@material-ui/core/Typography';
import FormControl from '@material-ui/core/FormControl';
import InputLabel from '@material-ui/core/InputLabel';
import Select from '@material-ui/core/Select';
import MenuItem from '@material-ui/core/MenuItem';
import { Content, Header, Page } from '@backstage/core-components';
import { useApi } from '@backstage/core-plugin-api';
import { catalogApiRef } from '@backstage/plugin-catalog-react';
import { wso2ApiPlatformApiRef } from '../../api';
import {
  apiColumns,
  apiProductColumns,
  mcpColumns,
  serviceColumns,
} from '../common/Table/columns';
import { GatewayDiscoveryFailureContent } from '../common/GatewayDiscoveryWarning';
import { SearchToolbar } from '../common/SearchToolbar';

import { useCatalogEntities } from './hooks/useCatalogEntities';
import { useStyles } from './styles';
import { ApiProductsTab } from './tabs/ApiProductsTab';
import { ApiTab } from './tabs/ApiTab';
import { McpServersTab } from './tabs/McpServersTab';
import { ServicesTab } from './tabs/ServicesTab';
import {
  filterRowsBySearchText,
  normalizeGatewayType,
  expandByGateways,
} from '../../utils/apiManagerUtils';

// ─── Main Page ────────────────────────────────────────────────────────────
export const Wso2ApiPlatformPage = () => {
  const classes = useStyles();
  const catalogApi = useApi(catalogApiRef);
  const wso2Api = useApi(wso2ApiPlatformApiRef);

  const [tabValue, setTabValue] = useState(0);
  const [selectedGateway, setSelectedGateway] = useState('all');
  const [selectedApiType, setSelectedApiType] = useState('all');
  const [apiSearchText, setApiSearchText] = useState('');
  const [apiProductSearchText, setApiProductSearchText] = useState('');
  const [mcpSearchText, setMcpSearchText] = useState('');
  const [serviceSearchText, setServiceSearchText] = useState('');

  const gatewaysState = useAsyncRetry(async () => {
    try {
      return await wso2Api.getGateways();
    } catch (error) {
      throw error;
    }
  }, [wso2Api]);

  const catalogState = useCatalogEntities(catalogApi);

  // Derive offline gateways
  const offlineGateways = useMemo(() => {
    return (
      gatewaysState.value?.filter((gw: any) => gw.status === 'Offline') || []
    );
  }, [gatewaysState.value]);

  const apiListValue = useMemo(() => {
    return catalogState.value
      ? {
          apis: catalogState.value.apis,
          pagination: {
            total: catalogState.value.apis.length,
            offset: 0,
            limit: 1000,
          },
        }
      : undefined;
  }, [catalogState.value]);

  const apiProductListState = {
    loading: catalogState.loading,
    value: catalogState.value
      ? {
          apiProducts: catalogState.value.apiProducts,
          pagination: {
            total: catalogState.value.apiProducts.length,
            offset: 0,
            limit: 1000,
          },
        }
      : undefined,
    error: catalogState.error,
    retry: catalogState.retry,
  };

  const mcpListState = {
    loading: catalogState.loading,
    value: catalogState.value
      ? {
          mcpServers: catalogState.value.mcpServers,
          pagination: {
            total: catalogState.value.mcpServers.length,
            offset: 0,
            limit: 1000,
          },
        }
      : undefined,
    error: catalogState.error,
    retry: catalogState.retry,
  };

  const servicesListState = {
    loading: catalogState.loading,
    value: {
      list: catalogState.value?.services || [],
    },
    error: catalogState.error,
    retry: catalogState.retry,
  };

  const apiCount = apiListValue?.apis?.length ?? 0;
  const apiProductCount = apiProductListState.value?.apiProducts?.length ?? 0;
  const mcpCount = mcpListState.value?.mcpServers?.length ?? 0;
  const totalCatalogResourceCount = apiCount + apiProductCount + mcpCount;

  const retryAll = useCallback(() => {
    catalogState.retry();
    gatewaysState.retry();
  }, [catalogState, gatewaysState]);

  // Poll gateway connectivity only — catalog is populated by the backend entity provider
  // on its own schedule, re-fetching it from the frontend won't bring new data sooner.
  const hasGatewayIssue = offlineGateways.length > 0 || !!gatewaysState.error;

  const gatewayRetryRef = useRef(gatewaysState.retry);
  useEffect(() => {
    gatewayRetryRef.current = gatewaysState.retry;
  }, [gatewaysState.retry]);

  useEffect(() => {
    if (!hasGatewayIssue) {
      return undefined;
    }

    const interval = setInterval(() => {
      gatewayRetryRef.current();
    }, 10000);

    return () => clearInterval(interval);
  }, [hasGatewayIssue]);

  const apiListState = {
    // Only block on catalog loading — gateway failures should not prevent APIM APIs from showing.
    // Gateway errors are surfaced separately via the offlineGateways warning panel.
    loading: catalogState.loading,
    value: apiListValue,
    // Only treat catalog errors as blocking — gateways are supplemental.
    error: catalogState.error,
    retry: retryAll,
  };

  // Derive all unique gateway names for the filter dropdown
  const availableGateways = useMemo(() => {
    const gateways = new Set<string>();

    // 1. Add names from APIs in the current list
    apiListState.value?.apis.forEach(api => {
      api.gateways?.forEach((gw: any) => {
        const name = gw.gatewayType;
        if (name) {
          gateways.add(normalizeGatewayType(name));
        }
      });
    });

    // 2. Add names from all discovered gateways
    gatewaysState.value?.forEach((gw: any) => {
      const name = gw.gatewayType;
      if (name) {
        gateways.add(normalizeGatewayType(name));
      }
    });

    return Array.from(gateways).sort();
  }, [apiListState.value?.apis, gatewaysState.value]);

  // Derive all unique API types for the filter dropdown
  const availableApiTypes = useMemo(() => {
    const types = new Set<string>();

    apiListState.value?.apis.forEach(api => {
      if (api.type) {
        types.add(api.type.toUpperCase());
      }
    });

    return Array.from(types).sort();
  }, [apiListState.value?.apis]);

  // Filter APIs based on selected gateway and API type
  const filteredApis = useMemo(() => {
    let apis = expandByGateways(apiListState.value?.apis || []);
    if (selectedGateway !== 'all') {
      apis = apis.filter(api =>
        api.gateways?.some(
          (gw: any) => normalizeGatewayType(gw.gatewayType) === selectedGateway,
        ),
      );
    }
    if (selectedApiType !== 'all') {
      apis = apis.filter(api => api.type?.toUpperCase() === selectedApiType);
    }
    return apis;
  }, [apiListState.value?.apis, selectedGateway, selectedApiType]);

  const visibleApis = useMemo(() => {
    const query = apiSearchText.trim().toLocaleLowerCase();
    if (!query) {
      return filteredApis;
    }

    return filteredApis.filter(api => {
      const searchableText = [
        api.name,
        api.displayName,
        api.entityName,
        api.version,
        api.provider,
        api.context,
        api.lifeCycleStatus,
        api.type,
        api.source,
        ...(api.gateways || []).flatMap((gateway: any) => [
          gateway.name,
          gateway.displayName,
          gateway.gatewayType,
        ]),
      ]
        .filter(Boolean)
        .join(' ')
        .toLocaleLowerCase();

      return searchableText.includes(query);
    });
  }, [apiSearchText, filteredApis]);

  const apiSearchHasNoResults =
    apiSearchText.trim().length > 0 && visibleApis.length === 0;
  const apiFiltersHaveNoResults =
    apiSearchText.trim().length === 0 && filteredApis.length === 0;

  const isGatewayDiscoveryFailureEmptyState =
    !catalogState.loading &&
    offlineGateways.length > 0 &&
    totalCatalogResourceCount === 0;

  const gatewayDiscoveryFailureContent = (
    <GatewayDiscoveryFailureContent
      loading={apiListState.loading}
      onRetry={() => apiListState.retry()}
    />
  );

  // Filter API Products based on selected gateway
  const filteredApiProducts = useMemo(() => {
    const products = expandByGateways(
      apiProductListState.value?.apiProducts || [],
    );
    return products;
  }, [apiProductListState.value?.apiProducts]);

  const visibleApiProducts = useMemo(
    () => filterRowsBySearchText(filteredApiProducts, apiProductSearchText),
    [apiProductSearchText, filteredApiProducts],
  );

  const visibleMcpServers = useMemo(
    () =>
      filterRowsBySearchText(
        expandByGateways(mcpListState.value?.mcpServers || []),
        mcpSearchText,
      ),
    [mcpListState.value?.mcpServers, mcpSearchText],
  );

  const serviceRows = useMemo(
    () =>
      (servicesListState.value?.list || []).map((service: any) => ({
        ...service,
        wso2Id: service.id,
      })),
    [servicesListState.value?.list],
  );

  const visibleServices = useMemo(
    () => filterRowsBySearchText(serviceRows, serviceSearchText),
    [serviceRows, serviceSearchText],
  );

  const apiProductSearchHasNoResults =
    apiProductSearchText.trim().length > 0 && visibleApiProducts.length === 0;
  const mcpSearchHasNoResults =
    mcpSearchText.trim().length > 0 && visibleMcpServers.length === 0;
  const serviceSearchHasNoResults =
    serviceSearchText.trim().length > 0 && visibleServices.length === 0;

  const apiFilterControls = (
    <Box className={classes.apiFilterControls}>
      <Box className={classes.apiFilterSelect}>
        <FormControl fullWidth variant="outlined" size="small">
          <InputLabel id="api-type-select-label">Select Type</InputLabel>
          <Select
            labelId="api-type-select-label"
            id="api-type-select"
            value={selectedApiType}
            label="Select Type"
            onChange={e => setSelectedApiType(e.target.value as string)}
          >
            <MenuItem value="all">
              <span>All Types</span>
            </MenuItem>
            {availableApiTypes.map(type => (
              <MenuItem key={type} value={type}>
                {type}
              </MenuItem>
            ))}
          </Select>
        </FormControl>
      </Box>

      <Box className={classes.apiFilterSelect}>
        <FormControl fullWidth variant="outlined" size="small">
          <InputLabel id="gateway-select-label">Select Gateway</InputLabel>
          <Select
            labelId="gateway-select-label"
            id="gateway-select"
            value={selectedGateway}
            label="Select Gateway"
            onChange={e => setSelectedGateway(e.target.value as string)}
          >
            <MenuItem value="all">
              <span>All Gateways</span>
            </MenuItem>
            {availableGateways.map(gw => (
              <MenuItem key={gw} value={gw}>
                {gw}
              </MenuItem>
            ))}
          </Select>
        </FormControl>
      </Box>
    </Box>
  );

  const apiTableToolbar = (
    <Box className={classes.apiTableToolbar}>
      {apiFilterControls}
      <SearchToolbar
        searchPlaceholder="Search APIs"
        searchText={apiSearchText}
        onSearchChanged={setApiSearchText}
        data={visibleApis}
        tableSearchClassName={classes.apiTableSearch}
        searchFieldAlignment="left"
      />
    </Box>
  );

  const resultNotFoundContent = (
    <Box className={classes.apiEmptyState}>
      <Typography variant="body1" color="textSecondary">
        Result not found
      </Typography>
    </Box>
  );

  const apiEmptyContent = apiSearchHasNoResults
    ? 'Result not found'
    : 'No APIs match the selected filters';

  return (
    <Page themeId="app" className={classes.root}>
      <Header
        title="WSO2 API Platform"
        subtitle={
          <Typography
            variant="subtitle1"
            className="BackstageHeader-subtitle"
            style={{ whiteSpace: 'nowrap', marginTop: '8px' }}
          >
            Discover and explore APIs, API Products, Services, and MCP Servers
            from WSO2 API Platform.
          </Typography>
        }
        style={{ backgroundImage: 'linear-gradient(90deg, #304271, #304271)' }}
      />
      <Content>
        <Box className={classes.tabBarContainer}>
          <Tabs
            value={tabValue}
            onChange={(_e, newValue) => setTabValue(newValue)}
            className={classes.tabs}
            TabIndicatorProps={{ style: { display: 'none' } }}
          >
            <Tab className={classes.tab} label="APIs" />
            <Tab className={classes.tab} label="API Products" />
            <Tab className={classes.tab} label="MCP Servers" />
            <Tab className={classes.tab} label="Services" />
          </Tabs>
        </Box>

        {tabValue === 0 && (
          <ApiTab
            isGatewayDiscoveryFailureEmptyState={
              isGatewayDiscoveryFailureEmptyState
            }
            gatewayDiscoveryFailureContent={gatewayDiscoveryFailureContent}
            apiListState={apiListState}
            apiCount={apiCount}
            apiTableToolbar={apiTableToolbar}
            visibleApis={visibleApis}
            columns={apiColumns}
            apiSearchHasNoResults={apiSearchHasNoResults}
            apiFiltersHaveNoResults={apiFiltersHaveNoResults}
            apiEmptyContent={apiEmptyContent}
            apiEmptyStateClassName={classes.apiEmptyState}
          />
        )}

        {tabValue === 1 && (
          <ApiProductsTab
            isGatewayDiscoveryFailureEmptyState={
              isGatewayDiscoveryFailureEmptyState
            }
            gatewayDiscoveryFailureContent={gatewayDiscoveryFailureContent}
            apiProductListState={apiProductListState}
            searchToolbar={
              <Box className={classes.apiTableToolbar}>
                <SearchToolbar
                  searchPlaceholder="Search API Products"
                  searchText={apiProductSearchText}
                  onSearchChanged={setApiProductSearchText}
                  data={visibleApiProducts}
                  tableSearchClassName={classes.apiTableSearch}
                />
              </Box>
            }
            visibleApiProducts={visibleApiProducts}
            columns={apiProductColumns}
            apiProductSearchHasNoResults={apiProductSearchHasNoResults}
            resultNotFoundContent={resultNotFoundContent}
          />
        )}

        {tabValue === 2 && (
          <McpServersTab
            isGatewayDiscoveryFailureEmptyState={
              isGatewayDiscoveryFailureEmptyState
            }
            gatewayDiscoveryFailureContent={gatewayDiscoveryFailureContent}
            mcpListState={mcpListState}
            searchToolbar={
              <Box className={classes.apiTableToolbar}>
                <SearchToolbar
                  searchPlaceholder="Search MCP Servers"
                  searchText={mcpSearchText}
                  onSearchChanged={setMcpSearchText}
                  data={visibleMcpServers}
                  tableSearchClassName={classes.apiTableSearch}
                />
              </Box>
            }
            visibleMcpServers={visibleMcpServers}
            columns={mcpColumns}
            mcpSearchHasNoResults={mcpSearchHasNoResults}
            resultNotFoundContent={resultNotFoundContent}
          />
        )}

        {tabValue === 3 && (
          <ServicesTab
            isGatewayDiscoveryFailureEmptyState={
              isGatewayDiscoveryFailureEmptyState
            }
            gatewayDiscoveryFailureContent={gatewayDiscoveryFailureContent}
            servicesListState={servicesListState}
            searchToolbar={
              <Box className={classes.apiTableToolbar}>
                <SearchToolbar
                  searchPlaceholder="Search Services"
                  searchText={serviceSearchText}
                  onSearchChanged={setServiceSearchText}
                  data={visibleServices}
                  tableSearchClassName={classes.apiTableSearch}
                />
              </Box>
            }
            visibleServices={visibleServices}
            columns={serviceColumns}
            serviceSearchHasNoResults={serviceSearchHasNoResults}
            resultNotFoundContent={resultNotFoundContent}
          />
        )}
      </Content>
    </Page>
  );
};
