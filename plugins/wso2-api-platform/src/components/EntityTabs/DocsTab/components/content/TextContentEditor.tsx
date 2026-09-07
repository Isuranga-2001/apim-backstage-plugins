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
import TextField from '@material-ui/core/TextField';
import Typography from '@material-ui/core/Typography';

export const TextContentEditor = (options: {
  value: string;
  onChange: (value: string) => void;
  maxSizeBytes: number;
}) => {
  const { value, onChange, maxSizeBytes } = options;
  const sizeBytes = new Blob([value]).size;
  const overLimit = sizeBytes > maxSizeBytes;

  return (
    <Box>
      <TextField
        label="Content"
        required
        fullWidth
        multiline
        rows={12}
        value={value}
        onChange={e => onChange(e.target.value)}
      />
      <Typography
        variant="caption"
        color={overLimit ? 'error' : 'textSecondary'}
      >
        {sizeBytes.toLocaleString()} / {maxSizeBytes.toLocaleString()} bytes
      </Typography>
    </Box>
  );
};
