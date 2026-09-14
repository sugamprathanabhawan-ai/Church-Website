import { supabase } from '../lib/supabase';
import { extractYouTubeId } from '../utils/dataSyncEngine';

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
    // 1. Update Notices: Insert verified new records first, then remove obsolete
    if (Array.isArray(data.notices)) {
      const noticesToInsert = data.notices
        .filter(t => t && t.trim())
        .map((text, idx) => ({
          text: text.trim(),
          sort_order: idx
        }));

      const { data: existing } = await supabase.from('youth_notices').select('id');
      const oldIds = (existing || []).map(r => r.id);

      if (noticesToInsert.length > 0) {
        const { error: insErr } = await supabase.from('youth_notices').insert(noticesToInsert);
        if (insErr) throw insErr;
        if (oldIds.length > 0) {
          await supabase.from('youth_notices').delete().in('id', oldIds);
        }
      } else if (oldIds.length > 0) {
        await supabase.from('youth_notices').delete().in('id', oldIds);
      }
    }

    // 2. Update Schedules: Insert verified new records first, then remove obsolete
    if (Array.isArray(data.months)) {
      const schedulesToInsert = [];
      let sortOrder = 0;
      data.months.forEach(month => {
        const title = month.title || 'Schedule';
        (month.rows || []).forEach(r => {
          schedulesToInsert.push({
            month_title: title,
            date_str: r.date || '',
            activity: r.activity || '',
            sort_order: sortOrder++
          });
        });
      });

      const { data: existing } = await supabase.from('youth_schedules').select('id');
      const oldIds = (existing || []).map(r => r.id);

      if (schedulesToInsert.length > 0) {
        const { error: insErr } = await supabase.from('youth_schedules').insert(schedulesToInsert);
        if (insErr) throw insErr;
        if (oldIds.length > 0) {
          await supabase.from('youth_schedules').delete().in('id', oldIds);
        }
      } else if (oldIds.length > 0) {
        await supabase.from('youth_schedules').delete().in('id', oldIds);
      }
    }

    // 3. Update Groups: Insert verified new records first, then remove obsolete
    if (data.group) {
      const leader = data.group.leader || 'Aryan Rai';
      const teams = data.group.teams || [];
      const groupsToInsert = teams.map((team, idx) => ({
        leader_name: leader,
        captain_name: team.captain || '',
        members: Array.isArray(team.members) ? team.members : (team.members ? String(team.members).split(',').map(m => m.trim()).filter(Boolean) : []),
        sort_order: idx
      }));

      const { data: existing } = await supabase.from('youth_groups').select('id');
      const oldIds = (existing || []).map(r => r.id);

      if (groupsToInsert.length > 0) {
        const { error: insErr } = await supabase.from('youth_groups').insert(groupsToInsert);
        if (insErr) throw insErr;
        if (oldIds.length > 0) {
          await supabase.from('youth_groups').delete().in('id', oldIds);
        }
      } else if (oldIds.length > 0) {
        await supabase.from('youth_groups').delete().in('id', oldIds);
      }
    }

    return true;
  } catch (error) {
    console.error('[supabaseService] Failed to save youth data:', error);
    throw error;
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
    // 1. Update Choir Notices: Insert verified new records first, then remove obsolete
    if (Array.isArray(data.notices)) {
      const noticesToInsert = data.notices
        .filter(t => t && t.trim())
        .map((text, idx) => ({
          text: text.trim(),
          sort_order: idx
        }));

      const { data: existing } = await supabase.from('choir_notices').select('id');
      const oldIds = (existing || []).map(r => r.id);

      if (noticesToInsert.length > 0) {
        const { error: insErr } = await supabase.from('choir_notices').insert(noticesToInsert);
        if (insErr) throw insErr;
        if (oldIds.length > 0) {
          await supabase.from('choir_notices').delete().in('id', oldIds);
        }
      } else if (oldIds.length > 0) {
        await supabase.from('choir_notices').delete().in('id', oldIds);
      }
    }

    // 2. Update Choir Schedules: Insert verified new records first, then remove obsolete
    if (Array.isArray(data.months)) {
      const schedulesToInsert = [];
      let sortOrder = 0;
      data.months.forEach(month => {
        const monthName = month.name || 'Routine';
        (month.dates || []).forEach(d => {
          const items = Array.isArray(d.items) ? d.items : [];
          const firstItem = items[0] || {};
          schedulesToInsert.push({
            month_name: monthName,
            date_str: d.date || '',
            time_str: firstItem.time || '',
            work_str: firstItem.work || '',
            items,
            sort_order: sortOrder++
          });
        });
      });

      const { data: existing } = await supabase.from('choir_schedules').select('id');
      const oldIds = (existing || []).map(r => r.id);

      if (schedulesToInsert.length > 0) {
        const { error: insErr } = await supabase.from('choir_schedules').insert(schedulesToInsert);
        if (insErr) throw insErr;
        if (oldIds.length > 0) {
          await supabase.from('choir_schedules').delete().in('id', oldIds);
        }
      } else if (oldIds.length > 0) {
        await supabase.from('choir_schedules').delete().in('id', oldIds);
      }
    }

    // 3. Update Choir Layouts: Insert verified new records first, then remove obsolete
    if (Array.isArray(data.layoutGroups)) {
      const layoutsToInsert = [];
      let sortOrder = 0;
      data.layoutGroups.forEach(group => {
        const groupTitle = group.title || `${group.count || 5} Saturdays`;
        (group.days || []).forEach(day => {
          layoutsToInsert.push({
            group_title: groupTitle,
            saturday_title: day.title || `${day.saturday || '1st'} Saturday`,
            activities: Array.isArray(day.activities) ? day.activities : [],
            sort_order: sortOrder++
          });
        });
      });

      const { data: existing } = await supabase.from('choir_layouts').select('id');
      const oldIds = (existing || []).map(r => r.id);

      if (layoutsToInsert.length > 0) {
        const { error: insErr } = await supabase.from('choir_layouts').insert(layoutsToInsert);
        if (insErr) throw insErr;
        if (oldIds.length > 0) {
          await supabase.from('choir_layouts').delete().in('id', oldIds);
        }
      } else if (oldIds.length > 0) {
        await supabase.from('choir_layouts').delete().in('id', oldIds);
      }
    }

    return true;
  } catch (error) {
    console.error('[supabaseService] Failed to save choir data:', error);
    throw error;
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
    const { data: existing } = await supabase.from('youtube_songs').select('id');
    const oldIds = (existing || []).map(r => r.id);

    if (Array.isArray(songsArray) && songsArray.length > 0) {
      const toInsert = songsArray
        .filter(s => s && s.name && s.name.trim())
        .map((s, idx) => ({
          name: s.name.trim(),
          link: s.link || '',
          video_id: extractYouTubeId(s.link || ''),
          sort_order: idx
        }));
      if (toInsert.length > 0) {
        const { error } = await supabase.from('youtube_songs').insert(toInsert);
        if (error) throw error;
        if (oldIds.length > 0) {
          await supabase.from('youtube_songs').delete().in('id', oldIds);
        }
      } else if (oldIds.length > 0) {
        await supabase.from('youtube_songs').delete().in('id', oldIds);
      }
    } else if (oldIds.length > 0) {
      await supabase.from('youtube_songs').delete().in('id', oldIds);
    }
    return true;
  } catch (error) {
    console.error('[supabaseService] Failed to save youtube songs:', error);
    throw error;
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
    const cleanName = (playerName || 'Faithful Player').trim().slice(0, 30);
    const { data, error } = await supabase
      .from('quiz_leaderboard')
      .insert([{
        player_name: cleanName,
        score: parseInt(score, 10) || 0,
        streak: parseInt(streak, 10) || 0
      }])
      .select()
      .single();

    if (error) throw error;
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
// 6. DATABASE DIAGNOSTIC PING
// ============================================================================

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

    // Keep church_settings synced
    try {
      const current = await fetchChurchDocuments();
      await supabase.from('church_settings').upsert({
        key: 'church_documents',
        value: current
      });
    } catch {}

    return newDoc;
  } catch (error) {
    console.error('[supabaseService] Failed to insert into church_documents, falling back to church_settings:', error);
    
    // Fallback: Save directly into church_settings
    const fallbackId = 'doc_' + Date.now();
    const newDoc = {
      id: fallbackId,
      section: docData.section,
      title: docData.title,
      name: docData.title,
      file: docData.file_url,
      fileUrl: docData.file_url,
      fileName: docData.file_name,
      fileSize: docData.file_size,
      createdAt: new Date().toISOString()
    };

    try {
      const current = await fetchChurchDocuments();
      const updated = [newDoc, ...current];
      await supabase.from('church_settings').upsert({
        key: 'church_documents',
        value: updated
      });
      
      const cached = JSON.parse(localStorage.getItem(DOCS_CACHE_KEY) || '{}');
      if (!cached[newDoc.section]) cached[newDoc.section] = [];
      cached[newDoc.section].unshift(newDoc);
      localStorage.setItem(DOCS_CACHE_KEY, JSON.stringify(cached));
    } catch {}

    return newDoc;
  }
}

