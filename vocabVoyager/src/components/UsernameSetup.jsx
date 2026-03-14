// src/components/UsernameSetup.jsx
// Industry-standard username setup / change modal.
//
// Rules (matches most major platforms):
//   • 3–30 characters
//   • Lowercase letters (a-z), digits (0-9), underscores (_), hyphens (-)
//   • Must start and end with a letter or digit (no leading/trailing _ or -)
//   • No consecutive special characters (__, --, _-, -_)
//   • No reserved words
//   • Globally unique (case-insensitive check against user_profiles)
//   • Can be changed any time — old username is immediately freed
//
import React, { useState, useEffect, useCallback } from 'react';
import { AtSign, CheckCircle, XCircle, Loader, X, AlertTriangle } from 'lucide-react';
import { supabase } from '../lib/supabase';

const isTableMissing = (err) =>
  err &&
  (err.message?.toLowerCase().includes('not found') ||
   err.message?.toLowerCase().includes('does not exist') ||
   err.code === '42P01');

const RESERVED = new Set([
  'admin','support','help','vocabvoyager','vocabai','dexdev',
  'superuser','moderator','root','api','www','mail','info','null','undefined',
]);

const USERNAME_RE = /^[a-z0-9][a-z0-9_-]{1,28}[a-z0-9]$/;

const validate = (raw) => {
  const v = raw.trim().toLowerCase();
  if (v.length < 3)   return 'At least 3 characters required.';
  if (v.length > 30)  return 'Max 30 characters.';
  if (!USERNAME_RE.test(v)) return 'Only a-z, 0-9, _ and -  · must start/end with a letter or digit.';
  if (/[_-]{2}/.test(v))   return 'No consecutive _ or - allowed.';
  if (RESERVED.has(v))     return `"${v}" is a reserved name.`;
  return null; // valid
};

const COOLDOWN_DAYS = 30;

const daysUntilCanChange = (lastChangedAt) => {
  if (!lastChangedAt) return 0;
  const msSince = Date.now() - new Date(lastChangedAt).getTime();
  const daysSince = msSince / 86400000;
  return Math.max(0, Math.ceil(COOLDOWN_DAYS - daysSince));
};

