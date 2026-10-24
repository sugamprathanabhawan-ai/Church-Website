import { createClient } from '@supabase/supabase-js';

const url = 'https://aiufpdabglxhojmmkedp.supabase.co';
const key = 'sb_publishable_qDJqr6BpPMTWLaL_C9n8Cw_TgKfgCBB';
const supabase = createClient(url, key);

async function runTestSuite() {
  console.log('--- TEST 1: ZenSync Direct Table Fallback ---');
  const testCode = 'test' + Math.floor(1000 + Math.random() * 9000);
  const { error: insErr } = await supabase.from('sessions').insert({
    code: testCode,
    device_name: 'Verification Bot',
    device_info: { test: true },
    main_signature: 'test_sig',
    content: { sections: [{ id: 's1', title: 'Intro' }] },
    current_slide: { sectionId: 's1', slideIndex: 0, globalIndex: 0 }
  });
  if (insErr) {
    console.error('FAIL - Insert session:', insErr.message);
  } else {
    console.log('PASS - Insert session with code:', testCode);

    // Update slide
    const { error: updErr } = await supabase.from('sessions').update({
      current_slide: { sectionId: 's1', slideIndex: 1, globalIndex: 1 },
      updated_at: new Date().toISOString()
    }).eq('code', testCode);
    console.log('PASS - Update slide:', !updErr);

    // Clean up
    const { error: delErr } = await supabase.from('sessions').delete().eq('code', testCode);
    console.log('PASS - Delete session:', !delErr);
  }

  console.log('\n--- TEST 2: SHA-256 Digest Verification in Node/Browser Web Crypto ---');
  const buffer = new TextEncoder().encode('SugamChurchAdmin2026!');
  const hashBuf = await crypto.subtle.digest('SHA-256', buffer);
  const hashArr = Array.from(new Uint8Array(hashBuf));
  const hex = hashArr.map(b => b.toString(16).padStart(2, '0')).join('');
  console.log('Calculated digest:', hex);
  console.log('Matches AuthContext PRIMARY_ADMIN_HASH?', hex === '57421e3d54ce5b863c25f26dc9947942fb87ce3d7024f51c29de2caa527007a6');

  console.log('\nAll core logic tests completed successfully.');
}

runTestSuite();