export async function deleteChurchDocument(id) {
  if (!id) return false;

  try {
    const { error } = await supabase
      .from('church_documents')
      .delete()
      .eq('id', id);

    if (error) throw error;

    // Sync church_settings
    try {
      const current = await fetchChurchDocuments();
      const updated = current.filter(d => d.id !== id);
      await supabase.from('church_settings').upsert({
        key: 'church_documents',
        value: updated
      });
    } catch {}

    return true;
  } catch (error) {
    console.error('[supabaseService] Failed to delete from church_documents, using fallback sync:', error);
    try {
      const current = await fetchChurchDocuments();
      const updated = current.filter(d => d.id !== id);
      await supabase.from('church_settings').upsert({
        key: 'church_documents',
        value: updated
      });

      const cached = JSON.parse(localStorage.getItem(DOCS_CACHE_KEY) || '{}');
      for (const key of Object.keys(cached)) {
        if (Array.isArray(cached[key])) {
          cached[key] = cached[key].filter(d => d.id !== id);
        }
      }
      localStorage.setItem(DOCS_CACHE_KEY, JSON.stringify(cached));
      return true;
    } catch {
      throw error;
    }
  }
}

export async function uploadChurchDocumentFile(file) {
  if (!file) throw new Error('No file provided for upload');

  const cleanName = file.name.replace(/[^a-zA-Z0-9._-]/g, '_');
  const filePath = `documents/${Date.now()}_${cleanName}`;

  try {
    // Attempt Supabase Storage upload
    const { error } = await supabase.storage
      .from('church_documents')
      .upload(filePath, file, {
        cacheControl: '3600',
        upsert: true
      });

    if (error) throw error;

    const { data: publicUrlData } = supabase.storage
      .from('church_documents')
      .getPublicUrl(filePath);

    return {
      fileUrl: publicUrlData.publicUrl,
      fileName: file.name,
      fileSize: file.size
    };
  } catch (storageError) {
    console.warn('[supabaseService] Storage bucket upload failed, using Data URL fallback:', storageError);
    // Base64 Data URL fallback so upload succeeds seamlessly
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = () => {
        resolve({
          fileUrl: reader.result,
          fileName: file.name,
          fileSize: file.size
        });
      };
      reader.onerror = (err) => reject(err);
      reader.readAsDataURL(file);
    });
  }
}
