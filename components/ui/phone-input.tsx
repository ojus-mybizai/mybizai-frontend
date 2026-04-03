'use client';

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';

// ── Country data (top markets for SMBs) ──────────────────────────────────
export interface CountryEntry {
  code: string;   // ISO 3166-1 alpha-2
  dial: string;   // e.g. "+91"
  name: string;
  flag: string;   // emoji
  pattern?: RegExp; // national number validation
  placeholder?: string;
}

const COUNTRIES: CountryEntry[] = [
  { code: 'IN', dial: '+91',  name: 'India',         flag: '\u{1F1EE}\u{1F1F3}', pattern: /^[6-9]\d{9}$/, placeholder: '98765 43210' },
  { code: 'US', dial: '+1',   name: 'United States',  flag: '\u{1F1FA}\u{1F1F8}', pattern: /^[2-9]\d{9}$/, placeholder: '(201) 555-0123' },
  { code: 'GB', dial: '+44',  name: 'United Kingdom', flag: '\u{1F1EC}\u{1F1E7}', pattern: /^\d{10,11}$/,  placeholder: '7911 123456' },
  { code: 'AE', dial: '+971', name: 'UAE',            flag: '\u{1F1E6}\u{1F1EA}', pattern: /^[0-9]\d{8}$/,  placeholder: '50 123 4567' },
  { code: 'SG', dial: '+65',  name: 'Singapore',      flag: '\u{1F1F8}\u{1F1EC}', pattern: /^[689]\d{7}$/,  placeholder: '9123 4567' },
  { code: 'AU', dial: '+61',  name: 'Australia',       flag: '\u{1F1E6}\u{1F1FA}', pattern: /^[0-9]\d{8,9}$/, placeholder: '0412 345 678' },
  { code: 'CA', dial: '+1',   name: 'Canada',          flag: '\u{1F1E8}\u{1F1E6}', pattern: /^[2-9]\d{9}$/, placeholder: '(204) 555-0123' },
  { code: 'SA', dial: '+966', name: 'Saudi Arabia',    flag: '\u{1F1F8}\u{1F1E6}', pattern: /^[0-9]\d{8}$/,  placeholder: '50 123 4567' },
  { code: 'QA', dial: '+974', name: 'Qatar',           flag: '\u{1F1F6}\u{1F1E6}', pattern: /^\d{8}$/,       placeholder: '3312 3456' },
  { code: 'KW', dial: '+965', name: 'Kuwait',          flag: '\u{1F1F0}\u{1F1FC}', pattern: /^\d{8}$/,       placeholder: '5012 3456' },
  { code: 'MY', dial: '+60',  name: 'Malaysia',        flag: '\u{1F1F2}\u{1F1FE}', pattern: /^\d{9,10}$/,    placeholder: '12-345 6789' },
  { code: 'PH', dial: '+63',  name: 'Philippines',     flag: '\u{1F1F5}\u{1F1ED}', pattern: /^[0-9]\d{9}$/,  placeholder: '917 123 4567' },
  { code: 'BD', dial: '+880', name: 'Bangladesh',      flag: '\u{1F1E7}\u{1F1E9}', pattern: /^1\d{9}$/,      placeholder: '1812-345678' },
  { code: 'PK', dial: '+92',  name: 'Pakistan',        flag: '\u{1F1F5}\u{1F1F0}', pattern: /^3\d{9}$/,      placeholder: '301 2345678' },
  { code: 'NP', dial: '+977', name: 'Nepal',           flag: '\u{1F1F3}\u{1F1F5}', pattern: /^[0-9]\d{9}$/,  placeholder: '984-1234567' },
  { code: 'LK', dial: '+94',  name: 'Sri Lanka',       flag: '\u{1F1F1}\u{1F1F0}', pattern: /^[0-9]\d{8}$/,  placeholder: '71 234 5678' },
  { code: 'DE', dial: '+49',  name: 'Germany',         flag: '\u{1F1E9}\u{1F1EA}', pattern: /^\d{10,11}$/,   placeholder: '151 23456789' },
  { code: 'FR', dial: '+33',  name: 'France',          flag: '\u{1F1EB}\u{1F1F7}', pattern: /^[0-9]\d{8}$/,  placeholder: '6 12 34 56 78' },
  { code: 'BR', dial: '+55',  name: 'Brazil',          flag: '\u{1F1E7}\u{1F1F7}', pattern: /^\d{10,11}$/,   placeholder: '11 91234 5678' },
  { code: 'ZA', dial: '+27',  name: 'South Africa',    flag: '\u{1F1FF}\u{1F1E6}', pattern: /^\d{9}$/,       placeholder: '71 234 5678' },
];

function getCountryByCode(code: string): CountryEntry {
  return COUNTRIES.find((c) => c.code === code) ?? COUNTRIES[0];
}

function getCountryByDial(dial: string): CountryEntry | undefined {
  // Sort by dial code length descending to match +971 before +97
  const sorted = [...COUNTRIES].sort((a, b) => b.dial.length - a.dial.length);
  return sorted.find((c) => dial.startsWith(c.dial));
}

// ── Validation ───────────────────────────────────────────────────────────
export function validatePhone(
  value: string,
  countryCode?: string,
): { valid: boolean; error?: string } {
  if (!value || !value.trim()) {
    return { valid: false, error: 'Phone number is required' };
  }
  const cleaned = value.replace(/[\s\-\(\)]/g, '');

  // E.164 basic check
  if (!/^\+\d{7,15}$/.test(cleaned)) {
    return { valid: false, error: 'Invalid phone format. Expected: +919876543210' };
  }

  // Country-specific validation
  if (countryCode) {
    const country = getCountryByCode(countryCode);
    if (country?.pattern) {
      const national = cleaned.slice(country.dial.length);
      if (!country.pattern.test(national)) {
        return {
          valid: false,
          error: `Invalid ${country.name} number. Expected ${country.placeholder ?? 'a valid number'}`,
        };
      }
    }
  }

  return { valid: true };
}

