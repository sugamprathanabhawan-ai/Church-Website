import type { NoteItem } from '../types';

export interface GenerateNoticeParams {
  currentNotes: { heading: string; body: string };
  previousNotes?: { heading: string; body: string };
}

export interface GenerateNoticeResult {
  notice: string;
  modelUsed: string;
}

/**
 * Calls Gemini 3.1 Flash Lite endpoint to analyze note changes and draft
 * a concise, church-appropriate notice announcement.
 */
export async function generateAiNoticeFromNotes(
  params: GenerateNoticeParams
): Promise<GenerateNoticeResult> {
  const { currentNotes, previousNotes } = params;

  try {
    const res = await fetch('/api/zensync-notice', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        currentNotes,
        previousNotes,
      }),
    });

    if (res.ok) {
      const data = await res.json();
      if (data && data.notice) {
        return {
          notice: data.notice.trim(),
          modelUsed: data.modelUsed || 'gemini-3.1-flash-lite',
        };
      }
    }
  } catch (err) {
    console.warn('[AiNoticeService] Network notice fetch notice:', err);
  }

  // Smart local fallback if offline
  const heading = (currentNotes.heading || 'Notice').trim();
  const firstLine = (currentNotes.body || '').split('\n').filter(Boolean)[0] || '';
  const fallback = firstLine
    ? `${heading}: ${firstLine}`
    : `Notice: ${heading} was updated.`;

  return {
    notice: fallback,
    modelUsed: 'local-fallback',
  };
}
