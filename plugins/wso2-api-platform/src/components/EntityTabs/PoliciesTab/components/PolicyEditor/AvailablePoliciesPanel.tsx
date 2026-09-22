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
import Chip from '@material-ui/core/Chip';
import CircularProgress from '@material-ui/core/CircularProgress';
import InputAdornment from '@material-ui/core/InputAdornment';
import TextField from '@material-ui/core/TextField';
import Typography from '@material-ui/core/Typography';
import Avatar from '@material-ui/core/Avatar';
import SearchIcon from '@material-ui/icons/Search';
import SecurityIcon from '@material-ui/icons/Security';
import DragIndicatorIcon from '@material-ui/icons/DragIndicator';
import OpenInNewIcon from '@material-ui/icons/OpenInNew';
import { EmptyState, WarningPanel } from '@backstage/core-components';
import {
  POLICY_HUB_WEBSITE_URL,
  usePolicyHubCategories,
  usePolicyHubPolicies,
} from '../../../../../api/policyHub';
import { POLICY_DND_MIME, setDraggedPolicy } from './policyDnd';
import { PolicyPagination } from '../PolicyPagination';
import { formatPolicyVersion } from './policyModel';

const PAGE_SIZE = 20;

/**
 * The "Available Policies" panel: the Policy Hub catalog, with each policy
 * draggable onto a drop zone in the policies panel. Attaching a policy only
 * happens via drag-and-drop into a drop zone.
 */
export function AvailablePoliciesPanel() {
  const [search, setSearch] = useState('');
  const [activeCategories, setActiveCategories] = useState<string[]>([]);
  const [page, setPage] = useState(1);

  const categoriesQuery = usePolicyHubCategories();
  const policiesQuery = usePolicyHubPolicies(page, PAGE_SIZE, activeCategories);

  const toggleCategory = (cat: string) => {
    setActiveCategories(prev =>
      prev.includes(cat) ? prev.filter(c => c !== cat) : [...prev, cat],
    );
    setPage(1);
  };

  const filtered = useMemo(() => {
    const term = search.trim().toLowerCase();
    const list = policiesQuery.value?.policies || [];
    if (!term) return list;
    return list.filter(p =>
      [p.displayName, p.name, p.description, ...p.tags]
        .filter(Boolean)
        .some(v => v!.toLowerCase().includes(term)),
    );
  }, [policiesQuery.value, search]);

  const total = policiesQuery.value?.total ?? 0;
  const totalPages = Math.max(1, Math.ceil(total / PAGE_SIZE));

  const renderPolicyList = () => {
    if (policiesQuery.loading) {
      return (
        <Box display="flex" justifyContent="center" py={6}>
          <CircularProgress size={24} />
        </Box>
      );
    }
    if (policiesQuery.error) {
      return (
        <WarningPanel severity="error" title="Failed to load policies">
          <Box display="flex" flexDirection="column" style={{ gap: 8 }}>
            <Typography variant="body2">
              {policiesQuery.error.message ||
                'Unable to load policies from the Policy Hub.'}
            </Typography>
            <Button
              size="small"
              variant="outlined"
              onClick={() => policiesQuery.retry()}
              style={{ alignSelf: 'flex-start' }}
            >
              Retry
            </Button>
          </Box>
        </WarningPanel>
      );
    }
    if (filtered.length === 0) {
      return (
        <EmptyState
          title="No policies"
          missing="content"
          description="No policies match the filter."
        />
      );
    }
    return (
      <Box display="flex" flexDirection="column" style={{ gap: 8 }}>
        {filtered.map(policy => (
          <Box
            draggable
            key={`${policy.name}@${policy.version}`}
            onDragEnd={() => setDraggedPolicy(null)}
            onDragStart={event => {
              setDraggedPolicy({
                name: policy.name,
                version: policy.version,
                displayName: policy.displayName,
              });
              event.dataTransfer.effectAllowed = 'copy';
              event.dataTransfer.setData(POLICY_DND_MIME, policy.name);
            }}
            display="flex"
            alignItems="center"
            p={1.25}
            style={{
              gap: 8,
              border: '1px solid rgba(0,0,0,0.12)',
              borderRadius: 6,
              cursor: 'grab',
            }}
          >
            <Box display="flex" color="text.disabled">
              <DragIndicatorIcon fontSize="small" />
            </Box>
            <Avatar
              src={policy.iconUrl}
              style={{ width: 28, height: 28 }}
              variant="rounded"
            >
              <SecurityIcon fontSize="small" />
            </Avatar>
            <Typography
              noWrap
              variant="body2"
              style={{ flex: 1, fontWeight: 600, minWidth: 0 }}
            >
              {policy.displayName}
            </Typography>
            <Chip
              label={formatPolicyVersion(policy.version)}
              size="small"
              variant="outlined"
            />
          </Box>
        ))}
      </Box>
    );
  };

  return (
    <Box display="flex" flexDirection="column" height="100%">
      <Box
        display="flex"
        alignItems="center"
        justifyContent="space-between"
        mb={1}
      >
        <Typography variant="subtitle1" style={{ fontWeight: 'bold' }}>
          Available Policies
        </Typography>
        <Button
          color="primary"
          href={POLICY_HUB_WEBSITE_URL}
          rel="noopener noreferrer"
          size="small"
          target="_blank"
          endIcon={<OpenInNewIcon fontSize="small" />}
        >
          Policy Hub
        </Button>
      </Box>

      <TextField
        fullWidth
        onChange={event => setSearch(event.target.value)}
        placeholder="Search policies"
        size="small"
        variant="outlined"
        value={search}
        InputProps={{
          startAdornment: (
            <InputAdornment position="start">
              <SearchIcon fontSize="small" />
            </InputAdornment>
          ),
        }}
      />

      {(categoriesQuery.value?.length || 0) > 0 && (
        <Box
          display="flex"
          flexWrap="wrap"
          mt={1.5}
          style={{ rowGap: 1, columnGap: 1 }}
        >
          <Chip
            label="All"
            size="small"
            color={activeCategories.length === 0 ? 'primary' : 'default'}
            onClick={() => {
              setActiveCategories([]);
              setPage(1);
            }}
          />
          {categoriesQuery.value!.map(cat => {
            const selected = activeCategories.includes(cat);
            return (
              <Chip
                key={cat}
                label={cat}
                size="small"
                color={selected ? 'primary' : 'default'}
                variant={selected ? 'default' : 'outlined'}
                onClick={() => toggleCategory(cat)}
              />
            );
          })}
        </Box>
      )}

      <Box flex={1} mt={1.5} style={{ overflowY: 'auto' }}>
        {renderPolicyList()}
      </Box>

      <PolicyPagination
        currentPage={page}
        totalPages={totalPages}
        onPageChange={setPage}
      />
    </Box>
  );
}
