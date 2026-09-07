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

import { useRef } from 'react';
import Box from '@material-ui/core/Box';
import Button from '@material-ui/core/Button';
import Chip from '@material-ui/core/Chip';
import Typography from '@material-ui/core/Typography';
import { humanizeBytes } from '../../utils/humanizeBytes';

export const FileContentInput = (options: {
  file: File | null;
  onChange: (file: File | null) => void;
  allowedExtensions: string[];
  maxSizeBytes: number;
  error?: string;
}) => {
  const { file, onChange, allowedExtensions, maxSizeBytes, error } = options;
  const inputRef = useRef<HTMLInputElement>(null);
  const accept =
    allowedExtensions.length > 0
      ? allowedExtensions.map(ext => `.${ext}`).join(',')
      : undefined;

  return (
    <Box>
      <input
        ref={inputRef}
        type="file"
        accept={accept}
        style={{ display: 'none' }}
        data-testid="file-content-input"
        onChange={e => onChange(e.target.files?.[0] ?? null)}
      />
      <Button variant="outlined" onClick={() => inputRef.current?.click()}>
        Choose file
      </Button>
      {file && (
        <Chip
          style={{ marginLeft: 8 }}
          label={`${file.name} (${humanizeBytes(file.size)})`}
          onDelete={() => onChange(null)}
        />
      )}
      {error && (
        <Typography color="error" variant="caption" display="block">
          {error}
        </Typography>
      )}
      <Typography variant="caption" color="textSecondary" display="block">
        Max size: {humanizeBytes(maxSizeBytes)}. Allowed types:{' '}
        {allowedExtensions.length > 0 ? allowedExtensions.join(', ') : 'any'}
      </Typography>
    </Box>
  );
};
