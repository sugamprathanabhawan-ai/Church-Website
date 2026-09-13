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
 * Helper to generate crisp SVG slide cards as data URLs for demo choir slides
 */
function createSlideSvgUrl(title: string, subtitle: string, verse: string, tag: string): string {
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 1920 1080" width="1920" height="1080">
    <defs>
      <linearGradient id="cardGrad" x1="0" y1="0" x2="1" y2="1">
        <stop offset="0%" stop-color="#ffffff"/>
        <stop offset="100%" stop-color="#f0f9ff"/>
      </linearGradient>
      <filter id="softShadow" x="-5%" y="-5%" width="110%" height="110%">
        <feDropShadow dx="0" dy="16" stdDeviation="24" flood-color="#0284c7" flood-opacity="0.12"/>
      </filter>
    </defs>
    <!-- Background Canvas -->
    <rect width="1920" height="1080" fill="#f8fafc"/>
    
    <!-- Outer Elegant Frame -->
    <rect x="80" y="80" width="1760" height="920" rx="32" fill="url(#cardGrad)" stroke="#bae6fd" stroke-width="3" filter="url(#softShadow)"/>
    
    <!-- Header Tag -->
    <rect x="160" y="150" width="220" height="54" rx="27" fill="#e0f2fe"/>
    <text x="270" y="186" fill="#0284c7" font-family="'Outfit', 'Inter', sans-serif" font-size="22" font-weight="700" text-anchor="middle" letter-spacing="2">${tag.toUpperCase()}</text>
    
    <!-- Title -->
    <text x="160" y="290" fill="#0f172a" font-family="'Outfit', 'Inter', sans-serif" font-size="64" font-weight="800">${title}</text>
    <text x="160" y="350" fill="#0284c7" font-family="'Inter', sans-serif" font-size="32" font-weight="600">${subtitle}</text>
    
    <!-- Lyric / Verse Body -->
    <line x1="160" y1="410" x2="1760" y2="410" stroke="#e2e8f0" stroke-width="2"/>
    <text x="960" y="580" fill="#1e293b" font-family="'Inter', sans-serif" font-size="44" font-weight="500" text-anchor="middle" line-height="1.6">
      ${verse.split('\n').map((line, idx) => `<tspan x="960" dy="${idx === 0 ? 0 : 64}">${line}</tspan>`).join('')}
    </text>
    
    <!-- Footer Branding -->
    <rect x="160" y="890" width="1600" height="2" fill="#e0f2fe"/>
    <text x="160" y="935" fill="#64748b" font-family="'Inter', sans-serif" font-size="22" font-weight="500">ZEN SYNC — SYNCHRONIZED PRESENTATION</text>
    <text x="1760" y="935" fill="#0284c7" font-family="'Inter', sans-serif" font-size="22" font-weight="600" text-anchor="end">Choir &amp; Congregation</text>
  </svg>`;

  return `data:image/svg+xml;charset=utf-8,${encodeURIComponent(svg)}`;
}

/**
 * Creates sample initial sections with choir hymn lyrics
 */
export function createDefaultSections(): SectionItem[] {
  return [
    {
      id: 'sec-1-bhajan',
      title: 'Bhajan & Hymn',
      slides: [
        {
          id: 'slide-1-1',
          name: 'Bhajan Stanza 1',
          url: createSlideSvgUrl(
            'Amazing Grace',
            'Verse 1 • Opening Praise',
            'Amazing grace, how sweet the sound\nThat saved a wretch like me\nI once was lost, but now am found\nWas blind, but now I see.',
            'Bhajan 1'
          ),
          createdAt: Date.now() - 3000,
        },
        {
          id: 'slide-1-2',
          name: 'Bhajan Stanza 2',
          url: createSlideSvgUrl(
            'Amazing Grace',
            'Verse 2 • Devotion & Faith',
            "'Twas grace that taught my heart to fear,\nAnd grace my fears relieved;\nHow precious did that grace appear\nThe hour I first believed.",
            'Bhajan 2'
          ),
          createdAt: Date.now() - 2000,
        },
        {
          id: 'slide-1-3',
          name: 'Bhajan Stanza 3',
          url: createSlideSvgUrl(
            'Amazing Grace',
            'Verse 3 • Everlasting Hope',
            'Through many dangers, toils and snares,\nI have already come;\n’Tis grace hath brought me safe thus far,\nAnd grace will lead me home.',
            'Bhajan 3'
          ),
          createdAt: Date.now() - 1000,
        },
      ],
    },
    {
      id: 'sec-2-chorus',
      title: 'Chorus',
      slides: [
        {
          id: 'slide-2-1',
          name: 'Chorus Refrain',
          url: createSlideSvgUrl(
            'Great is Thy Faithfulness',
            'Chorus Refrain • All Voices Together',
            'Great is Thy faithfulness! Great is Thy faithfulness!\nMorning by morning new mercies I see;\nAll I have needed Thy hand hath provided—\nGreat is Thy faithfulness, Lord, unto me!',
            'Chorus'
          ),
          createdAt: Date.now() - 800,
        },
        {
          id: 'slide-2-2',
          name: 'Chorus Bridge',
          url: createSlideSvgUrl(
            'Praise the Lord',
            'Bridge • Uplifting Harmony',
            'Praise God, from whom all blessings flow;\nPraise Him, all creatures here below;\nPraise Him above, ye heav’nly host;\nPraise Father, Son, and Holy Ghost.',
            'Bridge'
          ),
          createdAt: Date.now() - 600,
        },
      ],
    },
    {
      id: 'sec-3-closing',
      title: 'Closing',
      slides: [
        {
          id: 'slide-3-1',
          name: 'Closing Blessing',
          url: createSlideSvgUrl(
            'Benediction',
            'Final Prayer & Peace',
            'The Lord bless you and keep you;\nThe Lord make His face shine on you and be gracious to you;\nThe Lord lift up His countenance upon you\nAnd give you everlasting peace. Amen.',
            'Closing'
          ),
          createdAt: Date.now() - 400,
        },
      ],
    },
  ];
}
