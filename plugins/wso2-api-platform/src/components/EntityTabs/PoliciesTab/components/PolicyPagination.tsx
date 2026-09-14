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
import Typography from '@material-ui/core/Typography';
import Button from '@material-ui/core/Button';

// Shared mini pagination control
export const PolicyPagination = ({
  currentPage,
  totalPages,
  onPageChange,
}: {
  currentPage: number;
  totalPages: number;
  onPageChange: (page: number) => void;
}) => {
  if (totalPages <= 1) return null;
  return (
    <Box
      display="flex"
      alignItems="center"
      justifyContent="center"
      mt={2}
      mb={1}
      style={{ gap: '12px' }}
    >
      <Button
        size="small"
        variant="outlined"
        disabled={currentPage === 1}
        onClick={() => onPageChange(currentPage - 1)}
        style={{ textTransform: 'none', minWidth: '70px' }}
      >
        &lt; Prev
      </Button>
      <Typography
        variant="caption"
        color="textSecondary"
        style={{ fontWeight: 600 }}
      >
        Page {currentPage} of {totalPages}
      </Typography>
      <Button
        size="small"
        variant="outlined"
        disabled={currentPage === totalPages}
        onClick={() => onPageChange(currentPage + 1)}
        style={{ textTransform: 'none', minWidth: '70px' }}
      >
        Next &gt;
      </Button>
    </Box>
  );
};
