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
import Box from '@material-ui/core/Box';
import Button from '@material-ui/core/Button';
import CircularProgress from '@material-ui/core/CircularProgress';
import Dialog from '@material-ui/core/Dialog';
import DialogActions from '@material-ui/core/DialogActions';
import DialogContent from '@material-ui/core/DialogContent';
import DialogTitle from '@material-ui/core/DialogTitle';
import IconButton from '@material-ui/core/IconButton';
import Typography from '@material-ui/core/Typography';
import CloseIcon from '@material-ui/icons/Close';
import { WarningPanel } from '@backstage/core-components';
import {
  getByPath,
  initValues,
  ParameterSchema,
  ParameterValues,
  setByPath,
  topLevelRequiredMissing,
  usePolicyDefinition,
} from '../../../../../api/policyHub';
import { getPolicyFriendlyName } from '../PolicyDetailsViewer';
import { ApiPolicy } from './policyModel';
import { defaultForSchema, SchemaField } from './SchemaField';

export type PolicyConfigRef = {
  name: string;
  version: string;
  displayName?: string;
};

/**
 * Dialog to configure a policy's parameters via a form generated recursively
 * from the policy's Policy Hub schema. Switching `policy` re-fetches the
 * schema and resets the form, so the dialog dynamically updates for whatever
 * policy is currently selected.
 */
export function PolicyConfigDialog({
  policy,
  open,
  mode,
  initialValues,
  onClose,
  onConfirm,
}: {
  policy: PolicyConfigRef | null;
  open: boolean;
  mode: 'add' | 'edit';
  initialValues?: Record<string, unknown>;
  onClose: () => void;
  onConfirm: (policy: ApiPolicy) => void;
}) {
  const definitionQuery = usePolicyDefinition(
    policy?.name,
    policy?.version,
    open && !!policy,
  );
  const schema: ParameterSchema | undefined = definitionQuery.value?.schema;

  const [valuesByKey, setValuesByKey] = useState<
    Record<string, ParameterValues>
  >({});
  const formKey = policy ? `${policy.name}@${policy.version}` : '';
  const values = useMemo(
    () =>
      valuesByKey[formKey] ?? (schema ? initValues(schema, initialValues) : {}),
    [valuesByKey, formKey, schema, initialValues],
  );

  const update = (next: ParameterValues) =>
    setValuesByKey(prev => ({ ...prev, [formKey]: next }));

  const onFieldChange = (path: string, value: unknown) =>
    update(setByPath(values, path, value));

  const onAddItem = (path: string, itemSchema: ParameterSchema) => {
    const current = getByPath(values, path);
    const arr = Array.isArray(current) ? current : [];
    update(
      setByPath(values, `${path}.${arr.length}`, defaultForSchema(itemSchema)),
    );
  };

  const onRemoveItem = (path: string, index: number) => {
    const current = getByPath(values, path);
    const arr = Array.isArray(current) ? [...current] : [];
    arr.splice(index, 1);
    update(setByPath(values, path, arr));
  };

  const missingRequired = useMemo(
    () => (schema ? topLevelRequiredMissing(schema, values) : false),
    [schema, values],
  );

  const hasParams = Boolean(
    schema && schema.properties && Object.keys(schema.properties).length > 0,
  );

  const confirm = () => {
    if (!policy) return;
    onConfirm({ name: policy.name, version: policy.version, params: values });
  };

  const renderContent = () => {
    if (definitionQuery.loading || (!schema && !definitionQuery.error)) {
      return (
        <Box display="flex" justifyContent="center" py={6}>
          <CircularProgress size={24} />
        </Box>
      );
    }
    if (definitionQuery.error) {
      return (
        <WarningPanel severity="error" title="Failed to load policy definition">
          <Box display="flex" flexDirection="column" style={{ gap: 8 }}>
            <Typography variant="body2">
              {definitionQuery.error.message ||
                'Unable to load the policy definition.'}
            </Typography>
            <Button
              size="small"
              variant="outlined"
              onClick={() => definitionQuery.retry()}
              style={{ alignSelf: 'flex-start' }}
            >
              Retry
            </Button>
          </Box>
        </WarningPanel>
      );
    }
    if (!hasParams) {
      return (
        <Typography variant="body2" color="textSecondary">
          This policy has no configurable parameters.
        </Typography>
      );
    }
    return (
      <SchemaField
        key={formKey}
        onAddItem={onAddItem}
        onChange={onFieldChange}
        onRemoveItem={onRemoveItem}
        path=""
        schema={schema!}
        values={values}
      />
    );
  };

  return (
    <Dialog open={open} onClose={onClose} maxWidth="sm" fullWidth>
      <DialogTitle disableTypography>
        <Box display="flex" alignItems="center" justifyContent="space-between">
          <Typography variant="h6">
            Configure{' '}
            {policy?.displayName || getPolicyFriendlyName(policy?.name || '')}
          </Typography>
          <IconButton aria-label="Close" onClick={onClose} size="small">
            <CloseIcon fontSize="small" />
          </IconButton>
        </Box>
      </DialogTitle>

      <DialogContent dividers>{renderContent()}</DialogContent>

      <DialogActions>
        <Button onClick={onClose}>Cancel</Button>
        <Button
          color="primary"
          variant="contained"
          disabled={definitionQuery.loading || !schema || missingRequired}
          onClick={confirm}
        >
          {mode === 'edit' ? 'Save policy' : 'Attach policy'}
        </Button>
      </DialogActions>
    </Dialog>
  );
}