const UsernameSetup = ({ userId, currentUsername, lastChangedAt, displayName, onSaved, onClose }) => {
  const [value, setValue] = useState(currentUsername || '');
  const [status, setStatus] = useState(null); // null | 'checking' | 'available' | 'taken' | 'error' | 'invalid'
  const [errorMsg, setErrorMsg] = useState('');
  const [saving, setSaving] = useState(false);
  const [tablesMissing, setTablesMissing] = useState(false);

  const daysLeft = currentUsername ? daysUntilCanChange(lastChangedAt) : 0;
  const onCooldown = daysLeft > 0;

  // Auto-suggest from display name on first open
  useEffect(() => {
    if (!currentUsername && displayName) {
      const suggested = displayName
        .toLowerCase()
        .replace(/\s+/g, '_')
        .replace(/[^a-z0-9_-]/g, '')
        .slice(0, 20);
      setValue(suggested);
    }
  }, []);

  const checkAvailability = useCallback(async (raw) => {
    const v = raw.trim().toLowerCase();
    const validErr = validate(v);
    if (validErr) { setStatus('invalid'); setErrorMsg(validErr); return; }
    if (v === currentUsername) { setStatus('available'); setErrorMsg(''); return; }

    setStatus('checking');
    try {
      const { data, error } = await supabase
        .from('user_profiles')
        .select('user_id')
        .eq('username', v)
        .maybeSingle();

      if (error) {
        if (isTableMissing(error)) {
          setTablesMissing(true);
          setStatus('error');
          setErrorMsg('');
        } else {
          setStatus('error');
          setErrorMsg('Could not check availability — try again.');
        }
        return;
      }
      setTablesMissing(false);
      if (data && data.user_id !== userId) {
        setStatus('taken');
        setErrorMsg(`@${v} is already taken.`);
      } else {
        setStatus('available');
        setErrorMsg('');
      }
    } catch {
      setStatus('error');
      setErrorMsg('Network error — try again.');
    }
  }, [currentUsername, userId]);

  // Debounce check
  useEffect(() => {
    if (!value) { setStatus(null); return; }
    const t = setTimeout(() => checkAvailability(value), 500);
    return () => clearTimeout(t);
  }, [value, checkAvailability]);

  const handleSave = async () => {
    if (status !== 'available') return;
    const v = value.trim().toLowerCase();
    setSaving(true);
    try {
      const { error } = await supabase
        .from('user_profiles')
        .upsert({
          user_id: userId,
          username: v,
          username_changed_at: new Date().toISOString(),
          updated_at: new Date().toISOString()
        }, { onConflict: 'user_id' });

      if (error) {
        if (isTableMissing(error)) {
          setTablesMissing(true);
          setErrorMsg('');
        } else {
          setErrorMsg('Failed to save. Please try again.');
          setStatus('error');
        }
        return;
      }
      onSaved?.(v);
    } catch (err) {
      setErrorMsg('Failed to save. Please try again.');
      setStatus('error');
    } finally {
      setSaving(false);
    }
  };

  const statusIcon = () => {
    if (status === 'checking') return <Loader className="w-4 h-4 animate-spin text-gray-400" />;
    if (status === 'available') return <CheckCircle className="w-4 h-4 text-emerald-500" />;
    if (status === 'taken' || status === 'invalid' || status === 'error')
      return <XCircle className="w-4 h-4 text-red-400" />;
    return null;
  };

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-md">
        {/* Header */}
        <div className="flex items-center justify-between px-5 pt-5 pb-3 border-b">
          <div className="flex items-center gap-2">
            <AtSign className="w-5 h-5 text-blue-600" />
            <h2 className="text-lg font-bold text-gray-800">
              {currentUsername ? 'Change Username' : 'Set Your Username'}
            </h2>
          </div>
          {onClose && (
            <button onClick={onClose} className="p-1 text-gray-400 hover:text-gray-600 rounded transition-colors">
              <X className="w-5 h-5" />
            </button>
          )}
        </div>

        <div className="p-5 space-y-4">
          {onCooldown && (
            <div className="flex items-start gap-3 p-3 bg-blue-50 border border-blue-200 rounded-xl text-sm text-blue-800">
              <AlertTriangle className="w-5 h-5 shrink-0 mt-0.5 text-blue-400" />
              <p>
                You can change your username again in <span className="font-semibold">{daysLeft} day{daysLeft !== 1 ? 's' : ''}</span>.
                Usernames can only be changed once every {COOLDOWN_DAYS} days.
              </p>
            </div>
          )}

          {tablesMissing && (
            <div className="flex items-start gap-3 p-3 bg-amber-50 border border-amber-200 rounded-xl text-sm text-amber-800">
              <AlertTriangle className="w-5 h-5 shrink-0 mt-0.5 text-amber-500" />
              <div>
                <p className="font-semibold">Database not set up yet</p>
                <p className="text-amber-700 mt-0.5">
                  Run <code className="bg-amber-100 px-1 rounded font-mono text-xs">sql/setup_new_tables.sql</code> in your
                  Supabase SQL Editor first. Usernames and social features will work immediately after.
                </p>
              </div>
            </div>
          )}

          <p className="text-sm text-gray-500">
            Your username is how friends find you. It's unique across all of VocabVoyager.
          </p>

          {/* Input */}
          <div className="relative">
            <span className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400 font-medium select-none">@</span>
            <input
              type="text"
              value={value}
              onChange={e => setValue(e.target.value.toLowerCase().replace(/\s/g, '_'))}
              maxLength={30}
              placeholder="your_username"
              className="w-full pl-8 pr-10 py-3 border border-gray-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-blue-400 text-sm font-mono"
              autoCapitalize="none"
              autoCorrect="off"
            />
            <span className="absolute right-3 top-1/2 -translate-y-1/2">
              {statusIcon()}
            </span>
          </div>

          {/* Feedback */}
          {status === 'available' && !errorMsg && (
            <p className="text-sm text-emerald-600 flex items-center gap-1.5">
              <CheckCircle className="w-4 h-4" /> @{value.trim().toLowerCase()} is available!
            </p>
          )}
          {errorMsg && (
            <p className="text-sm text-red-500 flex items-center gap-1.5">
              <XCircle className="w-4 h-4 shrink-0" /> {errorMsg}
            </p>
          )}

          {/* Rules hint */}
          <ul className="text-[11px] text-gray-400 space-y-0.5 pl-3 border-l-2 border-gray-100">
            <li>3–30 characters · letters, numbers, _ and -</li>
            <li>Must start and end with a letter or digit</li>
            <li>No consecutive _ _ or - -</li>
            <li>Case-insensitive · unique globally</li>
          </ul>

          {/* Save */}
          <button
            onClick={handleSave}
            disabled={status !== 'available' || saving || onCooldown}
            className="w-full py-3 bg-blue-600 text-white rounded-xl font-semibold hover:bg-blue-700 disabled:opacity-40 disabled:cursor-not-allowed transition-colors flex items-center justify-center gap-2"
          >
            {saving ? <Loader className="w-4 h-4 animate-spin" /> : <CheckCircle className="w-4 h-4" />}
            {saving ? 'Saving…' : onCooldown ? `Change available in ${daysLeft}d` : currentUsername ? 'Change Username' : 'Claim Username'}
          </button>
        </div>
      </div>
    </div>
  );
};

export default UsernameSetup;
