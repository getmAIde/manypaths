/**
 * supabase.js — Supabase client for ManyPaths
 * Used for: research_usage (free tier tracking) + research_saves (persistent saves)
 */

import { createClient } from '@supabase/supabase-js';

const SUPABASE_URL  = process.env.SUPABASE_URL  || 'https://cvniwzqfiauwvslxjjbm.supabase.co';
// Use service role key server-side (bypasses RLS — all access is server-mediated).
// Falls back to anon key for local dev without service role set.
const SUPABASE_KEY  = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.SUPABASE_ANON_KEY || '';

export const supabase = createClient(SUPABASE_URL, SUPABASE_KEY);

export const FREE_LIMIT = 3;

function currentMonth() {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
}

// ─── Usage tracking ───────────────────────────────────────────────────────────

/**
 * Check if a user/fingerprint has runs remaining this month.
 * Returns { allowed: bool, remaining: number, count: number }
 */
export async function checkUsage(userId, fingerprint) {
  const month = currentMonth();
  const match = userId
    ? { user_id: userId, month }
    : { fingerprint, month };

  const { data, error } = await supabase
    .from('research_usage')
    .select('run_count')
    .match(match)
    .maybeSingle();

  if (error) {
    console.error('[supabase/checkUsage]', error.message);
    // Fail open — don't block users if DB is down
    return { allowed: true, remaining: FREE_LIMIT, count: 0 };
  }

  const count = data?.run_count ?? 0;
  return {
    allowed: count < FREE_LIMIT,
    remaining: Math.max(0, FREE_LIMIT - count),
    count
  };
}

/**
 * Increment run count for a user/fingerprint this month.
 * @deprecated Use atomicIncrementUsage instead — this has a race condition.
 */
export async function incrementUsage(userId, fingerprint) {
  await atomicIncrementUsage(userId, fingerprint);
}

/**
 * Atomically increment the run count and return the new count.
 * Uses a Postgres RPC with ON CONFLICT to avoid race conditions.
 * Returns { newCount, allowed } where allowed = newCount <= FREE_LIMIT.
 */
export async function atomicIncrementUsage(userId, fingerprint) {
  const month = currentMonth();

  const { data, error } = await supabase.rpc('increment_usage_atomic', {
    p_fingerprint: fingerprint ?? null,
    p_user_id:     userId     ?? null,
    p_month:       month,
  });

  if (error) {
    console.error('[supabase/atomicIncrementUsage]', error.message);
    // Fail open — don't block users if DB is down
    return { newCount: 1, allowed: true };
  }

  const newCount = data ?? 1;
  return { newCount, allowed: newCount <= FREE_LIMIT };
}

// ─── Saves ────────────────────────────────────────────────────────────────────

export async function listSaves(userId) {
  const { data, error } = await supabase
    .from('research_saves')
    .select('id, title, tradition, denomination, topic, format, depth, language, created_at, updated_at')
    .eq('user_id', userId)
    .order('updated_at', { ascending: false });

  if (error) throw new Error(error.message);
  return data;
}

export async function getSave(userId, saveId) {
  const { data, error } = await supabase
    .from('research_saves')
    .select('*')
    .eq('user_id', userId)
    .eq('id', saveId)
    .single();

  if (error) throw new Error(error.message);
  if (data && typeof data.output === 'string') {
    try { data.output = JSON.parse(data.output); } catch { /* leave as string */ }
  }
  return data;
}

export async function createSave(userId, payload) {
  const { title, tradition, denomination, topic, format, depth, language, output } = payload;
  const outputStr = typeof output === 'string' ? output : JSON.stringify(output);
  const { data, error } = await supabase
    .from('research_saves')
    .insert({ user_id: userId, title, tradition, denomination, topic, format, depth, language: language || 'en', output: outputStr })
    .select()
    .single();

  if (error) throw new Error(error.message);
  return data;
}


export async function deleteSave(userId, saveId) {
  const { error } = await supabase
    .from('research_saves')
    .delete()
    .eq('user_id', userId)
    .eq('id', saveId);

  if (error) throw new Error(error.message);
}
