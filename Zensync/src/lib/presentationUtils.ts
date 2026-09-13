import type { SectionItem, FlatSlide, CurrentSlideState } from '../types';

/**
 * Flattens all sections into a continuous sequence of slides
 */
export function flattenSections(sections: SectionItem[]): FlatSlide[] {
  const result: FlatSlide[] = [];
  let globalIndex = 0;

  for (const section of sections) {
    if (!section.slides || section.slides.length === 0) continue;
    for (let i = 0; i < section.slides.length; i++) {
      result.push({
        globalIndex,
        sectionId: section.id,
        sectionTitle: section.title,
        slideIndex: i,
        slide: section.slides[i],
      });
      globalIndex++;
    }
  }

  return result;
}

/**
 * Returns the current slide location based on globalIndex or section/slideIndex
 */
export function resolveSlideState(
  sections: SectionItem[],
  target: { globalIndex?: number; sectionId?: string; slideIndex?: number }
): { currentSlide: CurrentSlideState; activeFlatSlide: FlatSlide | null; totalSlides: number } {
  const flat = flattenSections(sections);
  const totalSlides = flat.length;

  if (totalSlides === 0) {
    return {
      currentSlide: { sectionId: '', slideIndex: 0, globalIndex: 0 },
      activeFlatSlide: null,
      totalSlides: 0,
    };
  }

  // If globalIndex is explicitly targeted
  if (typeof target.globalIndex === 'number') {
    const clampedIndex = Math.max(0, Math.min(target.globalIndex, totalSlides - 1));
    const matched = flat[clampedIndex];
    return {
      currentSlide: {
        sectionId: matched.sectionId,
        slideIndex: matched.slideIndex,
        globalIndex: clampedIndex,
      },
      activeFlatSlide: matched,
      totalSlides,
    };
  }

  // If sectionId & slideIndex are targeted
  if (target.sectionId) {
    const found = flat.find(
      (item) => item.sectionId === target.sectionId && item.slideIndex === (target.slideIndex ?? 0)
    );
    if (found) {
      return {
        currentSlide: {
          sectionId: found.sectionId,
          slideIndex: found.slideIndex,
          globalIndex: found.globalIndex,
        },
        activeFlatSlide: found,
        totalSlides,
      };
    }
  }

  // Fallback to first slide
  const first = flat[0];
  return {
    currentSlide: {
      sectionId: first.sectionId,
      slideIndex: first.slideIndex,
      globalIndex: 0,
    },
    activeFlatSlide: first,
    totalSlides,
  };
}

/**
 * Generates a random 4-digit code e.g. "4827"
 */
export function generateSessionCode(): string {
  const code = Math.floor(1000 + Math.random() * 9000).toString();
  return code;
}

/**
 * Creates empty initial sections (user adds their own sections and slides)
 */
export function createDefaultSections(): SectionItem[] {
  return [];
}
