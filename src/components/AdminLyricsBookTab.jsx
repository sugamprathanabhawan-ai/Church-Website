import React, { useState, useEffect, useMemo, useRef } from 'react';
import { 
  Plus, 
  Trash2, 
  Edit3, 
  Eye, 
  EyeOff, 
  Save, 
  Upload, 
  FileUp, 
  FileText, 
  CheckCircle2, 
  AlertCircle, 
  RotateCcw, 
  History, 
  Sparkles, 
  Copy, 
  Check, 
  X, 
  ChevronRight, 
  ArrowLeft, 
  ArrowUp,
  ArrowDown,
  Layers,
  AlignLeft,
  Lock, 
  Unlock, 
  Music, 
  Search, 
  Wand2,
  SlidersHorizontal,
  FileCheck,
  Globe,
  Languages,
  ArrowRightLeft,
  Key,
  RefreshCw
} from 'lucide-react';
import { 
  parseLyricsWithChords, 
  formatSongToText, 
  detectDuplicateSong,
  generateId,
  isLikelyChord,
  chordsToChordLine,
  chordLineToChords,
  transposeChordLine
} from '../utils/lyricsChordParser';
import { uploadSongSourceDocument } from '../services/supabaseService';
import { 
  translateWorshipLyrics, 
  fetchGeminiKeyStatus, 
  saveGeminiApiKey 
} from '../services/geminiService';

