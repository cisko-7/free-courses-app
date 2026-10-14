import { createClient } from '@supabase/supabase-js';

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || 'https://nvfdedgzhkkhqdonzqjg.supabase.co';
const supabaseAnonKey =
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || 'sb_publishable_e8kqV5i-DFfISvfP6j9yNg_GQMSzxjI';

export const supabase = createClient(supabaseUrl, supabaseAnonKey);