// ── Component ────────────────────────────────────────────────────────────
export interface PhoneInputProps {
  value: string;
  onChange: (fullNumber: string) => void;
  onBlur?: () => void;
  onKeyDown?: (e: React.KeyboardEvent) => void;
  defaultCountry?: string;
  error?: string;
  className?: string;
  placeholder?: string;
  disabled?: boolean;
  required?: boolean;
  label?: string;
}

export function PhoneInput({
  value,
  onChange,
  onBlur,
  onKeyDown,
  defaultCountry = 'IN',
  error,
  className,
  placeholder,
  disabled = false,
  required = false,
  label,
}: PhoneInputProps) {
  // Parse initial value
  const parseValue = useCallback(
    (val: string) => {
      if (!val) return { country: getCountryByCode(defaultCountry), national: '' };
      const cleaned = val.replace(/[\s\-\(\)]/g, '');
      if (cleaned.startsWith('+')) {
        const match = getCountryByDial(cleaned);
        if (match) {
          return { country: match, national: cleaned.slice(match.dial.length) };
        }
      }
      return { country: getCountryByCode(defaultCountry), national: cleaned.replace(/^\+/, '') };
    },
    [defaultCountry],
  );

  const [selectedCountry, setSelectedCountry] = useState<CountryEntry>(() => parseValue(value).country);
  const [national, setNational] = useState<string>(() => parseValue(value).national);
  const [dropdownOpen, setDropdownOpen] = useState(false);
  const wrapperRef = useRef<HTMLDivElement>(null);

  // Sync external value changes
  useEffect(() => {
    const parsed = parseValue(value);
    if (parsed.country.code !== selectedCountry.code || parsed.national !== national) {
      setSelectedCountry(parsed.country);
      setNational(parsed.national);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [value]);

  // Close dropdown on outside click
  useEffect(() => {
    function handleClick(e: MouseEvent) {
      if (wrapperRef.current && !wrapperRef.current.contains(e.target as Node)) {
        setDropdownOpen(false);
      }
    }
    document.addEventListener('mousedown', handleClick);
    return () => document.removeEventListener('mousedown', handleClick);
  }, []);

  const handleNationalChange = useCallback(
    (raw: string) => {
      // Strip non-digit chars except leading + which we handle
      const digits = raw.replace(/[^\d]/g, '');
      setNational(digits);
      onChange(digits ? `${selectedCountry.dial}${digits}` : '');
    },
    [selectedCountry, onChange],
  );

  const handleCountryChange = useCallback(
    (country: CountryEntry) => {
      setSelectedCountry(country);
      setDropdownOpen(false);
      onChange(national ? `${country.dial}${national}` : '');
    },
    [national, onChange],
  );

  const validationResult = useMemo(
    () => (national ? validatePhone(`${selectedCountry.dial}${national}`, selectedCountry.code) : null),
    [selectedCountry, national],
  );

  const displayError = error ?? (validationResult && !validationResult.valid ? validationResult.error : undefined);

  return (
    <div ref={wrapperRef} className="relative">
      {label && (
        <label className="mb-1 block text-sm font-medium text-text-primary">
          {label}
          {required && <span className="ml-0.5 text-red-500">*</span>}
        </label>
      )}
      <div
        className={`flex items-center rounded border bg-bg-primary text-sm text-text-primary ${
          displayError ? 'border-red-500' : 'border-border-color focus-within:border-accent'
        } ${disabled ? 'opacity-60' : ''} ${className ?? ''}`}
      >
        {/* Country code selector */}
        <button
          type="button"
          disabled={disabled}
          onClick={() => setDropdownOpen(!dropdownOpen)}
          className="flex shrink-0 items-center gap-1 border-r border-border-color px-2 py-2 text-sm hover:bg-bg-secondary"
        >
          <span className="text-base">{selectedCountry.flag}</span>
          <span className="text-text-secondary">{selectedCountry.dial}</span>
          <svg className="h-3 w-3 text-text-secondary" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
          </svg>
        </button>

        {/* Phone number input */}
        <input
          type="tel"
          value={national}
          onChange={(e) => handleNationalChange(e.target.value)}
          onBlur={onBlur}
          onKeyDown={onKeyDown}
          disabled={disabled}
          placeholder={placeholder ?? selectedCountry.placeholder ?? 'Enter phone number'}
          className="min-w-0 flex-1 bg-transparent px-3 py-2 outline-none placeholder:text-text-secondary/50"
        />
      </div>

      {/* Country dropdown */}
      {dropdownOpen && (
        <div className="absolute left-0 top-full z-50 mt-1 max-h-60 w-72 overflow-auto rounded border border-border-color bg-bg-primary shadow-lg">
          {COUNTRIES.map((c) => (
            <button
              key={c.code}
              type="button"
              onClick={() => handleCountryChange(c)}
              className={`flex w-full items-center gap-2 px-3 py-2 text-left text-sm hover:bg-bg-secondary ${
                c.code === selectedCountry.code ? 'bg-accent/10 font-medium text-accent' : 'text-text-primary'
              }`}
            >
              <span className="text-base">{c.flag}</span>
              <span className="flex-1">{c.name}</span>
              <span className="text-text-secondary">{c.dial}</span>
            </button>
          ))}
        </div>
      )}

      {/* Error message */}
      {displayError && <p className="mt-1 text-xs text-red-500">{displayError}</p>}
    </div>
  );
}

export { COUNTRIES, getCountryByCode, getCountryByDial };
export default PhoneInput;
