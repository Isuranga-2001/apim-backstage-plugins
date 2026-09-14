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

import { useState, useMemo } from 'react';
import Box from '@material-ui/core/Box';
import Typography from '@material-ui/core/Typography';
import { useTheme } from '@material-ui/core/styles';
import Accordion from '@material-ui/core/Accordion';
import AccordionSummary from '@material-ui/core/AccordionSummary';
import AccordionDetails from '@material-ui/core/AccordionDetails';
import Divider from '@material-ui/core/Divider';
import Tooltip from '@material-ui/core/Tooltip';
import ExpandMoreIcon from '@material-ui/icons/ExpandMore';
import InfoIcon from '@material-ui/icons/InfoOutlined';
import ChevronRightIcon from '@material-ui/icons/ChevronRight';
import { getPolicyFriendlyName } from './PolicyDetailsViewer';
import { PolicyDetailsDialog, PolicyDetailsRef } from './PolicyDetailsDialog';
import { CODE_FONT_FAMILY } from '../../../../styles/fonts';
import { useListStyles } from './styles';
import { PolicyPagination } from './PolicyPagination';

// Stateful sub-component for paginated flow-level policies
const Wso2PolicyFlowList = ({
  flowType,
  policies,
  classes,
  hideLabel = false,
  onPolicyClick,
}: {
  flowType: string;
  policies: any[];
  classes: any;
  hideLabel?: boolean;
  onPolicyClick: (policy: any) => void;
}) => {
  const [page, setPage] = useState(1);
  const theme = useTheme();
  const itemsPerPage = 5;

  if (!policies || policies.length === 0) return null;

  const totalPages = Math.ceil(policies.length / itemsPerPage);
  const paginatedPolicies = policies.slice(
    (page - 1) * itemsPerPage,
    page * itemsPerPage,
  );

  const content = (
    <Box>
      <Box>
        {paginatedPolicies.map((policy: any, idx: number) => {
          const policyName = policy.policyName || policy.name || 'Unknown';
          const version = policy.policyVersion || policy.version || 'N/A';

          return (
            <Box
              key={`${flowType}-${idx}`}
              className={classes.policyAccordion}
              display="flex"
              alignItems="center"
              justifyContent="space-between"
              px={2}
              py={1}
              style={{ cursor: 'pointer' }}
              onClick={() => onPolicyClick(policy)}
            >
              <Typography className={classes.policyTitle}>
                {getPolicyFriendlyName(policyName)}
                <span
                  style={{
                    fontWeight: 400,
                    opacity: 0.5,
                    fontSize: '0.75rem',
                    marginLeft: '8px',
                  }}
                >
                  ({version})
                </span>
              </Typography>
              <ChevronRightIcon fontSize="small" style={{ opacity: 0.5 }} />
            </Box>
          );
        })}
      </Box>
      <PolicyPagination
        currentPage={page}
        totalPages={totalPages}
        onPageChange={setPage}
      />
    </Box>
  );

  if (hideLabel) {
    return (
      <Box mb={2} width="100%">
        {content}
      </Box>
    );
  }

  return (
    <Accordion
      elevation={0}
      style={{
        marginBottom: '12px',
        border: `1px solid ${theme.palette.divider}`,
        borderRadius: '4px',
        backgroundColor:
          theme.palette.type === 'dark'
            ? 'rgba(255,255,255,0.02)'
            : 'rgba(0,0,0,0.02)',
      }}
    >
      <AccordionSummary expandIcon={<ExpandMoreIcon />}>
        <Typography
          variant="subtitle2"
          style={{ fontWeight: 'bold', textTransform: 'uppercase' }}
        >
          {flowType} FLOW{' '}
          <span
            style={{ opacity: 0.6, marginLeft: '8px', fontWeight: 'normal' }}
          >
            ({policies.length} {policies.length === 1 ? 'policy' : 'policies'})
          </span>
        </Typography>
      </AccordionSummary>
      <AccordionDetails style={{ display: 'block', padding: theme.spacing(2) }}>
        {content}
      </AccordionDetails>
    </Accordion>
  );
};

