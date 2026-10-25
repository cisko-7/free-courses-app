/**
 * Адрес и публичный ключ Supabase. Отдельный модуль без побочных эффектов:
 * его импортирует и клиент (lib/supabase.ts), и серверный layout для CSP.
 * Ключ anon/publishable публичный по своей природе; данные защищает RLS.
 */
export const SUPABASE_URL = (process.env.NEXT_PUBLIC_SUPABASE_URL || 'https://nvfdedgzhkkhqdonzqjg.supabase.co').trim();
export const SUPABASE_ANON_KEY = (
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || 'sb_publishable_e8kqV5i-DFfISvfP6j9yNg_GQMSzxjI'
).trim();
