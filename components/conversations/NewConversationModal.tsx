'use client';

import { useEffect, useState } from 'react';
import { X, MessageSquarePlus, Loader2, User } from 'lucide-react';
import {
  listVerifiedWhatsAppChannels,
  whatsAppChannelLabel,
  type Channel,
} from '@/services/channels';
import { startConversation, type StartConversationResult } from '@/services/conversations';
import { PhoneInput, validatePhone } from '@/components/ui/phone-input';

interface Props {
  open: boolean;
  onClose: () => void;
  onCreated: (result: StartConversationResult) => void;
  initialPhone?: string;
  initialName?: string;
}

export function NewConversationModal({ open, onClose, onCreated, initialPhone, initialName }: Props) {
  const [channels, setChannels] = useState<Channel[]>([]);
  const [channelId, setChannelId] = useState<string>('');
  const [phone, setPhone] = useState('');
  const [phoneError, setPhoneError] = useState<string | null>(null);
  const [name, setName] = useState('');
  const [loading, setLoading] = useState(false);
  const [loadingChannels, setLoadingChannels] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!open) return;
    setError(null);
    setPhone(initialPhone ?? '');
    setPhoneError(null);
    setName(initialName ?? '');
    setLoadingChannels(true);
    listVerifiedWhatsAppChannels()
      .then((chs) => {
        setChannels(chs);
        if (chs.length > 0) setChannelId(String(chs[0].id));
      })
      .catch(() => setError('Could not load channels.'))
      .finally(() => setLoadingChannels(false));
  }, [open]);

  if (!open) return null;

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!channelId) { setError('Select a channel.'); return; }
    if (!phone.trim()) { setError('Enter a phone number.'); return; }
    const validation = validatePhone(phone.trim());
    if (!validation.valid) {
      setPhoneError(validation.error ?? 'Invalid phone number.');
      return;
    }
    setPhoneError(null);
    setLoading(true);
    setError(null);
    try {
      const result = await startConversation({
        channel_id: Number(channelId),
        phone: phone.trim(),
        name: name.trim() || undefined,
      });
      onCreated(result);
      onClose();
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Could not start the conversation.');
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm p-4">
      <div className="relative w-full max-w-md rounded-2xl border border-border-color bg-card-bg shadow-2xl">
        <div className="flex items-center justify-between px-6 pt-5 pb-4 border-b border-border-color">
          <div className="flex items-center gap-2">
            <div className="flex h-8 w-8 items-center justify-center rounded-full bg-accent/10">
              <MessageSquarePlus className="h-4 w-4 text-accent" />
            </div>
            <h2 className="text-base font-semibold text-text-primary">New conversation</h2>
          </div>
          <button onClick={onClose} className="rounded-lg p-1.5 hover:bg-bg-secondary text-text-secondary">
            <X className="h-4 w-4" />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="px-6 py-5 space-y-4">
          {error && (
            <div className="rounded-lg bg-red-500/10 border border-red-500/20 px-3 py-2 text-xs text-red-400">
              {error}
            </div>
          )}

          <div>
            <label className="block text-xs font-medium text-text-secondary mb-1">Channel</label>
            <select
              value={channelId}
              onChange={(e) => setChannelId(e.target.value)}
              disabled={loadingChannels || channels.length === 0}
              className="w-full px-3 py-2 text-sm rounded-lg border border-border-color bg-bg-secondary text-text-primary focus:outline-none focus:border-accent disabled:opacity-60"
            >
              {channels.length === 0 && <option value="">No connected WhatsApp channel</option>}
              {channels.map((c) => (
                <option key={String(c.id)} value={String(c.id)}>{whatsAppChannelLabel(c)}</option>
              ))}
            </select>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-medium text-text-secondary mb-1">Phone</label>
              <PhoneInput
                value={phone}
                onChange={(v) => { setPhone(v); if (phoneError) setPhoneError(null); }}
                defaultCountry="IN"
                error={phoneError ?? undefined}
                className="rounded-lg"
              />
            </div>
            <div>
              <label className="block text-xs font-medium text-text-secondary mb-1">Name (optional)</label>
              <div className="relative">
                <User className="absolute left-3 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-text-secondary" />
                <input
                  type="text"
                  placeholder="Full name"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  className="w-full pl-8 pr-3 py-2 text-sm rounded-lg border border-border-color bg-bg-secondary text-text-primary placeholder:text-text-secondary focus:outline-none focus:border-accent"
                />
              </div>
            </div>
          </div>

          <p className="text-[11px] text-text-secondary">
            An existing contact with this number is reused automatically. On WhatsApp you&apos;ll need to
            send an approved template first (outside the 24-hour window).
          </p>

          <div className="flex gap-2 pt-1">
            <button
              type="button"
              onClick={onClose}
              className="flex-1 py-2 text-sm rounded-lg border border-border-color bg-bg-secondary hover:bg-card-bg text-text-secondary transition-colors"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={loading || channels.length === 0}
              className="flex-1 py-2 text-sm rounded-lg bg-accent hover:bg-accent/90 text-white font-medium transition-colors disabled:opacity-60 flex items-center justify-center gap-1.5"
            >
              {loading && <Loader2 className="h-3.5 w-3.5 animate-spin" />}
              Start chat
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
