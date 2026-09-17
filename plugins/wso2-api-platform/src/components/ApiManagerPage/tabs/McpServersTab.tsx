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
import CircularProgress from '@material-ui/core/CircularProgress';
import Typography from '@material-ui/core/Typography';
import { Table, TableColumn, WarningPanel } from '@backstage/core-components';
import { Wso2McpSummary } from '../../../api';
import { tableIconsWithoutSearchClear } from '../../common/Table/tableRenderers';

type McpServersTabProps = {
  isGatewayDiscoveryFailureEmptyState?: boolean;
  gatewayDiscoveryFailureContent?: React.ReactNode;
  mcpListState: any;
  searchToolbar: React.ReactNode;
  visibleMcpServers: Wso2McpSummary[];
  columns: TableColumn<Wso2McpSummary>[];
  mcpSearchHasNoResults: boolean;
  resultNotFoundContent: React.ReactNode;
};

export const McpServersTab = ({
  isGatewayDiscoveryFailureEmptyState,
  gatewayDiscoveryFailureContent,
  mcpListState,
  searchToolbar,
  visibleMcpServers,
  columns,
  mcpSearchHasNoResults,
  resultNotFoundContent,
}: McpServersTabProps) => (
  <>
    {mcpListState.loading &&
      !isGatewayDiscoveryFailureEmptyState &&
      (!mcpListState.value?.mcpServers ||
        mcpListState.value.mcpServers.length === 0) && (
        <Box
          display="flex"
          flexDirection="column"
          alignItems="center"
          justifyContent="center"
          my={10}
        >
          <CircularProgress color="primary" size={50} thickness={4} />
          <Box mt={2}>
            <Typography variant="h6" color="textSecondary">
              Fetching MCP Servers...
            </Typography>
          </Box>
        </Box>
      )}
    {mcpListState.error && (
      <WarningPanel
        title="Failed to load MCP Servers"
        message={mcpListState.error.message}
      />
    )}
    {isGatewayDiscoveryFailureEmptyState && gatewayDiscoveryFailureContent}
    {!mcpListState.loading &&
      !isGatewayDiscoveryFailureEmptyState &&
      (!mcpListState.value?.mcpServers ||
        mcpListState.value.mcpServers.length === 0) && (
        <Box
          display="flex"
          flexDirection="column"
          alignItems="center"
          justifyContent="center"
          my={10}
          textAlign="center"
        >
          <Box mt={3} maxWidth={600}>
            <Typography variant="h5" gutterBottom style={{ fontWeight: 500 }}>
              No MCP Servers Available
            </Typography>
            <Typography variant="body1" color="textSecondary">
              We could not find any Model Control Plane servers in your WSO2
              ecosystem.
            </Typography>
          </Box>
        </Box>
      )}
    {mcpListState.value?.mcpServers &&
      mcpListState.value.mcpServers.length > 0 && (
        <>
          {searchToolbar}
          {visibleMcpServers.length > 0 ? (
            <Table
              options={{
                paging: true,
                search: false,
                pageSize: 5,
                pageSizeOptions: [5, 10, 20, 50, 100],
                toolbar: false,
              }}
              icons={tableIconsWithoutSearchClear}
              columns={columns}
              data={visibleMcpServers}
            />
          ) : (
            mcpSearchHasNoResults && resultNotFoundContent
          )}
        </>
      )}
  </>
);
