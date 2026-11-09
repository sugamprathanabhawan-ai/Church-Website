const tables = [
  'admin_users', 'youth_notices', 'youth_schedules', 'youth_groups',
  'choir_notices', 'choir_schedules', 'choir_layouts', 'youtube_songs',
  'quiz_questions', 'quiz_leaderboard', 'faq_items', 'church_settings',
  'church_documents', 'audio_sermons', 'sessions', 'zen_upload_tickets',
  'lyrics_songs', 'lyrics_song_versions'
];
const url = 'https://aiufpdabglxhojmmkedp.supabase.co/rest/v1';
const key = 'sb_publishable_qDJqr6BpPMTWLaL_C9n8Cw_TgKfgCBB';

async function check() {
  const results = await Promise.all(tables.map(async t => {
    try {
      const res = await fetch(`${url}/${t}?select=count`, {
        headers: { 'apikey': key, 'Authorization': `Bearer ${key}`, 'Range': '0-0' }
      });
      return { table: t, status: res.status };
    } catch (err) {
      return { table: t, status: 'ERROR', error: err.message };
    }
  }));

  console.log('Existing tables:');
  results.filter(r => r.status === 200 || r.status === 206).forEach(r => console.log('  [OK]', r.table));
  console.log('Missing/Forbidden tables:');
  results.filter(r => r.status !== 200 && r.status !== 206).forEach(r => console.log('  [FAILED]', r.table, 'status:', r.status));
}

check();
