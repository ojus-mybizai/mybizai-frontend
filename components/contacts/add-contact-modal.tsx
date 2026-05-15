'use client';

import { useRef, useState } from 'react';
import { X, Bot, Users, ChevronDown, Search, AlertCircle } from 'lucide-react';
import { contactsService, type Contact, type RoutingMode } from '@/services/contacts';
import type { Agent } from '@/services/agents';

// ── Country codes ──────────────────────────────────────────────
const COUNTRY_CODES = [
  { code: 'IN', dial: '91',  flag: '🇮🇳', name: 'India' },
  { code: 'US', dial: '1',   flag: '🇺🇸', name: 'United States' },
  { code: 'GB', dial: '44',  flag: '🇬🇧', name: 'United Kingdom' },
  { code: 'AE', dial: '971', flag: '🇦🇪', name: 'UAE' },
  { code: 'SG', dial: '65',  flag: '🇸🇬', name: 'Singapore' },
  { code: 'AU', dial: '61',  flag: '🇦🇺', name: 'Australia' },
  { code: 'CA', dial: '1',   flag: '🇨🇦', name: 'Canada' },
  { code: 'SA', dial: '966', flag: '🇸🇦', name: 'Saudi Arabia' },
  { code: 'QA', dial: '974', flag: '🇶🇦', name: 'Qatar' },
  { code: 'KW', dial: '965', flag: '🇰🇼', name: 'Kuwait' },
  { code: 'BH', dial: '973', flag: '🇧🇭', name: 'Bahrain' },
  { code: 'OM', dial: '968', flag: '🇴🇲', name: 'Oman' },
  { code: 'NP', dial: '977', flag: '🇳🇵', name: 'Nepal' },
  { code: 'BD', dial: '880', flag: '🇧🇩', name: 'Bangladesh' },
  { code: 'PK', dial: '92',  flag: '🇵🇰', name: 'Pakistan' },
  { code: 'LK', dial: '94',  flag: '🇱🇰', name: 'Sri Lanka' },
  { code: 'MY', dial: '60',  flag: '🇲🇾', name: 'Malaysia' },
  { code: 'ID', dial: '62',  flag: '🇮🇩', name: 'Indonesia' },
  { code: 'PH', dial: '63',  flag: '🇵🇭', name: 'Philippines' },
  { code: 'TH', dial: '66',  flag: '🇹🇭', name: 'Thailand' },
  { code: 'VN', dial: '84',  flag: '🇻🇳', name: 'Vietnam' },
  { code: 'NZ', dial: '64',  flag: '🇳🇿', name: 'New Zealand' },
  { code: 'ZA', dial: '27',  flag: '🇿🇦', name: 'South Africa' },
  { code: 'NG', dial: '234', flag: '🇳🇬', name: 'Nigeria' },
  { code: 'KE', dial: '254', flag: '🇰🇪', name: 'Kenya' },
  { code: 'GH', dial: '233', flag: '🇬🇭', name: 'Ghana' },
  { code: 'DE', dial: '49',  flag: '🇩🇪', name: 'Germany' },
  { code: 'FR', dial: '33',  flag: '🇫🇷', name: 'France' },
  { code: 'IT', dial: '39',  flag: '🇮🇹', name: 'Italy' },
  { code: 'NL', dial: '31',  flag: '🇳🇱', name: 'Netherlands' },
  { code: 'ES', dial: '34',  flag: '🇪🇸', name: 'Spain' },
  { code: 'BR', dial: '55',  flag: '🇧🇷', name: 'Brazil' },
  { code: 'MX', dial: '52',  flag: '🇲🇽', name: 'Mexico' },
  { code: 'JP', dial: '81',  flag: '🇯🇵', name: 'Japan' },
  { code: 'CN', dial: '86',  flag: '🇨🇳', name: 'China' },
  { code: 'HK', dial: '852', flag: '🇭🇰', name: 'Hong Kong' },
] as const;

type CountryEntry = typeof COUNTRY_CODES[number];

