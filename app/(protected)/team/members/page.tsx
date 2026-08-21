/**
 * /team/members — Members admin (invite, deactivate, role assignment).
 *
 * Re-exports the legacy /members page while the /team surface is stabilised
 * (Slice 4). Old /members bookmarks land here via next.config redirects.
 */
export { default } from '../../members/page';
