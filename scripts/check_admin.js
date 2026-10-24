import { createClient } from '@supabase/supabase-js';

const url = 'https://aiufpdabglxhojmmkedp.supabase.co';
const key = 'sb_publishable_qDJqr6BpPMTWLaL_C9n8Cw_TgKfgCBB';

const supabase = createClient(url, key);

async function testSignIn() {
  const email = 'sugamprathanabhawan@gmail.com';
  const password = 'SugamChurchAdmin2026!';
  const { data, error } = await supabase.auth.signInWithPassword({
    email,
    password
  });

  console.log('Sign in result:', {
    user: data?.user ? { id: data.user.id, email: data.user.email } : null,
    session: !!data?.session,
    error: error?.message,
    status: error?.status
  });
}

testSignIn();
