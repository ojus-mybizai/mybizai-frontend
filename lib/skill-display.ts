/**
 * Skill display metadata.
 *
 * Maps the backend's technical skill names (e.g. `update_contact_field`) to
 * owner-friendly labels, icons, and task-led buckets. Keeps the Skills page
 * speaking the owner's language while the runtime keeps using the precise
 * snake_case identifiers.
 *
 * Skills not listed here fall back to a humanised version of the snake_case
 * name (`add_lead_note` → `Add lead note`) and the bucket `other`, so new
 * skills don't break the page — they just appear under "Other" until
 * curated.
 */

export type SkillBucketKey =
  | 'talk'
  | 'capture'
  | 'work'
  | 'lookup'
  | 'pipeline'
  | 'notify'
  | 'data'
  | 'other';

export interface SkillBucket {
  key: SkillBucketKey;
  label: string;
  description: string;
  sortOrder: number;
}

export const SKILL_BUCKETS: Record<SkillBucketKey, SkillBucket> = {
  talk:     { key: 'talk',     label: 'Talk to customers',     description: 'How the agent replies — text, media, templates.',                 sortOrder: 1 },
  capture:  { key: 'capture',  label: 'Capture customer info', description: 'Save names, contacts, notes, and custom fields.',                 sortOrder: 2 },
  work:     { key: 'work',     label: 'Manage tasks',          description: 'Create, assign, reassign, and report on work items.',             sortOrder: 3 },
  lookup:   { key: 'lookup',   label: 'Look up information',   description: 'Search contacts, records, knowledge — read-only queries.',        sortOrder: 4 },
  pipeline: { key: 'pipeline', label: 'Move deals along',      description: 'Advance contacts through stages and report on the pipeline.',    sortOrder: 5 },
  notify:   { key: 'notify',   label: 'Notify your team',      description: 'Ping owners and teammates when something needs attention.',      sortOrder: 6 },
  data:     { key: 'data',     label: 'Save records to sheets',description: 'Create/update structured records on your datasheets.',           sortOrder: 7 },
  other:    { key: 'other',    label: 'Other',                 description: 'Skills that don\'t fit a bucket yet.',                            sortOrder: 99 },
};

export interface SkillDisplay {
  label: string;
  bucket: SkillBucketKey;
  /** Lucide icon name (resolved in the component). */
  iconName: string;
  /** When true, the skill is auto-injected by the engine and can't be toggled. */
  alwaysOn?: boolean;
}

// Curated metadata. Extend as new skills are added.
const REGISTRY: Record<string, SkillDisplay> = {
  // Talk to customers
  send_message:           { label: 'Reply to a message',      bucket: 'talk',     iconName: 'MessageSquare', alwaysOn: true },
  send_template_message:  { label: 'Send a WhatsApp template',bucket: 'talk',     iconName: 'FileText' },
  send_record_media:      { label: 'Send a record card',      bucket: 'talk',     iconName: 'Image',          alwaysOn: true },

  // Capture customer info
  update_contact_field:   { label: 'Save contact details',    bucket: 'capture',  iconName: 'PencilLine' },
  update_lead_field:      { label: 'Save lead details (V1)',  bucket: 'capture',  iconName: 'PencilLine' },
  add_lead_note:          { label: 'Add a note',              bucket: 'capture',  iconName: 'StickyNote' },
  qualify_contact:        { label: 'Qualify the contact',     bucket: 'capture',  iconName: 'CheckCircle2' },
  qualify_lead:           { label: 'Qualify the lead',        bucket: 'capture',  iconName: 'CheckCircle2' },
  score_lead:             { label: 'Score the lead',          bucket: 'capture',  iconName: 'Gauge' },
  assign_contact:         { label: 'Assign contact to user',  bucket: 'capture',  iconName: 'UserPlus' },
  assign_lead:            { label: 'Assign lead to user',     bucket: 'capture',  iconName: 'UserPlus' },
  switch_lead_agent:      { label: 'Switch lead\'s agent',    bucket: 'capture',  iconName: 'ArrowRightLeft' },
  add_contact_to_group:   { label: 'Add contact to group',    bucket: 'capture',  iconName: 'UserPlus' },

  // Look up information
  query_contacts:         { label: 'Search contacts',         bucket: 'lookup',   iconName: 'Search' },
  query_leads:            { label: 'Search leads',            bucket: 'lookup',   iconName: 'Search' },
  get_contact_details:    { label: 'Get one contact',         bucket: 'lookup',   iconName: 'IdCard' },
  get_lead_details:       { label: 'Get one lead',            bucket: 'lookup',   iconName: 'IdCard' },
  query_conversations:    { label: 'Search conversations',    bucket: 'lookup',   iconName: 'MessagesSquare' },
  lookup_knowledge:       { label: 'Look up knowledge',       bucket: 'lookup',   iconName: 'BookOpen' },

  // Manage tasks
  create_work:            { label: 'Create a task',           bucket: 'work',     iconName: 'ClipboardPlus' },
  assign_work:            { label: 'Assign a task',           bucket: 'work',     iconName: 'UserCheck' },
  reassign_work:          { label: 'Reassign a task',         bucket: 'work',     iconName: 'Repeat' },
  query_work:             { label: 'Search tasks',            bucket: 'work',     iconName: 'ClipboardList' },
  get_overdue_work:       { label: 'Find overdue tasks',      bucket: 'work',     iconName: 'AlarmClockOff' },

  // Move deals along
  move_to_stage:          { label: 'Move to next stage',      bucket: 'pipeline', iconName: 'MoveRight' },
  get_pipeline_status:    { label: 'Get pipeline status',     bucket: 'pipeline', iconName: 'BarChart3' },

  // Notify
  notify_user:            { label: 'Notify a teammate',       bucket: 'notify',   iconName: 'BellRing' },
};

/** Humanise a snake_case skill name as a fallback label. */
function humanise(name: string): string {
  if (!name) return name;
  return name
    .split('_')
    .map((w) => (w ? w.charAt(0).toUpperCase() + w.slice(1) : ''))
    .join(' ');
}

export function getSkillDisplay(name: string, fallbackCategory?: string): SkillDisplay {
  const hit = REGISTRY[name];
  if (hit) return hit;

  // Heuristic fallback by backend category so new skills slot somewhere reasonable.
  const cat = (fallbackCategory || '').toLowerCase();
  let bucket: SkillBucketKey = 'other';
  if (name.startsWith('create_') && name.endsWith('_record')) bucket = 'data';
  else if (name.startsWith('search_') || name.startsWith('get_')) bucket = 'lookup';
  else if (name.startsWith('update_')) bucket = 'capture';
  else if (cat === 'communication') bucket = 'talk';
  else if (cat === 'lead') bucket = 'capture';
  else if (cat === 'work') bucket = 'work';
  else if (cat === 'pipeline') bucket = 'pipeline';
  else if (cat === 'notification') bucket = 'notify';
  else if (cat === 'data') bucket = 'data';

  return { label: humanise(name), bucket, iconName: 'Wrench' };
}

export function isAlwaysOnSkill(name: string): boolean {
  return !!REGISTRY[name]?.alwaysOn;
}
