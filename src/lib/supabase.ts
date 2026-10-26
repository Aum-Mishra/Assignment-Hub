import { createClient, SupabaseClient } from '@supabase/supabase-js';

// Support standard Vite env variables: publishable key or legacy anon key
const supabaseUrl = import.meta.env.VITE_SUPABASE_URL?.trim();
const supabaseKey = (
  import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY ||
  import.meta.env.VITE_SUPABASE_ANON_KEY ||
  ''
).trim();

export const STORAGE_BUCKET = (
  import.meta.env.VITE_SUPABASE_STORAGE_BUCKET?.trim() || 'assignments'
);

export interface SupabaseConfigStatus {
  isConfigured: boolean;
  missingVars: string[];
  supabaseUrl: string;
}

export const checkSupabaseConfig = (): SupabaseConfigStatus => {
  const missing: string[] = [];
  if (!supabaseUrl) missing.push('VITE_SUPABASE_URL');
  if (!supabaseKey) missing.push('VITE_SUPABASE_PUBLISHABLE_KEY (or VITE_SUPABASE_ANON_KEY)');

  return {
    isConfigured: missing.length === 0,
    missingVars: missing,
    supabaseUrl: supabaseUrl || '',
  };
};

export const configStatus = checkSupabaseConfig();

// Create the singleton client if configured, or null otherwise
export const supabase: SupabaseClient | null = configStatus.isConfigured
  ? createClient(supabaseUrl, supabaseKey, {
      auth: {
        persistSession: false,
        autoRefreshToken: false,
      },
    })
  : null;

/**
 * Returns the active Supabase client or throws a descriptive error
 */
export function getSupabaseClient(): SupabaseClient {
  if (!supabase) {
    throw new Error(
      'Supabase client is not configured. Please supply VITE_SUPABASE_URL and VITE_SUPABASE_PUBLISHABLE_KEY in your environment.'
    );
  }
  return supabase;
}