// ── Validation helpers ─────────────────────────────────────────

/** Validates the raw phone input (may contain non-digits). */
function validatePhoneRaw(raw: string): string | null {
  if (!raw) return null;                              // empty = optional
  if (!/^\d+$/.test(raw)) return 'Phone number must contain digits only — no spaces, dashes or letters';
  if (raw.length < 6)     return 'Too short — enter at least 6 digits';
  if (raw.length > 12)    return 'Too long — enter at most 12 digits';
  return null;
}

function validateEmail(email: string): string | null {
  if (!email) return null;
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email))
    return 'Enter a valid email (e.g. name@example.com)';
  return null;
}

function validateName(name: string): string | null {
  if (!name.trim()) return 'Name is required';
  if (name.trim().length < 2) return 'Name must be at least 2 characters';
  return null;
}

/** Parse FastAPI 422 detail array → field → message map. */
function parseApiErrors(body: unknown): Record<string, string> {
  const out: Record<string, string> = {};
  if (typeof body !== 'object' || !body) return out;
  const detail = (body as Record<string, unknown>).detail;
  if (!Array.isArray(detail)) return out;
  for (const err of detail) {
    const loc: string[] = err?.loc ?? [];
    const msg: string   = err?.msg ?? 'Invalid value';
    const field = loc[loc.length - 1] ?? 'general';
    out[String(field)] = msg.replace(/^Value error, /, '');
  }
  return out;
}

// ── Props ──────────────────────────────────────────────────────

interface Props {
  agents: Agent[];
  onClose: () => void;
  onCreated: (contact: Contact) => void;
  groupName?: string | null;
}

// ── Component ──────────────────────────────────────────────────

