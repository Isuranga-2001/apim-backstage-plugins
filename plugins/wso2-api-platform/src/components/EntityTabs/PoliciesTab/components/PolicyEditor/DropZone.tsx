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
import { getDraggedPolicy } from './policyDnd';

/** A left-panel drop target that highlights while a catalog policy hovers it. */
export function DropZone({
  active,
  disabled = false,
  onEnter,
  onLeave,
  onDrop,
  children,
}: {
  active: boolean;
  disabled?: boolean;
  onEnter: () => void;
  onLeave: () => void;
  onDrop: () => void;
  children: React.ReactNode;
}) {
  return (
    <Box
      onDragLeave={disabled ? undefined : onLeave}
      onDragOver={event => {
        if (disabled || !getDraggedPolicy()) return;
        event.preventDefault();
        event.dataTransfer.dropEffect = 'copy';
        onEnter();
      }}
      onDrop={event => {
        if (disabled) return;
        event.preventDefault();
        onDrop();
      }}
      style={{
        border: '2px dashed',
        borderColor: active && !disabled ? '#1976d2' : 'transparent',
        borderRadius: 6,
        padding: active && !disabled ? 4 : 0,
        transition: 'border-color .12s',
      }}
    >
      {children}
    </Box>
  );
}
