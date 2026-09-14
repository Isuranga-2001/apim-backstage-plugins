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
import Box from '@material-ui/core/Box';
import Card from '@material-ui/core/Card';
import CardContent from '@material-ui/core/CardContent';
import Chip from '@material-ui/core/Chip';
import Divider from '@material-ui/core/Divider';
import Accordion from '@material-ui/core/Accordion';
import AccordionSummary from '@material-ui/core/AccordionSummary';
import AccordionDetails from '@material-ui/core/AccordionDetails';
import Button from '@material-ui/core/Button';
import Tooltip from '@material-ui/core/Tooltip';
import Typography from '@material-ui/core/Typography';
import ExpandMoreIcon from '@material-ui/icons/ExpandMore';
import LanguageIcon from '@material-ui/icons/Language';
import WarningIcon from '@material-ui/icons/Warning';
import { PolicySummary } from '../../../../../api/policyHub';
import { CODE_FONT_FAMILY } from '../../../../../styles/fonts';
import { EditableModel, EditableOperation } from '../../hooks/usePolicyEditorModel';
import { AttachedPolicyList } from './AttachedPolicyList';
import { AvailablePoliciesPanel } from './AvailablePoliciesPanel';
import { DropZone } from './DropZone';
import { PolicyConfigDialog, PolicyConfigRef } from './PolicyConfigDialog';
import { getDraggedPolicy } from './policyDnd';
import {
  ApiPolicy,
  FlowPolicies,
  POLICY_FLOWS,
  PolicyFlow,
  PolicyScope,
  reorderPolicies,
  scopeId,
} from './policyModel';

type EditState = {
  scope: PolicyScope;
  policyIndex: number;
  policy: ApiPolicy;
} | null;

const FLOW_LABELS: Record<PolicyFlow, string> = {
  request: 'Request Flow',
  response: 'Response Flow',
  fault: 'Fault Flow',
};

const getMethodColor = (method: string) => {
  const m = (method || '').toUpperCase();
  if (m === 'GET') return { main: '#61affe', light: 'rgba(97, 175, 254, 0.1)' };
  if (m === 'POST') return { main: '#49cc90', light: 'rgba(73, 204, 144, 0.1)' };
  if (m === 'PUT') return { main: '#fca130', light: 'rgba(252, 161, 48, 0.1)' };
  if (m === 'DELETE') return { main: '#f93e3e', light: 'rgba(249, 62, 62, 0.1)' };
  if (m === 'PATCH') return { main: '#50e3c2', light: 'rgba(80, 227, 194, 0.1)' };
  return { main: '#9012fe', light: 'rgba(144, 18, 254, 0.1)' };
};

const countFlows = (flows: FlowPolicies) =>
  flows.request.length + flows.response.length + flows.fault.length;

