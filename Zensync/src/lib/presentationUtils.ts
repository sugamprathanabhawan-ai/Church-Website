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

/**
 * Downscales an uploaded slide image client-side to an optimized, fast-loading resolution
 * (max 1600px dimension, high-quality JPEG 0.85) while keeping sermon notes, scripture,
 * and song chords completely legible and understandable.
 */
export async function optimizeSlideImageForUpload(
  file: File,
  maxDimension = 1600,
  quality = 0.85
): Promise<File> {
  if (!file || !file.type.startsWith('image/')) {
    return file;
  }

  return new Promise((resolve) => {
    const img = new Image();
    const objectUrl = URL.createObjectURL(file);

    img.onload = () => {
      URL.revokeObjectURL(objectUrl);
      try {
        let { width, height } = img;

        // If image is already smaller than maxDimension and file size < 350KB, keep as-is
        if (width <= maxDimension && height <= maxDimension && file.size <= 350 * 1024) {
          return resolve(file);
        }

        // Calculate proportional scale preserving aspect ratio
        if (width > maxDimension || height > maxDimension) {
          if (width > height) {
            height = Math.round((height * maxDimension) / width);
            width = maxDimension;
          } else {
            width = Math.round((width * maxDimension) / height);
            height = maxDimension;
          }
        }

        const canvas = document.createElement('canvas');
        canvas.width = width;
        canvas.height = height;

        const ctx = canvas.getContext('2d');
        if (!ctx) {
          return resolve(file);
        }

        ctx.imageSmoothingEnabled = true;
        ctx.imageSmoothingQuality = 'high';
        ctx.drawImage(img, 0, 0, width, height);

        canvas.toBlob(
          (blob) => {
            if (!blob) {
              return resolve(file);
            }
            const cleanName = file.name.replace(/\.[^/.]+$/, '') + '.jpg';
            const optimizedFile = new File([blob], cleanName, {
              type: 'image/jpeg',
              lastModified: Date.now(),
            });
            console.log(
              `[ZenSync] Optimized "${file.name}" (${(file.size / 1024).toFixed(0)}KB -> ${(optimizedFile.size / 1024).toFixed(0)}KB, ${width}x${height})`
            );
            resolve(optimizedFile);
          },
          'image/jpeg',
          quality
        );
      } catch (err) {
        console.warn('[ZenSync] Error downscaling image, falling back to original file:', err);
        resolve(file);
      }
    };

    img.onerror = () => {
      URL.revokeObjectURL(objectUrl);
      resolve(file);
    };

    img.src = objectUrl;
  });
}
