/**
 * Data Utility & Routine Formatter Engine
 * Sugam Prathana Bhawan (Sugam Church)
 */

export const STORAGE_KEYS = {
  CHOIR: "sugam_choirroutine_data",
  YOUTH: "sugam_youthroutine_data",
  YOUTUBE: "sugam_youtube_data",
  QUIZ_SCORES: "sugam_quiz_scores"
};

/**
 * Escapes HTML characters
 */
export function escapeHtml(str) {
  return String(str || "").replace(/[&<>'"]/g, tag => ({
    '&': '&amp;', '<': '&lt;', '>': '&gt;', "'": '&#39;', '"': '&quot;'
  }[tag]));
}

/**
 * Extracts 11-character YouTube video ID
 */
export function extractYouTubeId(url) {
  if (!url) return "";
  try {
    const cleanUrl = String(url).trim();
    if (/^[A-Za-z0-9_-]{11}$/.test(cleanUrl)) return cleanUrl;

    const parsedUrl = new URL(cleanUrl.startsWith("http") ? cleanUrl : `https://${cleanUrl}`);
    const hostname = parsedUrl.hostname.replace(/^www\./, "").toLowerCase();

    if (hostname === "youtu.be") {
      return parsedUrl.pathname.split("/").filter(Boolean)[0] || "";
    } else if (["youtube.com", "m.youtube.com", "music.youtube.com", "youtube-nocookie.com"].includes(hostname)) {
      const vParam = parsedUrl.searchParams.get("v");
      if (vParam) return vParam;
      const paths = parsedUrl.pathname.split("/").filter(Boolean);
      if (["embed", "shorts", "live", "v"].includes(paths[0])) return paths[1] || "";
    }
    return "";
  } catch {
    const match = String(url).match(/(?:youtu\.be\/|youtube\.com\/(?:embed\/|v\/|watch\?v=|shorts\/|live\/))([\w-]{11})/i);
    return match ? match[1] : "";
  }
}

/**
 * Choir Routine Serializer
 */
export function serializeChoirRoutine(data) {
  let out = "[notices]\n";
  (data.notices || []).forEach(notice => {
    if (notice && notice.trim()) out += `${notice.trim()}\n`;
  });
  out += "\n[schedule]\n\n";

  (data.months || []).forEach((month, mIdx) => {
    out += `month${mIdx + 1}|${month.name || ""}\n`;
    (month.dates || []).forEach(d => {
      out += `date|${d.date || ""}:\n`;
      (d.items || []).forEach((it, iIdx) => {
        if (it.time) out += `time${iIdx + 1}|${it.time}\n`;
        if (it.work) out += `work${iIdx + 1}|${it.work}\n`;
      });
      out += "\n";
    });
  });

  out += "[layout]\n";
  (data.layoutGroups || []).forEach(group => {
    const count = group.count || (group.title ? group.title.split(" ")[0] : "5");
    out += `${count}sats:\n\n`;
    (group.days || []).forEach(day => {
      const sat = day.saturday || (day.title ? day.title.split(" ")[0] : "1st");
      out += `${sat} sat:\n`;
      (day.activities || []).forEach(act => {
        if (act && act.trim()) out += `${act.trim()}\n`;
      });
      out += "\n";
    });
  });

  return out.trim() + "\n";
}

/**
 * Youth Routine Serializer
 */
export function serializeYouthRoutine(data) {
  let out = "[Notices]\n";
  (data.notices || []).forEach(n => {
    if (n && n.trim()) out += `${n.trim()}\n`;
  });
  out += "\n[Schedule]\n";

  (data.months || []).forEach(month => {
    out += `${month.title || "Routine"}\n`;
    (month.rows || []).forEach(row => {
      out += `${row.date || ""}|${row.activity || ""}\n`;
    });
    out += "\n";
  });

  out += "[Group]\n";
  if (data.group && data.group.leader) {
    out += `Leader: ${data.group.leader}\n\n`;
  }

  (data.group?.teams || []).forEach(team => {
    out += `Captain: ${team.captain || ""}\n`;
    out += `Members: ${(team.members || []).join(", ")}\n\n`;
  });

  return out.trim() + "\n";
}

/**
 * YouTube Songs Serializer
 */
export function serializeYouTubeSongs(data) {
  let out = "[youtube]\n\n";
  const songsList = Array.isArray(data) ? data : (data.songs || []);
  songsList.forEach(song => {
    if (song.name && (song.link || song.videoId)) {
      const link = song.link || `https://youtu.be/${song.videoId}`;
      out += `${song.name} | ${link}\n`;
    }
  });
  return out.trim() + "\n";
}