export function PolicyEditorView({
  apiType,
  initialModel,
  editingDisabledReason,
}: {
  apiType?: string;
  initialModel: EditableModel;
  editingDisabledReason?: string;
}) {
  const [apiFlows, setApiFlows] = useState<FlowPolicies>(initialModel.apiFlows);
  const [operations, setOperations] = useState<EditableOperation[]>(
    initialModel.operations,
  );
  const apiIsFlat = initialModel.apiIsFlat;

  const [scope, setScope] = useState<PolicyScope | null>(null);
  const [picked, setPicked] = useState<PolicySummary | null>(null);
  const [editing, setEditing] = useState<EditState>(null);
  const [activeZone, setActiveZone] = useState<string | null>(null);

  const canEdit = !editingDisabledReason;

  const policiesFor = (s: PolicyScope): ApiPolicy[] =>
    s.kind === 'api' ? apiFlows[s.flow] : operations[s.index].flows[s.flow];

  const setPoliciesFor = (s: PolicyScope, next: ApiPolicy[]) => {
    if (s.kind === 'api') {
      setApiFlows(prev => ({ ...prev, [s.flow]: next }));
    } else {
      setOperations(ops =>
        ops.map((op, i) =>
          i === s.index ? { ...op, flows: { ...op.flows, [s.flow]: next } } : op,
        ),
      );
    }
  };

  const dropOnScope = (s: PolicyScope) => {
    const dragged = getDraggedPolicy();
    setActiveZone(null);
    if (!dragged || !canEdit) return;
    setEditing(null);
    setScope(s);
    setPicked({
      name: dragged.name,
      version: dragged.version,
      displayName: dragged.displayName,
      provider: '',
      categories: [],
      tags: [],
      isLatest: true,
    });
  };

  const openEdit = (s: PolicyScope, index: number) => {
    setPicked(null);
    setScope(s);
    setEditing({ scope: s, policyIndex: index, policy: policiesFor(s)[index] });
  };

  const confirmPolicy = (policy: ApiPolicy) => {
    if (!scope) return;
    if (editing) {
      setPoliciesFor(
        scope,
        policiesFor(scope).map((p, i) => (i === editing.policyIndex ? policy : p)),
      );
    } else {
      setPoliciesFor(scope, [...policiesFor(scope), policy]);
    }
    closeFlow();
  };

  const closeFlow = () => {
    setPicked(null);
    setEditing(null);
    setScope(null);
  };

  const removeAt = (s: PolicyScope, i: number) =>
    setPoliciesFor(
      s,
      policiesFor(s).filter((_p, idx) => idx !== i),
    );
  const reorderAt = (s: PolicyScope, from: number, to: number) =>
    setPoliciesFor(s, reorderPolicies(policiesFor(s), from, to));

  const configRef: PolicyConfigRef | null = editing
    ? { name: editing.policy.name, version: editing.policy.version }
    : picked;

  const renderFlowZone = (s: PolicyScope, policies: ApiPolicy[], hideLabel: boolean) => {
    const zid = scopeId(s);
    return (
      <DropZone
        key={zid}
        active={activeZone === zid}
        disabled={!canEdit}
        onDrop={() => dropOnScope(s)}
        onEnter={() => setActiveZone(zid)}
        onLeave={() => setActiveZone(null)}
      >
        <Box mb={2}>
          {!hideLabel && (
            <Typography
              variant="caption"
              style={{ fontWeight: 700, textTransform: 'uppercase', opacity: 0.7 }}
            >
              {FLOW_LABELS[s.flow]}
            </Typography>
          )}
          <AttachedPolicyList
            canAdd={canEdit}
            policies={policies}
            onEdit={i => openEdit(s, i)}
            onReorder={(from, to) => reorderAt(s, from, to)}
            onRemove={i => removeAt(s, i)}
          />
        </Box>
      </DropZone>
    );
  };

  const renderFlows = (
    kind: 'api' | 'operation',
    index: number | undefined,
    flows: FlowPolicies,
    isFlat: boolean,
  ) => {
    if (isFlat) {
      const s: PolicyScope =
        kind === 'api'
          ? { kind: 'api', flow: 'request' }
          : { kind: 'operation', index: index!, flow: 'request' };
      return renderFlowZone(s, flows.request, true);
    }
    return POLICY_FLOWS.map(flow => {
      const s: PolicyScope =
        kind === 'api'
          ? { kind: 'api', flow }
          : { kind: 'operation', index: index!, flow };
      return renderFlowZone(s, flows[flow], false);
    });
  };

  const isGraphQl = (apiType || '').toUpperCase() === 'GRAPHQL';

  return (
    <Box p={2}>
      {editingDisabledReason && (
        <Box
          display="flex"
          alignItems="center"
          mb={2}
          px={2}
          py={1}
          style={{
            gap: 8,
            background: '#fff8e1',
            border: '1px solid #ffca28',
            borderRadius: 4,
          }}
        >
          <WarningIcon fontSize="small" style={{ color: '#f57f17' }} />
          <Typography variant="body2">{editingDisabledReason}</Typography>
        </Box>
      )}

      <Box display="flex" flexDirection="row" flexWrap="wrap" style={{ gap: 16 }}>
        {/* LEFT: Policies (drop targets) */}
        <Box flex={1} minWidth={320}>
          <Card variant="outlined" style={{ height: '100%' }}>
            <CardContent>
              <Typography variant="subtitle1" style={{ marginBottom: 4 }}>
                Policies
              </Typography>
              <Typography variant="body2" color="textSecondary" style={{ marginBottom: 16 }}>
                Drag policies from the right onto the API or a resource.
              </Typography>

              {/* Global / API-level */}
              <Box display="flex" alignItems="center" mb={1} style={{ gap: 8 }}>
                <LanguageIcon fontSize="small" />
                <Typography style={{ fontWeight: 600 }}>
                  Global policies (API level)
                </Typography>
              </Box>
              {renderFlows('api', undefined, apiFlows, apiIsFlat)}

              <Divider style={{ margin: '8px 0 16px' }} />
              <Typography style={{ fontWeight: 600, marginBottom: 8 }}>
                Resources
              </Typography>
              {isGraphQl ? (
                <Typography variant="body2" color="textSecondary">
                  Operation level policies are not supported for GraphQL APIs.
                </Typography>
              ) : operations.length === 0 ? (
                <Typography variant="body2" color="textSecondary">
                  No resources available.
                </Typography>
              ) : (
                <Box display="flex" flexDirection="column" style={{ gap: 8 }}>
                  {operations.map((op, index) => {
                    const colors = getMethodColor(op.method);
                    const count = countFlows(op.flows);
                    return (
                      <Accordion key={index} elevation={0} variant="outlined">
                        <AccordionSummary expandIcon={<ExpandMoreIcon />}>
                          <Box display="flex" alignItems="center" style={{ gap: 12 }}>
                            <Chip
                              label={op.method}
                              size="small"
                              style={{
                                backgroundColor: colors.main,
                                color: 'white',
                                fontWeight: 700,
                                minWidth: 58,
                              }}
                            />
                            <Typography
                              noWrap
                              style={{ fontFamily: CODE_FONT_FAMILY }}
                            >
                              {op.path}
                            </Typography>
                            {count > 0 && (
                              <Chip label={count} size="small" variant="outlined" />
                            )}
                          </Box>
                        </AccordionSummary>
                        <AccordionDetails style={{ display: 'block' }}>
                          {renderFlows('operation', index, op.flows, op.isFlat)}
                        </AccordionDetails>
                      </Accordion>
                    );
                  })}
                </Box>
              )}
            </CardContent>
          </Card>
        </Box>

        {/* RIGHT: Available Policies (drag source) */}
        <Box flexShrink={0} width={340} minWidth={280}>
          <Card variant="outlined" style={{ height: '100%' }}>
            <CardContent style={{ height: 560 }}>
              <AvailablePoliciesPanel />
            </CardContent>
          </Card>
        </Box>
      </Box>

      <Box display="flex" justifyContent="flex-end" mt={2}>
        <Tooltip title="Persistence coming soon">
          <span>
            <Button variant="contained" color="primary" disabled>
              Save
            </Button>
          </span>
        </Tooltip>
      </Box>

      <PolicyConfigDialog
        policy={configRef}
        open={Boolean(configRef)}
        mode={editing ? 'edit' : 'add'}
        initialValues={editing?.policy.params}
        onClose={closeFlow}
        onConfirm={confirmPolicy}
      />
    </Box>
  );
}
