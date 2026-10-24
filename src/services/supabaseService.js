import { supabase } from '../lib/supabase';
import { extractYouTubeId } from '../utils/dataSyncEngine';
import { DEFAULT_SUGAM_SONGS } from '../utils/lyricsChordParser';
import { DEFAULT_AUDIO_SERMONS } from '../utils/defaultSermons';

export function formatSupabaseError(error, context = 'Database operation') {
  if (!error) return new Error(`${context} failed`);
  if (
    error.code === '42501' || 
    error.message?.includes('row-level security') || 
    error.message?.includes('violates row-level security')
  ) {
    return new Error(
      `Permission Denied (RLS): The database policy blocked this operation. Please verify that your account has administrator privileges in public.admin_users.`
    );
  }
  if (
    error.code === '42P01' ||
    error.code === 'PGRST205' ||
    error.message?.includes('does not exist') ||
    error.message?.includes('schema cache')
  ) {
    return new Error(
      `${context} notice: The required database table or RPC function is not found in Supabase. Please apply the latest "supabase_schema.sql" in your Supabase SQL Editor.`
    );
  }
  return new Error(error.message || `${context} failed`);
}

// ============================================================================
// 1. YOUTH ROUTINE SERVICES
// ============================================================================

export async function fetchYouthData() {
  try {
    const [noticesRes, schedulesRes, groupsRes] = await Promise.all([
      supabase.from('youth_notices').select('*').order('sort_order', { ascending: true }),
      supabase.from('youth_schedules').select('*').order('sort_order', { ascending: true }),
      supabase.from('youth_groups').select('*').order('sort_order', { ascending: true })
    ]);

    if (noticesRes.error) throw noticesRes.error;
    if (schedulesRes.error) throw schedulesRes.error;
    if (groupsRes.error) throw groupsRes.error;

    const notices = (noticesRes.data || []).map(n => n.text);

    // Group schedules by month_title
    const monthsMap = new Map();
    (schedulesRes.data || []).forEach(row => {
      const monthTitle = row.month_title || 'Routine';
      if (!monthsMap.has(monthTitle)) {
        monthsMap.set(monthTitle, { id: row.id, title: monthTitle, rows: [] });
      }
      monthsMap.get(monthTitle).rows.push({
        id: row.id,
        date: row.date_str,
        activity: row.activity
      });
    });
    const months = Array.from(monthsMap.values());

    // Build youth group object
    let leader = '';
    const teams = [];
    (groupsRes.data || []).forEach(g => {
      if (g.leader_name && !leader) {
        leader = g.leader_name;
      }
      teams.push({
        id: g.id,
        captain: g.captain_name || '',
        members: Array.isArray(g.members) ? g.members : []
      });
    });

    return {
      notices,
      months,
      group: { leader, teams }
    };
  } catch (error) {
    console.error('[supabaseService] Failed to fetch youth data:', error);
    throw error;
  }
}

export async function saveYouthData(data) {
  try {
    const noticesPayload = (data.notices || [])
      .filter(t => t && t.trim())
      .map(t => t.trim());

    const schedulesPayload = [];
    (data.months || []).forEach(month => {
      const title = month.title || 'Routine';
      (month.rows || []).forEach(r => {
        schedulesPayload.push({
          month_title: title,
          date_str: r.date || '',
          activity: r.activity || ''
        });
      });
    });

    const leader = data.group?.leader || 'Aryan Rai';
    const teams = data.group?.teams || [];
    const groupsPayload = teams.map(team => ({
      leader_name: leader,
      captain_name: team.captain || '',
      members: Array.isArray(team.members) 
        ? team.members 
        : (team.members ? String(team.members).split(',').map(m => m.trim()).filter(Boolean) : [])
    }));

    // Atomic PostgreSQL RPC execution
    const { data: rpcRes, error: rpcErr } = await supabase.rpc('sync_youth_routine', {
      p_notices: noticesPayload,
      p_schedules: schedulesPayload,
      p_groups: groupsPayload
    });

    if (rpcErr) {
      if (rpcErr.code === 'PGRST202') {
        // Safe, non-destructive direct table synchronization
        // 1. Fetch existing IDs first so we never delete before new records are confirmed
        const [oldNotices, oldSchedules, oldGroups] = await Promise.all([
          supabase.from('youth_notices').select('id'),
          supabase.from('youth_schedules').select('id'),
          supabase.from('youth_groups').select('id')
        ]);

        // 2. Insert new records
        if (noticesPayload.length > 0) {
          const { error: insNoticesErr } = await supabase.from('youth_notices').insert(noticesPayload.map((text, idx) => ({ text, sort_order: idx })));
          if (insNoticesErr) throw insNoticesErr;
        }
        if (schedulesPayload.length > 0) {
          const { error: insSchedErr } = await supabase.from('youth_schedules').insert(schedulesPayload.map((s, idx) => ({ ...s, sort_order: idx })));
          if (insSchedErr) throw insSchedErr;
        }
        if (groupsPayload.length > 0) {
          const { error: insGroupsErr } = await supabase.from('youth_groups').insert(groupsPayload.map((g, idx) => ({ ...g, sort_order: idx })));
          if (insGroupsErr) throw insGroupsErr;
        }

        // 3. Clean up previously existing records only after successful insertion
        const prunePromises = [];
        if (oldNotices.data?.length > 0) {
          prunePromises.push(supabase.from('youth_notices').delete().in('id', oldNotices.data.map(r => r.id)));
        }
        if (oldSchedules.data?.length > 0) {
          prunePromises.push(supabase.from('youth_schedules').delete().in('id', oldSchedules.data.map(r => r.id)));
        }
        if (oldGroups.data?.length > 0) {
          prunePromises.push(supabase.from('youth_groups').delete().in('id', oldGroups.data.map(r => r.id)));
        }
        await Promise.all(prunePromises);
        return true;
      }
      console.error('[supabaseService] Atomic sync_youth_routine RPC failed:', rpcErr);
      throw formatSupabaseError(rpcErr, 'Syncing youth routine');
    }

    return true;
  } catch (error) {
    console.error('[supabaseService] Failed to save youth data:', error);
    throw formatSupabaseError(error, 'Saving youth data');
  }
}

// ============================================================================
// 2. CHOIR ROUTINE SERVICES
// ============================================================================

export async function fetchChoirData() {
  try {
    const [noticesRes, schedulesRes, layoutsRes] = await Promise.all([
      supabase.from('choir_notices').select('*').order('sort_order', { ascending: true }),
      supabase.from('choir_schedules').select('*').order('sort_order', { ascending: true }),
      supabase.from('choir_layouts').select('*').order('sort_order', { ascending: true })
    ]);

    if (noticesRes.error) throw noticesRes.error;
    if (schedulesRes.error) throw schedulesRes.error;
    if (layoutsRes.error) throw layoutsRes.error;

    const notices = (noticesRes.data || []).map(n => n.text);

    // Group schedules by month_name
    const monthsMap = new Map();
    (schedulesRes.data || []).forEach(row => {
      const monthName = row.month_name || 'Choir Routine';
      if (!monthsMap.has(monthName)) {
        monthsMap.set(monthName, { name: monthName, dates: [] });
      }
      const items = Array.isArray(row.items) && row.items.length > 0
        ? row.items
        : [{ time: row.time_str || '', work: row.work_str || '' }];

      monthsMap.get(monthName).dates.push({
        id: row.id,
        date: row.date_str,
        items
      });
    });
    const months = Array.from(monthsMap.values());

    // Group layouts by group_title (e.g. 5 Saturdays, 4 Saturdays)
    const layoutsMap = new Map();
    (layoutsRes.data || []).forEach(row => {
      const groupTitle = row.group_title || 'Layout';
      const count = groupTitle.match(/\d+/)?.[0] || '5';
      if (!layoutsMap.has(groupTitle)) {
        layoutsMap.set(groupTitle, { title: groupTitle, count, days: [] });
      }
      layoutsMap.get(groupTitle).days.push({
        id: row.id,
        title: row.saturday_title,
        saturday: row.saturday_title.split(' ')[0] || '1st',
        activities: Array.isArray(row.activities) ? row.activities : []
      });
    });
    const layoutGroups = Array.from(layoutsMap.values());

    return {
      notices,
      months,
      layoutGroups
    };
  } catch (error) {
    console.error('[supabaseService] Failed to fetch choir data:', error);
    throw error;
  }
}

