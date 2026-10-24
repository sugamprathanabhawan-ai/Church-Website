/**
 * Default Curated Audio Sermons & Audio Bible Chapters for Sugam Church
 * Provides immediate fallback streaming recordings with rich metadata.
 */

export const DEFAULT_AUDIO_SERMONS = [
  {
    id: 'sermon-1',
    title: 'परमप्रभु मेरो गोठालो हुनुहुन्छ (The Lord is My Shepherd)',
    speaker: 'पास्टर किरण थापा (Senior Pastor Kiran Thapa)',
    category: 'Audio Bible',
    scripture: 'भजनसंग्रह २३:१-६ (Psalm 23)',
    audio_url: 'https://archive.org/download/hymns-for-home-worship-volume-05-02-i-surrender-all-craig-king-1411-44_202212/%28Hymns_For_Home_%26_Worship_Volume_05%29_02_I_Surrender_All_%28Craig_King%29_%281411-44%29.mp3',
    file_name: 'psalm_23_nepali_audio_bible.mp3',
    file_size: 4242680,
    duration: '03:45',
    cover_image: '/images/img1.webp',
    description: 'परमप्रभु मेरो गोठालो हुनुहुन्छ, मलाई केहीको अभाव हुनेछैन। उहाँले मलाई हरियो खर्कमा डोर्याउनुहुन्छ र शान्त पानीको किनारमा डोर्याउनुहुन्छ।',
    date_preached: '2026-10-18',
    is_featured: true,
    sort_order: 1
  },
  {
    id: 'sermon-2',
    title: 'विश्‍वास र प्रार्थनाको सामर्थ्य (The Power of Faith & Prayer)',
    speaker: 'पास्टर किरण थापा (Senior Pastor Kiran Thapa)',
    category: 'Sermon',
    scripture: 'मत्ती २१:२१-२२ (Matthew 21:21-22)',
    audio_url: 'https://archive.org/download/hymns-for-home-worship-volume-05-02-i-surrender-all-craig-king-1411-44_202212/%28Hymns_For_Home_%26_Worship_Volume_05%29_08_Take_The_World%2C_But_Give_Me_Jesus_%28Craig_King%29_%281411-44%29.mp3',
    file_name: 'faith_prayer_sermon_sugam.mp3',
    file_size: 5120000,
    duration: '05:12',
    cover_image: '/images/img4.webp',
    description: 'शनिबारको आराधना सेवाको मुख्य प्रवचन: यदि तिमीहरूमा विश्वास छ र शङ्का गर्दैनौ भने, तिमीहरूले जे पनि प्रार्थनामा माग्नेछौ, त्यो पाउनेछौ।',
    date_preached: '2026-10-11',
    is_featured: false,
    sort_order: 2
  },
  {
    id: 'sermon-3',
    title: 'डाँडाको उपदेश र धन्यका वचनहरू (The Beatitudes)',
    speaker: 'सह पास्टर दीपक थापा (Co-Pastor Deepak Thapa)',
    category: 'Audio Bible',
    scripture: 'मत्ती ५:१-१२ (Matthew 5:1-12)',
    audio_url: 'https://archive.org/download/hymns-for-home-worship-volume-05-02-i-surrender-all-craig-king-1411-44_202212/%28Hymns_For_Home_%26_Worship_Volume_05%29_09_Nearer%2C_Still_Nearer_%28Craig_King%29_%281411-44%29.mp3',
    file_name: 'beatitudes_matthew_5_nepali.mp3',
    file_size: 6116696,
    duration: '04:30',
    cover_image: '/images/img2.webp',
    description: 'प्रभु येशू ख्रीष्टको डाँडाको उपदेश: "धन्य आत्मामा दीन हुनेहरू, किनकि स्वर्गको राज्य तिनीहरूकै हो। धन्य शोक गर्नेहरू, किनकि तिनीहरूले सान्त्वना पाउनेछन्।"',
    date_preached: '2026-10-04',
    is_featured: false,
    sort_order: 3
  },
  {
    id: 'sermon-4',
    title: 'युवा पुस्ता र ख्रीष्टमा समर्पण (Youth Living for Christ)',
    speaker: 'आर्यन राई (Youth Leader Aryan Rai)',
    category: 'Youth Message',
    scripture: '१ तिमोथी ४:१२ (1 Timothy 4:12)',
    audio_url: 'https://archive.org/download/hymns-for-home-worship-volume-05-02-i-surrender-all-craig-king-1411-44_202212/%28Hymns_For_Home_%26_Worship_Volume_05%29_10_O_Jesus%2C_I_Have_Promised_%28Craig_King%29_%281411-44%29.mp3',
    file_name: 'youth_fellowship_message_oct2026.mp3',
    file_size: 4242680,
    duration: '04:15',
    cover_image: '/images/you3.png',
    description: 'युवा संगति (Youth Fellowship): कसैले तिम्रो जवानीलाई तुच्छ नठानोस्, तर वचनमा, चालचलनमा, प्रेममा, विश्वासमा र शुद्धतामा विश्वासीहरूका निम्ति उदाहरण बन।',
    date_preached: '2026-09-27',
    is_featured: false,
    sort_order: 4
  },
  {
    id: 'sermon-5',
    title: 'उपवास र अन्तरविन्ती प्रार्थना (Fasting, Intercession & Grace)',
    speaker: 'एल्डर नरेश राई (Elder Naresh Rai)',
    category: 'Prayer & Fasting',
    scripture: 'यशैया ५८:६-९ (Isaiah 58:6-9)',
    audio_url: 'https://archive.org/download/hymns-for-home-worship-volume-05-02-i-surrender-all-craig-king-1411-44_202212/%28Hymns_For_Home_%26_Worship_Volume_05%29_11_Live_Out_Thy_Life_Within_Me_Medley_%28Craig_King%29_%281411-44%29.mp3',
    file_name: 'fasting_prayer_teaching.mp3',
    file_size: 6193559,
    duration: '04:55',
    cover_image: '/images/img5.webp',
    description: 'मंगलबार र शुक्रबारको उपवास प्रार्थनाको शिक्षा: परमेश्वरले रोज्नुभएको उपवास र त्यसको आत्मिक फल, बन्धनहरू फुकाउनु र स्वर्गीय आशिष् पाउनु।',
    date_preached: '2026-09-20',
    is_featured: false,
    sort_order: 5
  }
];

export const SERMON_CATEGORIES = [
  'All',
  'Sermon',
  'Audio Bible',
  'Youth Message',
  'Prayer & Fasting'
];

export const CATEGORY_LABELS = {
  'All': 'सबै (All)',
  'Sermon': 'प्रवचन (Sermons)',
  'Audio Bible': 'अडियो बाइबल (Audio Bible)',
  'Youth Message': 'युवा सन्देश (Youth Message)',
  'Prayer & Fasting': 'उपवास र प्रार्थना (Prayer & Fasting)'
};
