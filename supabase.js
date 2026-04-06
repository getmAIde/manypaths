/**
 * supabase.js — Supabase client for ManyPaths
 * Used for: research_usage (free tier tracking) + research_saves (persistent saves)
 */

import { createClient } from '@supabase/supabase-js';

const SUPABASE_URL  = process.env.SUPABASE_URL  || 'https://cvniwzqfiauwvslxjjbm.supabase.co';
const SUPABASE_KEY  = process.env.SUPABASE_ANON_KEY || 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImN2bml3enFmaWF1d3ZzbHhqamJtIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzU0NTE2NDIsImV4cCI6MjA5MTAyNzY0Mn0.Ed6C-PWJlHwqOfXou3tRL1FVh0loPNu89Vun9epD1w4';

export const supabase = createClient(SUPABASE_URL, SUPABASE_KEY);

const FREE_LIMIT = 3;

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
 */
export async function incrementUsage(userId, fingerprint) {
  const month = currentMonth();

  if (userId) {
    const { data } = await supabase
      .from('research_usage')
      .select('id, run_count')
      .match({ user_id: userId, month })
      .maybeSingle();

    if (data) {
      await supabase
        .from('research_usage')
        .update({ run_count: data.run_count + 1, updated_at: new Date().toISOString() })
        .eq('id', data.id);
    } else {
      await supabase
        .from('research_usage')
        .insert({ user_id: userId, month, run_count: 1 });
    }
  } else if (fingerprint) {
    const { data } = await supabase
      .from('research_usage')
      .select('id, run_count')
      .match({ fingerprint, month })
      .maybeSingle();

    if (data) {
      await supabase
        .from('research_usage')
        .update({ run_count: data.run_count + 1, updated_at: new Date().toISOString() })
        .eq('id', data.id);
    } else {
      await supabase
        .from('research_usage')
        .insert({ fingerprint, month, run_count: 1 });
    }
  }
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
  return data;
}

export async function createSave(userId, payload) {
  const { title, tradition, denomination, topic, format, depth, language, output } = payload;
  const { data, error } = await supabase
    .from('research_saves')
    .insert({ user_id: userId, title, tradition, denomination, topic, format, depth, language: language || 'en', output })
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