export const Wso2PublisherPoliciesList = ({
  details,
  gatewayOperations = [],
  gatewayApiPolicies = {},
  apiType,
}: {
  details?: any;
  gatewayOperations?: any[];
  gatewayApiPolicies?: any;
  apiType?: string;
}) => {
  const theme = useTheme();
  const classes = useListStyles();

  const [opPage, setOpPage] = useState(1);
  const opsPerPage = 5;

  const [selectedPolicy, setSelectedPolicy] = useState<PolicyDetailsRef | null>(
    null,
  );
  const handlePolicyClick = (policy: any) => {
    setSelectedPolicy({
      name: policy.policyName || policy.name || 'Unknown',
      version: policy.policyVersion || policy.version,
      parameters: policy.parameters || policy.params,
    });
  };

  const getMethodColors = (method: string) => {
    const m = (method || '').toUpperCase();
    if (m === 'GET')
      return { main: '#61affe', light: 'rgba(97, 175, 254, 0.1)' };
    if (m === 'POST')
      return { main: '#49cc90', light: 'rgba(73, 204, 144, 0.1)' };
    if (m === 'PUT')
      return { main: '#fca130', light: 'rgba(252, 161, 48, 0.1)' };
    if (m === 'DELETE')
      return { main: '#f93e3e', light: 'rgba(249, 62, 62, 0.1)' };
    if (m === 'PATCH')
      return { main: '#50e3c2', light: 'rgba(80, 227, 194, 0.1)' };
    return { main: '#9012fe', light: 'rgba(144, 18, 254, 0.1)' };
  };

  // Merge Publisher details with Gateway data if needed
  const rawApiPolicies = useMemo(
    () =>
      gatewayApiPolicies && Object.keys(gatewayApiPolicies).length > 0
        ? gatewayApiPolicies
        : details?.apiPolicies || {},
    [details?.apiPolicies, gatewayApiPolicies],
  );

  const isFlatApiPolicies = Array.isArray(rawApiPolicies);

  const apiPolicies = useMemo(() => {
    if (isFlatApiPolicies) {
      return { request: rawApiPolicies, response: [], fault: [] };
    }
    return {
      request: rawApiPolicies.request || [],
      response: rawApiPolicies.response || [],
      fault: rawApiPolicies.fault || [],
    };
  }, [rawApiPolicies, isFlatApiPolicies]);

  const operations =
    gatewayOperations && gatewayOperations.length > 0
      ? gatewayOperations
      : details?.operations || [];

  const hasApiPolicies =
    apiPolicies.request?.length > 0 ||
    apiPolicies.response?.length > 0 ||
    apiPolicies.fault?.length > 0;

  const totalOpPages = Math.ceil(operations.length / opsPerPage);
  const paginatedOperations = operations.slice(
    (opPage - 1) * opsPerPage,
    opPage * opsPerPage,
  );

  const resolvedApiType = (apiType || details?.type || '').toUpperCase();

  return (
    <Box p={2}>
      <Box mb={4}>
        <Box display="flex" alignItems="center" mb={1}>
          <Typography
            variant="subtitle1"
            style={{
              fontWeight: 'bold',
              textTransform: 'uppercase',
              letterSpacing: '1px',
            }}
          >
            Global API Policies
          </Typography>
          <Tooltip
            title="Policies applied globally across all resources of this API."
            arrow
          >
            <InfoIcon
              style={{
                fontSize: '1rem',
                marginLeft: '8px',
                cursor: 'pointer',
                opacity: 0.6,
              }}
            />
          </Tooltip>
        </Box>
        {hasApiPolicies && (
          <Box p={0.5}>
            <Wso2PolicyFlowList
              flowType="Request"
              policies={apiPolicies.request}
              classes={classes}
              hideLabel={isFlatApiPolicies}
              onPolicyClick={handlePolicyClick}
            />
            <Wso2PolicyFlowList
              flowType="Response"
              policies={apiPolicies.response}
              classes={classes}
              onPolicyClick={handlePolicyClick}
            />
            <Wso2PolicyFlowList
              flowType="Fault"
              policies={apiPolicies.fault}
              classes={classes}
              onPolicyClick={handlePolicyClick}
            />
          </Box>
        )}
        {!hasApiPolicies && (
          <Typography variant="body2" color="textSecondary" align="center">
            No Global API policies found.
          </Typography>
        )}
      </Box>

      {operations && operations.length > 0 && (
        <>
          <Box display="flex" alignItems="center" mb={1}>
            <Typography
              variant="subtitle1"
              style={{
                fontWeight: 'bold',
                textTransform: 'uppercase',
                letterSpacing: '1px',
              }}
            >
              Operation Level Policies
            </Typography>
            <Tooltip
              title="Policies applied specifically to specific resources of this API."
              arrow
            >
              <InfoIcon
                style={{
                  fontSize: '1rem',
                  marginLeft: '8px',
                  cursor: 'pointer',
                  opacity: 0.6,
                }}
              />
            </Tooltip>
          </Box>

          {resolvedApiType === 'GRAPHQL' ? (
            <Box mt={2}>
              <Typography variant="body2" color="textSecondary" align="center">
                Operational level policies are not supported for GraphQL APIs.
              </Typography>
            </Box>
          ) : (
            <>
              <Box>
                {paginatedOperations.map((op: any, idx: number) => {
                  const rawOpPolicies =
                    op.operationPolicies || op.policies || {};
                  const isFlatOpPolicies = Array.isArray(rawOpPolicies);
                  const opPolicies = isFlatOpPolicies
                    ? { request: rawOpPolicies, response: [], fault: [] }
                    : {
                        request: rawOpPolicies.request || [],
                        response: rawOpPolicies.response || [],
                        fault: rawOpPolicies.fault || [],
                      };

                  const hasOpPolicies =
                    opPolicies.request?.length > 0 ||
                    opPolicies.response?.length > 0 ||
                    opPolicies.fault?.length > 0;
                  const colors = getMethodColors(op.verb || op.method);

                  return (
                    <Accordion
                      key={idx}
                      elevation={0}
                      style={{
                        marginBottom: '8px',
                        border: `1px solid ${colors.main}`,
                        borderRadius: '4px',
                        backgroundColor: colors.light,
                      }}
                    >
                      <AccordionSummary expandIcon={<ExpandMoreIcon />}>
                        <Box display="flex" alignItems="center">
                          <Box
                            px={1.5}
                            py={0.5}
                            mr={2}
                            borderRadius={4}
                            style={{
                              backgroundColor: colors.main,
                              color: 'white',
                              fontWeight: 'bold',
                              minWidth: '80px',
                              textAlign: 'center',
                              fontSize: '0.75rem',
                            }}
                          >
                            {(op.verb || op.method || 'UNKNOWN').toUpperCase()}
                          </Box>
                          <Typography
                            variant="body2"
                            style={{
                              fontFamily: CODE_FONT_FAMILY,
                              fontWeight: 600,
                              color: theme.palette.text.primary,
                            }}
                          >
                            {op.target || op.path}
                          </Typography>
                          {!hasOpPolicies && (
                            <Typography
                              variant="caption"
                              style={{ marginLeft: '16px', opacity: 0.5 }}
                            >
                              (0 policies)
                            </Typography>
                          )}
                        </Box>
                      </AccordionSummary>
                      <AccordionDetails
                        style={{ display: 'block', padding: theme.spacing(2) }}
                      >
                        <Box width="100%">
                          {hasOpPolicies ? (
                            <>
                              <Wso2PolicyFlowList
                                flowType="Request"
                                policies={opPolicies.request}
                                classes={classes}
                                hideLabel={isFlatOpPolicies}
                                onPolicyClick={handlePolicyClick}
                              />
                              {opPolicies.response?.length > 0 && (
                                <>
                                  <Divider style={{ margin: '16px 0' }} />
                                  <Wso2PolicyFlowList
                                    flowType="Response"
                                    policies={opPolicies.response}
                                    classes={classes}
                                    onPolicyClick={handlePolicyClick}
                                  />
                                </>
                              )}
                              {opPolicies.fault?.length > 0 && (
                                <>
                                  <Divider style={{ margin: '16px 0' }} />
                                  <Wso2PolicyFlowList
                                    flowType="Fault"
                                    policies={opPolicies.fault}
                                    classes={classes}
                                    onPolicyClick={handlePolicyClick}
                                  />
                                </>
                              )}
                            </>
                          ) : (
                            <Typography variant="body2" color="textSecondary">
                              No operation-level policies configured for this
                              resource.
                            </Typography>
                          )}
                        </Box>
                      </AccordionDetails>
                    </Accordion>
                  );
                })}
              </Box>
              <PolicyPagination
                currentPage={opPage}
                totalPages={totalOpPages}
                onPageChange={setOpPage}
              />
            </>
          )}
        </>
      )}

      <PolicyDetailsDialog
        policy={selectedPolicy}
        open={!!selectedPolicy}
        onClose={() => setSelectedPolicy(null)}
      />
    </Box>
  );
};
