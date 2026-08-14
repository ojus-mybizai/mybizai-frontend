'use client';

import { useEffect, useState } from 'react';
import { MessageCircle, Save, CheckCircle2, XCircle, AlertTriangle, Bot, UserPlus } from 'lucide-react';
import PermissionGuard from '@/components/permission-guard';
import { getWaSettings, updateWaSettings, type WaSettings } from '@/services/waEmployees';
import {
  getWhatsAppSyncSettings,
  updateWhatsAppSyncSettings,
} from '@/services/settings';

// WhatsApp employee-channel settings — business-level. Folded out of the retired
// /wa-employees screen (Slice 5b); surfaces the existing GET/PUT
// /wa/employees/settings endpoints, no backend change.
export default function WhatsAppSettingsPage() {
  const [settings, setSettings] = useState<WaSettings | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const [channelId, setChannelId] = useState('');
  const [taskTemplate, setTaskTemplate] = useState('');
  const [checkinTime, setCheckinTime] = useState('');
  const [checkinEnabled, setCheckinEnabled] = useState(false);
  const [inviteHeader, setInviteHeader] = useState('');
  const [inviteBody, setInviteBody] = useState('');

  // AI human-takeover (WhatsApp Coexistence) — separate endpoint, own save.
  const [takeoverEnabled, setTakeoverEnabled] = useState(true);
  const [resumeHours, setResumeHours] = useState('24');
  const [takeoverSaving, setTakeoverSaving] = useState(false);
  const [takeoverSaved, setTakeoverSaved] = useState(false);

  useEffect(() => {
    let live = true;
    setLoading(true);
    Promise.all([getWaSettings(), getWhatsAppSyncSettings().catch(() => null)])
      .then(([s, sync]) => {
        if (!live) return;
        setSettings(s);
        setChannelId(s.wa_employee_channel_id ? String(s.wa_employee_channel_id) : '');
        setTaskTemplate(s.task_template_name || '');
        setCheckinTime(s.checkin_schedule_time || '');
        setCheckinEnabled(s.checkin_schedule_enabled);
        setInviteHeader(s.invite_header || '');
        setInviteBody(s.invite_body || '');
        if (sync) {
          setTakeoverEnabled(sync.wa_app_takeover_enabled);
          setResumeHours(String(sync.wa_app_takeover_resume_hours));
        }
      })
      .catch((e) => { if (live) setError(e instanceof Error ? e.message : 'Failed to load settings'); })
      .finally(() => { if (live) setLoading(false); });
    return () => { live = false; };
  }, []);

  async function handleSaveTakeover() {
    setTakeoverSaving(true);
    setError(null);
    try {
      const hours = Math.min(720, Math.max(1, Number(resumeHours) || 24));
      const saved = await updateWhatsAppSyncSettings({
        wa_app_takeover_enabled: takeoverEnabled,
        wa_app_takeover_resume_hours: hours,
      });
      setResumeHours(String(saved.wa_app_takeover_resume_hours));
      setTakeoverSaved(true);
      setTimeout(() => setTakeoverSaved(false), 3000);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Failed to save takeover settings');
    } finally {
      setTakeoverSaving(false);
    }
  }

  async function handleSave() {
    setSaving(true);
    setError(null);
    try {
      await updateWaSettings({
        wa_employee_channel_id: channelId ? Number(channelId) : null,
        task_template_name: taskTemplate.trim() || null,
        checkin_schedule_time: checkinTime.trim() || null,
        checkin_schedule_enabled: checkinEnabled,
        invite_header: inviteHeader.trim() || null,
        invite_body: inviteBody.trim() || null,
      });
      setSaved(true);
      setTimeout(() => setSaved(false), 3000);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Failed to save settings');
    } finally {
      setSaving(false);
    }
  }

  const channels = settings?.available_channels || [];

  return (
    <PermissionGuard permission="manage_settings">
      <div className="mx-auto max-w-2xl space-y-6">
        <div className="flex items-center gap-3">
          <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-accent/10">
            <MessageCircle className="h-5 w-5 text-accent" />
          </div>
          <div>
            <h1 className="text-xl font-semibold text-text-primary">WhatsApp Settings</h1>
            <p className="text-sm text-text-secondary">
              Which WhatsApp number reaches your team, and their daily check-in schedule.
            </p>
          </div>
        </div>

        {error && (
          <div className="rounded-lg border border-red-300 bg-red-50 px-4 py-3 text-sm text-red-800 dark:bg-red-900/30 dark:text-red-300">
            {error}
          </div>
        )}

        {loading ? (
          <p className="text-sm text-text-secondary">Loading…</p>
        ) : (
          <>
            {/* Channel selection */}
            <div className={`rounded-2xl bg-card-bg p-5 space-y-3 ${!channelId ? 'border-2 border-red-300' : 'border border-border-color'}`}>
              <div className="flex items-center justify-between">
                <h2 className="text-base font-semibold text-text-primary">Employee WhatsApp Channel</h2>
                {channelId
                  ? <span className="inline-flex items-center gap-1 rounded-full border border-green-300 bg-green-50 px-2 py-0.5 text-xs font-medium text-green-700 dark:bg-green-900/30 dark:text-green-300"><CheckCircle2 className="h-3 w-3" /> Configured</span>
                  : <span className="inline-flex items-center gap-1 rounded-full border border-red-300 bg-red-50 px-2 py-0.5 text-xs font-medium text-red-600 dark:bg-red-900/30 dark:text-red-300"><XCircle className="h-3 w-3" /> Required</span>}
              </div>
              <p className="text-sm text-text-secondary">Which WhatsApp number sends invites, tasks, and attendance to members.</p>
              {channels.length === 0 ? (
                <div className="rounded-lg border border-red-300 bg-red-50 px-4 py-3 text-sm text-red-800 dark:bg-red-900/30 dark:text-red-300">
                  No WhatsApp channels connected. Connect one under <strong>Channels</strong> first.
                </div>
              ) : (
                <select
                  value={channelId}
                  onChange={(e) => setChannelId(e.target.value)}
                  className={`w-full rounded-lg border bg-bg-primary px-3 py-2 text-sm text-text-primary focus:outline-none focus:ring-2 focus:ring-accent ${!channelId ? 'border-red-300' : 'border-border-color'}`}
                >
                  <option value="">— Select a WhatsApp channel —</option>
                  {channels.map((ch) => (
                    <option key={ch.id} value={String(ch.id)}>
                      {ch.name} — {ch.phone_number || ch.phone_number_id}
                    </option>
                  ))}
                </select>
              )}
            </div>

            {/* Task template */}
            <div className="rounded-2xl border border-border-color bg-card-bg p-5 space-y-3">
              <h2 className="text-base font-semibold text-text-primary">
                Task Template Name <span className="ml-1 text-xs font-normal text-text-secondary">Optional</span>
              </h2>
              <p className="text-sm text-text-secondary">Meta-approved utility template for sending tasks outside the 24-hour window.</p>
              <input
                value={taskTemplate}
                onChange={(e) => setTaskTemplate(e.target.value)}
                placeholder="e.g. task_assignment"
                className="w-full rounded-lg border border-border-color bg-bg-primary px-3 py-2 text-sm text-text-primary placeholder:text-text-secondary focus:outline-none focus:ring-2 focus:ring-accent"
              />
              <p className="text-xs text-text-secondary">
                Variables: <code className="rounded bg-bg-secondary px-1">{'{{1}}'}</code> = task title,{' '}
                <code className="rounded bg-bg-secondary px-1">{'{{2}}'}</code> = member name,{' '}
                <code className="rounded bg-bg-secondary px-1">{'{{3}}'}</code> = due date
              </p>
            </div>

            {/* Check-in schedule */}
            <div className="rounded-2xl border border-border-color bg-card-bg p-5 space-y-4">
              <div className="flex items-center justify-between">
                <h2 className="text-base font-semibold text-text-primary">Daily Check-in Schedule</h2>
                <label className="flex cursor-pointer items-center gap-2">
                  <span className="text-sm text-text-secondary">{checkinEnabled ? 'Enabled' : 'Disabled'}</span>
                  <button
                    type="button"
                    onClick={() => setCheckinEnabled((v) => !v)}
                    className={`relative inline-flex h-5 w-9 items-center rounded-full transition-colors ${checkinEnabled ? 'bg-accent' : 'bg-border-color'}`}
                  >
                    <span className={`inline-block h-3.5 w-3.5 transform rounded-full bg-white transition-transform ${checkinEnabled ? 'translate-x-4' : 'translate-x-1'}`} />
                  </button>
                </label>
              </div>
              <p className="text-sm text-text-secondary">
                At this time (UTC) every day, all active WhatsApp members automatically receive an
                <strong> &ldquo;✅ I&apos;m in Office&rdquo;</strong> check-in button.
              </p>
              <div className="flex items-center gap-3">
                <input
                  type="time"
                  value={checkinTime}
                  onChange={(e) => setCheckinTime(e.target.value)}
                  disabled={!checkinEnabled}
                  className="rounded-lg border border-border-color bg-bg-primary px-3 py-2 text-sm text-text-primary focus:outline-none focus:ring-2 focus:ring-accent disabled:opacity-50"
                />
                <span className="text-sm text-text-secondary">UTC time</span>
              </div>
              {checkinEnabled && !checkinTime && (
                <p className="flex items-center gap-1 text-xs text-amber-600">
                  <AlertTriangle className="h-3 w-3" /> Set a time or disable the schedule.
                </p>
              )}
            </div>

            {/* Team invite message — shown to a new member with Accept/Decline buttons */}
            <div className="rounded-2xl border border-border-color bg-card-bg p-5 space-y-3">
              <div className="flex items-start gap-3">
                <div className="mt-0.5 flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-accent/10">
                  <UserPlus className="h-4 w-4 text-accent" />
                </div>
                <div>
                  <h2 className="text-base font-semibold text-text-primary">Team Invite Message</h2>
                  <p className="text-sm text-text-secondary">
                    The WhatsApp message a new member sees. Buttons (Accept / Decline) are added automatically.
                  </p>
                </div>
              </div>

              <div>
                <label className="mb-1 block text-xs font-medium text-text-secondary">
                  Header <span className="font-normal text-text-secondary/70">— up to 60 chars</span>
                </label>
                <input
                  value={inviteHeader}
                  onChange={(e) => setInviteHeader(e.target.value.slice(0, 60))}
                  maxLength={60}
                  placeholder="Team Invite"
                  className="w-full rounded-lg border border-border-color bg-bg-primary px-3 py-2 text-sm text-text-primary placeholder:text-text-secondary focus:outline-none focus:ring-2 focus:ring-accent"
                />
              </div>

              <div>
                <label className="mb-1 block text-xs font-medium text-text-secondary">Body</label>
                <textarea
                  value={inviteBody}
                  onChange={(e) => setInviteBody(e.target.value.slice(0, 1024))}
                  maxLength={1024}
                  rows={3}
                  placeholder="You've been invited to join {business}. Accept to start receiving tasks."
                  className="w-full rounded-lg border border-border-color bg-bg-primary px-3 py-2 text-sm text-text-primary placeholder:text-text-secondary focus:outline-none focus:ring-2 focus:ring-accent resize-y"
                />
                <div className="mt-1 flex items-center justify-between text-xs text-text-secondary">
                  <div>
                    Variables:{' '}
                    <code className="rounded bg-bg-secondary px-1">{'{business}'}</code>,{' '}
                    <code className="rounded bg-bg-secondary px-1">{'{name}'}</code>
                  </div>
                  <span>{inviteBody.length}/1024</span>
                </div>
              </div>

              {/* Preview */}
              <div className="rounded-lg bg-bg-secondary/60 p-3">
                <div className="text-[11px] font-semibold uppercase tracking-wider text-text-secondary mb-1.5">Preview</div>
                <div className="rounded-md bg-bg-primary p-3 text-sm">
                  <div className="font-semibold text-text-primary">
                    {(inviteHeader.trim() || 'Team Invite')}
                  </div>
                  <p className="mt-1 text-text-primary/90 whitespace-pre-wrap">
                    {(inviteBody.trim() || "You've been invited to join {business}. Accept to start receiving tasks.")
                      .replaceAll('{business}', 'Your business')
                      .replaceAll('{name}', 'Alex')}
                  </p>
                  <div className="mt-2 flex gap-2 border-t border-border-color pt-2">
                    <span className="rounded-md bg-bg-secondary px-2 py-1 text-xs font-medium text-text-primary">Accept</span>
                    <span className="rounded-md bg-bg-secondary px-2 py-1 text-xs font-medium text-text-primary">Decline</span>
                  </div>
                </div>
              </div>
            </div>

            <button
              type="button"
              onClick={() => void handleSave()}
              disabled={saving}
              className="inline-flex items-center gap-2 rounded-lg bg-accent px-6 py-2.5 text-sm font-semibold text-white hover:opacity-90 disabled:opacity-60"
            >
              <Save className="h-4 w-4" />
              {saving ? 'Saving…' : saved ? 'Saved!' : 'Save settings'}
            </button>

            {/* AI human takeover (WhatsApp Business app sync) */}
            <div className="rounded-2xl border border-border-color bg-card-bg p-5 space-y-4">
              <div className="flex items-start justify-between gap-3">
                <div className="flex items-start gap-3">
                  <div className="mt-0.5 flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-accent/10">
                    <Bot className="h-4 w-4 text-accent" />
                  </div>
                  <div>
                    <h2 className="text-base font-semibold text-text-primary">Human Takeover from the WhatsApp App</h2>
                    <p className="text-sm text-text-secondary">
                      When you reply to a customer directly from the WhatsApp Business app, pause the AI on
                      that conversation so the bot and you don&apos;t both answer.
                    </p>
                  </div>
                </div>
                <label className="flex cursor-pointer items-center gap-2 shrink-0">
                  <span className="text-sm text-text-secondary">{takeoverEnabled ? 'On' : 'Off'}</span>
                  <button
                    type="button"
                    onClick={() => setTakeoverEnabled((v) => !v)}
                    className={`relative inline-flex h-5 w-9 items-center rounded-full transition-colors ${takeoverEnabled ? 'bg-accent' : 'bg-border-color'}`}
                  >
                    <span className={`inline-block h-3.5 w-3.5 transform rounded-full bg-white transition-transform ${takeoverEnabled ? 'translate-x-4' : 'translate-x-1'}`} />
                  </button>
                </label>
              </div>

              <div className={`flex flex-wrap items-center gap-2 ${takeoverEnabled ? '' : 'opacity-50'}`}>
                <span className="text-sm text-text-secondary">Resume the AI after</span>
                <input
                  type="number"
                  min={1}
                  max={720}
                  value={resumeHours}
                  onChange={(e) => setResumeHours(e.target.value)}
                  disabled={!takeoverEnabled}
                  className="w-20 rounded-lg border border-border-color bg-bg-primary px-3 py-2 text-sm text-text-primary focus:outline-none focus:ring-2 focus:ring-accent disabled:opacity-60"
                />
                <span className="text-sm text-text-secondary">hours of no human reply.</span>
              </div>
              <p className="text-xs text-text-secondary">
                The AI resumes on the next customer message once this window has passed. It never resumes a
                conversation you set to manual yourself.
              </p>

              <button
                type="button"
                onClick={() => void handleSaveTakeover()}
                disabled={takeoverSaving}
                className="inline-flex items-center gap-2 rounded-lg bg-accent px-6 py-2.5 text-sm font-semibold text-white hover:opacity-90 disabled:opacity-60"
              >
                <Save className="h-4 w-4" />
                {takeoverSaving ? 'Saving…' : takeoverSaved ? 'Saved!' : 'Save takeover settings'}
              </button>
            </div>
          </>
        )}
      </div>
    </PermissionGuard>
  );
}