export default function AdminLyricsBookTab({
  songs = [],
  onSaveSong,
  onDeleteSong,
  onRollbackSong,
  onFetchVersions,
  showToast
}) {
  // Views: 'list' (manage songs), 'creator' (upload & AI extract / new song), 'editor' (visual lyrics & chords editor)
  const [currentView, setCurrentView] = useState('list');
  const [listTab, setListTab] = useState('all'); // 'all', 'published', 'draft'
  const [searchQuery, setSearchQuery] = useState('');

  // Editing Song state
  const [activeSong, setActiveSong] = useState(null);
  const [previewMode, setPreviewMode] = useState(false);
  const [previewChords, setPreviewChords] = useState(true);
  const [editorMode, setEditorMode] = useState('two_layer'); // 'two_layer' | 'sheet_text'
  const [sheetTextDraft, setSheetTextDraft] = useState('');
  const [showFormatModal, setShowFormatModal] = useState(false);
  const [formatModalText, setFormatModalText] = useState('');

  // Upload & AI Extraction Workflow state (Steps: 1: Upload, 2: Extract, 3: Edit, 4: Publish)
  const [creatorStep, setCreatorStep] = useState(1);
  const [uploadedFile, setUploadedFile] = useState(null);
  const [uploadPreviewUrl, setUploadPreviewUrl] = useState('');
  const [extracting, setExtracting] = useState(false);
  const [extractedTitle, setExtractedTitle] = useState('');
  const [extractedRawLyrics, setExtractedRawLyrics] = useState('');
  const [extractionConfidence, setExtractionConfidence] = useState('high');

  // Language Detection & Bidirectional Translation state
  const [detectedLanguage, setDetectedLanguage] = useState(null); // 'Nepali' | 'English'
  const [activeLyricsTab, setActiveLyricsTab] = useState('original'); // 'original' | 'translated' | 'romanized'
  const [extractedOriginalTitle, setExtractedOriginalTitle] = useState('');
  const [extractedOriginalLyrics, setExtractedOriginalLyrics] = useState('');
  const [translatedTitle, setTranslatedTitle] = useState('');
  const [translatedLyrics, setTranslatedLyrics] = useState('');
  const [romanizedLyrics, setRomanizedLyrics] = useState('');
  const [translating, setTranslating] = useState(false);

  // Gemini API Key management state
  const [geminiKeyConfigured, setGeminiKeyConfigured] = useState(null);
  const [apiKeyInput, setApiKeyInput] = useState('');
  const [savingApiKey, setSavingApiKey] = useState(false);
  const [missingApiKeyError, setMissingApiKeyError] = useState(null);

  // Editor on-demand translation state
  const [editorTranslating, setEditorTranslating] = useState(false);

  // Confirmation modals
  const [showPublishModal, setShowPublishModal] = useState(false);
  const [duplicateWarning, setDuplicateWarning] = useState(null);
  const [savingSong, setSavingSong] = useState(false);
  const [songToDelete, setSongToDelete] = useState(null);
  const [deletingSong, setDeletingSong] = useState(false);

  // Version History Modal state
  const [historySong, setHistorySong] = useState(null);
  const [songVersions, setSongVersions] = useState([]);
  const [loadingVersions, setLoadingVersions] = useState(false);
  const [rollingBack, setRollingBack] = useState(false);

  const fileInputRef = useRef(null);

  // Filtered list of songs
  const filteredSongs = useMemo(() => {
    const q = searchQuery.toLowerCase().trim();
    return (songs || []).filter(song => {
      const matchesTab = listTab === 'all' || song.status === listTab;
      if (!matchesTab) return false;
      if (!q) return true;
      const titleMatch = (song.title || '').toLowerCase().includes(q);
      const authorMatch = (song.author || '').toLowerCase().includes(q);
      const lyricsMatch = (song.search_text || '').toLowerCase().includes(q);
      return titleMatch || authorMatch || lyricsMatch;
    });
  }, [songs, listTab, searchQuery]);

  // Counts
  const counts = useMemo(() => {
    const published = (songs || []).filter(s => s.status === 'published').length;
    const drafts = (songs || []).filter(s => s.status === 'draft').length;
    return { all: (songs || []).length, published, drafts };
  }, [songs]);

  // --- ACTIONS: START NEW SONG ---
  const handleStartNewSong = () => {
    setCreatorStep(1);
    setUploadedFile(null);
    setUploadPreviewUrl('');
    setExtractedTitle('');
    setExtractedRawLyrics('');
    setDuplicateWarning(null);
    setCurrentView('creator');
  };

  const handleCreateFromScratch = () => {
    const emptySong = {
      id: `temp_${Date.now()}`,
      title: 'New Worship Song',
      author: 'Sugam Church Choir',
      key_signature: 'G',
      time_signature: '4/4',
      category: 'Worship',
      language: 'Nepali',
      status: 'draft',
      sections: [
        {
          id: generateId('sec'),
          type: 'verse',
          title: 'Verse 1',
          lines: [
            { id: generateId('line'), text: '', chord_line: '', chords: [] }
          ]
        }
      ]
    };
    setActiveSong(emptySong);
    setEditorMode('two_layer');
    setCurrentView('editor');
  };

  // --- ACTIONS: FILE UPLOAD & AI EXTRACTION ---
  const handleFileSelect = (e) => {
    const file = e.target.files?.[0];
    if (!file) return;

    if (file.size > 10 * 1024 * 1024) {
      showToast('File size exceeds 10MB limit.', 'error');
      return;
    }

    setUploadedFile(file);
    if (file.type.startsWith('image/')) {
      const url = URL.createObjectURL(file);
      setUploadPreviewUrl(url);
    } else {
      setUploadPreviewUrl('');
    }

    // Trigger AI extraction
    extractLyricsFromFile(file);
  };

  // Check Gemini Key status on mount
  useEffect(() => {
    fetchGeminiKeyStatus().then(st => {
      setGeminiKeyConfigured(Boolean(st?.configured));
    });
  }, []);

  const handleSaveApiKeyInline = async () => {
    if (!apiKeyInput.trim()) {
      showToast('Please enter your Gemini API key.', 'error');
      return;
    }
    setSavingApiKey(true);
    try {
      await saveGeminiApiKey(apiKeyInput.trim());
      setGeminiKeyConfigured(true);
      setMissingApiKeyError(null);
      showToast('Gemini API key saved successfully!');
      if (uploadedFile) {
        extractLyricsFromFile(uploadedFile, apiKeyInput.trim());
      }
    } catch (err) {
      showToast(err.message || 'Failed to save API key', 'error');
    } finally {
      setSavingApiKey(false);
    }
  };

  const extractLyricsFromFile = async (file, overrideKey = null) => {
    setExtracting(true);
    setCreatorStep(2);
    setMissingApiKeyError(null);

    try {
      // Convert file to base64
      const reader = new FileReader();
      const base64Promise = new Promise((resolve, reject) => {
        reader.onload = () => resolve(reader.result);
        reader.onerror = reject;
      });
      reader.readAsDataURL(file);
      const base64Data = await base64Promise;

      const headers = { 'Content-Type': 'application/json' };
      if (overrideKey) headers['x-gemini-key'] = overrideKey;

      const response = await fetch('/api/extract-lyrics', {
        method: 'POST',
        headers,
        body: JSON.stringify({
          imageBase64: base64Data,
          mimeType: file.type || 'image/jpeg',
          filename: file.name
        })
      });

      const result = await response.json().catch(() => ({}));

      if (!response.ok || result.requiresApiKey) {
        if (result.requiresApiKey || response.status === 400 || response.status === 503) {
          setMissingApiKeyError(result.error || 'Gemini API key is required to extract lyrics with AI.');
          showToast('Please enter your Gemini API key to activate AI extraction.', 'error');
          return;
        }
        throw new Error(result.error || 'Extraction endpoint returned error status.');
      }

      const songTitle = result.title || file.name.replace(/\.[^/.]+$/, '').replace(/[-_]/g, ' ') || 'Untitled Song';
      setExtractedTitle(songTitle);
      setExtractedOriginalTitle(songTitle);
      
      let lyricsString = '';
      if (result.sections && Array.isArray(result.sections)) {
        lyricsString = result.sections.map(s => {
          const lines = (s.lines || []).join('\n');
          return s.title ? `[${s.title}]\n${lines}` : lines;
        }).join('\n\n');
      } else {
        lyricsString = result.rawLyrics || '';
      }

      const finalLyrics = lyricsString || 'Enter song lyrics line by line...';
      setExtractedRawLyrics(finalLyrics);
      setExtractedOriginalLyrics(finalLyrics);
      setExtractionConfidence(result.confidence || 'high');

      // Detect language
      const detected = result.detectedLanguage || (/[\u0900-\u097F]/.test(finalLyrics) ? 'Nepali' : 'English');
      setDetectedLanguage(detected);

      // Translation payloads from initial extraction
      let transLyrics = '';
      if (result.translatedSections && Array.isArray(result.translatedSections)) {
        transLyrics = result.translatedSections.map(s => {
          const lines = (s.lines || []).join('\n');
          return s.title ? `[${s.title}]\n${lines}` : lines;
        }).join('\n\n');
      } else {
        transLyrics = result.translatedRawLyrics || '';
      }

      setTranslatedTitle(result.translatedTitle || '');
      setTranslatedLyrics(transLyrics);
      setRomanizedLyrics(result.romanizedLyrics || '');
      setActiveLyricsTab('original');
      setMissingApiKeyError(null);
      setGeminiKeyConfigured(true);

      showToast(`Extracted lyrics! Detected language: ${detected === 'Nepali' ? '🇳🇵 Nepali' : '🇺🇸 English'}`);
    } catch (err) {
      console.warn('[AdminLyricsBook] AI extraction error:', err);
      setExtractedTitle(file.name.replace(/\.[^/.]+$/, '').replace(/[-_]/g, ' ') || 'Extracted Song');
      setExtractedRawLyrics('Verse 1\nPlease review and enter lyrics line by line here...');
      setExtractionConfidence('manual_review');
      setDetectedLanguage('Nepali');
      showToast(err.message || 'AI extraction failed. You can transcribe and edit manually.', 'error');
    } finally {
      setExtracting(false);
    }
  };

  // Bidirectional On-Demand Translation in Creator Workflow
  const handleTranslateOnDemand = async (targetLang) => {
    const textToTranslate = extractedOriginalLyrics || extractedRawLyrics;
    if (!textToTranslate || !textToTranslate.trim()) {
      showToast('No lyrics available to translate.', 'error');
      return;
    }

    setTranslating(true);
    try {
      const sourceLang = targetLang === 'English' ? 'Nepali' : 'English';
      const res = await translateWorshipLyrics({
        text: textToTranslate,
        targetLanguage: targetLang,
        sourceLanguage: sourceLang,
        title: extractedOriginalTitle || extractedTitle
      });

      const transTitle = res.translatedTitle || extractedTitle;
      const transLyrics = res.translatedLyrics || '';

      setTranslatedTitle(transTitle);
      setTranslatedLyrics(transLyrics);
      setActiveLyricsTab('translated');
      setExtractedTitle(transTitle);
      setExtractedRawLyrics(transLyrics);
      showToast(`Successfully translated to ${targetLang}!`);
    } catch (err) {
      showToast(err.message || 'Translation failed.', 'error');
    } finally {
      setTranslating(false);
    }
  };

  // Switch between Original, Translated, and Romanized views
  const handleSwitchLyricsTab = (tab) => {
    setActiveLyricsTab(tab);
    if (tab === 'original') {
      setExtractedTitle(extractedOriginalTitle || extractedTitle);
      setExtractedRawLyrics(extractedOriginalLyrics || extractedRawLyrics);
    } else if (tab === 'translated') {
      if (translatedLyrics) {
        setExtractedTitle(translatedTitle || extractedTitle);
        setExtractedRawLyrics(translatedLyrics);
      } else {
        const target = detectedLanguage === 'Nepali' ? 'English' : 'Nepali';
        handleTranslateOnDemand(target);
      }
    } else if (tab === 'romanized') {
      if (romanizedLyrics) {
        setExtractedRawLyrics(romanizedLyrics);
      }
    }
  };

  // Bidirectional On-Demand Translation in Two-Layer Editor
  const handleTranslateEditorSong = async () => {
    if (!activeSong) return;
    const currentSections = activeSong.sections || [];
    const textFormatted = formatSongToText(currentSections, false);
    if (!textFormatted.trim()) {
      showToast('No lyrics to translate in this song.', 'error');
      return;
    }

    const currentLang = activeSong.language || 'Nepali';
    const targetLang = currentLang === 'Nepali' ? 'English' : 'Nepali';

    setEditorTranslating(true);
    try {
      const res = await translateWorshipLyrics({
        text: textFormatted,
        targetLanguage: targetLang,
        sourceLanguage: currentLang,
        title: activeSong.title
      });

      if (res.translatedLyrics) {
        const translatedSections = parseLyricsWithChords(res.translatedLyrics);
        // Map chords over from previous lines
        translatedSections.forEach((tSec, sIdx) => {
          const origSec = currentSections[sIdx];
          if (origSec && origSec.lines) {
            (tSec.lines || []).forEach((tLine, lIdx) => {
              const origLine = origSec.lines[lIdx];
              if (origLine && origLine.chord_line) {
                tLine.chord_line = origLine.chord_line;
                tLine.chords = origLine.chords || [];
              }
            });
          }
        });

        setActiveSong(prev => ({
          ...prev,
          title: res.translatedTitle || prev.title,
          language: targetLang,
          sections: translatedSections
        }));

        showToast(`Song lyrics translated to ${targetLang}!`);
      }
    } catch (err) {
      showToast(err.message || 'Translation failed.', 'error');
    } finally {
      setEditorTranslating(false);
    }
  };

  const handleContinueToEditor = async () => {
    // Parse the extracted text into structured sections & lines
    const parsedSections = parseLyricsWithChords(extractedRawLyrics);

    let uploadedUrl = null;
    if (uploadedFile) {
      try {
        uploadedUrl = await uploadSongSourceDocument(uploadedFile);
      } catch (uploadErr) {
        console.warn('[AdminLyricsBook] Source file retention warning:', uploadErr.message);
      }
    }

    const song = {
      id: `temp_${Date.now()}`,
      title: extractedTitle.trim() || 'Untitled Worship Song',
      author: 'Sugam Church Choir',
      key_signature: 'G',
      time_signature: '4/4',
      category: 'Worship',
      language: 'Nepali',
      status: 'draft',
      source_file_url: uploadedUrl,
      sections: parsedSections
    };

    setActiveSong(song);
    setCurrentView('editor');
  };

  // --- ACTIONS: EDIT EXISTING SONG ---
  const handleEditSong = (song) => {
    const cloned = JSON.parse(JSON.stringify(song));
    if (Array.isArray(cloned.sections)) {
      cloned.sections.forEach(sec => {
        (sec.lines || []).forEach(line => {
          if (line.chord_line === undefined || line.chord_line === null) {
            line.chord_line = chordsToChordLine(line.chords || []);
          }
        });
      });
    }
    setActiveSong(cloned);
    setEditorMode('two_layer');
    setDuplicateWarning(null);
    setCurrentView('editor');
  };

  // Common Key chords helper for quick-insert pills
  const getCommonKeyChords = (key = 'G') => {
    const keyMap = {
      'C': ['C', 'F', 'G', 'Am', 'Dm', 'Em', 'G/B'],
      'D': ['D', 'G', 'A', 'Bm', 'Em', 'F#m', 'D/F#'],
      'E': ['E', 'A', 'B', 'C#m', 'F#m', 'G#m', 'B/D#'],
      'F': ['F', 'Bb', 'C', 'Dm', 'Gm', 'Am', 'C/E'],
      'G': ['G', 'C', 'D', 'Em', 'Am', 'Bm', 'D/F#'],
      'A': ['A', 'D', 'E', 'F#m', 'Bm', 'C#m', 'A/C#'],
      'B': ['B', 'E', 'F#', 'G#m', 'C#m', 'D#m', 'F#/A#'],
      'Bb': ['Bb', 'Eb', 'F', 'Gm', 'Cm', 'Dm', 'F/A'],
      'Eb': ['Eb', 'Ab', 'Bb', 'Cm', 'Fm', 'Gm', 'Bb/D'],
      'Ab': ['Ab', 'Db', 'Eb', 'Fm', 'Bbm', 'Cm', 'Eb/G']
    };
    return keyMap[key] || ['G', 'C', 'D', 'Em', 'Am', 'D/F#', 'A', 'E', 'Bm'];
  };

  // --- EDITOR LINE & CHORD CONTROLS ---
  const handleUpdateTitle = (val) => {
    setActiveSong(prev => ({ ...prev, title: val }));
  };

  const handleUpdateMetadata = (field, val) => {
    setActiveSong(prev => ({ ...prev, [field]: val }));
  };

  const handleAddSection = () => {
    setActiveSong(prev => {
      const nextNum = (prev.sections || []).length + 1;
      return {
        ...prev,
        sections: [
          ...(prev.sections || []),
          {
            id: generateId('sec'),
            type: 'verse',
            title: `Verse ${nextNum}`,
            lines: [{ id: generateId('line'), text: '', chord_line: '', chords: [] }]
          }
        ]
      };
    });
  };

  const handleRemoveSection = (sectionIndex) => {
    if (!window.confirm('Remove this entire section?')) return;
    setActiveSong(prev => ({
      ...prev,
      sections: (prev.sections || []).filter((_, idx) => idx !== sectionIndex)
    }));
  };

  const handleAddLine = (sectionIndex) => {
    setActiveSong(prev => ({
      ...prev,
      sections: (prev.sections || []).map((sec, sIdx) => {
        if (sIdx !== sectionIndex) return sec;
        return {
          ...sec,
          lines: [...(sec.lines || []), { id: generateId('line'), text: '', chord_line: '', chords: [] }]
        };
      })
    }));
  };

  // Update upper chord layer
  const handleUpdateLineChordLine = (sectionIndex, lineIndex, chordLineVal) => {
    const parsedChords = chordLineToChords(chordLineVal);
    setActiveSong(prev => ({
      ...prev,
      sections: (prev.sections || []).map((sec, sIdx) => {
        if (sIdx !== sectionIndex) return sec;
        return {
          ...sec,
          lines: (sec.lines || []).map((line, lIdx) => {
            if (lIdx !== lineIndex) return line;
            return {
              ...line,
              chord_line: chordLineVal,
              chords: parsedChords
            };
          })
        };
      })
    }));
  };

  // Update lower lyrics layer
  const handleUpdateLineText = (sectionIndex, lineIndex, text) => {
    setActiveSong(prev => ({
      ...prev,
      sections: (prev.sections || []).map((sec, sIdx) => {
        if (sIdx !== sectionIndex) return sec;
        return {
          ...sec,
          lines: (sec.lines || []).map((line, lIdx) => {
            if (lIdx !== lineIndex) return line;
            return { ...line, text };
          })
        };
      })
    }));
  };

  // Quick insert chord pill into upper chord layer
  const handleQuickInsertChord = (sectionIndex, lineIndex, chordToInsert) => {
    const section = activeSong.sections[sectionIndex];
    const line = section.lines[lineIndex];
    const currentChordLine = line.chord_line !== undefined && line.chord_line !== null
      ? line.chord_line
      : chordsToChordLine(line.chords || []);
    
    let updated;
    if (!currentChordLine || !currentChordLine.trim()) {
      updated = chordToInsert + '          ';
    } else {
      updated = currentChordLine.trimEnd() + '    ' + chordToInsert + '    ';
    }
    handleUpdateLineChordLine(sectionIndex, lineIndex, updated);
  };

  // Keyboard navigation: Enter on chord input moves focus down to lyrics input
  const handleChordInputKeyDown = (e, sIdx, lIdx) => {
    if (e.key === 'Enter') {
      e.preventDefault();
      const lyricInput = document.getElementById(`lyric-input-${sIdx}-${lIdx}`);
      if (lyricInput) lyricInput.focus();
    }
  };

  // Keyboard navigation: Enter on lyrics input inserts new line and focuses its chord input
  const handleLyricInputKeyDown = (e, sIdx, lIdx) => {
    if (e.key === 'Enter') {
      e.preventDefault();
      // Insert new line right after current line
      setActiveSong(prev => ({
        ...prev,
        sections: (prev.sections || []).map((sec, secIdx) => {
          if (secIdx !== sIdx) return sec;
          const newLines = [...(sec.lines || [])];
          newLines.splice(lIdx + 1, 0, {
            id: generateId('line'),
            text: '',
            chord_line: '',
            chords: []
          });
          return { ...sec, lines: newLines };
        })
      }));
      // Focus the new line's chord input after render
      setTimeout(() => {
        const nextChordInput = document.getElementById(`chord-input-${sIdx}-${lIdx + 1}`);
        if (nextChordInput) nextChordInput.focus();
      }, 50);
    }
  };

  // Reorder lines within section
  const handleMoveLine = (sectionIndex, lineIndex, direction) => {
    setActiveSong(prev => ({
      ...prev,
      sections: (prev.sections || []).map((sec, sIdx) => {
        if (sIdx !== sectionIndex) return sec;
        const lines = [...(sec.lines || [])];
        const targetIndex = lineIndex + direction;
        if (targetIndex < 0 || targetIndex >= lines.length) return sec;
        const temp = lines[lineIndex];
        lines[lineIndex] = lines[targetIndex];
        lines[targetIndex] = temp;
        return { ...sec, lines };
      })
    }));
  };

  // Duplicate line
  const handleDuplicateLine = (sectionIndex, lineIndex) => {
    setActiveSong(prev => ({
      ...prev,
      sections: (prev.sections || []).map((sec, sIdx) => {
        if (sIdx !== sectionIndex) return sec;
        const lines = [...(sec.lines || [])];
        const toDup = lines[lineIndex];
        lines.splice(lineIndex + 1, 0, {
          ...JSON.parse(JSON.stringify(toDup)),
          id: generateId('line')
        });
        return { ...sec, lines };
      })
    }));
  };

  // Clear chords on line
  const handleClearLineChords = (sectionIndex, lineIndex) => {
    handleUpdateLineChordLine(sectionIndex, lineIndex, '');
  };

  // Delete line
  const handleRemoveLine = (sectionIndex, lineIndex) => {
    setActiveSong(prev => ({
      ...prev,
      sections: (prev.sections || []).map((sec, sIdx) => {
        if (sIdx !== sectionIndex) return sec;
        return {
          ...sec,
          lines: (sec.lines || []).filter((_, lIdx) => lIdx !== lineIndex)
        };
      })
    }));
  };

  // Full Sheet Text Editor Mode toggles
  const handleSwitchToSheetText = () => {
    const text = formatSongToText(activeSong.sections, true);
    setSheetTextDraft(text);
    setEditorMode('sheet_text');
  };

  const handleApplySheetText = () => {
    if (!sheetTextDraft.trim()) {
      showToast('Sheet text cannot be empty.', 'error');
      return;
    }
    const parsed = parseLyricsWithChords(sheetTextDraft);
    setActiveSong(prev => ({ ...prev, sections: parsed }));
    setEditorMode('two_layer');
    showToast('Applied full sheet changes to two-layer inputs!');
  };

  // Auto-format / Sheet Importer Modal handlers
  const handleOpenFormatModal = () => {
    const currentText = formatSongToText(activeSong.sections, true);
    setFormatModalText(currentText);
    setShowFormatModal(true);
  };

  const handleApplyFormatModal = () => {
    if (!formatModalText || !formatModalText.trim()) {
      showToast('Please enter lyrics and chord text.', 'error');
      return;
    }
    const parsed = parseLyricsWithChords(formatModalText);
    setActiveSong(prev => ({ ...prev, sections: parsed }));
    setShowFormatModal(false);
    showToast('Converted and loaded into two-layer chord & lyrics editor!');
  };

  // --- ACTIONS: SAVE & PUBLISH ---
  const handleSaveDraft = async () => {
    if (!activeSong.title || !activeSong.title.trim()) {
      showToast('Please provide a song title.', 'error');
      return;
    }

    setSavingSong(true);
    try {
      const payload = { ...activeSong, status: 'draft' };
      await onSaveSong(payload);
      showToast(`Draft "${payload.title}" saved successfully!`);
      setCurrentView('list');
    } catch (err) {
      showToast(err.message || 'Failed to save draft.', 'error');
    } finally {
      setSavingSong(false);
    }
  };

  const handleInitiatePublish = () => {
    if (!activeSong.title || !activeSong.title.trim()) {
      showToast('Please provide a song title before publishing.', 'error');
      return;
    }

    // Check duplicate detection
    const dup = detectDuplicateSong(activeSong, songs);
    if (dup && dup.isDuplicate) {
      setDuplicateWarning(dup.message);
    } else {
      setDuplicateWarning(null);
    }

    setShowPublishModal(true);
  };

  const handleConfirmPublish = async () => {
    setSavingSong(true);
    try {
      const payload = { ...activeSong, status: 'published' };
      await onSaveSong(payload);
      showToast(`Song "${payload.title}" published to Choir Lyrics Book!`);
      setShowPublishModal(false);
      setCurrentView('list');
    } catch (err) {
      showToast(err.message || 'Failed to publish song.', 'error');
    } finally {
      setSavingSong(false);
    }
  };

  // --- ACTIONS: DELETE SONG ---
  const handleRequestDelete = (song) => {
    if (!song) return;
    setSongToDelete(song);
  };

  const handleConfirmDelete = async () => {
    if (!songToDelete) return;

    setDeletingSong(true);
    try {
      await onDeleteSong(songToDelete.id);
      showToast(`"${songToDelete.title}" deleted.`);
      if (activeSong && activeSong.id === songToDelete.id) {
        setActiveSong(null);
        setCurrentView('list');
      }
      setSongToDelete(null);
    } catch (err) {
      showToast(err.message || 'Failed to delete song.', 'error');
    } finally {
      setDeletingSong(false);
    }
  };

  // --- ACTIONS: VERSION HISTORY & ROLLBACK ---
  const handleOpenVersionHistory = async (song) => {
    setHistorySong(song);
    setLoadingVersions(true);
    try {
      const vers = await onFetchVersions(song.id);
      setSongVersions(vers || []);
    } catch (err) {
      console.warn('Error fetching versions:', err);
      setSongVersions([]);
    } finally {
      setLoadingVersions(false);
    }
  };

  const handleRollbackVersion = async (targetVersionNumber) => {
    if (!window.confirm(`Rollback "${historySong.title}" to Version ${targetVersionNumber}? This will restore lyrics and chords together.`)) {
      return;
    }

    setRollingBack(true);
    try {
      await onRollbackSong(historySong.id, targetVersionNumber);
      showToast(`Successfully rolled back to Version ${targetVersionNumber}!`);
      setHistorySong(null);
    } catch (err) {
      showToast(err.message || 'Failed to rollback song version.', 'error');
    } finally {
      setRollingBack(false);
    }
  };

  return (
    <div className="w-full font-sans animate-fade-in">

      {/* =========================================================================
          VIEW 1: SONG MANAGEMENT DIRECTORY (LIST & DRAFTS)
         ========================================================================= */}
      {currentView === 'list' && (
        <div className="space-y-6">
          
          {/* Top Bar with Creator CTA */}
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 bg-white p-6 rounded-3xl border border-[#d4e8ee] shadow-sm">
            <div>
              <span className="text-xs font-bold tracking-widest uppercase text-[#285c73] flex items-center gap-1.5">
                <Music className="w-3.5 h-3.5 text-[#4b9fb9]" />
                Choir Resources Administration
              </span>
              <h2 className="text-2xl sm:text-3xl font-serif font-bold text-[#214b60] mt-1">
                Sugam Lyrics Book
              </h2>
              <p className="text-xs sm:text-sm text-[#395e70] mt-0.5">
                Create, edit chords, extract lyrics with AI, and manage published choir songs.
              </p>
            </div>

            <div className="flex items-center gap-2.5">
              <button
                onClick={handleCreateFromScratch}
                className="px-4 py-2.5 bg-white hover:bg-[#e4f3f8] text-[#285c73] border border-[#d4e8ee] rounded-2xl text-xs font-bold transition flex items-center gap-2"
              >
                <span>Write Manually</span>
              </button>
              <button
                onClick={handleStartNewSong}
                className="px-5 py-2.5 bg-[#285c73] hover:bg-[#214b60] text-white rounded-2xl text-xs sm:text-sm font-bold shadow-md shadow-[#285c73]/20 transition hover:scale-105 flex items-center gap-2"
              >
                <Plus className="w-4 h-4" />
                <span>Upload &amp; Add Song</span>
              </button>
            </div>
          </div>

          {/* Search & Tabs */}
          <div className="flex flex-col sm:flex-row gap-3 items-center justify-between">
            {/* Tabs */}
            <div className="flex items-center gap-2 bg-white p-1 rounded-2xl border border-[#d4e8ee] shadow-2xs self-start sm:self-auto">
              <button
                onClick={() => setListTab('all')}
                className={`px-3.5 py-1.5 rounded-xl text-xs font-bold transition ${
                  listTab === 'all'
                    ? 'bg-[#285c73] text-white shadow-xs'
                    : 'text-[#214b60] hover:bg-[#e4f3f8]'
                }`}
              >
                All Songs ({counts.all})
              </button>
              <button
                onClick={() => setListTab('published')}
                className={`px-3.5 py-1.5 rounded-xl text-xs font-bold transition flex items-center gap-1.5 ${
                  listTab === 'published'
                    ? 'bg-emerald-600 text-white shadow-xs'
                    : 'text-[#214b60] hover:bg-[#e4f3f8]'
                }`}
              >
                <Lock className="w-3 h-3 text-emerald-200" />
                <span>Published ({counts.published})</span>
              </button>
              <button
                onClick={() => setListTab('draft')}
                className={`px-3.5 py-1.5 rounded-xl text-xs font-bold transition flex items-center gap-1.5 ${
                  listTab === 'draft'
                    ? 'bg-amber-600 text-white shadow-xs'
                    : 'text-[#214b60] hover:bg-[#e4f3f8]'
                }`}
              >
                <span>Drafts ({counts.drafts})</span>
              </button>
            </div>

            {/* Search */}
            <div className="relative w-full sm:w-72">
              <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-[#52788d] pointer-events-none" />
              <input
                type="text"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder="Search songs..."
                className="w-full pl-10 pr-4 py-2 bg-white border border-[#d4e8ee] rounded-xl text-xs font-medium text-[#214b60] focus:outline-none focus:ring-2 focus:ring-[#285c73]"
              />
            </div>
          </div>

          {/* Table / List */}
          <div className="bg-white rounded-3xl border border-[#d4e8ee] shadow-sm overflow-hidden">
            {filteredSongs.length > 0 ? (
              <div className="divide-y divide-[#d4e8ee]">
                {filteredSongs.map(song => {
                  const isPublished = song.status === 'published';
                  const totalLines = (song.sections || []).reduce((acc, s) => acc + (s.lines || []).length, 0);
                  const totalChords = (song.sections || []).reduce((acc, s) => {
                    return acc + (s.lines || []).reduce((lAcc, l) => lAcc + (l.chords || []).length, 0);
                  }, 0);

                  return (
                    <div 
                      key={song.id} 
                      className="p-5 flex flex-col md:flex-row md:items-center justify-between gap-4 hover:bg-[#f8faf7] transition-colors"
                    >
                      <div className="flex items-start gap-3.5">
                        <div className={`w-10 h-10 rounded-2xl flex items-center justify-center shrink-0 ${
                          isPublished ? 'bg-emerald-50 text-emerald-700 border border-emerald-200' : 'bg-amber-50 text-amber-700 border border-amber-200'
                        }`}>
                          <Music className="w-5 h-5" />
                        </div>

                        <div>
                          <div className="flex items-center gap-2 mb-1">
                            <h3 className="font-bold text-sm sm:text-base text-[#214b60]">
                              {song.title}
                            </h3>
                            <span className={`px-2 py-0.5 rounded-full text-[10px] font-bold uppercase tracking-wider ${
                              isPublished ? 'bg-emerald-100 text-emerald-800' : 'bg-amber-100 text-amber-800'
                            }`}>
                              {song.status}
                            </span>
                            {song.version && (
                              <span className="text-[10px] font-mono text-slate-400">
                                v{song.version}
                              </span>
                            )}
                          </div>

                          <div className="flex flex-wrap items-center gap-2 text-xs text-[#52788d]">
                            <span>{song.author || 'Unknown author'}</span>
                            <span>•</span>
                            <span className="font-mono font-semibold text-[#285c73]">Key: {song.key_signature || 'G'}</span>
                            <span>•</span>
                            <span>{totalLines} lines ({totalChords} chords)</span>
                            {song.category && (
                              <>
                                <span>•</span>
                                <span className="bg-[#dceef5] text-[#214b60] px-2 py-0.5 rounded-md text-[10px] font-bold">
                                  {song.category}
                                </span>
                              </>
                            )}
                          </div>
                        </div>
                      </div>

                      {/* Actions */}
                      <div className="flex items-center gap-2 self-end md:self-auto">
                        {/* Version History Button */}
                        <button
                          onClick={() => handleOpenVersionHistory(song)}
                          className="p-2 rounded-xl border border-[#d4e8ee] hover:bg-[#e4f3f8] text-[#285c73] transition"
                          title="View Version History & Rollback"
                        >
                          <History className="w-4 h-4" />
                        </button>

                        {/* Edit Button */}
                        <button
                          onClick={() => handleEditSong(song)}
                          className="px-3.5 py-1.5 bg-[#e4f3f8] hover:bg-[#dceef5] text-[#285c73] border border-[#d4e8ee] rounded-xl text-xs font-bold transition flex items-center gap-1.5"
                        >
                          <Edit3 className="w-3.5 h-3.5" />
                          <span>Edit</span>
                        </button>

                        {/* Delete Button */}
                        <button
                          onClick={() => handleRequestDelete(song)}
                          className="p-2 rounded-xl border border-[#d4e8ee] hover:bg-rose-50 text-slate-400 hover:text-rose-600 transition"
                          title="Delete song"
                        >
                          <Trash2 className="w-4 h-4" />
                        </button>
                      </div>
                    </div>
                  );
                })}
              </div>
            ) : (
              <div className="p-12 text-center">
                <Music className="w-10 h-10 text-slate-300 mx-auto mb-2" />
                <p className="font-bold text-sm text-[#214b60]">No songs found</p>
                <p className="text-xs text-[#52788d] mt-1">Upload a photo/PDF or add your first choir song.</p>
              </div>
            )}
          </div>

        </div>
      )}

      {/* =========================================================================
          VIEW 2: CREATOR WORKFLOW (UPLOAD & AI EXTRACTION)
         ========================================================================= */}
      {currentView === 'creator' && (
        <div className="bg-white rounded-3xl p-6 sm:p-8 border border-[#d4e8ee] shadow-sm max-w-4xl mx-auto space-y-8 animate-fade-in">
          
          {/* Header */}
          <div className="flex items-center justify-between pb-4 border-b border-[#d4e8ee]">
            <div>
              <span className="text-xs font-bold uppercase tracking-widest text-[#285c73]">Step by Step</span>
              <h2 className="text-2xl font-serif font-bold text-[#214b60]">Upload &amp; AI Extraction</h2>
            </div>
            <button
              onClick={() => setCurrentView('list')}
              className="p-2 rounded-xl hover:bg-slate-100 text-slate-400 transition"
            >
              <X className="w-5 h-5" />
            </button>
          </div>

          {/* Stepper Wizard Bar */}
          <div className="flex items-center justify-between max-w-lg mx-auto">
            <div className="flex items-center gap-2">
              <div className="w-7 h-7 rounded-full bg-[#285c73] text-white flex items-center justify-center font-bold text-xs">
                1
              </div>
              <span className="text-xs font-bold text-[#214b60]">Upload</span>
            </div>
            <div className="h-0.5 flex-1 mx-2 bg-[#d4e8ee]" />
            <div className="flex items-center gap-2">
              <div className={`w-7 h-7 rounded-full flex items-center justify-center font-bold text-xs ${
                creatorStep >= 2 ? 'bg-[#285c73] text-white' : 'bg-slate-100 text-slate-400'
              }`}>
                2
              </div>
              <span className="text-xs font-bold text-[#214b60]">Extract</span>
            </div>
            <div className="h-0.5 flex-1 mx-2 bg-[#d4e8ee]" />
            <div className="flex items-center gap-2">
              <div className="w-7 h-7 rounded-full bg-slate-100 text-slate-400 flex items-center justify-center font-bold text-xs">
                3
              </div>
              <span className="text-xs font-bold text-slate-400">Edit</span>
            </div>
            <div className="h-0.5 flex-1 mx-2 bg-[#d4e8ee]" />
            <div className="flex items-center gap-2">
              <div className="w-7 h-7 rounded-full bg-slate-100 text-slate-400 flex items-center justify-center font-bold text-xs">
                4
              </div>
              <span className="text-xs font-bold text-slate-400">Publish</span>
            </div>
          </div>

          {/* Step 1 & 2 Container: Matches Panel 3 of mockup */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6 items-start">
            
            {/* Left: Upload Box */}
            <div 
              onClick={() => fileInputRef.current?.click()}
              className="border-2 border-dashed border-[#4b9fb9]/60 hover:border-[#285c73] rounded-3xl p-8 text-center bg-[#f8faf7] hover:bg-[#e4f3f8]/30 transition-all cursor-pointer flex flex-col items-center justify-center min-h-[300px]"
            >
              <input
                ref={fileInputRef}
                type="file"
                accept="image/*,application/pdf"
                className="hidden"
                onChange={handleFileSelect}
              />

              {uploadPreviewUrl ? (
                <div className="w-full flex flex-col items-center">
                  <img 
                    src={uploadPreviewUrl} 
                    alt="Upload preview" 
                    className="max-h-48 rounded-xl object-contain shadow-xs mb-3 border border-[#d4e8ee]" 
                  />
                  <p className="text-xs font-bold text-[#214b60] truncate max-w-[200px]">
                    {uploadedFile?.name}
                  </p>
                  <p className="text-[10px] text-[#4b9fb9] font-semibold mt-1">Click to replace file</p>
                </div>
              ) : (
                <>
                  <div className="w-14 h-14 rounded-2xl bg-[#dceef5] text-[#285c73] flex items-center justify-center mb-4">
                    <FileUp className="w-7 h-7" />
                  </div>
                  <h4 className="font-bold text-sm text-[#214b60] mb-1">
                    Upload a photo or PDF
                  </h4>
                  <p className="text-xs text-[#52788d] mb-4">
                    Drag &amp; drop or click to browse
                  </p>
                  <span className="text-[10px] text-[#52788d] bg-white px-2.5 py-1 rounded-full border border-[#d4e8ee] mb-4">
                    Supports: JPG, PNG, PDF (max 10MB)
                  </span>
                  <button
                    type="button"
                    className="px-5 py-2 bg-[#285c73] text-white rounded-xl text-xs font-bold shadow-xs hover:bg-[#214b60] transition"
                  >
                    Choose File
                  </button>
                </>
              )}
            </div>

            {/* Right: AI Extracted Preview */}
            <div className="bg-[#f8faf7] rounded-3xl p-6 border border-[#d4e8ee] flex flex-col justify-between min-h-[300px]">
              <div>
                <div className="flex flex-wrap items-center justify-between gap-2 mb-3">
                  <div className="flex items-center gap-2">
                    <h4 className="font-bold text-sm text-[#214b60] flex items-center gap-1.5">
                      <Sparkles className="w-4 h-4 text-[#4b9fb9]" />
                      <span>AI Extracted Lyrics</span>
                    </h4>
                    {detectedLanguage && (
                      <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[11px] font-bold bg-[#e4f3f8] text-[#285c73] border border-[#d4e8ee]">
                        <Globe className="w-3 h-3 text-[#4b9fb9]" />
                        <span>Detected: {detectedLanguage === 'Nepali' ? '🇳🇵 Nepali' : '🇺🇸 English'}</span>
                      </span>
                    )}
                  </div>

                  {extracting && (
                    <span className="text-[10px] font-bold text-[#4b9fb9] animate-pulse flex items-center gap-1">
                      <RefreshCw className="w-3 h-3 animate-spin" />
                      <span>Extracting with Gemini Vision...</span>
                    </span>
                  )}
                </div>

                {/* Missing API Key Inline Alert Card */}
                {missingApiKeyError && (
                  <div className="p-4 bg-amber-50 border border-amber-200 rounded-2xl mb-4 text-xs animate-fade-in space-y-2.5">
                    <div className="flex items-center gap-2 text-amber-900 font-bold">
                      <Key className="w-4 h-4 text-amber-700" />
                      <span>Gemini API Key Required</span>
                    </div>
                    <p className="text-[11px] text-amber-800 leading-relaxed">
                      To activate multimodal AI song extraction and translation, please paste your Google Gemini API key below. It will automatically power both the Lyrics Book and the Sugam Church Bot.
                    </p>
                    <div className="flex gap-2">
                      <input
                        type="password"
                        placeholder="Paste your Gemini API key (e.g. AIzaSy...)"
                        value={apiKeyInput}
                        onChange={(e) => setApiKeyInput(e.target.value)}
                        className="flex-1 px-3 py-2 bg-white border border-amber-300 rounded-xl text-xs font-mono text-slate-800 focus:outline-none focus:ring-2 focus:ring-amber-500"
                      />
                      <button
                        type="button"
                        onClick={handleSaveApiKeyInline}
                        disabled={savingApiKey || !apiKeyInput.trim()}
                        className="px-4 py-2 bg-[#285c73] hover:bg-[#214b60] disabled:opacity-50 text-white rounded-xl text-xs font-bold transition shrink-0"
                      >
                        {savingApiKey ? 'Saving...' : 'Save & Extract'}
                      </button>
                    </div>
                  </div>
                )}

                {/* Translation & View Tabs (Nepali <-> English) */}
                {detectedLanguage && !missingApiKeyError && (
                  <div className="flex flex-wrap items-center justify-between gap-2 mb-3 bg-white p-1.5 rounded-2xl border border-[#d4e8ee]">
                    <div className="flex items-center gap-1">
                      <button
                        type="button"
                        onClick={() => handleSwitchLyricsTab('original')}
                        className={`px-3 py-1 rounded-xl text-xs font-bold transition flex items-center gap-1 ${
                          activeLyricsTab === 'original' 
                            ? 'bg-[#285c73] text-white shadow-xs' 
                            : 'text-[#52788d] hover:bg-slate-100'
                        }`}
                      >
                        <span>Original ({detectedLanguage === 'Nepali' ? '🇳🇵 NE' : '🇺🇸 EN'})</span>
                      </button>

                      <button
                        type="button"
                        onClick={() => handleSwitchLyricsTab('translated')}
                        className={`px-3 py-1 rounded-xl text-xs font-bold transition flex items-center gap-1 ${
                          activeLyricsTab === 'translated' 
                            ? 'bg-[#285c73] text-white shadow-xs' 
                            : 'text-[#52788d] hover:bg-slate-100'
                        }`}
                      >
                        <Languages className="w-3.5 h-3.5" />
                        <span>Translation ({detectedLanguage === 'Nepali' ? '🇺🇸 EN' : '🇳🇵 NE'})</span>
                      </button>

                      {romanizedLyrics && detectedLanguage === 'Nepali' && (
                        <button
                          type="button"
                          onClick={() => handleSwitchLyricsTab('romanized')}
                          className={`px-3 py-1 rounded-xl text-xs font-bold transition ${
                            activeLyricsTab === 'romanized' 
                              ? 'bg-[#285c73] text-white shadow-xs' 
                              : 'text-[#52788d] hover:bg-slate-100'
                          }`}
                        >
                          <span>Romanized</span>
                        </button>
                      )}
                    </div>

                    {/* On-Demand Re-translate Action */}
                    <button
                      type="button"
                      onClick={() => handleTranslateOnDemand(detectedLanguage === 'Nepali' ? 'English' : 'Nepali')}
                      disabled={translating}
                      className="px-2.5 py-1 text-[11px] font-bold text-[#285c73] hover:bg-[#e4f3f8] rounded-lg transition flex items-center gap-1"
                      title="Translate between Nepali and English"
                    >
                      <ArrowRightLeft className={`w-3 h-3 ${translating ? 'animate-spin' : ''}`} />
                      <span>{translating ? 'Translating...' : (detectedLanguage === 'Nepali' ? 'Translate to English' : 'Translate to Nepali')}</span>
                    </button>
                  </div>
                )}

                {/* Suggested Title Input */}
                <div className="mb-4">
                  <div className="flex items-center justify-between mb-1">
                    <label className="block text-[11px] font-bold uppercase tracking-wider text-[#52788d]">
                      {activeLyricsTab === 'translated' ? 'Translated Song Title' : 'Suggested Title'}
                    </label>
                    {activeLyricsTab === 'translated' && (
                      <span className="text-[10px] text-[#4b9fb9] font-medium">
                        Showing {detectedLanguage === 'Nepali' ? 'English' : 'Nepali'} translation
                      </span>
                    )}
                  </div>
                  <input
                    type="text"
                    value={extractedTitle}
                    onChange={(e) => setExtractedTitle(e.target.value)}
                    placeholder="Enter or confirm song title..."
                    className="w-full px-3.5 py-2 bg-white border border-[#d4e8ee] rounded-xl text-xs font-bold text-[#214b60] focus:ring-2 focus:ring-[#285c73] focus:outline-none"
                  />
                </div>

                {/* Extracted Lyrics Textarea */}
                <div className="mb-4">
                  <div className="flex items-center justify-between mb-1">
                    <label className="block text-[11px] font-bold uppercase tracking-wider text-[#52788d]">
                      {activeLyricsTab === 'translated' 
                        ? `Translated Lyrics (${detectedLanguage === 'Nepali' ? 'English' : 'Nepali'})` 
                        : (activeLyricsTab === 'romanized' ? 'Romanized Nepali Lyrics' : `Extracted Lyrics (${detectedLanguage || 'Original'})`)}
                    </label>
                    <span className="text-[10px] text-[#52788d]">
                      Editable before chord editor
                    </span>
                  </div>
                  <textarea
                    rows={8}
                    value={extractedRawLyrics}
                    onChange={(e) => setExtractedRawLyrics(e.target.value)}
                    placeholder="Extracted song lyrics will appear here..."
                    className="w-full px-3.5 py-2.5 bg-white border border-[#d4e8ee] rounded-xl text-xs font-sans text-[#214b60] leading-relaxed focus:ring-2 focus:ring-[#285c73] focus:outline-none"
                  />
                </div>
              </div>

              {/* Edit & Continue Button */}
              <button
                type="button"
                onClick={handleContinueToEditor}
                disabled={extracting || !extractedRawLyrics.trim()}
                className="w-full py-2.5 bg-[#285c73] hover:bg-[#214b60] text-white rounded-xl text-xs sm:text-sm font-bold shadow-md transition disabled:opacity-50 flex items-center justify-center gap-2"
              >
                <span>Edit &amp; Continue to Chord Editor</span>
                <ChevronRight className="w-4 h-4" />
              </button>
            </div>

          </div>

        </div>
      )}

      {/* =========================================================================
          VIEW 3: SONG EDITOR (DESKTOP & MOBILE SPLIT VIEW)
          Matches Panel 1 & 2 in the user's mockup!
         ========================================================================= */}
      {currentView === 'editor' && activeSong && (
        <div className="space-y-6 animate-fade-in">
          
          {/* Top Bar with Navigation & Actions */}
          <div className="bg-white rounded-3xl p-5 sm:p-6 border border-[#d4e8ee] shadow-sm flex flex-col md:flex-row md:items-center justify-between gap-4">
            
            <div className="flex items-center gap-3">
              <button
                onClick={() => setCurrentView('list')}
                className="p-2 rounded-xl hover:bg-[#e4f3f8] text-[#285c73] transition"
                title="Back to library"
              >
                <ArrowLeft className="w-5 h-5" />
              </button>

              <div>
                <div className="flex items-center gap-2">
                  <input
                    type="text"
                    value={activeSong.title}
                    onChange={(e) => handleUpdateTitle(e.target.value)}
                    placeholder="Enter song title..."
                    className="font-serif text-xl sm:text-2xl font-bold text-[#214b60] bg-transparent border-b border-dashed border-[#4b9fb9] focus:outline-none focus:border-solid focus:border-[#285c73] px-1 py-0.5"
                  />
                  <Edit3 className="w-4 h-4 text-slate-400" />
                </div>

                <div className="flex flex-wrap items-center gap-2 text-xs text-[#52788d] mt-1">
                  <span>Written by:</span>
                  <input
                    type="text"
                    value={activeSong.author || ''}
                    onChange={(e) => handleUpdateMetadata('author', e.target.value)}
                    placeholder="Author name..."
                    className="bg-transparent border-b border-[#d4e8ee] text-[#214b60] font-medium text-xs w-28 px-1 focus:outline-none"
                  />
                  <span>•</span>
                  <span>Key:</span>
                  <input
                    type="text"
                    value={activeSong.key_signature || 'G'}
                    onChange={(e) => handleUpdateMetadata('key_signature', e.target.value)}
                    placeholder="G"
                    className="bg-transparent border-b border-[#d4e8ee] text-[#285c73] font-mono font-bold text-xs w-10 text-center focus:outline-none"
                  />
                  <span>•</span>
                  <span>Time:</span>
                  <input
                    type="text"
                    value={activeSong.time_signature || '4/4'}
                    onChange={(e) => handleUpdateMetadata('time_signature', e.target.value)}
                    placeholder="4/4"
                    className="bg-transparent border-b border-[#d4e8ee] text-[#214b60] font-mono text-xs w-10 text-center focus:outline-none"
                  />
                  <span>•</span>
                  <span>Category:</span>
                  <select
                    value={activeSong.category || 'Worship'}
                    onChange={(e) => handleUpdateMetadata('category', e.target.value)}
                    className="bg-transparent border-b border-[#d4e8ee] text-[#214b60] font-semibold text-xs focus:outline-none"
                  >
                    <option value="Worship">Worship</option>
                    <option value="Praise">Praise</option>
                    <option value="Hymn">Hymn</option>
                    <option value="Youth">Youth</option>
                    <option value="Christmas">Christmas</option>
                    <option value="Special">Special</option>
                  </select>
                </div>
              </div>
            </div>

            {/* Right Buttons: Delete, Preview, Save Draft, Publish */}
            <div className="flex items-center gap-2.5 self-end md:self-auto">
              {activeSong && activeSong.id && !String(activeSong.id).startsWith('temp_') && (
                <button
                  type="button"
                  onClick={() => handleRequestDelete(activeSong)}
                  disabled={savingSong || deletingSong}
                  className="px-3.5 py-2.5 bg-rose-50 hover:bg-rose-100 text-rose-700 border border-rose-200 rounded-2xl text-xs font-bold transition flex items-center gap-1.5"
                  title="Delete this song"
                >
                  <Trash2 className="w-4 h-4 text-rose-600" />
                  <span className="hidden sm:inline">Delete</span>
                </button>
              )}

              {/* Translate Song Button (Nepali <-> English) */}
              <button
                type="button"
                onClick={handleTranslateEditorSong}
                disabled={editorTranslating || savingSong}
                className="px-3.5 py-2.5 bg-sky-50 hover:bg-sky-100 text-sky-800 border border-sky-200 rounded-2xl text-xs font-bold transition flex items-center gap-1.5"
                title="Translate lyrics between Nepali and English"
              >
                <ArrowRightLeft className={`w-3.5 h-3.5 text-sky-600 ${editorTranslating ? 'animate-spin' : ''}`} />
                <span className="hidden sm:inline">
                  {editorTranslating ? 'Translating...' : (activeSong.language === 'Nepali' ? 'Translate to EN' : 'Translate to NE')}
                </span>
              </button>

              <button
                type="button"
                onClick={() => setPreviewMode(!previewMode)}
                className={`px-4 py-2.5 rounded-2xl text-xs font-bold border transition flex items-center gap-1.5 ${
                  previewMode ? 'bg-[#285c73] text-white border-[#285c73]' : 'bg-white hover:bg-[#e4f3f8] text-[#214b60] border-[#d4e8ee]'
                }`}
              >
                <Eye className="w-4 h-4" />
                <span className="hidden sm:inline">Preview</span>
              </button>

              <button
                type="button"
                onClick={handleSaveDraft}
                disabled={savingSong}
                className="px-4 py-2.5 bg-white hover:bg-[#e4f3f8] text-[#214b60] border border-[#d4e8ee] rounded-2xl text-xs font-bold transition flex items-center gap-1.5"
              >
                <Save className="w-4 h-4 text-slate-500" />
                <span>Save Draft</span>
              </button>

              <button
                type="button"
                onClick={handleInitiatePublish}
                disabled={savingSong}
                className="px-5 py-2.5 bg-emerald-600 hover:bg-emerald-700 text-white rounded-2xl text-xs sm:text-sm font-bold shadow-md shadow-emerald-600/20 transition hover:scale-105 flex items-center gap-1.5"
              >
                <Lock className="w-4 h-4" />
                <span>Publish</span>
              </button>
            </div>

          </div>

          {/* Desktop & Tablet Two-Column Layout */}
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
            
            {/* Column 1: Edit Lyrics & Chords (lg:col-span-7) */}
            <div className="lg:col-span-7 space-y-6">
              
              <div className="bg-white rounded-3xl p-6 border border-[#d4e8ee] shadow-sm">
                
                {/* Header of Editor Box */}
                <div className="flex flex-col sm:flex-row sm:items-center justify-between pb-4 border-b border-[#d4e8ee] mb-6 gap-3">
                  <div>
                    <h3 className="font-bold text-base text-[#214b60] flex items-center gap-2">
                      <span>Two-Layer Lyrics &amp; Chords</span>
                      <span className="px-2 py-0.5 rounded-full text-[10px] font-mono font-bold bg-[#e4f3f8] text-[#285c73]">
                        Key: {activeSong.key_signature || 'G'}
                      </span>
                    </h3>
                    <p className="text-[11px] text-[#52788d] mt-0.5">
                      Upper layer for Chords, lower layer for Lyrics. Position chords with spaces directly above words.
                    </p>
                  </div>

                  <div className="flex flex-wrap items-center gap-2">
                    {/* View Switcher: Two-Layer vs Full Sheet */}
                    <div className="flex items-center bg-[#f0f7fa] p-1 rounded-xl border border-[#d4e8ee]">
                      <button
                        type="button"
                        onClick={() => {
                          if (editorMode === 'sheet_text') {
                            handleApplySheetText();
                          } else {
                            setEditorMode('two_layer');
                          }
                        }}
                        className={`px-2.5 py-1 rounded-lg text-xs font-bold transition flex items-center gap-1.5 ${
                          editorMode === 'two_layer'
                            ? 'bg-[#285c73] text-white shadow-2xs'
                            : 'text-[#214b60] hover:text-[#285c73]'
                        }`}
                        title="Two-layer stacked line inputs"
                      >
                        <Layers className="w-3.5 h-3.5" />
                        <span>Two-Layer</span>
                      </button>
                      <button
                        type="button"
                        onClick={() => {
                          if (editorMode === 'two_layer') {
                            handleSwitchToSheetText();
                          }
                        }}
                        className={`px-2.5 py-1 rounded-lg text-xs font-bold transition flex items-center gap-1.5 ${
                          editorMode === 'sheet_text'
                            ? 'bg-[#285c73] text-white shadow-2xs'
                            : 'text-[#214b60] hover:text-[#285c73]'
                        }`}
                        title="Edit as raw full-song chord sheet"
                      >
                        <AlignLeft className="w-3.5 h-3.5" />
                        <span>Full Sheet</span>
                      </button>
                    </div>

                    <button
                      type="button"
                      onClick={handleOpenFormatModal}
                      className="px-3 py-1.5 bg-[#e4f3f8] hover:bg-[#dceef5] text-[#285c73] rounded-xl text-xs font-bold transition flex items-center gap-1"
                      title="Paste ChordPro or standard chords"
                    >
                      <Wand2 className="w-3.5 h-3.5" />
                      <span>Auto Format</span>
                    </button>

                    {editorMode === 'two_layer' && (
                      <button
                        type="button"
                        onClick={handleAddSection}
                        className="px-3 py-1.5 bg-white hover:bg-[#e4f3f8] text-[#214b60] border border-[#d4e8ee] rounded-xl text-xs font-bold transition flex items-center gap-1"
                      >
                        <Plus className="w-3.5 h-3.5" />
                        <span>Add Section</span>
                      </button>
                    )}
                  </div>
                </div>

                {/* MODE A: TWO-LAYER STACKED LINE INPUTS */}
                {editorMode === 'two_layer' ? (
                  <div className="space-y-6">
                    {(activeSong.sections || []).map((section, sIdx) => {
                      const commonKeyChords = getCommonKeyChords(activeSong.key_signature || 'G');
                      return (
                        <div 
                          key={section.id || sIdx} 
                          className="p-4 sm:p-5 rounded-2xl bg-[#f8faf7] border border-[#d4e8ee] space-y-4"
                        >
                          {/* Section Title Header */}
                          <div className="flex items-center justify-between pb-2 border-b border-[#d4e8ee]">
                            <div className="flex items-center gap-2">
                              <input
                                type="text"
                                value={section.title || `Section ${sIdx + 1}`}
                                onChange={(e) => {
                                  const val = e.target.value;
                                  setActiveSong(prev => ({
                                    ...prev,
                                    sections: prev.sections.map((sec, idx) => idx === sIdx ? { ...sec, title: val } : sec)
                                  }));
                                }}
                                className="text-xs font-bold uppercase tracking-wider text-[#285c73] bg-white border border-[#d4e8ee] rounded-lg px-2.5 py-1 focus:outline-none"
                              />
                              <span className="text-[11px] text-[#52788d]">
                                ({(section.lines || []).length} lines)
                              </span>
                            </div>

                            <button
                              type="button"
                              onClick={() => handleRemoveSection(sIdx)}
                              className="p-1.5 text-slate-400 hover:text-rose-600 rounded-lg hover:bg-rose-50 transition"
                              title="Delete section"
                            >
                              <Trash2 className="w-3.5 h-3.5" />
                            </button>
                          </div>

                          {/* Line Cards */}
                          <div className="space-y-4">
                            {(section.lines || []).map((line, lIdx) => {
                              const chordLineVal = line.chord_line !== undefined && line.chord_line !== null
                                ? line.chord_line
                                : chordsToChordLine(line.chords || []);
                              return (
                                <div 
                                  key={line.id || lIdx}
                                  className="bg-white rounded-2xl p-3.5 sm:p-4 border border-[#d4e8ee] hover:border-[#4b9fb9]/60 shadow-xs transition space-y-3"
                                >
                                  {/* Line Top Toolbar */}
                                  <div className="flex flex-wrap items-center justify-between gap-2 pb-2 border-b border-slate-100">
                                    <div className="flex flex-wrap items-center gap-1.5">
                                      <span className="px-2 py-0.5 rounded-md bg-[#e4f3f8] text-[#285c73] font-mono text-[10px] font-bold">
                                        Line {lIdx + 1}
                                      </span>
                                      <span className="text-[10px] text-slate-400 hidden sm:inline ml-1">
                                        Quick Chords:
                                      </span>
                                      <div className="flex flex-wrap items-center gap-1">
                                        {commonKeyChords.map(ch => (
                                          <button
                                            key={ch}
                                            type="button"
                                            onClick={() => handleQuickInsertChord(sIdx, lIdx, ch)}
                                            className="px-1.5 py-0.5 rounded bg-slate-100 hover:bg-[#e4f3f8] text-[#285c73] hover:text-[#214b60] border border-slate-200 hover:border-[#b8dfea] font-mono font-bold text-[10px] transition"
                                            title={`Insert ${ch} into chord layer`}
                                          >
                                            +{ch}
                                          </button>
                                        ))}
                                      </div>
                                    </div>

                                    {/* Action icons */}
                                    <div className="flex items-center gap-1 text-slate-400">
                                      {lIdx > 0 && (
                                        <button
                                          type="button"
                                          onClick={() => handleMoveLine(sIdx, lIdx, -1)}
                                          className="p-1 hover:text-[#285c73] rounded hover:bg-slate-100 transition"
                                          title="Move line up"
                                        >
                                          <ArrowUp className="w-3.5 h-3.5" />
                                        </button>
                                      )}
                                      {lIdx < section.lines.length - 1 && (
                                        <button
                                          type="button"
                                          onClick={() => handleMoveLine(sIdx, lIdx, 1)}
                                          className="p-1 hover:text-[#285c73] rounded hover:bg-slate-100 transition"
                                          title="Move line down"
                                        >
                                          <ArrowDown className="w-3.5 h-3.5" />
                                        </button>
                                      )}
                                      <button
                                        type="button"
                                        onClick={() => handleDuplicateLine(sIdx, lIdx)}
                                        className="p-1 hover:text-[#285c73] rounded hover:bg-slate-100 transition"
                                        title="Duplicate line"
                                      >
                                        <Copy className="w-3.5 h-3.5" />
                                      </button>
                                      {chordLineVal && (
                                        <button
                                          type="button"
                                          onClick={() => handleClearLineChords(sIdx, lIdx)}
                                          className="p-1 hover:text-amber-600 rounded hover:bg-amber-50 transition"
                                          title="Clear chords on this line"
                                        >
                                          <RotateCcw className="w-3.5 h-3.5" />
                                        </button>
                                      )}
                                      <button
                                        type="button"
                                        onClick={() => handleRemoveLine(sIdx, lIdx)}
                                        className="p-1 text-slate-300 hover:text-rose-600 rounded hover:bg-rose-50 transition"
                                        title="Delete line"
                                      >
                                        <Trash2 className="w-3.5 h-3.5" />
                                      </button>
                                    </div>
                                  </div>

                                  {/* Two Synchronized Input Layers */}
                                  <div className="space-y-2">
                                    
                                    {/* UPPER INPUT LAYER: CHORDS */}
                                    <div>
                                      <div className="flex items-center justify-between mb-1">
                                        <label 
                                          htmlFor={`chord-input-${sIdx}-${lIdx}`}
                                          className="text-[10px] font-bold uppercase tracking-wider text-[#285c73] font-mono flex items-center gap-1.5 cursor-pointer"
                                        >
                                          <span className="w-2 h-2 rounded-full bg-[#4b9fb9] inline-block" />
                                          Chord (Upper Layer)
                                        </label>
                                        <span className="text-[10px] text-slate-400 font-sans">
                                          Use spaces to align transitions with syllables below
                                        </span>
                                      </div>
                                      <input
                                        type="text"
                                        id={`chord-input-${sIdx}-${lIdx}`}
                                        value={chordLineVal}
                                        onChange={(e) => handleUpdateLineChordLine(sIdx, lIdx, e.target.value)}
                                        onKeyDown={(e) => handleChordInputKeyDown(e, sIdx, lIdx)}
                                        placeholder="Type chords directly with spaces (e.g. G          D/F#       Em         C)..."
                                        className="w-full font-mono text-xs sm:text-sm font-bold text-[#285c73] bg-[#f0f7fa] hover:bg-white focus:bg-white border border-[#b8dfea] focus:border-[#285c73] rounded-xl px-3 py-2.5 focus:outline-none transition tracking-normal placeholder:font-sans placeholder:font-normal placeholder:text-slate-400 placeholder:text-xs"
                                        spellCheck={false}
                                        autoComplete="off"
                                      />
                                    </div>

                                    {/* LOWER INPUT LAYER: LYRICS */}
                                    <div>
                                      <div className="flex items-center justify-between mb-1">
                                        <label 
                                          htmlFor={`lyric-input-${sIdx}-${lIdx}`}
                                          className="text-[10px] font-bold uppercase tracking-wider text-[#214b60] font-mono flex items-center gap-1.5 cursor-pointer"
                                        >
                                          <span className="w-2 h-2 rounded-full bg-slate-400 inline-block" />
                                          Lyrics (Lower Layer)
                                        </label>
                                        <span className="text-[10px] text-slate-400 font-sans">
                                          Press Enter for next line
                                        </span>
                                      </div>
                                      <input
                                        type="text"
                                        id={`lyric-input-${sIdx}-${lIdx}`}
                                        value={line.text || ''}
                                        onChange={(e) => handleUpdateLineText(sIdx, lIdx, e.target.value)}
                                        onKeyDown={(e) => handleLyricInputKeyDown(e, sIdx, lIdx)}
                                        placeholder="Enter lyric line (text aligns 1:1 below the chords above)..."
                                        className="w-full font-mono text-xs sm:text-sm font-medium text-[#214b60] bg-white hover:border-[#4b9fb9] border border-[#d4e8ee] focus:border-[#285c73] rounded-xl px-3 py-2.5 focus:outline-none transition tracking-normal placeholder:font-sans placeholder:font-normal placeholder:text-slate-300 placeholder:text-xs"
                                        spellCheck={false}
                                        autoComplete="off"
                                      />
                                    </div>

                                  </div>

                                </div>
                              );
                            })}
                          </div>

                          {/* Add Line to Section Button */}
                          <button
                            type="button"
                            onClick={() => handleAddLine(sIdx)}
                            className="w-full py-2 bg-white hover:bg-[#e4f3f8] text-[#285c73] border border-dashed border-[#4b9fb9] rounded-xl text-xs font-bold transition flex items-center justify-center gap-1.5"
                          >
                            <Plus className="w-3.5 h-3.5" />
                            <span>Add Line</span>
                          </button>

                        </div>
                      );
                    })}
                  </div>
                ) : (
                  /* MODE B: FULL SHEET TEXT EDITOR */
                  <div className="space-y-4">
                    <div className="p-3 bg-[#e4f3f8]/60 border border-[#d4e8ee] rounded-xl text-xs text-[#285c73] flex items-center justify-between">
                      <span>Full Raw Sheet Mode: Chord lines sit directly above lyric lines.</span>
                      <button
                        type="button"
                        onClick={handleApplySheetText}
                        className="px-3 py-1 bg-[#285c73] text-white rounded-lg text-xs font-bold transition hover:bg-[#214b60]"
                      >
                        Apply to Two-Layer Inputs
                      </button>
                    </div>

                    <textarea
                      value={sheetTextDraft}
                      onChange={(e) => setSheetTextDraft(e.target.value)}
                      rows={18}
                      className="w-full font-mono text-xs sm:text-sm p-4 rounded-2xl border border-[#d4e8ee] bg-[#f8faf7] text-[#214b60] focus:outline-none focus:bg-white focus:border-[#285c73] leading-relaxed whitespace-pre resize-y"
                      placeholder="[Verse 1]&#10;G             D            Em         C&#10;Amazing grace, how sweet the sound"
                      spellCheck={false}
                    />

                    <div className="flex items-center justify-between pt-2">
                      <button
                        type="button"
                        onClick={() => setEditorMode('two_layer')}
                        className="px-4 py-2 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-xl text-xs font-bold transition"
                      >
                        Back to Two-Layer Inputs
                      </button>

                      <button
                        type="button"
                        onClick={handleApplySheetText}
                        className="px-4 py-2 bg-[#285c73] hover:bg-[#214b60] text-white rounded-xl text-xs font-bold transition flex items-center gap-1.5"
                      >
                        <Check className="w-3.5 h-3.5" />
                        <span>Apply &amp; Switch to Two-Layer View</span>
                      </button>
                    </div>
                  </div>
                )}

                {/* Editor Summary Footer */}
                <div className="mt-6 pt-4 border-t border-[#d4e8ee] flex items-center justify-between text-xs text-[#52788d]">
                  <button
                    type="button"
                    onClick={handleAddSection}
                    className="inline-flex items-center gap-1.5 text-xs font-bold text-[#285c73] hover:underline"
                  >
                    <Plus className="w-4 h-4" />
                    <span>Add New Section</span>
                  </button>

                  <div>
                    {(activeSong.sections || []).reduce((acc, s) => acc + (s.lines || []).length, 0)} lines • {' '}
                    {(activeSong.sections || []).reduce((acc, s) => acc + (s.lines || []).reduce((lAcc, l) => lAcc + (l.chords || []).length, 0), 0)} chords
                  </div>
                </div>

              </div>

            </div>

            {/* Column 2: Live Song Preview (lg:col-span-5) */}
            <div className="lg:col-span-5 sticky top-24">
              <div className="bg-white rounded-3xl p-6 border border-[#d4e8ee] shadow-sm">
                
                {/* Preview Header & Chords Toggle */}
                <div className="flex items-center justify-between pb-3 border-b border-[#d4e8ee] mb-5">
                  <h3 className="font-bold text-sm text-[#214b60] flex items-center gap-1.5">
                    <Eye className="w-4 h-4 text-[#4b9fb9]" />
                    <span>Song Preview</span>
                  </h3>

                  <div className="flex items-center bg-[#f0f7fa] p-1 rounded-xl border border-[#d4e8ee]">
                    <button
                      type="button"
                      onClick={() => setPreviewChords(true)}
                      className={`px-2.5 py-1 rounded-lg text-xs font-bold transition ${
                        previewChords ? 'bg-[#285c73] text-white shadow-2xs' : 'text-[#214b60]'
                      }`}
                    >
                      Chords
                    </button>
                    <button
                      type="button"
                      onClick={() => setPreviewChords(false)}
                      className={`px-2.5 py-1 rounded-lg text-xs font-bold transition ${
                        !previewChords ? 'bg-[#285c73] text-white shadow-2xs' : 'text-[#214b60]'
                      }`}
                    >
                      Lyrics
                    </button>
                  </div>
                </div>

                {/* Preview Sheet Card */}
                <div className="rounded-2xl p-5 bg-[#f8faf7] border border-[#d4e8ee]/80 text-[#214b60]">
                  <div className="text-center mb-6">
                    <h2 className="font-serif text-2xl font-bold tracking-tight">
                      {activeSong.title || 'Untitled Song'}
                    </h2>
                    <p className="text-xs text-[#52788d] mt-1 font-medium">
                      {activeSong.author ? `By ${activeSong.author}` : 'Sugam Church Choir'}
                    </p>
                  </div>

                  {/* Render Lines in Synchronized Monospace */}
                  <div className="space-y-4">
                    {(activeSong.sections || []).map((section, sIdx) => (
                      <div key={sIdx}>
                        {section.title && (
                          <div className="text-[10px] font-bold uppercase tracking-widest text-[#285c73] mb-2 font-mono">
                            [{section.title}]
                          </div>
                        )}
                        <div className="space-y-3">
                          {(section.lines || []).map((line, lIdx) => {
                            const chordVal = line.chord_line !== undefined && line.chord_line !== null
                              ? line.chord_line
                              : chordsToChordLine(line.chords || []);
                            return (
                              <div key={lIdx} className="overflow-x-auto no-scrollbar py-0.5">
                                {previewChords && chordVal && chordVal.trim() && (
                                  <div className="font-mono text-xs font-bold text-[#285c73] whitespace-pre leading-none pb-1 select-none">
                                    {chordVal}
                                  </div>
                                )}
                                <div className="font-mono text-xs sm:text-sm font-medium text-[#214b60] whitespace-pre select-text">
                                  {line.text || <span className="opacity-40 italic font-sans text-xs">[Instrumental]</span>}
                                </div>
                              </div>
                            );
                          })}
                        </div>
                      </div>
                    ))}
                  </div>

                  {/* Preview Footer */}
                  <div className="mt-6 pt-3 border-t border-[#d4e8ee] flex items-center justify-between text-[11px] text-[#52788d]">
                    <span className="font-mono">
                      Key: {activeSong.key_signature || 'G'} | {activeSong.time_signature || '4/4'}
                    </span>
                    <span className="truncate max-w-[150px]">
                      {activeSong.title}
                    </span>
                  </div>
                </div>

              </div>
            </div>

          </div>

        </div>
      )}

      {/* =========================================================================
          MODAL 1: CONFIRM TO PUBLISH (With Duplicate Song Warning)
         ========================================================================= */}
      {showPublishModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-sm animate-fade-in">
          <div className="bg-white rounded-3xl p-6 sm:p-8 max-w-md w-full shadow-2xl border border-[#d4e8ee] space-y-5">
            
            <div className="w-12 h-12 rounded-2xl bg-emerald-50 text-emerald-600 flex items-center justify-center mx-auto border border-emerald-100">
              <Lock className="w-6 h-6" />
            </div>

            <div className="text-center">
              <h3 className="font-serif text-2xl font-bold text-[#214b60]">
                Confirm to Publish
              </h3>
              <p className="text-xs text-[#52788d] mt-1">
                This song will be immediately available to all choir members under Choir Resources.
              </p>
            </div>

            {/* Duplicate warning alert if detected */}
            {duplicateWarning && (
              <div className="p-4 rounded-2xl bg-amber-50 border border-amber-200 text-amber-900 flex items-start gap-3 text-xs">
                <AlertCircle className="w-5 h-5 text-amber-600 shrink-0 mt-0.5" />
                <div>
                  <p className="font-bold">Duplicate Warning</p>
                  <p className="mt-0.5 text-amber-800 leading-relaxed">{duplicateWarning}</p>
                </div>
              </div>
            )}

            <div className="p-4 rounded-2xl bg-[#f8faf7] border border-[#d4e8ee] space-y-1.5 text-xs text-[#214b60]">
              <div className="flex justify-between">
                <span className="text-[#52788d]">Song Title:</span>
                <span className="font-bold">{activeSong?.title}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-[#52788d]">Key:</span>
                <span className="font-mono font-bold">{activeSong?.key_signature || 'G'}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-[#52788d]">Category:</span>
                <span className="font-semibold">{activeSong?.category || 'Worship'}</span>
              </div>
            </div>

            <div className="flex items-center gap-3 pt-2">
              <button
                type="button"
                onClick={() => setShowPublishModal(false)}
                className="flex-1 py-2.5 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-xl text-xs font-bold transition"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={handleConfirmPublish}
                disabled={savingSong}
                className="flex-1 py-2.5 bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl text-xs font-bold shadow-md transition disabled:opacity-50"
              >
                {savingSong ? 'Publishing...' : 'Confirm Publish'}
              </button>
            </div>

          </div>
        </div>
      )}

      {/* =========================================================================
          MODAL 2: VERSION HISTORY & ROLLBACK (Panel 5 in mockup)
         ========================================================================= */}
      {historySong && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-sm animate-fade-in">
          <div className="bg-white rounded-3xl p-6 sm:p-8 max-w-lg w-full shadow-2xl border border-[#d4e8ee] space-y-6 max-h-[90vh] overflow-y-auto">
            
            <div className="flex items-center justify-between pb-3 border-b border-[#d4e8ee]">
              <div>
                <span className="text-[10px] font-bold uppercase tracking-widest text-[#285c73]">Rollback System</span>
                <h3 className="font-serif text-xl sm:text-2xl font-bold text-[#214b60]">
                  Version History
                </h3>
              </div>
              <button
                onClick={() => setHistorySong(null)}
                className="p-1.5 rounded-lg hover:bg-slate-100 text-slate-400"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="text-xs text-[#52788d]">
              Retains published versions. Authorized administrators can restore immediately previous version with complete chords and lyrics.
            </div>

            {/* Version List */}
            <div className="space-y-3">
              
              {/* Current Version */}
              <div className="p-4 rounded-2xl bg-emerald-50/60 border border-emerald-200 flex items-center justify-between gap-3">
                <div className="flex items-center gap-3">
                  <CheckCircle2 className="w-5 h-5 text-emerald-600" />
                  <div>
                    <div className="flex items-center gap-2">
                      <span className="font-bold text-xs text-emerald-950">
                        Version {historySong.version || 1} (Latest)
                      </span>
                      <span className="px-2 py-0.5 rounded-full text-[9px] font-bold uppercase bg-emerald-600 text-white">
                        Current
                      </span>
                    </div>
                    <p className="text-[11px] text-emerald-800 mt-0.5">
                      Active published version in choir library
                    </p>
                  </div>
                </div>
              </div>

              {/* Previous Versions from DB */}
              {loadingVersions ? (
                <div className="py-6 text-center text-xs text-[#52788d]">
                  Loading version snapshots...
                </div>
              ) : songVersions.length > 0 ? (
                songVersions.map((ver, idx) => (
                  <div 
                    key={ver.id || idx}
                    className="p-4 rounded-2xl bg-[#f8faf7] border border-[#d4e8ee] flex items-center justify-between gap-3 hover:bg-[#e4f3f8]/40 transition"
                  >
                    <div className="flex items-center gap-3">
                      <History className="w-5 h-5 text-[#285c73]" />
                      <div>
                        <div className="flex items-center gap-2">
                          <span className="font-bold text-xs text-[#214b60]">
                            Version {ver.version_number} (Rollback)
                          </span>
                        </div>
                        <p className="text-[11px] text-[#52788d] mt-0.5">
                          {ver.created_at ? new Date(ver.created_at).toLocaleDateString() : 'Previous version'} • {ver.note || 'Snapshot'}
                        </p>
                      </div>
                    </div>

                    <button
                      type="button"
                      onClick={() => handleRollbackVersion(ver.version_number)}
                      disabled={rollingBack}
                      className="px-3.5 py-1.5 bg-[#285c73] hover:bg-[#214b60] text-white rounded-xl text-xs font-bold shadow-xs transition"
                    >
                      Rollback
                    </button>
                  </div>
                ))
              ) : (
                <div className="p-4 rounded-2xl bg-slate-50 border border-slate-200 text-center text-xs text-slate-500">
                  No previous rollback snapshot stored yet. When you edit and re-publish, a rollback snapshot is automatically retained.
                </div>
              )}

            </div>

            {/* Rollback Explanatory Notice */}
            <div className="p-4 rounded-2xl bg-[#e4f3f8]/50 border border-[#d4e8ee] text-xs text-[#285c73] flex items-start gap-2.5">
              <FileCheck className="w-4 h-4 shrink-0 mt-0.5 text-[#4b9fb9]" />
              <p className="leading-relaxed">
                Restoring a previous version recovers the song title, lyrics, sections, and exact chord positions together in an atomic transaction.
              </p>
            </div>

          </div>
        </div>
      )}

      {/* =========================================================================
          MODAL 3: AUTO-FORMAT / PASTE SHEET IMPORTER MODAL
         ========================================================================= */}
      {showFormatModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-sm animate-fade-in">
          <div className="bg-white rounded-3xl p-6 sm:p-8 max-w-xl w-full shadow-2xl border border-[#d4e8ee] space-y-5">
            
            <div className="flex items-center justify-between pb-3 border-b border-[#d4e8ee]">
              <div>
                <span className="text-[10px] font-bold uppercase tracking-widest text-[#285c73]">Import &amp; Auto-Format</span>
                <h3 className="font-serif text-xl sm:text-2xl font-bold text-[#214b60]">
                  Paste Chord Sheet
                </h3>
              </div>
              <button
                onClick={() => setShowFormatModal(false)}
                className="p-1.5 rounded-lg hover:bg-slate-100 text-slate-400"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <p className="text-xs text-[#52788d] leading-relaxed">
              Paste standard worship song lyrics with chord lines directly above lyric lines, or bracketed chords (e.g. <span className="font-mono bg-slate-100 px-1 py-0.5 rounded text-[#285c73]">[G]Amazing [D]grace</span>). It will automatically convert into synchronized two-layer line inputs.
            </p>

            <textarea
              value={formatModalText}
              onChange={(e) => setFormatModalText(e.target.value)}
              rows={12}
              className="w-full font-mono text-xs sm:text-sm p-4 rounded-2xl border border-[#d4e8ee] bg-[#f8faf7] text-[#214b60] focus:outline-none focus:bg-white focus:border-[#285c73] leading-relaxed whitespace-pre"
              placeholder="[Verse 1]&#10;G             D            Em         C&#10;Amazing grace, how sweet the sound"
              spellCheck={false}
            />

            <div className="flex items-center gap-3 pt-2">
              <button
                type="button"
                onClick={() => setShowFormatModal(false)}
                className="flex-1 py-2.5 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-xl text-xs font-bold transition"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={handleApplyFormatModal}
                className="flex-1 py-2.5 bg-[#285c73] hover:bg-[#214b60] text-white rounded-xl text-xs font-bold transition shadow-md shadow-[#285c73]/20 flex items-center justify-center gap-2"
              >
                <Wand2 className="w-4 h-4" />
                <span>Format into Two Layers</span>
              </button>
            </div>

          </div>
        </div>
      )}

      {/* =========================================================================
          MODAL 4: DELETE CONFIRMATION MODAL
         ========================================================================= */}
      {songToDelete && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-sm animate-fade-in">
          <div className="bg-white rounded-3xl p-6 sm:p-7 max-w-md w-full shadow-2xl border border-rose-100 space-y-4">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-2xl bg-rose-100 text-rose-600 flex items-center justify-center shrink-0">
                <Trash2 className="w-5 h-5" />
              </div>
              <div>
                <h3 className="font-serif text-lg font-bold text-slate-900">
                  Delete Song?
                </h3>
                <p className="text-xs text-slate-500">
                  This action will permanently remove this song.
                </p>
              </div>
            </div>

            <div className="p-3.5 rounded-2xl bg-slate-50 border border-slate-200">
              <p className="font-bold text-sm text-[#214b60]">{songToDelete.title}</p>
              <p className="text-xs text-[#52788d] mt-0.5">
                {songToDelete.author || 'Sugam Church Choir'} • Key: {songToDelete.key_signature || 'G'}
              </p>
            </div>

            <div className="flex items-center gap-3 pt-2">
              <button
                type="button"
                disabled={deletingSong}
                onClick={() => setSongToDelete(null)}
                className="flex-1 py-2.5 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-xl text-xs font-bold transition"
              >
                Cancel
              </button>
              <button
                type="button"
                disabled={deletingSong}
                onClick={handleConfirmDelete}
                className="flex-1 py-2.5 bg-rose-600 hover:bg-rose-700 text-white rounded-xl text-xs font-bold transition shadow-md shadow-rose-600/20 flex items-center justify-center gap-2"
              >
                {deletingSong ? (
                  <span>Deleting...</span>
                ) : (
                  <>
                    <Trash2 className="w-4 h-4" />
                    <span>Yes, Delete Song</span>
                  </>
                )}
              </button>
            </div>
          </div>
        </div>
      )}

    </div>
  );
}

/**
 * Preview Chord Line helper
 */
function PreviewChordLine({ chords = [], chordLine = '' }) {
  if (chordLine && chordLine.trim()) {
    return (
      <span className="inline-block whitespace-pre font-mono font-bold">
        {chordLine}
      </span>
    );
  }
  if (!Array.isArray(chords) || chords.length === 0) return null;
  const chordString = chordsToChordLine(chords);
  return (
    <span className="inline-block whitespace-pre font-mono font-bold">
      {chordString}
    </span>
  );
}
