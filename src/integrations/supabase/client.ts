import { createClient } from '@supabase/supabase-js';
import type { Database } from './types';

const SUPABASE_URL = "https://gwyqhiqyukpshrniliuv.supabase.co";
const SUPABASE_PUBLISHABLE_KEY = "sb_publishable_LaG-KFuSU_qKJbc1zTSUNw_6ioNc_IE";

export const supabase = createClient<Database>(SUPABASE_URL, SUPABASE_PUBLISHABLE_KEY, {
  auth: {
    storage: localStorage,
    persistSession: true,
    autoRefreshToken: true,
  }
});
