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
 * 1:1 with wso2_artifacts. Split out so list queries never drag a BLOB, and
 * so an external storage backend can be introduced without touching the
 * metadata table. URL documents get no row here at all — the target lives
 * in wso2_artifacts.source_url. See
 * docs/document-attachment-implementation-plan.md §5.4.
 *
 * @param {import('knex').Knex} knex
 */
exports.up = async function up(knex) {
  await knex.schema.createTable('wso2_artifact_content', table => {
    table
      .string('artifact_id', 64)
      .notNullable()
      .primary()
      .references('id')
      .inTable('wso2_artifacts')
      .onDelete('CASCADE');
    table.string('storage_backend', 32).notNullable().defaultTo('database');
    table.text('storage_ref').nullable();
    table.string('mime_type', 127).nullable();
    table.string('file_name', 255).nullable();
    table.bigInteger('size_bytes').nullable();
    table.string('checksum', 64).nullable();
    table.text('content_text').nullable();
    table.binary('content_blob').nullable();
    table
      .timestamp('created_at', { useTz: true })
      .notNullable()
      .defaultTo(knex.fn.now());
    table
      .timestamp('updated_at', { useTz: true })
      .notNullable()
      .defaultTo(knex.fn.now());
  });
};

/**
 * @param {import('knex').Knex} knex
 */
exports.down = async function down(knex) {
  await knex.schema.dropTableIfExists('wso2_artifact_content');
};
