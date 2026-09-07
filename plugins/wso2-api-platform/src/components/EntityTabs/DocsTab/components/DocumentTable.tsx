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

import { Table, TableColumn } from '@backstage/core-components';
import Box from '@material-ui/core/Box';
import IconButton from '@material-ui/core/IconButton';
import Link from '@material-ui/core/Link';
import Tooltip from '@material-ui/core/Tooltip';
import Typography from '@material-ui/core/Typography';
import Chip from '@material-ui/core/Chip';
import DeleteOutlineIcon from '@material-ui/icons/DeleteOutline';
import EditIcon from '@material-ui/icons/Edit';
import VisibilityIcon from '@material-ui/icons/Visibility';
import { Wso2ApiDocument, Wso2ApiDocumentCapabilities } from '../../../../api';
import { getApiTypeChipStyle } from '../../../common/Table/tableRenderers';

export const Wso2DocumentTable = (options: {
  documents: Wso2ApiDocument[];
  onPreview: (doc: Wso2ApiDocument) => void;
  onDownload: (doc: Wso2ApiDocument) => void;
  capabilities?: Wso2ApiDocumentCapabilities;
  onEditMetadata?: (doc: Wso2ApiDocument) => void;
  onDelete?: (doc: Wso2ApiDocument) => void;
}) => {
  const {
    documents,
    onPreview,
    onDownload,
    capabilities,
    onEditMetadata,
    onDelete,
  } = options;

  const columns: TableColumn<Wso2ApiDocument>[] = [
    {
      title: 'Name',
      field: 'name',
      render: (rowData: Wso2ApiDocument) => (
        <Link
          href="#"
          onClick={(e: React.MouseEvent) => {
            e.preventDefault();
            if (
              rowData.sourceType === 'MARKDOWN' ||
              rowData.sourceType === 'INLINE'
            ) {
              onPreview(rowData);
            } else {
              onDownload(rowData);
            }
          }}
          style={{
            color: '#0A66C2',
            textDecoration: 'underline',
            cursor: 'pointer',
            fontWeight: 'bold',
          }}
        >
          {rowData.name}
        </Link>
      ),
    },
    {
      title: 'Type',
      field: 'type',
      render: (rowData: Wso2ApiDocument) => (
        <Chip size="small" label={rowData.type} style={getApiTypeChipStyle()} />
      ),
    },
    {
      title: 'Source',
      field: 'sourceType',
      render: (rowData: Wso2ApiDocument) => {
        const isPreviewable =
          rowData.sourceType === 'MARKDOWN' || rowData.sourceType === 'INLINE';
        return (
          <Typography variant="body2" color="textSecondary">
            {rowData.sourceType} {isPreviewable ? '(Previewable)' : ''}
          </Typography>
        );
      },
    },
    { title: 'Summary', field: 'summary' },
  ];

  if (capabilities?.updateMetadata || capabilities?.delete) {
    columns.push({
      title: 'Actions',
      field: 'actions',
      sorting: false,
      width: '140px',
      align: 'right',
      render: (rowData: Wso2ApiDocument) => (
        <Box display="flex" justifyContent="flex-end">
          <Tooltip title="View">
            <IconButton
              size="small"
              aria-label={`View ${rowData.name}`}
              onClick={() => {
                if (
                  rowData.sourceType === 'MARKDOWN' ||
                  rowData.sourceType === 'INLINE'
                ) {
                  onPreview(rowData);
                } else {
                  onDownload(rowData);
                }
              }}
            >
              <VisibilityIcon fontSize="small" />
            </IconButton>
          </Tooltip>
          {capabilities?.updateMetadata && (
            <Tooltip title="Edit metadata">
              <IconButton
                size="small"
                aria-label={`Edit metadata of ${rowData.name}`}
                onClick={() => onEditMetadata?.(rowData)}
              >
                <EditIcon fontSize="small" />
              </IconButton>
            </Tooltip>
          )}
          {capabilities?.delete && (
            <Tooltip title="Delete">
              <IconButton
                size="small"
                aria-label={`Delete ${rowData.name}`}
                onClick={() => onDelete?.(rowData)}
              >
                <DeleteOutlineIcon fontSize="small" />
              </IconButton>
            </Tooltip>
          )}
        </Box>
      ),
    });
  }

  return (
    <Table
      options={{ paging: documents.length > 5, search: false }}
      columns={columns}
      data={documents}
    />
  );
};