export function AddContactModal({ agents, onClose, onCreated, groupName }: Props) {
  const [name,       setName]       = useState('');
  const [dialCode,   setDialCode]   = useState<CountryEntry>(COUNTRY_CODES[0]); // India default
  const [phoneDigits, setPhoneDigits] = useState('');
  const [email,      setEmail]      = useState('');
  const [mode,       setMode]       = useState<RoutingMode>('manual');
  const [agentId,    setAgentId]    = useState<number | null>(null);
  const [notes,      setNotes]      = useState('');
  const [saving,     setSaving]     = useState(false);

  // Per-field errors (touched = user has left the field)
  const [errors,  setErrors]  = useState<Record<string, string>>({});
  const [touched, setTouched] = useState<Record<string, boolean>>({});

  const [countryOpen,  setCountryOpen]  = useState(false);
  const [countrySearch, setCountrySearch] = useState('');
  const searchRef = useRef<HTMLInputElement>(null);

  const activeAgents = agents.filter(a => a.status === 'active');

  const filteredCountries = COUNTRY_CODES.filter(c =>
    c.name.toLowerCase().includes(countrySearch.toLowerCase()) ||
    c.dial.includes(countrySearch) ||
    c.code.toLowerCase().includes(countrySearch.toLowerCase())
  );

  // ── Field blur handlers ──────────────────────────────────────
  const blurField = (field: string, value: string) => {
    setTouched(p => ({ ...p, [field]: true }));
    let err: string | null = null;
    if (field === 'name')  err = validateName(value);
    if (field === 'phone') err = validatePhoneRaw(value);
    if (field === 'email') err = validateEmail(value);
    setErrors(p => ({ ...p, [field]: err ?? '' }));
  };

  // Validate phone input in real-time — do NOT silently strip characters
  const handlePhoneChange = (raw: string) => {
    setPhoneDigits(raw);
    if (touched.phone || raw) {
      setTouched(p => ({ ...p, phone: true }));
      const err = validatePhoneRaw(raw);
      setErrors(p => ({ ...p, phone: err ?? '' }));
    }
  };

  // ── Submit ───────────────────────────────────────────────────
  const handleSubmit = async () => {
    // Run all validations
    const nameErr  = validateName(name);
    const phoneErr = validatePhoneRaw(phoneDigits);
    const emailErr = validateEmail(email);

    const newErrors = {
      name:  nameErr  ?? '',
      phone: phoneErr ?? '',
      email: emailErr ?? '',
    };
    setErrors(newErrors);
    setTouched({ name: true, phone: true, email: true });

    if (nameErr || phoneErr || emailErr) return;

    // Build full E.164 — only if input is valid pure digits
    const cleanDigits = phoneDigits.replace(/\D/g, '');
    const fullPhone = cleanDigits ? `+${dialCode.dial}${cleanDigits}` : undefined;

    setSaving(true);
    try {
      const contact = await contactsService.create({
        name: name.trim(),
        phone: fullPhone,
        email: email.trim() || undefined,
        routing_mode: mode,
        ai_agent_id: mode === 'ai' ? agentId : null,
        notes: notes.trim() || undefined,
      });
      onCreated(contact);
    } catch (err: unknown) {
      const status = err && typeof err === 'object' && 'status' in err
        ? (err as { status: number }).status
        : 0;

      // 409 Conflict — duplicate phone or email
      if (status === 409) {
        try {
          const body = await (err as { json?: () => Promise<unknown> }).json?.();
          const msg: string = (body as Record<string, string>)?.detail ?? 'Duplicate contact.';
          // Route error to the right field and ensure it's "touched" so it renders
          if (msg.toLowerCase().includes('phone')) {
            setTouched(p => ({ ...p, phone: true }));
            setErrors(p => ({ ...p, phone: msg }));
          } else if (msg.toLowerCase().includes('email')) {
            setTouched(p => ({ ...p, email: true }));
            setErrors(p => ({ ...p, email: msg }));
          } else {
            setErrors(p => ({ ...p, general: msg }));
          }
          return;
        } catch { /* fall through */ }
      }

      // 422 Validation errors from Pydantic
      if (status === 422) {
        try {
          const body = await (err as { json?: () => Promise<unknown> }).json?.();
          const fieldErrors = parseApiErrors(body);
          if (Object.keys(fieldErrors).length) {
            setErrors(p => ({ ...p, ...fieldErrors }));
            return;
          }
        } catch { /* fall through */ }
      }

      setErrors(p => ({ ...p, general: 'Failed to create contact. Please try again.' }));
    } finally {
      setSaving(false);
    }
  };

  // ── Field error helper ───────────────────────────────────────
  const fieldError = (field: string) =>
    touched[field] && errors[field] ? errors[field] : '';

  const inputClass = (field: string) =>
    `w-full px-3 py-2 text-sm border rounded-lg bg-bg-secondary text-primary-text focus:outline-none focus:ring-2 transition-colors ${
      fieldError(field)
        ? 'border-red-400 focus:ring-red-200'
        : 'border-border-color focus:ring-accent/30'
    }`;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40">
      <div className="bg-bg-primary border border-border-color rounded-xl shadow-xl w-full max-w-md mx-4 flex flex-col max-h-[90vh]">

        {/* Header */}
        <div className="flex items-center justify-between px-6 pt-5 pb-4 border-b border-border-color flex-shrink-0">
          <h2 className="text-base font-semibold text-primary-text">Add Contact</h2>
          <button onClick={onClose} className="text-secondary-text hover:text-primary-text">
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Scrollable body */}
        <div className="overflow-y-auto flex-1 px-6 py-4">

          {/* Group badge */}
          {groupName && (
            <div className="flex items-center gap-2 mb-4 px-3 py-2 rounded-lg bg-accent/5 border border-accent/20">
              <Users className="w-3.5 h-3.5 text-accent flex-shrink-0" />
              <span className="text-xs text-accent font-medium">
                Will be added to <span className="font-semibold">{groupName}</span>
              </span>
            </div>
          )}

          <div className="space-y-4">

            {/* Name */}
            <div>
              <label className="block text-xs font-medium text-secondary-text mb-1">
                Name <span className="text-red-500">*</span>
              </label>
              <input
                value={name}
                onChange={e => setName(e.target.value)}
                onBlur={() => blurField('name', name)}
                placeholder="Full name"
                className={inputClass('name')}
              />
              <FieldError msg={fieldError('name')} />
            </div>

            {/* Phone with country code */}
            <div>
              <label className="block text-xs font-medium text-secondary-text mb-1">Phone</label>
              <div className={`flex rounded-lg border overflow-visible transition-colors ${
                fieldError('phone') ? 'border-red-400' : 'border-border-color'
              } focus-within:ring-2 ${
                fieldError('phone') ? 'focus-within:ring-red-200' : 'focus-within:ring-accent/30'
              }`}>

                {/* Country code button */}
                <div className="relative flex-shrink-0">
                  <button
                    type="button"
                    onClick={() => {
                      setCountryOpen(o => !o);
                      setTimeout(() => searchRef.current?.focus(), 50);
                    }}
                    className="flex items-center gap-1.5 h-full px-2.5 bg-bg-secondary border-r border-border-color text-sm text-primary-text hover:bg-bg-secondary/80 transition-colors rounded-l-lg"
                  >
                    <span className="text-base leading-none">{dialCode.flag}</span>
                    <span className="font-medium text-xs">+{dialCode.dial}</span>
                    <ChevronDown className="w-3 h-3 text-secondary-text" />
                  </button>

                  {/* Country dropdown */}
                  {countryOpen && (
                    <>
                      <div className="fixed inset-0 z-20" onClick={() => setCountryOpen(false)} />
                      <div className="absolute left-0 top-full mt-1 z-30 bg-bg-primary border border-border-color rounded-xl shadow-xl w-64 overflow-hidden">
                        {/* Search */}
                        <div className="flex items-center gap-2 px-3 py-2 border-b border-border-color">
                          <Search className="w-3.5 h-3.5 text-secondary-text flex-shrink-0" />
                          <input
                            ref={searchRef}
                            value={countrySearch}
                            onChange={e => setCountrySearch(e.target.value)}
                            placeholder="Search country…"
                            className="flex-1 text-xs bg-transparent text-primary-text focus:outline-none"
                          />
                        </div>
                        {/* List */}
                        <div className="max-h-52 overflow-y-auto">
                          {filteredCountries.length === 0 ? (
                            <p className="px-3 py-3 text-xs text-secondary-text text-center">No results</p>
                          ) : filteredCountries.map(c => (
                            <button
                              key={c.code}
                              onClick={() => {
                                setDialCode(c);
                                setCountryOpen(false);
                                setCountrySearch('');
                              }}
                              className={`w-full flex items-center gap-2.5 px-3 py-2.5 text-sm text-left hover:bg-bg-secondary transition-colors ${
                                dialCode.code === c.code ? 'bg-accent/5 text-accent font-medium' : 'text-primary-text'
                              }`}
                            >
                              <span className="text-base leading-none">{c.flag}</span>
                              <span className="flex-1 truncate text-xs">{c.name}</span>
                              <span className="text-xs text-secondary-text">+{c.dial}</span>
                            </button>
                          ))}
                        </div>
                      </div>
                    </>
                  )}
                </div>

                {/* Digits input */}
                <input
                  value={phoneDigits}
                  onChange={e => handlePhoneChange(e.target.value)}
                  onBlur={() => blurField('phone', phoneDigits)}
                  placeholder="9876543210"
                  inputMode="numeric"
                  className="flex-1 px-3 py-2 text-sm bg-bg-secondary text-primary-text focus:outline-none rounded-r-lg min-w-0"
                />
              </div>
              <FieldError msg={fieldError('phone')} />
              {!fieldError('phone') && /^\d+$/.test(phoneDigits) && phoneDigits && (
                <p className="text-xs text-secondary-text mt-1">
                  Will be saved as <span className="font-medium text-primary-text">+{dialCode.dial}{phoneDigits}</span>
                </p>
              )}
            </div>

            {/* Email */}
            <div>
              <label className="block text-xs font-medium text-secondary-text mb-1">Email</label>
              <input
                value={email}
                onChange={e => setEmail(e.target.value)}
                onBlur={() => blurField('email', email)}
                placeholder="name@example.com"
                type="email"
                inputMode="email"
                className={inputClass('email')}
              />
              <FieldError msg={fieldError('email')} />
            </div>

            {/* Routing mode */}
            <div>
              <label className="block text-xs font-medium text-secondary-text mb-2">When they message you</label>
              <div className="grid grid-cols-3 gap-2">
                {([
                  ['manual',  'Manual'],
                  ['ai',      'AI Agent'],
                  ['blocked', 'Block'],
                ] as [RoutingMode, string][]).map(([m, label]) => (
                  <button
                    key={m}
                    type="button"
                    onClick={() => setMode(m)}
                    className={`py-2 text-xs rounded-lg border transition-colors ${
                      mode === m
                        ? 'border-accent bg-accent/5 text-accent font-medium'
                        : 'border-border-color text-primary-text hover:bg-bg-secondary'
                    }`}
                  >
                    {label}
                  </button>
                ))}
              </div>
            </div>

            {/* Agent picker */}
            {mode === 'ai' && (
              <div>
                <label className="block text-xs font-medium text-secondary-text mb-1">
                  Assign Agent <span className="text-red-500">*</span>
                </label>
                {activeAgents.length === 0 ? (
                  <p className="text-xs text-amber-600 bg-amber-50 border border-amber-200 rounded-lg px-3 py-2">
                    No active agents found. Create an agent first.
                  </p>
                ) : (
                  <select
                    value={agentId ?? ''}
                    onChange={e => setAgentId(Number(e.target.value) || null)}
                    className="w-full px-3 py-2 text-sm border border-border-color rounded-lg bg-bg-secondary text-primary-text focus:outline-none focus:ring-2 focus:ring-accent/30"
                  >
                    <option value="">Select an agent…</option>
                    {activeAgents.map(a => (
                      <option key={a.id} value={a.id}>{a.name}</option>
                    ))}
                  </select>
                )}
              </div>
            )}

            {/* Notes */}
            <div>
              <label className="block text-xs font-medium text-secondary-text mb-1">Notes <span className="text-secondary-text font-normal">(private)</span></label>
              <textarea
                value={notes}
                onChange={e => setNotes(e.target.value)}
                placeholder="Who is this person?"
                rows={2}
                className="w-full px-3 py-2 text-sm border border-border-color rounded-lg bg-bg-secondary text-primary-text focus:outline-none focus:ring-2 focus:ring-accent/30 resize-none"
              />
            </div>
          </div>

          {/* General API error */}
          {errors.general && (
            <div className="flex items-start gap-2 mt-3 px-3 py-2 rounded-lg bg-red-50 border border-red-200">
              <AlertCircle className="w-3.5 h-3.5 text-red-500 flex-shrink-0 mt-0.5" />
              <p className="text-xs text-red-600">{errors.general}</p>
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="flex gap-3 px-6 py-4 border-t border-border-color flex-shrink-0">
          <button
            onClick={onClose}
            className="flex-1 py-2 text-sm border border-border-color rounded-lg text-primary-text hover:bg-bg-secondary transition-colors"
          >
            Cancel
          </button>
          <button
            onClick={handleSubmit}
            disabled={saving}
            className="flex-1 py-2 text-sm bg-accent text-white rounded-lg hover:bg-accent/90 font-medium disabled:opacity-60 transition-colors"
          >
            {saving ? 'Saving…' : 'Add Contact'}
          </button>
        </div>
      </div>
    </div>
  );
}

// ── Inline field error ─────────────────────────────────────────

function FieldError({ msg }: { msg: string }) {
  if (!msg) return null;
  return (
    <p className="flex items-center gap-1 text-xs text-red-500 mt-1">
      <AlertCircle className="w-3 h-3 flex-shrink-0" />
      {msg}
    </p>
  );
}
