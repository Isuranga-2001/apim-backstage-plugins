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

import Grid from '@material-ui/core/Grid';
import MenuItem from '@material-ui/core/MenuItem';
import TextField from '@material-ui/core/TextField';
import {
  Wso2ApiDocumentType,
  Wso2ApiDocumentVisibility,
} from '../../../../api';

export type DocumentMetadataFormValue = {
  name: string;
  type: Wso2ApiDocumentType;
  otherTypeName: string;
  summary: string;
  visibility: Wso2ApiDocumentVisibility;
};

// SWAGGER_DOC is legacy/APIM-internal and intentionally excluded (OQ-4) —
// definitions get their own artifact kind in a later phase instead.
const DOCUMENT_TYPE_OPTIONS: Array<{
  value: Wso2ApiDocumentType;
  label: string;
}> = [
  { value: 'HOWTO', label: 'How To' },
  { value: 'SAMPLES', label: 'Samples & SDK' },
  { value: 'PUBLIC_FORUM', label: 'Public Forum' },
  { value: 'SUPPORT_FORUM', label: 'Support Forum' },
  { value: 'API_MESSAGE_FORMAT', label: 'API Message Formats' },
  { value: 'OTHER', label: 'Other' },
];

const VISIBILITY_OPTIONS: Array<{
  value: Wso2ApiDocumentVisibility;
  label: string;
}> = [
  { value: 'API_LEVEL', label: 'API level' },
  { value: 'OWNER_ONLY', label: 'Owner only' },
  { value: 'PRIVATE', label: 'Private' },
];

export const DocumentMetadataForm = (options: {
  value: DocumentMetadataFormValue;
  onChange: (value: DocumentMetadataFormValue) => void;
  disabled?: boolean;
}) => {
  const { value, onChange, disabled } = options;
  const set = (patch: Partial<DocumentMetadataFormValue>) =>
    onChange({ ...value, ...patch });

  return (
    <Grid container spacing={2}>
      <Grid item xs={12}>
        <TextField
          id="document-metadata-name"
          label="Name"
          required
          fullWidth
          value={value.name}
          onChange={e => set({ name: e.target.value })}
          inputProps={{ maxLength: 255 }}
          disabled={disabled}
        />
      </Grid>
      <Grid item xs={12} sm={6}>
        <TextField
          id="document-metadata-type"
          select
          label="Type"
          required
          fullWidth
          value={value.type}
          onChange={e =>
            set({ type: e.target.value as Wso2ApiDocumentType })
          }
          disabled={disabled}
        >
          {DOCUMENT_TYPE_OPTIONS.map(opt => (
            <MenuItem key={opt.value} value={opt.value}>
              {opt.label}
            </MenuItem>
          ))}
        </TextField>
      </Grid>
      <Grid item xs={12} sm={6}>
        <TextField
          id="document-metadata-visibility"
          select
          label="Visibility"
          fullWidth
          value={value.visibility}
          onChange={e =>
            set({ visibility: e.target.value as Wso2ApiDocumentVisibility })
          }
          disabled={disabled}
        >
          {VISIBILITY_OPTIONS.map(opt => (
            <MenuItem key={opt.value} value={opt.value}>
              {opt.label}
            </MenuItem>
          ))}
        </TextField>
      </Grid>
      {value.type === 'OTHER' && (
        <Grid item xs={12}>
          <TextField
            id="document-metadata-other-type-name"
            label="Other type name"
            required
            fullWidth
            value={value.otherTypeName}
            onChange={e => set({ otherTypeName: e.target.value })}
            disabled={disabled}
          />
        </Grid>
      )}
      <Grid item xs={12}>
        <TextField
          id="document-metadata-summary"
          label="Summary"
          fullWidth
          multiline
          minRows={2}
          value={value.summary}
          onChange={e => set({ summary: e.target.value })}
          disabled={disabled}
        />
      </Grid>
    </Grid>
  );
};
