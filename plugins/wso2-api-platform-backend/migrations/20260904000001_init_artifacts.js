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

/**
 * Metadata-only table for API artifacts (documents today, definitions
 * reserved via artifact_kind). Never contains payloads, so list queries
 * stay cheap. See docs/document-attachment-implementation-plan.md §5.3.
 *
 * @param {import('knex').Knex} knex
 */
exports.up = async function up(knex) {
  await knex.schema.createTable('wso2_artifacts', table => {
    table.string('id', 64).notNullable().primary();
    table.string('artifact_kind', 32).notNullable();
    table.string('source_kind', 32).notNullable();
    table.string('gateway_id', 255).notNullable();
    table.string('api_id', 255).notNullable();
    table.string('api_version', 64).nullable();
    table.string('entity_ref', 512).nullable();
    table.string('name', 255).notNullable();
    table.string('doc_type', 64).notNullable();
    table.string('other_type_name', 255).nullable();
    table.text('summary').nullable();
    table.string('source_type', 20).notNullable();
    table.string('visibility', 20).notNullable().defaultTo('API_LEVEL');
    table.text('source_url').nullable();
    table.string('created_by', 255).nullable();
    table
      .timestamp('created_at', { useTz: true })
      .notNullable()
      .defaultTo(knex.fn.now());
    table.string('updated_by', 255).nullable();
    table
      .timestamp('updated_at', { useTz: true })
      .notNullable()
      .defaultTo(knex.fn.now());

    table.unique(
      ['artifact_kind', 'source_kind', 'gateway_id', 'api_id', 'name'],
      { indexName: 'wso2_artifacts_natural_key' },
    );
    table.index(
      ['source_kind', 'gateway_id', 'api_id', 'artifact_kind'],
      'wso2_artifacts_api_idx',
    );
    table.index(['entity_ref'], 'wso2_artifacts_entity_ref_idx');
  });
};

/**
 * @param {import('knex').Knex} knex
 */
exports.down = async function down(knex) {
  await knex.schema.dropTableIfExists('wso2_artifacts');
};