export async function saveChoirData(data) {
  try {
    const noticesPayload = (data.notices || [])
      .filter(t => t && t.trim())
      .map(t => ({ text: t.trim() }));

    const schedulesPayload = [];
    (data.months || []).forEach(month => {
      const monthName = month.name || 'Routine';
      (month.dates || []).forEach(d => {
        const items = Array.isArray(d.items) ? d.items : [];
        const firstItem = items[0] || {};
        schedulesPayload.push({
          month_name: monthName,
          date_str: d.date || '',
          time_str: firstItem.time || '',
          work_str: firstItem.work || '',
          items
        });
      });
    });

    const layoutsPayload = [];
    (data.layoutGroups || []).forEach(group => {
      const groupTitle = group.title || `${group.count || 5} Saturdays`;
      (group.days || []).forEach(day => {
        layoutsPayload.push({
          group_title: groupTitle,
          saturday_title: day.title || `${day.saturday || '1st'} Saturday`,
          activities: Array.isArray(day.activities) ? day.activities : []
        });
      });
    });

    // Atomic PostgreSQL RPC execution
    const { data: rpcRes, error: rpcErr } = await supabase.rpc('sync_choir_routine', {
      p_notices: noticesPayload,
      p_schedules: schedulesPayload,
      p_layouts: layoutsPayload
    });

    if (rpcErr) {
      if (rpcErr.code === 'PGRST202') {
        // Safe, non-destructive direct table synchronization
        // 1. Fetch existing IDs first
        const [oldNotices, oldSchedules, oldLayouts] = await Promise.all([
          supabase.from('choir_notices').select('id'),
          supabase.from('choir_schedules').select('id'),
          supabase.from('choir_layouts').select('id')
        ]);

        // 2. Insert new records
        if (noticesPayload.length > 0) {
          const { error: insNoticesErr } = await supabase.from('choir_notices').insert(noticesPayload.map((text, idx) => ({ text, sort_order: idx })));
          if (insNoticesErr) throw insNoticesErr;
        }
        if (schedulesPayload.length > 0) {
          const { error: insSchedErr } = await supabase.from('choir_schedules').insert(schedulesPayload.map((s, idx) => ({ ...s, sort_order: idx })));
          if (insSchedErr) throw insSchedErr;
        }
        if (layoutsPayload.length > 0) {
          const { error: insLayoutsErr } = await supabase.from('choir_layouts').insert(layoutsPayload.map((l, idx) => ({ ...l, sort_order: idx })));
          if (insLayoutsErr) throw insLayoutsErr;
        }

        // 3. Clean up replaced records only after successful insertion
        const prunePromises = [];
        if (oldNotices.data?.length > 0) {
          prunePromises.push(supabase.from('choir_notices').delete().in('id', oldNotices.data.map(r => r.id)));
        }
        if (oldSchedules.data?.length > 0) {
          prunePromises.push(supabase.from('choir_schedules').delete().in('id', oldSchedules.data.map(r => r.id)));
        }
        if (oldLayouts.data?.length > 0) {
          prunePromises.push(supabase.from('choir_layouts').delete().in('id', oldLayouts.data.map(r => r.id)));
        }
        await Promise.all(prunePromises);
        return true;
      }
      console.error('[supabaseService] Atomic sync_choir_routine RPC failed:', rpcErr);
      throw formatSupabaseError(rpcErr, 'Syncing choir routine');
    }

    return true;
  } catch (error) {
    console.error('[supabaseService] Failed to save choir data:', error);
    throw formatSupabaseError(error, 'Saving choir data');
  }
}

// ============================================================================
// 3. YOUTUBE SONGS SERVICES
// ============================================================================

export async function fetchYouTubeSongs() {
  try {
    const { data, error } = await supabase
      .from('youtube_songs')
      .select('*')
      .order('sort_order', { ascending: true });

    if (error) throw error;

    const songs = (data || []).map(s => ({
      id: s.id,
      name: s.name,
      link: s.link,
      videoId: s.video_id || extractYouTubeId(s.link)
    }));

    return { songs };
  } catch (error) {
    console.error('[supabaseService] Failed to fetch youtube songs:', error);
    throw error;
  }
}

export async function saveYouTubeSongs(songsArray) {
  try {
    const songsPayload = (Array.isArray(songsArray) ? songsArray : [])
      .filter(s => s && s.name && s.name.trim())
      .map(s => ({
        name: s.name.trim(),
        link: s.link || '',
        video_id: extractYouTubeId(s.link || '')
      }));

    // Atomic PostgreSQL RPC execution
    const { data: rpcRes, error: rpcErr } = await supabase.rpc('sync_youtube_songs', {
      p_songs: songsPayload
    });

    if (rpcErr) {
      if (rpcErr.code === 'PGRST202') {
        // Safe, non-destructive direct table synchronization
        const { data: oldSongs } = await supabase.from('youtube_songs').select('id');
        if (songsPayload.length > 0) {
          const { error: insSongsErr } = await supabase.from('youtube_songs').insert(songsPayload.map((s, idx) => ({ ...s, sort_order: idx })));
          if (insSongsErr) throw insSongsErr;
        }
        if (oldSongs && oldSongs.length > 0) {
          await supabase.from('youtube_songs').delete().in('id', oldSongs.map(r => r.id));
        }
        return true;
      }
      console.error('[supabaseService] Atomic sync_youtube_songs RPC failed:', rpcErr);
      throw formatSupabaseError(rpcErr, 'Syncing worship songs');
    }

    return true;
  } catch (error) {
    console.error('[supabaseService] Failed to save youtube songs:', error);
    throw formatSupabaseError(error, 'Saving worship songs');
  }
}

export async function addYouTubeSong(song) {
  const { data, error } = await supabase.from('youtube_songs').insert([{
    name: song.name,
    link: song.link,
    video_id: extractYouTubeId(song.link),
    sort_order: song.sort_order || 999
  }]).select().single();
  if (error) throw error;
  return data;
}

export async function deleteYouTubeSong(id) {
  const { error } = await supabase.from('youtube_songs').delete().eq('id', id);
  if (error) throw error;
  return true;
}

// ============================================================================
// 4. BIBLE QUIZ & LEADERBOARD SERVICES
// ============================================================================

export async function fetchQuizQuestions(limit = 100) {
  try {
    const { data, error } = await supabase
      .from('quiz_questions')
      .select('*')
      .order('sort_order', { ascending: true })
      .limit(limit);

    if (error) throw error;

    return (data || []).map(q => ({
      id: q.id,
      question: q.question,
      options: Array.isArray(q.options) ? q.options : [],
      answer: typeof q.answer === 'number' ? q.answer : 0,
      reference: q.reference || '',
      category: q.category || 'General'
    }));
  } catch (error) {
    console.error('[supabaseService] Failed to fetch quiz questions:', error);
    return [];
  }
}

export async function fetchQuizLeaderboard(limit = 10) {
  try {
    const { data, error } = await supabase
      .from('quiz_leaderboard')
      .select('*')
      .order('score', { ascending: false })
      .order('created_at', { ascending: false })
      .limit(limit);

    if (error) throw error;
    return data || [];
  } catch (error) {
    console.error('[supabaseService] Failed to fetch leaderboard:', error);
    return [];
  }
}

