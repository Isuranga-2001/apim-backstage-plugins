/**
 * Drops the `visibility` column from wso2_artifacts. Self-hosted gateway
 * and OpenChoreo have no equivalent concept (confirmed against WSO2 API
 * Platform docs and the underlying APK CRD schema — see
 * docs/patch-plan-A-drop-visibility-field.md §1); the column was carried
 * over from the on-prem Publisher v4 `Document` schema for wire-format
 * compatibility only, and was never enforced.
 *
 * @param {import('knex').Knex} knex
 */
exports.up = async function up(knex) {
  await knex.schema.alterTable('wso2_artifacts', table => {
    table.dropColumn('visibility');
  });
};

/**
 * @param {import('knex').Knex} knex
 */
exports.down = async function down(knex) {
  await knex.schema.alterTable('wso2_artifacts', table => {
    table.string('visibility', 20).notNullable().defaultTo('API_LEVEL');
  });
};
