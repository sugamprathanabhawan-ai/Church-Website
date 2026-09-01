import { createClient } from '@supabase/supabase-js';

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL || 'https://aiufpdabglxhojmmkedp.supabase.co';
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY || 'sb_publishable_qDJqr6BpPMTWLaL_C9n8Cw_TgKfgCBB';

if (!supabaseUrl || !supabaseAnonKey) {
  console.error('[Supabase] Missing Supabase URL or Anon Key in environment variables.');
}

export const supabase = createClient(supabaseUrl, supabaseAnonKey, {
  auth: {
    persistSession: true,
    autoRefreshToken: true
  },
  realtime: {
    params: {
      eventsPerSecond: 10
    }
  }
});

export default supabase;