export async function submitQuizScore(playerName, score, streak = 0) {
  try {
    const rawName = (playerName || 'Faithful Player').trim();
    const cleanName = rawName
      .replace(/[<>{}`$\\]/g, '')
      .replace(/[\r\n\t]+/g, ' ')
      .trim()
      .slice(0, 30);

    if (cleanName.length < 2) {
      throw new Error('Player name must be between 2 and 30 characters.');
    }

    const numScore = parseInt(score, 10) || 0;
    const numStreak = parseInt(streak, 10) || 0;

    if (numScore < 0 || numScore > 2500) {
      throw new Error('Invalid score: must be between 0 and 2,500 points.');
    }
    if (numStreak < 0 || numStreak > 10) {
      throw new Error('Invalid streak: must be between 0 and 10 consecutive answers.');
    }

    // Client-side anti-spam throttling (15 seconds between submissions)
    if (typeof window !== 'undefined' && window.sessionStorage) {
      const lastSubmit = Number(sessionStorage.getItem('sugam_last_quiz_submit') || 0);
      if (Date.now() - lastSubmit < 15000) {
        throw new Error('Please wait 15 seconds before submitting another score.');
      }
    }

    const { data, error } = await supabase
      .from('quiz_leaderboard')
      .insert([{
        player_name: cleanName,
        score: numScore,
        streak: numStreak
      }])
      .select()
      .single();

    if (error) throw error;

    if (typeof window !== 'undefined' && window.sessionStorage) {
      sessionStorage.setItem('sugam_last_quiz_submit', String(Date.now()));
    }

    return data;
  } catch (error) {
    console.error('[supabaseService] Failed to submit quiz score:', error);
    throw error;
  }
}

export async function clearQuizLeaderboard() {
  try {
    const { error } = await supabase
      .from('quiz_leaderboard')
      .delete()
      .neq('id', '00000000-0000-0000-0000-000000000000');
    if (error) throw error;
    return true;
  } catch (error) {
    console.error('[supabaseService] Failed to clear leaderboard:', error);
    throw error;
  }
}

// ============================================================================
// 5. CHATBOT FAQS SERVICES
// ============================================================================

export async function fetchFaqs() {
  try {
    const { data, error } = await supabase
      .from('faq_items')
      .select('*')
      .order('sort_order', { ascending: true });

    if (error) throw error;
    return (data || []).map(f => ({
      id: f.id,
      question: f.question,
      answer: f.answer,
      keywords: Array.isArray(f.keywords) ? f.keywords : []
    }));
  } catch (error) {
    console.error('[supabaseService] Failed to fetch faqs:', error);
    return [];
  }
}

// ============================================================================
// 6. DATABASE DIAGNOSTIC PING & CHURCH SETTINGS
// ============================================================================

export async function fetchChurchSetting(key, defaultValue = null) {
  try {
    const { data, error } = await supabase
      .from('church_settings')
      .select('value')
      .eq('key', key)
      .maybeSingle();

    if (error) throw error;
    return data ? data.value : defaultValue;
  } catch (err) {
    console.warn(`[supabaseService] Failed to fetch setting "${key}":`, err.message);
    return defaultValue;
  }
}

export async function saveChurchSetting(key, value) {
  try {
    const { data, error } = await supabase
      .from('church_settings')
      .upsert({
        key,
        value,
        updated_at: new Date().toISOString()
      }, { onConflict: 'key' })
      .select()
      .single();

    if (error) throw error;
    return data?.value || value;
  } catch (err) {
    console.warn(`[supabaseService] Failed to save setting "${key}":`, err.message);
    throw err;
  }
}

export async function testDatabaseConnection() {
  const startTime = performance.now();
  try {
    const { count, error } = await supabase
      .from('youtube_songs')
      .select('*', { count: 'exact', head: true });

    const latency = Math.round(performance.now() - startTime);
    if (error) {
      return { online: false, latency: 0, error: error.message };
    }
    return { online: true, latency, songCount: count };
  } catch (err) {
    return { online: false, latency: 0, error: err.message };
  }
}

// ============================================================================
// 7. CHURCH DOCUMENTS & PDF REPOSITORY (CALENDAR, LAWS, CHOIR)
// ============================================================================

const DOCS_CACHE_KEY = 'sugam_church_docs_cache';

export async function fetchChurchDocuments(section = null) {
  try {
    let query = supabase
      .from('church_documents')
      .select('*')
      .order('sort_order', { ascending: true })
      .order('created_at', { ascending: false });

    if (section) {
      query = query.eq('section', section);
    }

    const { data, error } = await query;
    if (error) throw error;

    const list = (data || []).map(d => ({
      id: d.id,
      section: d.section,
      title: d.title || d.name || 'Untitled Document',
      name: d.title || d.name || 'Untitled Document',
      file: d.file_url,
      fileUrl: d.file_url,
      fileName: d.file_name || 'document.pdf',
      fileSize: d.file_size || 0,
      createdAt: d.created_at
    }));

    // Update local cache
    try {
      const existing = JSON.parse(localStorage.getItem(DOCS_CACHE_KEY) || '{}');
      if (section) {
        existing[section] = list;
      } else {
        ['calendar', 'laws', 'choir'].forEach(sec => {
          existing[sec] = list.filter(item => item.section === sec);
        });
      }
      localStorage.setItem(DOCS_CACHE_KEY, JSON.stringify(existing));
    } catch {}

    return list;
  } catch (error) {
    console.warn('[supabaseService] Falling back for church documents:', error);
    // 1. Try church_settings fallback
    try {
      const { data: settingsData } = await supabase
        .from('church_settings')
        .select('value')
        .eq('key', 'church_documents')
        .single();

      if (settingsData && settingsData.value) {
        const allDocs = Array.isArray(settingsData.value) ? settingsData.value : [];
        const filtered = section ? allDocs.filter(d => d.section === section) : allDocs;
        return filtered.map(d => ({
          id: d.id || Math.random().toString(),
          section: d.section,
          title: d.title || d.name || 'Document',
          name: d.title || d.name || 'Document',
          file: d.fileUrl || d.file,
          fileUrl: d.fileUrl || d.file,
          fileName: d.fileName || 'document.pdf',
          fileSize: d.fileSize || 0,
          createdAt: d.createdAt || new Date().toISOString()
        }));
      }
    } catch {}

    // 2. Try localStorage cache fallback
    try {
      const cached = JSON.parse(localStorage.getItem(DOCS_CACHE_KEY) || '{}');
      if (section && Array.isArray(cached[section])) {
        return cached[section];
      }
      if (!section) {
        return Object.values(cached).flat();
      }
    } catch {}

    return [];
  }
}

export async function addChurchDocument({ section, title, fileUrl, fileName = '', fileSize = 0 }) {
  if (!section || !title || !fileUrl) {
    throw new Error('Section, document title, and file URL are required');
  }

  const docData = {
    section: section.toLowerCase().trim(),
    title: title.trim(),
    file_url: fileUrl.trim(),
    file_name: fileName || title.trim() + '.pdf',
    file_size: fileSize || 0,
    sort_order: 0
  };

  try {
    const { data, error } = await supabase
      .from('church_documents')
      .insert([docData])
      .select()
      .single();

    if (error) throw error;
    if (!data) {
      throw new Error('Database insert succeeded but returned no document data.');
    }

    const newDoc = {
      id: data.id,
      section: data.section,
      title: data.title,
      name: data.title,
      file: data.file_url,
      fileUrl: data.file_url,
      fileName: data.file_name,
      fileSize: data.file_size,
      createdAt: data.created_at
    };

    // Keep church_settings synced as secondary mirror
    try {
      const current = await fetchChurchDocuments();
      await supabase.from('church_settings').upsert({
        key: 'church_documents',
        value: current
      });
    } catch (syncErr) {
      console.warn('[supabaseService] Secondary church_settings sync notice:', syncErr);
    }

    // Update local cache ONLY after remote persistence succeeds
    try {
      const cached = JSON.parse(localStorage.getItem(DOCS_CACHE_KEY) || '{}');
      if (!cached[newDoc.section]) cached[newDoc.section] = [];
      cached[newDoc.section].unshift(newDoc);
      localStorage.setItem(DOCS_CACHE_KEY, JSON.stringify(cached));
    } catch {}

    return newDoc;
  } catch (error) {
    console.error('[supabaseService] Failed to insert into church_documents:', error);
    throw formatSupabaseError(error, 'Adding church document');
  }
}

export async function deleteChurchDocument(id) {
  if (!id) {
    throw new Error('Document ID is required for deletion');
  }

  try {
    // 1. Fetch file URL before deleting database row so we can clean up storage
    let fileUrlToDelete = null;
    try {
      const { data: docData } = await supabase
        .from('church_documents')
        .select('file_url')
        .eq('id', id)
        .maybeSingle();
      if (docData?.file_url) {
        fileUrlToDelete = docData.file_url;
      }
    } catch (fetchErr) {
      console.warn('[supabaseService] Could not pre-fetch document record:', fetchErr);
    }

    // 2. Delete database row with exact count verification
    const { error, count } = await supabase
      .from('church_documents')
      .delete({ count: 'exact' })
      .eq('id', id);

    if (error) throw error;
    if (count === 0) {
      throw new Error(`Document with ID "${id}" was not found or could not be deleted.`);
    }

    // 3. Clean up associated storage file if stored on Supabase Storage
    if (fileUrlToDelete && typeof fileUrlToDelete === 'string') {
      try {
        const storageMatch = fileUrlToDelete.match(/\/storage\/v1\/object\/public\/([^/]+)\/(.+)$/);
        if (storageMatch) {
          const bucket = storageMatch[1];
          const objectPath = decodeURIComponent(storageMatch[2]);
          await supabase.storage.from(bucket).remove([objectPath]);
        }
      } catch (cleanErr) {
        console.warn('[supabaseService] Non-critical storage object cleanup warning:', cleanErr);
      }
    }

    // 4. Sync church_settings fallback & localStorage ONLY after remote persistence succeeds
    try {
      const current = await fetchChurchDocuments();
      const updated = current.filter(d => d.id !== id);
      await supabase.from('church_settings').upsert({
        key: 'church_documents',
        value: updated
      });
    } catch {}

    try {
      const cached = JSON.parse(localStorage.getItem(DOCS_CACHE_KEY) || '{}');
      for (const key of Object.keys(cached)) {
        if (Array.isArray(cached[key])) {
          cached[key] = cached[key].filter(d => d.id !== id);
        }
      }
      localStorage.setItem(DOCS_CACHE_KEY, JSON.stringify(cached));
    } catch {}

    return true;
  } catch (error) {
    console.error('[supabaseService] Failed to delete from church_documents:', error);
    throw formatSupabaseError(error, 'Deleting document');
  }
}

const ALLOWED_DOC_EXTENSIONS = ['.pdf'];
const MAX_DOC_SIZE = 25 * 1024 * 1024; // 25 MB

export async function uploadChurchDocumentFile(file) {
  if (!file) throw new Error('No file provided for upload');

  // Validate MIME type / extension
  const isPdf = file.type === 'application/pdf' || file.name.toLowerCase().endsWith('.pdf');
  if (!isPdf) {
    throw new Error('Invalid file type. Only PDF documents (.pdf) are allowed.');
  }

  // Validate File Size
  if (file.size > MAX_DOC_SIZE) {
    throw new Error(`Document size exceeds the 25MB limit (File is ${(file.size / (1024 * 1024)).toFixed(1)}MB).`);
  }

  const cleanName = file.name.replace(/[^a-zA-Z0-9._-]/g, '_');
  const filePath = `documents/${Date.now()}_${cleanName}`;

  try {
    const { error } = await supabase.storage
      .from('church_documents')
      .upload(filePath, file, {
        cacheControl: '3600',
        upsert: true,
        contentType: 'application/pdf'
      });

    if (error) throw error;

    const { data: publicUrlData } = supabase.storage
      .from('church_documents')
      .getPublicUrl(filePath);

    if (!publicUrlData?.publicUrl) {
      throw new Error('Failed to retrieve public URL after storage upload.');
    }

    return {
      fileUrl: publicUrlData.publicUrl,
      fileName: file.name,
      fileSize: file.size
    };
  } catch (storageError) {
    console.error('[supabaseService] Storage bucket upload failed:', storageError);
    throw formatSupabaseError(storageError, 'Uploading document to Supabase Storage');
  }
}

// ============================================================================
// 6. WEBSITE PICTURES & MEDIA MANAGEMENT SERVICES
// ============================================================================

export const DEFAULT_WEBSITE_PICTURES = {
  carousel: [
    { id: 'c1', image: "/images/start.webp", text: "Welcome to Our Saturday Service" },
    { id: 'c2', image: "/images/com.webp", text: "Community & Fellowship Programs" },
    { id: 'c3', image: "/images/js3.webp", text: "Empowering Next Generation Youth" },
    { id: 'c4', image: "/images/js2.webp", text: "Youth Fellowship in Action" },
    { id: 'c5', image: "/images/js.webp", text: "Youth Praise & Prayer" },
    { id: 'c6', image: "/images/gs.webp", text: "House Fellowship Ministry" },
    { id: 'c7', image: "/images/bs.webp", text: "Joyful Children's Ministry" },
    { id: 'c8', image: "/images/bs2.webp", text: "Sunday School & Kids Fellowship" },
    { id: 'c9', image: "/images/bs4.webp", text: "Bible Teaching for Children" },
    { id: 'c10', image: "/images/ama4.webp", text: "Mothers' Prayer Fellowship" },
    { id: 'c11', image: "/images/ama.webp", text: "Women's Ministry in Faith" },
    { id: 'c12', image: "/images/carol1.webp", text: "Christmas Carol Celebration" },
    { id: 'c13', image: "/images/carol2.webp", text: "Joyous Carol Service" },
    { id: 'c14', image: "/images/choir1.webp", text: "Harmonious Choir Ministry" },
    { id: 'c15', image: "/images/choir2.webp", text: "Choir Praise and Worship" },
  ],
  gallery: [
    { id: 'g1', src: "/images/img1.webp", caption: "Church Fellowship & Community" },
    { id: 'g2', src: "/images/img2.webp", caption: "Worship & Praise Service" },
    { id: 'g3', src: "/images/img3.webp", caption: "Youth Gathering" },
    { id: 'g4', src: "/images/img4.webp", caption: "Prayer Meeting Moments" },
    { id: 'g5', src: "/images/img5.webp", caption: "Church Celebration" },
    { id: 'g6', src: "/images/img6.webp", caption: "Worship Time" },
    { id: 'g7', src: "/images/img7.webp", caption: "Church Events & Fellowship" },
    { id: 'g8', src: "/images/img8.webp", caption: "Community Outreach" },
    { id: 'g9', src: "/images/img9.webp", caption: "Choir Practice" },
    { id: 'g10', src: "/images/img10.webp", caption: "Joyful Worship Service" },
    { id: 'g11', src: "/images/img11.webp", caption: "Church Family Gathering" },
  ],
  leaders: [
    { id: 'l1', name: "किरण थापा", role: "पास्टर (Senior Pastor)", image: "/images/ag1.webp", category: "pastoral" },
    { id: 'l2', name: "दीपक थापा", role: "सह पास्टर (Co-Pastor)", image: "/images/ag2.webp", category: "pastoral" },
    { id: 'l3', name: "नरेश राई", role: "एल्डर (Elder)", image: "/images/ag3.webp", category: "pastoral" },
    { id: 'l4', name: "खड्क चौधरी", role: "डिकन (Deacon)", image: "/images/ag4.webp", category: "deacon" },
    { id: 'l5', name: "बिलास पोख्रेल", role: "डिकन (Deacon)", image: "/images/ag5.webp", category: "deacon" },
    { id: 'l6', name: "नरेन राई", role: "डिकन (Deacon)", image: "/images/ag6.webp", category: "deacon" },
    { id: 'l7', name: "मान बहादुर श्रेष्ठ", role: "डिकन (Deacon)", image: "/images/ag7.webp", category: "deacon" },
    { id: 'l8', name: "स्टीफन तामाङ", role: "डिकन (Deacon)", image: "/images/ag8.webp", category: "deacon" },
    { id: 'l9', name: "आर्यन राई", role: "युवा अगुवा तथा आराधक (Youth Leader & Worship)", image: "/images/you3.png", category: "youth_worship" },
    { id: 'l10', name: "सारा पौडेल", role: "युवा क्याप्टेन तथा आराधक (Youth Captain)", image: "/images/you1.jpg", category: "youth_worship" },
    { id: 'l11', name: "सुरज पोख्रेल", role: "युवा सदस्य / संगति (Yakub Fellowship)", image: "/images/you2.jpg", category: "youth_worship" },
    { id: 'l12', name: "उर्मिला चौधरी", role: "युवा सदस्य / संगति (Yahunna Fellowship)", image: "/images/you4.jpg", category: "youth_worship" },
    { id: 'l13', name: "ममता राई", role: "आराधक (Worship Ministry)", image: "/images/choir1.webp", category: "worship" },
    { id: 'l14', name: "सृष्टि खड्का", role: "आराधक (Worship Ministry)", image: "/images/choir2.webp", category: "worship" },
  ]
};

const PICS_CACHE_KEY = 'sugam_website_pictures';

export function sanitizeLeadershipRoles(leaders) {
  if (!Array.isArray(leaders)) return leaders;
  return leaders.map(member => {
    let role = member.role || '';
    const isSara = member.id === 'l10' || (member.name && (member.name.includes('सारा') || member.name.toLowerCase().includes('sara')));
    const isNaresh = member.id === 'l3' || (member.name && (member.name.includes('नरेश') || member.name.toLowerCase().includes('naresh')));

    if (!isSara && /captain|क्याप्टेन/i.test(role)) {
      role = role.replace(/युवा क्याप्टेन/gi, 'युवा सदस्य / संगति')
                 .replace(/Youth Captain/gi, 'Fellowship Member')
                 .replace(/क्याप्टेन|Captain/gi, 'संगति')
                 .trim();
    }
    if (isSara && !/क्याप्टेन/i.test(role)) {
      role = 'युवा क्याप्टेन तथा आराधक (Youth Captain)';
    }
    if (!isNaresh && /elder|एल्डर/i.test(role)) {
      role = role.replace(/एल्डर|Elder/gi, 'अगुवा (Leader)').trim();
    }
    if (isNaresh && !/एल्डर/i.test(role)) {
      role = 'एल्डर (Elder)';
    }

    return {
      ...member,
      role
    };
  });
}

export async function fetchWebsitePictures() {
  try {
    const { data, error } = await supabase
      .from('church_settings')
      .select('value')
      .eq('key', 'website_pictures')
      .maybeSingle();

    if (!error && data && data.value) {
      localStorage.setItem(PICS_CACHE_KEY, JSON.stringify(data.value));
      return {
        carousel: data.value.carousel || DEFAULT_WEBSITE_PICTURES.carousel,
        gallery: data.value.gallery || DEFAULT_WEBSITE_PICTURES.gallery,
        leaders: sanitizeLeadershipRoles(data.value.leaders || DEFAULT_WEBSITE_PICTURES.leaders),
      };
    }
  } catch (err) {
    console.warn('[supabaseService] Error fetching website_pictures:', err);
  }

  // Fallback to local storage
  const cached = localStorage.getItem(PICS_CACHE_KEY);
  if (cached) {
    try {
      const parsed = JSON.parse(cached);
      return {
        carousel: parsed.carousel || DEFAULT_WEBSITE_PICTURES.carousel,
        gallery: parsed.gallery || DEFAULT_WEBSITE_PICTURES.gallery,
        leaders: sanitizeLeadershipRoles(parsed.leaders || DEFAULT_WEBSITE_PICTURES.leaders),
      };
    } catch {
      // ignore
    }
  }

  return {
    ...DEFAULT_WEBSITE_PICTURES,
    leaders: sanitizeLeadershipRoles(DEFAULT_WEBSITE_PICTURES.leaders)
  };
}

export async function saveWebsitePictures(data) {
  const payload = {
    carousel: data.carousel || [],
    gallery: data.gallery || [],
    leaders: data.leaders || [],
  };

  try {
    const { error } = await supabase.from('church_settings').upsert({
      key: 'website_pictures',
      value: payload
    });
    if (error) throw formatSupabaseError(error, 'Saving website pictures');

    // Update local cache ONLY after remote persistence succeeds
    localStorage.setItem(PICS_CACHE_KEY, JSON.stringify(payload));
  } catch (err) {
    console.error('[supabaseService] Error saving website_pictures to church_settings:', err);
    throw formatSupabaseError(err, 'Saving website pictures');
  }
}

const ALLOWED_IMAGE_TYPES = ['image/jpeg', 'image/png', 'image/webp', 'image/gif'];
const MAX_IMAGE_SIZE = 5 * 1024 * 1024; // 5 MB

export async function uploadWebsiteImage(file) {
  if (!file) throw new Error('No image file provided for upload');

  // Validate MIME type
  if (file.type && !ALLOWED_IMAGE_TYPES.includes(file.type)) {
    throw new Error('Invalid image format. Allowed formats: JPG, PNG, WebP, GIF.');
  }

  // Validate Size
  if (file.size > MAX_IMAGE_SIZE) {
    throw new Error(`Image file exceeds the 5MB limit (File is ${(file.size / (1024 * 1024)).toFixed(1)}MB).`);
  }

  const cleanName = file.name.replace(/[^a-zA-Z0-9._-]/g, '_');
  const filePath = `website_media/${Date.now()}_${cleanName}`;

  // 1. First try church_documents bucket
  try {
    const { data, error } = await supabase.storage
      .from('church_documents')
      .upload(filePath, file, { 
        cacheControl: '3600', 
        upsert: true,
        contentType: file.type || 'image/jpeg'
      });

    if (!error && data) {
      const { data: publicUrlData } = supabase.storage
        .from('church_documents')
        .getPublicUrl(filePath);
      if (publicUrlData?.publicUrl) {
        return publicUrlData.publicUrl;
      }
    }
    if (error) throw error;
  } catch (err) {
    console.warn('[supabaseService] Upload to church_documents bucket failed, trying zen_sync_images fallback:', err.message);
  }

  // 2. Secondary bucket fallback: zen_sync_images
  try {
    const zenPath = `church_website/${Date.now()}_${cleanName}`;
    const { data, error } = await supabase.storage
      .from('zen_sync_images')
      .upload(zenPath, file, { 
        cacheControl: '3600', 
        upsert: true,
        contentType: file.type || 'image/jpeg'
      });

    if (!error && data) {
      const { data: publicUrlData } = supabase.storage
        .from('zen_sync_images')
        .getPublicUrl(zenPath);
      if (publicUrlData?.publicUrl) {
        return publicUrlData.publicUrl;
      }
    }
    if (error) throw error;
  } catch (err) {
    console.error('[supabaseService] Image storage upload failed across both buckets:', err);
    throw formatSupabaseError(err, 'Uploading image to Supabase Storage');
  }

  throw new Error('Failed to retrieve public image URL after upload.');
}

// ============================================================================
// 10. SUGAM LYRICS BOOK SERVICES
// ============================================================================

const LYRICS_STORAGE_KEY = 'sugam_lyrics_songs_fallback';
const LYRICS_VERSIONS_STORAGE_KEY = 'sugam_lyrics_versions_fallback';
const LYRICS_DELETED_IDS_KEY = 'sugam_lyrics_deleted_ids';

function getDeletedSongIds() {
  try {
    const raw = localStorage.getItem(LYRICS_DELETED_IDS_KEY);
    if (raw) {
      const parsed = JSON.parse(raw);
      if (Array.isArray(parsed)) return parsed;
    }
  } catch {}
  return [];
}

function saveDeletedSongId(songId) {
  if (!songId) return;
  try {
    const ids = getDeletedSongIds();
    if (!ids.includes(songId)) {
      ids.push(songId);
      localStorage.setItem(LYRICS_DELETED_IDS_KEY, JSON.stringify(ids));
    }
  } catch {}
}

function getLocalLyricsFallback() {
  const deletedIds = getDeletedSongIds();
  try {
    const raw = localStorage.getItem(LYRICS_STORAGE_KEY);
    if (raw !== null) {
      const parsed = JSON.parse(raw);
      if (Array.isArray(parsed)) {
        return parsed.filter(s => s && s.id && !deletedIds.includes(s.id));
      }
    }
  } catch (err) {
    console.warn('[supabaseService] Error reading local lyrics fallback:', err);
  }

  // Initial load when localStorage has never been set: filter default songs by any previously deleted IDs
  const initial = DEFAULT_SUGAM_SONGS.filter(s => s && s.id && !deletedIds.includes(s.id));
  try {
    localStorage.setItem(LYRICS_STORAGE_KEY, JSON.stringify(initial));
  } catch {}
  return initial;
}

function saveLocalLyricsFallback(songs) {
  try {
    localStorage.setItem(LYRICS_STORAGE_KEY, JSON.stringify(songs));
  } catch (err) {
    console.warn('[supabaseService] Error saving local lyrics fallback:', err);
  }
}

function getLocalVersionsFallback() {
  try {
    const raw = localStorage.getItem(LYRICS_VERSIONS_STORAGE_KEY);
    if (raw) return JSON.parse(raw);
  } catch {}
  return {};
}

function saveLocalVersionsFallback(versionsMap) {
  try {
    localStorage.setItem(LYRICS_VERSIONS_STORAGE_KEY, JSON.stringify(versionsMap));
  } catch {}
}

/**
 * Fetch songs from lyrics_songs table
 * @param {boolean} includeDrafts - If false, fetches published songs only (for regular members)
 */
export async function fetchLyricsSongs(includeDrafts = false) {
  try {
    let query = supabase.from('lyrics_songs').select('*');

    if (!includeDrafts) {
      query = query.eq('status', 'published').order('title', { ascending: true });
    } else {
      query = query.order('updated_at', { ascending: false });
    }

    const { data, error } = await query;

    if (error) {
      console.warn('[supabaseService] lyrics_songs fetch returned error, using fallback:', error.message);
      const local = getLocalLyricsFallback();
      return includeDrafts ? local : local.filter(s => s.status === 'published');
    }

    if (Array.isArray(data) && data.length > 0) {
      // Update local cache
      saveLocalLyricsFallback(data);
      return data;
    }

    // If database table is empty, seed or return initial defaults
    const local = getLocalLyricsFallback();
    return includeDrafts ? local : local.filter(s => s.status === 'published');
  } catch (err) {
    console.warn('[supabaseService] fetchLyricsSongs failed, using local cache:', err);
    const local = getLocalLyricsFallback();
    return includeDrafts ? local : local.filter(s => s.status === 'published');
  }
}

/**
 * Fetch version history for a specific song
 */
export async function fetchLyricsSongVersions(songId) {
  if (!songId) return [];
  try {
    const { data, error } = await supabase
      .from('lyrics_song_versions')
      .select('*')
      .eq('song_id', songId)
      .order('version_number', { ascending: false });

    if (error) {
      console.warn('[supabaseService] fetchLyricsSongVersions DB error:', error.message);
      const localVersions = getLocalVersionsFallback();
      return localVersions[songId] || [];
    }

    return data || [];
  } catch (err) {
    console.warn('[supabaseService] fetchLyricsSongVersions catch fallback:', err);
    const localVersions = getLocalVersionsFallback();
    return localVersions[songId] || [];
  }
}

/**
 * Save song (Create or Edit, Draft or Published) with version history
 */
export async function saveLyricsSong(songData) {
  if (!songData || !songData.title || !songData.title.trim()) {
    throw new Error('Song title is required.');
  }

  const cleanTitle = songData.title.trim();
  const searchLines = (songData.sections || [])
    .flatMap(s => (s.lines || []).map(l => l.text))
    .filter(Boolean)
    .join(' ');
  const searchText = `${cleanTitle} ${songData.author || ''} ${searchLines}`.toLowerCase();

  const isExisting = Boolean(songData.id && !songData.id.startsWith('temp_'));
  const songId = isExisting ? songData.id : undefined;

  const payload = {
    title: cleanTitle,
    author: (songData.author || '').trim(),
    key_signature: songData.key_signature || songData.keySignature || 'G',
    time_signature: songData.time_signature || songData.timeSignature || '4/4',
    category: songData.category || 'Worship',
    language: songData.language || 'Nepali',
    status: songData.status || 'draft',
    sections: songData.sections || [],
    search_text: searchText,
    source_file_url: songData.source_file_url || null,
    updated_at: new Date().toISOString()
  };

  try {
    // 1. Try atomic RPC if available
    const { data: rpcRes, error: rpcErr } = await supabase.rpc('save_lyrics_song_with_version', {
      p_id: songId || null,
      p_title: payload.title,
      p_author: payload.author,
      p_key: payload.key_signature,
      p_time_sig: payload.time_signature,
      p_category: payload.category,
      p_language: payload.language,
      p_status: payload.status,
      p_sections: payload.sections,
      p_search_text: payload.search_text,
      p_source_file_url: payload.source_file_url
    });

    if (!rpcErr && rpcRes) {
      // Update local storage cache
      const currentLocal = getLocalLyricsFallback();
      const updatedLocal = isExisting
        ? currentLocal.map(s => s.id === rpcRes.id ? rpcRes : s)
        : [rpcRes, ...currentLocal];
      saveLocalLyricsFallback(updatedLocal);
      return rpcRes;
    }

    if (rpcErr && rpcErr.code !== 'PGRST202') {
      console.warn('[supabaseService] save_lyrics_song_with_version RPC error, trying direct upsert:', rpcErr);
    }

    // 2. Direct table upsert fallback
    if (isExisting) {
      // Snapshot previous published version if we are publishing an edit
      if (payload.status === 'published') {
        const { data: existingData } = await supabase
          .from('lyrics_songs')
          .select('*')
          .eq('id', songId)
          .maybeSingle();

        if (existingData && existingData.status === 'published') {
          const newVersion = (existingData.version || 1) + 1;
          payload.version = newVersion;

          // Snapshot previous version
          try {
            await supabase.from('lyrics_song_versions').insert([{
              song_id: songId,
              version_number: existingData.version || 1,
              title: existingData.title,
              metadata: {
                author: existingData.author,
                key_signature: existingData.key_signature,
                time_signature: existingData.time_signature,
                category: existingData.category,
                language: existingData.language
              },
              sections: existingData.sections,
              published_at: existingData.published_at || new Date().toISOString(),
              note: `Rollback snapshot before version ${newVersion}`
            }]);

            // Prune versions older than 1 previous published version
            const { data: allVers } = await supabase
              .from('lyrics_song_versions')
              .select('id')
              .eq('song_id', songId)
              .order('version_number', { ascending: false });

            if (Array.isArray(allVers) && allVers.length > 1) {
              const idsToDelete = allVers.slice(1).map(v => v.id);
              await supabase.from('lyrics_song_versions').delete().in('id', idsToDelete);
            }
          } catch (verErr) {
            console.warn('[supabaseService] Direct version snapshot error:', verErr.message);
          }
        }
      }

      const { data, error } = await supabase
        .from('lyrics_songs')
        .update(payload)
        .eq('id', songId)
        .select()
        .single();

      if (error) throw formatSupabaseError(error, 'Updating song');

      // Update local cache
      const currentLocal = getLocalLyricsFallback();
      const updatedLocal = currentLocal.map(s => s.id === data.id ? data : s);
      saveLocalLyricsFallback(updatedLocal);
      return data;
    } else {
      payload.version = 1;
      payload.created_at = new Date().toISOString();
      if (payload.status === 'published') {
        payload.published_at = new Date().toISOString();
      }

      const { data, error } = await supabase
        .from('lyrics_songs')
        .insert([payload])
        .select()
        .single();

      if (error) throw formatSupabaseError(error, 'Creating song');

      // Update local cache
      const currentLocal = getLocalLyricsFallback();
      saveLocalLyricsFallback([data, ...currentLocal]);
      return data;
    }
  } catch (err) {
    console.error('[supabaseService] saveLyricsSong error, applying local fallback:', err);
    // Offline/Local resilience
    const currentLocal = getLocalLyricsFallback();
    const finalId = songId || `local_song_${Date.now()}`;
    const localSong = {
      ...payload,
      id: finalId,
      version: (songData.version || 0) + 1,
      created_at: songData.created_at || new Date().toISOString(),
      published_at: payload.status === 'published' ? (songData.published_at || new Date().toISOString()) : null
    };

    const updatedLocal = isExisting
      ? currentLocal.map(s => s.id === finalId ? localSong : s)
      : [localSong, ...currentLocal];

    saveLocalLyricsFallback(updatedLocal);

    // Save local version snapshot if published
    if (payload.status === 'published' && isExisting) {
      const localVersions = getLocalVersionsFallback();
      const prevVersions = localVersions[finalId] || [];
      const newSnapshot = {
        id: `ver_${Date.now()}`,
        song_id: finalId,
        version_number: songData.version || 1,
        title: songData.title,
        metadata: {
          author: songData.author,
          key_signature: songData.key_signature,
          time_signature: songData.time_signature,
          category: songData.category,
          language: songData.language
        },
        sections: songData.sections,
        created_at: new Date().toISOString(),
        published_at: new Date().toISOString(),
        note: `Rollback snapshot`
      };
      // Keep only 1 rollback version
      localVersions[finalId] = [newSnapshot];
      saveLocalVersionsFallback(localVersions);
    }

    return localSong;
  }
}

/**
 * Delete song
 */
export async function deleteLyricsSong(songId) {
  if (!songId) throw new Error('Song ID is required for deletion');

  // 1. Try remote Supabase deletion (both child versions and song record)
  try {
    await supabase.from('lyrics_song_versions').delete().eq('song_id', songId);
    const { error } = await supabase.from('lyrics_songs').delete().eq('id', songId);
    if (error && error.code !== 'PGRST116' && error.code !== 'PGRST205') {
      console.warn('[supabaseService] deleteLyricsSong DB notice:', error.message);
    }
  } catch (err) {
    console.warn('[supabaseService] DB delete notice:', err);
  }

  // 2. Permanently record as deleted so it can never be resurrected by defaults
  saveDeletedSongId(songId);

  // 3. Update local fallback cache
  const currentLocal = getLocalLyricsFallback();
  const updatedLocal = currentLocal.filter(s => s && s.id !== songId);
  saveLocalLyricsFallback(updatedLocal);

  // 4. Clean up any local cached versions
  const localVersions = getLocalVersionsFallback();
  delete localVersions[songId];
  saveLocalVersionsFallback(localVersions);

  return true;
}

/**
 * Rollback song to target version
 */
export async function rollbackLyricsSong(songId, targetVersionNumber) {
  if (!songId || !targetVersionNumber) {
    throw new Error('Song ID and Target Version Number are required for rollback');
  }

  try {
    // 1. Try atomic rollback RPC
    const { data: rpcRes, error: rpcErr } = await supabase.rpc('rollback_lyrics_song', {
      p_song_id: songId,
      p_target_version: targetVersionNumber
    });

    if (!rpcErr && rpcRes) {
      const currentLocal = getLocalLyricsFallback();
      saveLocalLyricsFallback(currentLocal.map(s => s.id === rpcRes.id ? rpcRes : s));
      return rpcRes;
    }

    // 2. Direct rollback fallback
    const { data: versionRec, error: verErr } = await supabase
      .from('lyrics_song_versions')
      .select('*')
      .eq('song_id', songId)
      .eq('version_number', targetVersionNumber)
      .maybeSingle();

    if (verErr || !versionRec) {
      throw new Error(`Target version ${targetVersionNumber} not found.`);
    }

    const { data: currentSong } = await supabase
      .from('lyrics_songs')
      .select('*')
      .eq('id', songId)
      .single();

    const rolledBackSong = {
      title: versionRec.title,
      author: versionRec.metadata?.author || currentSong.author,
      key_signature: versionRec.metadata?.key_signature || currentSong.key_signature,
      time_signature: versionRec.metadata?.time_signature || currentSong.time_signature,
      category: versionRec.metadata?.category || currentSong.category,
      language: versionRec.metadata?.language || currentSong.language,
      sections: versionRec.sections,
      version: (currentSong?.version || 1) + 1,
      updated_at: new Date().toISOString()
    };

    const { data: updated, error: updateErr } = await supabase
      .from('lyrics_songs')
      .update(rolledBackSong)
      .eq('id', songId)
      .select()
      .single();

    if (updateErr) throw formatSupabaseError(updateErr, 'Rolling back song');

    const currentLocal = getLocalLyricsFallback();
    saveLocalLyricsFallback(currentLocal.map(s => s.id === updated.id ? updated : s));
    return updated;
  } catch (err) {
    console.error('[supabaseService] rollbackLyricsSong error, checking local version cache:', err);
    const localVersions = getLocalVersionsFallback();
    const songVersions = localVersions[songId] || [];
    const targetVer = songVersions.find(v => v.version_number === targetVersionNumber);

    if (!targetVer) {
      throw new Error(`Rollback failed: Version ${targetVersionNumber} could not be located.`);
    }

    const currentLocal = getLocalLyricsFallback();
    const existing = currentLocal.find(s => s.id === songId);
    if (!existing) throw new Error('Song not found in local library');

    const restored = {
      ...existing,
      title: targetVer.title,
      author: targetVer.metadata?.author || existing.author,
      key_signature: targetVer.metadata?.key_signature || existing.key_signature,
      time_signature: targetVer.metadata?.time_signature || existing.time_signature,
      category: targetVer.metadata?.category || existing.category,
      language: targetVer.metadata?.language || existing.language,
      sections: targetVer.sections,
      version: (existing.version || 1) + 1,
      updated_at: new Date().toISOString()
    };

    saveLocalLyricsFallback(currentLocal.map(s => s.id === songId ? restored : s));
    return restored;
  }
}

/**
 * Upload song photo or scanned PDF to Supabase Storage
 */
export async function uploadSongSourceDocument(file) {
  if (!file) throw new Error('No file provided for upload');
  const cleanName = (file.name || 'document').replace(/[^a-zA-Z0-9.-]/g, '_');
  const path = `lyrics_sources/${Date.now()}_${cleanName}`;

  try {
    const { data, error } = await supabase.storage
      .from('church_documents')
      .upload(path, file, {
        cacheControl: '3600',
        upsert: true,
        contentType: file.type || 'application/octet-stream'
      });

    if (!error && data) {
      const { data: pubData } = supabase.storage
        .from('church_documents')
        .getPublicUrl(path);
      if (pubData?.publicUrl) return pubData.publicUrl;
    }
  } catch (err) {
    console.warn('[supabaseService] church_documents upload failed, falling back to zen_sync_images:', err);
  }

  // Fallback bucket
  try {
    const { data, error } = await supabase.storage
      .from('zen_sync_images')
      .upload(path, file, {
        cacheControl: '3600',
        upsert: true,
        contentType: file.type || 'application/octet-stream'
      });

    if (!error && data) {
      const { data: pubData } = supabase.storage
        .from('zen_sync_images')
        .getPublicUrl(path);
      if (pubData?.publicUrl) return pubData.publicUrl;
    }
    if (error) throw error;
  } catch (err) {
    console.error('[supabaseService] Document upload failed:', err);
    throw formatSupabaseError(err, 'Uploading song photo/document');
  }

  throw new Error('Failed to retrieve file URL after upload.');
}

// ============================================================================
// 9. AUDIO SERMONS & BIBLE STREAMING SERVICES
// ============================================================================

export { DEFAULT_AUDIO_SERMONS };

const AUDIO_STORAGE_KEY = 'sugam_audio_sermons_local';

function getLocalAudioFallback() {
  try {
    const raw = typeof window !== 'undefined' ? localStorage.getItem(AUDIO_STORAGE_KEY) : null;
    if (raw) {
      const parsed = JSON.parse(raw);
      if (Array.isArray(parsed) && parsed.length > 0) return parsed;
    }
  } catch {}
  return DEFAULT_AUDIO_SERMONS;
}

function saveLocalAudioFallback(list) {
  try {
    if (typeof window !== 'undefined') {
      localStorage.setItem(AUDIO_STORAGE_KEY, JSON.stringify(list));
    }
  } catch (err) {
    console.warn('[supabaseService] Error saving local audio fallback:', err);
  }
}

/**
 * Fetch all audio sermons and Bible streaming recordings.
 * Falls back gracefully to DEFAULT_AUDIO_SERMONS if table doesn't exist yet.
 */
export async function fetchAudioSermons() {
  try {
    const { data, error } = await supabase
      .from('audio_sermons')
      .select('*')
      .order('sort_order', { ascending: true })
      .order('date_preached', { ascending: false });

    if (error) {
      // Table doesn't exist yet, schema cache missing, or connection issue: fallback gracefully
      if (
        error.code === '42P01' || 
        error.code === 'PGRST205' || 
        error.message?.includes('does not exist') ||
        error.message?.includes('schema cache')
      ) {
        console.warn('[supabaseService] audio_sermons table not found; returning local audio fallback.');
        return getLocalAudioFallback();
      }
      throw error;
    }

    if (!data || data.length === 0) {
      return getLocalAudioFallback();
    }

    // Update local cache
    saveLocalAudioFallback(data);
    return data;
  } catch (error) {
    console.warn('[supabaseService] fetchAudioSermons error, using defaults:', error.message);
    return getLocalAudioFallback();
  }
}

/**
 * Save or update an audio sermon record in Supabase.
 */
export async function saveAudioSermon(sermon) {
  if (!sermon?.title?.trim()) {
    throw new Error('Sermon title is required');
  }
  if (!sermon?.audio_url?.trim()) {
    throw new Error('Audio streaming URL or uploaded file is required');
  }

  const isNew = !sermon.id || String(sermon.id).startsWith('sermon-');
  const targetId = isNew ? `sermon-${Date.now()}` : sermon.id;
  
  const payload = {
    title: sermon.title.trim(),
    speaker: sermon.speaker?.trim() || 'पास्टर (Pastor)',
    category: sermon.category?.trim() || 'Sermon',
    scripture: sermon.scripture?.trim() || '',
    audio_url: sermon.audio_url.trim(),
    file_name: sermon.file_name || '',
    file_size: sermon.file_size || 0,
    duration: sermon.duration || '00:00',
    cover_image: sermon.cover_image || '',
    description: sermon.description?.trim() || '',
    date_preached: sermon.date_preached || new Date().toISOString().split('T')[0],
    is_featured: Boolean(sermon.is_featured),
    sort_order: Number.isInteger(sermon.sort_order) ? sermon.sort_order : 0,
    updated_at: new Date().toISOString()
  };

  if (!isNew) {
    payload.id = sermon.id;
  }

  try {
    const { data, error } = await supabase
      .from('audio_sermons')
      .upsert(payload)
      .select()
      .single();

    if (error) {
      if (
        error.code === '42P01' || 
        error.code === 'PGRST205' || 
        error.message?.includes('schema cache') ||
        error.message?.includes('does not exist')
      ) {
        // Fallback to local storage persistence
        const currentList = getLocalAudioFallback();
        const savedItem = { ...payload, id: targetId };
        const updatedList = isNew
          ? [savedItem, ...currentList]
          : currentList.map(s => s.id === sermon.id ? savedItem : s);
        saveLocalAudioFallback(updatedList);
        return savedItem;
      }
      throw error;
    }

    const currentList = getLocalAudioFallback();
    const updatedList = isNew
      ? [data, ...currentList.filter(s => s.id !== data.id)]
      : currentList.map(s => s.id === data.id ? data : s);
    saveLocalAudioFallback(updatedList);
    return data;
  } catch (error) {
    console.warn('[supabaseService] Remote save audio sermon failed, falling back to local cache:', error.message);
    const currentList = getLocalAudioFallback();
    const savedItem = { ...payload, id: targetId };
    const updatedList = isNew
      ? [savedItem, ...currentList]
      : currentList.map(s => s.id === sermon.id ? savedItem : s);
    saveLocalAudioFallback(updatedList);
    return savedItem;
  }
}

/**
 * Delete an audio sermon from Supabase with local fallback.
 */
export async function deleteAudioSermon(id) {
  if (!id) throw new Error('No sermon ID provided for deletion');

  // Prune from local cache
  const currentList = getLocalAudioFallback();
  saveLocalAudioFallback(currentList.filter(s => s.id !== id));

  // If deleting a local default placeholder
  if (String(id).startsWith('sermon-')) {
    return true;
  }

  try {
    const { error } = await supabase
      .from('audio_sermons')
      .delete()
      .eq('id', id);

    if (error && error.code !== '42P01' && error.code !== 'PGRST205') {
      throw error;
    }
    return true;
  } catch (error) {
    console.warn('[supabaseService] Delete audio sermon remote error (removed from local cache):', error.message);
    return true;
  }
}

const MAX_AUDIO_SIZE = 100 * 1024 * 1024; // 100 MB

/**
 * Upload an audio file to Supabase Storage with bucket auto-detection and fallback.
 */
export async function uploadAudioSermonFile(file) {
  if (!file) throw new Error('No audio file provided for upload');

  // Size limit check
  if (file.size > MAX_AUDIO_SIZE) {
    throw new Error(`Audio file size exceeds 100MB limit (${(file.size / (1024 * 1024)).toFixed(1)}MB). Please compress the audio to 64-96kbps or use external URL.`);
  }

  const cleanName = file.name.replace(/[^a-zA-Z0-9._-]/g, '_');
  const filePath = `sermons/${Date.now()}_${cleanName}`;
  const contentType = file.type || 'audio/mpeg';

  // 1. Try primary bucket: church_audio
  try {
    const { error: uploadErr } = await supabase.storage
      .from('church_audio')
      .upload(filePath, file, {
        cacheControl: '86400',
        upsert: true,
        contentType
      });

    if (!uploadErr) {
      const { data: pubData } = supabase.storage
        .from('church_audio')
        .getPublicUrl(filePath);

      if (pubData?.publicUrl) {
        return {
          fileUrl: pubData.publicUrl,
          fileName: file.name,
          fileSize: file.size
        };
      }
    } else {
      console.warn('[supabaseService] church_audio bucket upload failed, attempting fallback to church_documents:', uploadErr.message);
    }
  } catch (primaryErr) {
    console.warn('[supabaseService] church_audio bucket error:', primaryErr.message);
  }

  // 2. Fallback bucket: church_documents
  try {
    const fallbackPath = `audio/${Date.now()}_${cleanName}`;
    const { error: fallbackErr } = await supabase.storage
      .from('church_documents')
      .upload(fallbackPath, file, {
        cacheControl: '86400',
        upsert: true,
        contentType
      });

    if (!fallbackErr) {
      const { data: pubData } = supabase.storage
        .from('church_documents')
        .getPublicUrl(fallbackPath);

      if (pubData?.publicUrl) {
        return {
          fileUrl: pubData.publicUrl,
          fileName: file.name,
          fileSize: file.size
        };
      }
    }
    if (fallbackErr) throw fallbackErr;
  } catch (fallbackError) {
    console.error('[supabaseService] Audio storage upload failed across buckets:', fallbackError);
    throw formatSupabaseError(fallbackError, 'Uploading audio file to Supabase Storage');
  }

  throw new Error('Failed to retrieve public audio URL after upload.');
}


