/**
 * Sugam Church — Lyrics Book & Chord Engine
 * Utility helpers for chord transposition, structured chord-lyric parsing,
 * formatting, alignment calculations, and duplicate detection.
 */

// Chromatic scales for transposition
const NOTES_SHARP = ['C', 'C#', 'D', 'D#', 'E', 'F', 'F#', 'G', 'G#', 'A', 'A#', 'B'];
const NOTES_FLAT  = ['C', 'Db', 'D', 'Eb', 'E', 'F', 'Gb', 'G', 'Ab', 'A', 'Bb', 'B'];

const ENHARMONIC_MAP = {
  'B#': 'C', 'E#': 'F', 'Cb': 'B', 'Fb': 'E'
};

/**
 * Transpose a single chord symbol (e.g. "G", "Em7", "F#m", "Bb/D") by semitones
 */
export function transposeChord(chordStr, semitones = 0) {
  if (!chordStr || semitones === 0) return chordStr;
  
  // Handle slash chords like D/F#
  if (chordStr.includes('/')) {
    const parts = chordStr.split('/');
    return `${transposeChord(parts[0], semitones)}/${transposeChord(parts[1], semitones)}`;
  }

  // Regex to match root note + accidental (e.g. "C#", "Bb", "A") + chord quality (e.g. "m7", "sus4", "add9")
  const match = chordStr.match(/^([A-G][#b]?)(.*)$/);
  if (!match) return chordStr;

  let root = match[1];
  const suffix = match[2] || '';

  if (ENHARMONIC_MAP[root]) {
    root = ENHARMONIC_MAP[root];
  }

  let index = NOTES_SHARP.indexOf(root);
  if (index === -1) {
    index = NOTES_FLAT.indexOf(root);
  }
  if (index === -1) return chordStr;

  let newIndex = (index + semitones) % 12;
  if (newIndex < 0) newIndex += 12;

  // Standard preferred chord notes in modern worship chord sheets
  // C, C#/Db, D, Eb, E, F, F#, G, Ab, A, Bb, B
  const preferFlats = root.includes('b') || ['F', 'Bb', 'Eb', 'Ab', 'Db'].includes(root);
  let newRoot;
  if (newIndex === 10) newRoot = 'Bb'; // Bb is standard in 95% of chord charts
  else if (newIndex === 3) newRoot = 'Eb'; // Eb is standard
  else if (newIndex === 8) newRoot = preferFlats ? 'Ab' : 'Ab'; // Ab preferred
  else if (newIndex === 1) newRoot = preferFlats ? 'Db' : 'C#';
  else if (newIndex === 6) newRoot = preferFlats ? 'Gb' : 'F#';
  else newRoot = preferFlats ? NOTES_FLAT[newIndex] : NOTES_SHARP[newIndex];

  return `${newRoot}${suffix}`;
}

/**
 * Extract chords and their 0-based character positions from a chord line string
 */
export function chordLineToChords(chordLine) {
  if (!chordLine || typeof chordLine !== 'string') return [];
  const chords = [];
  const regex = /\S+/g;
  let match;
  while ((match = regex.exec(chordLine)) !== null) {
    chords.push({
      chord: match[0],
      position: match.index
    });
  }
  return chords;
}

/**
 * Convert structured chords array into a monospace chord line string with exact spacing
 */
export function chordsToChordLine(chords = []) {
  if (!Array.isArray(chords) || chords.length === 0) return '';
  const sorted = [...chords].sort((a, b) => (a.position || 0) - (b.position || 0));
  let line = '';
  let cursor = 0;
  for (const c of sorted) {
    if (!c.chord) continue;
    const targetPos = Math.max(cursor, c.position || 0);
    const spaces = Math.max(0, targetPos - cursor);
    line += ' '.repeat(spaces) + c.chord;
    cursor = line.length;
  }
  return line;
}

/**
 * Transpose a raw chord line string while preserving exact character start positions
 */
export function transposeChordLine(chordLine, semitones = 0) {
  if (!chordLine || semitones === 0) return chordLine;
  const chords = chordLineToChords(chordLine);
  if (chords.length === 0) return chordLine;
  const transposed = chords.map(c => ({
    chord: transposeChord(c.chord, semitones),
    position: c.position
  }));
  return chordsToChordLine(transposed);
}

/**
 * Transpose an entire song structure (updates both structured chords and raw chord_line)
 */
export function transposeSongSections(sections = [], semitones = 0) {
  if (!sections || semitones === 0) return sections;

  return sections.map(section => ({
    ...section,
    lines: (section.lines || []).map(line => {
      const newChords = (line.chords || []).map(c => ({
        ...c,
        chord: transposeChord(c.chord, semitones)
      }));
      const newChordLine = line.chord_line !== undefined && line.chord_line !== null
        ? transposeChordLine(line.chord_line, semitones)
        : chordsToChordLine(newChords);
      return {
        ...line,
        chords: newChords,
        chord_line: newChordLine
      };
    })
  }));
}

/**
 * Generate a unique ID
 */
export function generateId(prefix = 'id') {
  return `${prefix}_${Date.now()}_${Math.random().toString(36).substring(2, 8)}`;
}

/**
 * Parse plain text or bracketed chord text (e.g. "[G]Amazing [D]grace")
 * into structured sections, lines, positioned chords, and synchronized chord_line.
 */
export function parseLyricsWithChords(rawText) {
  if (!rawText || typeof rawText !== 'string') return [];

  const rawLines = rawText.split(/\r?\n/);
  const sections = [];
  let currentSection = {
    id: generateId('sec'),
    type: 'verse',
    title: 'Verse 1',
    lines: []
  };

  const sectionHeaderRegex = /^\s*\[?(verse\s*\d*|chorus\s*\d*|bridge\s*\d*|intro|outro|pre-chorus|stuti|aradhana|kailash|muktidata)\]?\s*$/i;

  let pendingChordLine = null;
  let pendingRawChordLine = null;

  for (let i = 0; i < rawLines.length; i++) {
    const rawLine = rawLines[i];
    const trimmed = rawLine.trim();

    if (!trimmed) {
      if (pendingChordLine) {
        // Chord line with no lyrics line following: treat as instrument / intro line
        currentSection.lines.push({
          id: generateId('line'),
          text: '',
          chord_line: pendingRawChordLine || chordsToChordLine(pendingChordLine),
          chords: pendingChordLine
        });
        pendingChordLine = null;
        pendingRawChordLine = null;
      }
      continue;
    }

    // Check for section header (e.g., [Verse 1], Chorus:, Verse 2)
    const headerMatch = trimmed.match(sectionHeaderRegex);
    if (headerMatch) {
      if (currentSection.lines.length > 0) {
        sections.push(currentSection);
      }
      const rawTitle = trimmed.replace(/[\[\]:]/g, '').trim();
      let type = 'verse';
      const lower = rawTitle.toLowerCase();
      if (lower.includes('chorus')) type = 'chorus';
      else if (lower.includes('bridge')) type = 'bridge';
      else if (lower.includes('intro')) type = 'intro';
      else if (lower.includes('outro')) type = 'outro';

      currentSection = {
        id: generateId('sec'),
        type,
        title: rawTitle,
        lines: []
      };
      pendingChordLine = null;
      pendingRawChordLine = null;
      continue;
    }

    // Check if line contains inline bracketed chords, e.g. "[G]Amazing [D]grace"
    if (/\[[A-G][#b]?[^\]]*\]/.test(rawLine)) {
      const chords = [];
      let textWithoutChords = '';
      let charIndex = 0;
      let pos = 0;

      while (pos < rawLine.length) {
        if (rawLine[pos] === '[') {
          const closePos = rawLine.indexOf(']', pos);
          if (closePos !== -1) {
            const chordToken = rawLine.slice(pos + 1, closePos).trim();
            if (isLikelyChord(chordToken)) {
              chords.push({ chord: chordToken, position: charIndex });
              pos = closePos + 1;
              continue;
            }
          }
        }
        textWithoutChords += rawLine[pos];
        charIndex++;
        pos++;
      }

      currentSection.lines.push({
        id: generateId('line'),
        text: textWithoutChords.trimEnd(),
        chord_line: chordsToChordLine(chords),
        chords
      });
      continue;
    }

    // Check if this line is a standalone chord line (e.g. "G          D          Em         C")
    const detectedChords = extractChordsFromLine(rawLine);
    if (detectedChords.length > 0 && isOnlyChordsLine(rawLine, detectedChords)) {
      if (pendingChordLine) {
        // Previous chord line had no lyric line, flush it
        currentSection.lines.push({
          id: generateId('line'),
          text: '',
          chord_line: pendingRawChordLine || chordsToChordLine(pendingChordLine),
          chords: pendingChordLine
        });
      }
      pendingChordLine = detectedChords;
      pendingRawChordLine = rawLine;
      continue;
    }

    // Standard lyric line
    const chordsForThisLine = pendingChordLine || [];
    const chordLineForThisLine = pendingRawChordLine !== null ? pendingRawChordLine : chordsToChordLine(chordsForThisLine);
    pendingChordLine = null;
    pendingRawChordLine = null;

    currentSection.lines.push({
      id: generateId('line'),
      text: rawLine.trimEnd(),
      chord_line: chordLineForThisLine,
      chords: chordsForThisLine
    });
  }

  if (pendingChordLine) {
    currentSection.lines.push({
      id: generateId('line'),
      text: '',
      chord_line: pendingRawChordLine || chordsToChordLine(pendingChordLine),
      chords: pendingChordLine
    });
  }

  if (currentSection.lines.length > 0) {
    sections.push(currentSection);
  }

  return sections.length > 0 ? sections : [
    {
      id: generateId('sec'),
      type: 'verse',
      title: 'Verse 1',
      lines: [
        { id: generateId('line'), text: '', chord_line: '', chords: [] }
      ]
    }
  ];
}

/**
 * Check if a token is a valid chord symbol
 */
export function isLikelyChord(token) {
  if (!token || typeof token !== 'string') return false;
  const clean = token.trim();
  // Standard chord regex: [A-G] with optional sharp/flat, followed by common qualities and optional slash note
  return /^[A-G][#b]?(?:m|maj|min|dim|aug|sus[24]?|add[249]?|[0-9]{1,2}|M[0-9]*)*(?:\/[A-G][#b]?)?$/i.test(clean);
}

/**
 * Extract chords and their 0-based character positions from a chord line
 */
function extractChordsFromLine(line) {
  const chords = [];
  const regex = /\S+/g;
  let match;
  while ((match = regex.exec(line)) !== null) {
    const word = match[0];
    if (isLikelyChord(word)) {
      chords.push({
        chord: word,
        position: match.index
      });
    }
  }
  return chords;
}

/**
 * Check if a line is composed almost exclusively of chords and whitespace
 */
function isOnlyChordsLine(line, chords) {
  if (chords.length === 0) return false;
  // If the count of non-chord words is 0
  const words = line.trim().split(/\s+/);
  const validChordCount = words.filter(w => isLikelyChord(w)).length;
  return validChordCount >= Math.ceil(words.length * 0.7);
}

/**
 * Format structured sections back into standard ChordPro / text presentation
 */
export function formatSongToText(sections = [], includeChords = true) {
  if (!Array.isArray(sections)) return '';

  const output = [];

  for (const section of sections) {
    if (section.title) {
      output.push(`[${section.title}]`);
    }

    for (const line of section.lines || []) {
      const chords = line.chords || [];
      const chordLine = line.chord_line !== undefined && line.chord_line !== null
        ? line.chord_line
        : chordsToChordLine(chords);
      const text = line.text || '';

      if (includeChords && chordLine && chordLine.trim()) {
        output.push(chordLine);
      }

      if (text) {
        output.push(text);
      } else if (!includeChords || (!chordLine || !chordLine.trim())) {
        output.push('');
      }
    }
    output.push('');
  }

  return output.join('\n').trim();
}

/**
 * Duplicate Song Detector: checks title similarity and lyric content similarity
 */
export function detectDuplicateSong(targetSong, existingSongs = []) {
  if (!targetSong || !Array.isArray(existingSongs) || existingSongs.length === 0) {
    return null;
  }

  const normalize = (str) =>
    (str || '')
      .toLowerCase()
      .replace(/[^\w\s\u0900-\u097F]/gi, '')
      .replace(/\s+/g, ' ')
      .trim();

  const targetTitle = normalize(targetSong.title);
  if (!targetTitle) return null;

  // Extract all text lines for similarity check
  const getFullText = (sections = []) =>
    (sections || [])
      .flatMap(s => (s.lines || []).map(l => l.text))
      .filter(Boolean)
      .join(' ')
      .toLowerCase()
      .replace(/\s+/g, ' ')
      .trim();

  const targetLyrics = normalize(getFullText(targetSong.sections));

  for (const song of existingSongs) {
    if (song.id && song.id === targetSong.id) continue;

    const existingTitle = normalize(song.title);
    if (targetTitle === existingTitle) {
      return {
        isDuplicate: true,
        reason: 'exact_title',
        matchedSong: song,
        message: `A song with the title "${song.title}" already exists.`
      };
    }

    // Check lyric overlap if lyrics are substantial (>30 chars)
    if (targetLyrics.length > 30) {
      const existingLyrics = normalize(getFullText(song.sections));
      if (existingLyrics.length > 30 && targetLyrics === existingLyrics) {
        return {
          isDuplicate: true,
          reason: 'identical_lyrics',
          matchedSong: song,
          message: `The lyrics are identical to existing song "${song.title}".`
        };
      }
    }
  }

  return null;
}

/**
 * Built-in Initial Sugam Church Choir Songbook Collection
 * High quality Nepali & international praise songs with chords
 */
export const RAW_DEFAULT_SUGAM_SONGS = [
  {
    id: 'sugam-song-amazing-grace',
    title: 'Amazing Grace',
    author: 'John Newton',
    key_signature: 'G',
    time_signature: '4/4',
    category: 'Hymn',
    language: 'English',
    status: 'published',
    version: 1,
    created_at: '2026-10-20T10:00:00Z',
    updated_at: '2026-10-20T10:00:00Z',
    published_at: '2026-10-20T10:00:00Z',
    sections: [
      {
        id: 'sec-ag-1',
        type: 'verse',
        title: 'Verse 1',
        lines: [
          {
            id: 'l-ag-1',
            text: 'Amazing grace, how sweet the sound',
            chords: [
              { chord: 'G', position: 0 },
              { chord: 'D', position: 14 },
              { chord: 'Em', position: 24 },
              { chord: 'C', position: 31 }
            ]
          },
          {
            id: 'l-ag-2',
            text: 'That saved a wretch like me',
            chords: [
              { chord: 'G', position: 0 },
              { chord: 'D', position: 11 },
              { chord: 'C', position: 21 },
              { chord: 'G', position: 25 }
            ]
          },
          {
            id: 'l-ag-3',
            text: 'I once was lost, but now am found',
            chords: [
              { chord: 'G', position: 0 },
              { chord: 'C', position: 11 },
              { chord: 'G', position: 22 },
              { chord: 'D', position: 31 }
            ]
          },
          {
            id: 'l-ag-4',
            text: 'Was blind, but now I see',
            chords: [
              { chord: 'Em', position: 0 },
              { chord: 'C', position: 10 },
              { chord: 'G', position: 18 },
              { chord: 'D', position: 22 }
            ]
          }
        ]
      },
      {
        id: 'sec-ag-2',
        type: 'verse',
        title: 'Verse 2',
        lines: [
          {
            id: 'l-ag-5',
            text: "'Twas grace that taught my heart to fear",
            chords: [
              { chord: 'G', position: 0 },
              { chord: 'D', position: 15 },
              { chord: 'Em', position: 27 },
              { chord: 'C', position: 35 }
            ]
          },
          {
            id: 'l-ag-6',
            text: 'And grace my fears relieved',
            chords: [
              { chord: 'G', position: 0 },
              { chord: 'D', position: 14 },
              { chord: 'C', position: 21 },
              { chord: 'G', position: 26 }
            ]
          }
        ]
      }
    ]
  },
  {
    id: 'sugam-song-yogya-kewal',
    title: 'योग्य केवल तपाईं (Yogya Kewal Tapai)',
    author: 'Sugam Church Choir',
    key_signature: 'D',
    time_signature: '4/4',
    category: 'Worship',
    language: 'Nepali',
    status: 'published',
    version: 1,
    created_at: '2026-10-20T10:00:00Z',
    updated_at: '2026-10-20T10:00:00Z',
    published_at: '2026-10-20T10:00:00Z',
    sections: [
      {
        id: 'sec-yk-chorus',
        type: 'chorus',
        title: 'Chorus',
        lines: [
          {
            id: 'l-yk-1',
            text: 'योग्य केवल तपाईं, प्रशंसाको योग्य प्रभु',
            chords: [
              { chord: 'D', position: 0 },
              { chord: 'A', position: 11 },
              { chord: 'Bm', position: 23 },
              { chord: 'G', position: 38 }
            ]
          },
          {
            id: 'l-yk-2',
            text: 'आराधना र महिमा, सदा तपाईंलाई होस्',
            chords: [
              { chord: 'D', position: 0 },
              { chord: 'A', position: 13 },
              { chord: 'G', position: 24 },
              { chord: 'D', position: 36 }
            ]
          }
        ]
      },
      {
        id: 'sec-yk-verse1',
        type: 'verse',
        title: 'Verse 1',
        lines: [
          {
            id: 'l-yk-3',
            text: 'तपाईं जस्तो कोही छैन, सारा स्वर्ग र पृथ्वीमा',
            chords: [
              { chord: 'D', position: 0 },
              { chord: 'F#m', position: 15 },
              { chord: 'G', position: 26 },
              { chord: 'A', position: 41 }
            ]
          },
          {
            id: 'l-yk-4',
            text: 'हाम्रो जीवनको सहारा, येशू तपाईं मात्र',
            chords: [
              { chord: 'Bm', position: 0 },
              { chord: 'F#m', position: 14 },
              { chord: 'G', position: 25 },
              { chord: 'A', position: 33 }
            ]
          }
        ]
      }
    ]
  },
  {
    id: 'sugam-song-jiwanko-swami',
    title: 'जीवनको स्वामी (Jiwanko Swami)',
    author: 'Nepali Christian Bhajan',
    key_signature: 'E',
    time_signature: '4/4',
    category: 'Praise',
    language: 'Nepali',
    status: 'published',
    version: 1,
    created_at: '2026-10-20T10:00:00Z',
    updated_at: '2026-10-20T10:00:00Z',
    published_at: '2026-10-20T10:00:00Z',
    sections: [
      {
        id: 'sec-js-1',
        type: 'verse',
        title: 'Verse 1',
        lines: [
          {
            id: 'l-js-1',
            text: 'जीवनको स्वामी येशू, तपाईंलाई नै मेरो प्रणाम',
            chords: [
              { chord: 'E', position: 0 },
              { chord: 'B', position: 14 },
              { chord: 'C#m', position: 26 },
              { chord: 'A', position: 41 }
            ]
          },
          {
            id: 'l-js-2',
            text: 'मुक्तिदाता उद्धारकर्ता, गाउँछु तपाईंको नाम',
            chords: [
              { chord: 'E', position: 0 },
              { chord: 'B', position: 16 },
              { chord: 'A', position: 27 },
              { chord: 'E', position: 40 }
            ]
          }
        ]
      },
      {
        id: 'sec-js-chorus',
        type: 'chorus',
        title: 'Chorus',
        lines: [
          {
            id: 'l-js-3',
            text: 'हाल्लेलूयाह होस् येशूको जय, हाल्लेलूयाह होस् प्रभुको',
            chords: [
              { chord: 'A', position: 0 },
              { chord: 'E', position: 18 },
              { chord: 'B', position: 32 },
              { chord: 'E', position: 46 }
            ]
          }
        ]
      }
    ]
  }
];

export const DEFAULT_SUGAM_SONGS = RAW_DEFAULT_SUGAM_SONGS.map(song => ({
  ...song,
  sections: (song.sections || []).map(sec => ({
    ...sec,
    lines: (sec.lines || []).map(line => ({
      ...line,
      chord_line: line.chord_line !== undefined && line.chord_line !== null 
        ? line.chord_line 
        : chordsToChordLine(line.chords)
    }))
  }))
}));
