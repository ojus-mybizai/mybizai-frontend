/**
 * /team/roles — Roles & access management.
 *
 * Re-exports the existing /settings/roles page under the /team umbrella. The
 * legacy path continues to work behind a 308 redirect from next.config.
 */
export { default } from '../../settings/roles/page';
