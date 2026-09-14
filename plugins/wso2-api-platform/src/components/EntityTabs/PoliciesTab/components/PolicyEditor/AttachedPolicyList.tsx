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
import Chip from '@material-ui/core/Chip';
import IconButton from '@material-ui/core/IconButton';
import Tooltip from '@material-ui/core/Tooltip';
import Typography from '@material-ui/core/Typography';
import DragIndicatorIcon from '@material-ui/icons/DragIndicator';
import EditIcon from '@material-ui/icons/Edit';
import SecurityIcon from '@material-ui/icons/Security';
import DeleteIcon from '@material-ui/icons/Delete';
import { getPolicyFriendlyName } from '../PolicyDetailsViewer';
import { ApiPolicy, formatPolicyVersion } from './policyModel';
import { POLICY_REORDER_MIME } from './policyDnd';

/**
 * Renders a flat, ordered list of attached policies with edit/delete and
 * drag-to-reorder, plus an empty state. Reordering uses native HTML5 drag
 * within this list only. Policies are attached via drag-and-drop (or a
 * click-to-add fallback) from the Available Policies catalog.
 */
export function AttachedPolicyList({
  policies,
  canAdd,
  onEdit,
  onRemove,
  onReorder,
  emptyText = 'Drag and drop policies here to attach them.',
}: {
  policies: ApiPolicy[];
  canAdd: boolean;
  onEdit: (index: number) => void;
  onRemove: (index: number) => void;
  onReorder: (from: number, to: number) => void;
  emptyText?: string;
}) {
  const [dragIndex, setDragIndex] = useState<number | null>(null);
  const [overIndex, setOverIndex] = useState<number | null>(null);

  return (
    <Box>
      <Typography variant="body2" style={{ fontWeight: 600, marginBottom: 8 }}>
        Policies
      </Typography>

      {policies.length === 0 ? (
        <Box
          bgcolor="rgba(0,0,0,0.04)"
          borderRadius={4}
          color="text.secondary"
          px={2}
          py={1.5}
        >
          <Typography variant="body2" color="textSecondary">
            {emptyText}
          </Typography>
        </Box>
      ) : (
        <Box display="flex" flexDirection="column" style={{ gap: 6 }}>
          {policies.map((policy, index) => {
            const isOver =
              overIndex === index && dragIndex !== null && dragIndex !== index;
            return (
              <Box
                draggable={canAdd}
                key={`${policy.name}-${index}`}
                onDragEnd={() => {
                  setDragIndex(null);
                  setOverIndex(null);
                }}
                onDragOver={event => {
                  if (dragIndex === null) return;
                  event.preventDefault();
                  setOverIndex(index);
                }}
                onDragStart={event => {
                  if (!canAdd) return;
                  setDragIndex(index);
                  event.dataTransfer.effectAllowed = 'move';
                  event.dataTransfer.setData(
                    POLICY_REORDER_MIME,
                    String(index),
                  );
                }}
                onDrop={event => {
                  if (dragIndex === null) return;
                  event.preventDefault();
                  event.stopPropagation();
                  if (dragIndex !== index) onReorder(dragIndex, index);
                  setDragIndex(null);
                  setOverIndex(null);
                }}
                display="flex"
                alignItems="center"
                px={1.5}
                py={1}
                style={{
                  gap: 8,
                  background: '#fff',
                  border: '1px solid',
                  borderColor: isOver ? '#1976d2' : 'rgba(0,0,0,0.12)',
                  borderTopWidth: isOver ? 3 : 1,
                  borderRadius: 6,
                  opacity: dragIndex === index ? 0.5 : 1,
                }}
              >
                {canAdd && (
                  <Box
                    display="flex"
                    color="text.disabled"
                    style={{ cursor: 'grab' }}
                  >
                    <DragIndicatorIcon fontSize="small" />
                  </Box>
                )}
                <SecurityIcon fontSize="small" />
                <Typography
                  noWrap
                  variant="body2"
                  style={{ flex: 1, fontWeight: 500 }}
                >
                  {getPolicyFriendlyName(policy.name)}
                </Typography>
                <Box display="flex" marginTop={0.8}>
                  <Chip
                    label={formatPolicyVersion(policy.version)}
                    size="small"
                    variant="outlined"
                  />
                </Box>
                {canAdd && (
                  <Box display="flex">
                    <Tooltip title="Edit">
                      <IconButton
                        aria-label="Edit policy"
                        onClick={() => onEdit(index)}
                        size="small"
                      >
                        <EditIcon fontSize="small" />
                      </IconButton>
                    </Tooltip>
                    <Tooltip title="Remove">
                      <IconButton
                        aria-label="Remove policy"
                        onClick={() => onRemove(index)}
                        size="small"
                      >
                        <DeleteIcon fontSize="small" color="error" />
                      </IconButton>
                    </Tooltip>
                  </Box>
                )}
              </Box>
            );
          })}
        </Box>
      )}
    </Box>
  );
}
