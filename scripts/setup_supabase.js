import { Client } from 'pg';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const rootDir = path.resolve(__dirname, '..');

// Read .env
function loadEnv() {
  const envPath = path.join(rootDir, '.env');
  if (!fs.existsSync(envPath)) return {};
  const content = fs.readFileSync(envPath, 'utf8');
  const env = {};
  content.split(/\r?\n/).forEach(line => {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith('#')) return;
    const eqIdx = trimmed.indexOf('=');
    if (eqIdx !== -1) {
      const key = trimmed.slice(0, eqIdx).trim();
      const val = trimmed.slice(eqIdx + 1).trim();
      env[key] = val;
    }
  });
  return env;
}

const env = loadEnv();
const dbUrl = env.Db_url || env.DATABASE_URL || process.env.Db_url || process.env.DATABASE_URL;

if (!dbUrl) {
  console.error('Error: Db_url or DATABASE_URL environment variable is required to run database migration.');
  console.error('Please configure Db_url in your local .env file.');
  process.exit(1);
}

console.log('Connecting to Supabase PostgreSQL...');
const client = new Client({
  connectionString: dbUrl,
  ssl: { rejectUnauthorized: false }
});

async function run() {
  try {
    await client.connect();
    console.log('Connected to Supabase PostgreSQL successfully!');

    // 1. Run Schema SQL
    const schemaSqlPath = path.join(rootDir, 'supabase_schema.sql');
    const schemaSql = fs.readFileSync(schemaSqlPath, 'utf8');
    console.log('Applying database schema & RLS policies...');
    await client.query(schemaSql);
    console.log('Schema applied successfully.');

    // 2. Seed Youth Notices
    console.log('Seeding Youth Notices...');
    const youthNotices = [
      'जयमसीह! Youth Fellowship takes place every Saturday(12:30 to 1:00).',
      'Project 10 starts from bhadra - Ashoj.',
      'Please come prepared with your Bibles and notebook.'
    ];
    for (let i = 0; i < youthNotices.length; i++) {
      await client.query(
        `INSERT INTO public.youth_notices (text, sort_order) VALUES ($1, $2)`,
        [youthNotices[i], i]
      );
    }

    // 3. Seed Youth Schedules
    console.log('Seeding Youth Schedules...');
    const youthSchedules = [
      { month_title: 'Bhadra-yakub', date_str: '6', activity: 'Random Word study:AGAPEY,DHONGI', sort_order: 0 },
      { month_title: 'Bhadra-yakub', date_str: '13', activity: '(1hour youth sangati) Aradhana: Sara Poudel, Bachan: Suraj pokhrel', sort_order: 1 },
      { month_title: 'Bhadra-yakub', date_str: '20', activity: 'Elder Naresh Rai (Aguwa bachan)', sort_order: 2 },
      { month_title: 'Bhadra-yakub', date_str: '27', activity: 'chela', sort_order: 3 },
      { month_title: 'Ashoj-patrus', date_str: '3', activity: 'Romi 13,14,15,16 (bible study)', sort_order: 4 },
      { month_title: 'Ashoj-patrus', date_str: '10', activity: '1 hour youth sangati(aradhana:Puja Rai, bachan Ruben Tamang)', sort_order: 5 },
      { month_title: 'Ashoj-patrus', date_str: '17', activity: 'Elder Naresh Rai (aguwa bachan)', sort_order: 6 },
      { month_title: 'Ashoj-patrus', date_str: '24', activity: 'Chela.', sort_order: 7 },
      { month_title: 'Ashoj-patrus', date_str: '31', activity: 'project 10.', sort_order: 8 }
    ];
    for (const item of youthSchedules) {
      await client.query(
        `INSERT INTO public.youth_schedules (month_title, date_str, activity, sort_order) VALUES ($1, $2, $3, $4)`,
        [item.month_title, item.date_str, item.activity, item.sort_order]
      );
    }

    // 4. Seed Youth Groups
    console.log('Seeding Youth Groups...');
    const youthGroups = [
      {
        leader_name: 'Aryan Rai',
        captain_name: 'SaraPoudel(Patrus)',
        members: ['Ishika', 'Onisimas', 'Yushan', 'bachan', 'Saprina', 'parina', 'janvi', 'rebika'],
        sort_order: 0
      },
      {
        leader_name: 'Aryan Rai',
        captain_name: 'SurajPokhrel(Yakub)',
        members: ['mamata', 'Ruben', 'puja rai', 'suresh', 'Safal', 'utsav', 'rojina', 'khum bahadur'],
        sort_order: 1
      },
      {
        leader_name: 'Aryan Rai',
        captain_name: 'urmilaChaudhary(Yahunna)',
        members: ['Puja majhi', 'sushila', 'shristi', 'pawan majhi', 'sanjita', 'namuna'],
        sort_order: 2
      }
    ];
    for (const g of youthGroups) {
      await client.query(
        `INSERT INTO public.youth_groups (leader_name, captain_name, members, sort_order) VALUES ($1, $2, $3, $4)`,
        [g.leader_name, g.captain_name, g.members, g.sort_order]
      );
    }

    // 5. Seed Choir Notices
    console.log('Seeding Choir Notices...');
    const choirNotices = [
      'Choir fellowship takes place every Saturday. Please come prepared and on time.',
      'Karthik 14,21,28 : Christmas & carol practice. 9:00 - 10:50'
    ];
    for (let i = 0; i < choirNotices.length; i++) {
      await client.query(
        `INSERT INTO public.choir_notices (text, sort_order) VALUES ($1, $2)`,
        [choirNotices[i], i]
      );
    }

    // 6. Seed Choir Schedules
    console.log('Seeding Choir Schedules...');
    const choirSchedules = [
      {
        month_name: 'Bhadra',
        date_str: '6',
        items: [{ time: '9:40 - 10:40', work: 'Choir practice & meeting' }],
        sort_order: 0
      },
      {
        month_name: 'Bhadra',
        date_str: '13',
        items: [{ time: '9:40 - 10:40', work: '(2 sat practice 30 min each.)' }],
        sort_order: 1
      },
      {
        month_name: 'Bhadra',
        date_str: '20',
        items: [
          { time: '9:50 - 10:15', work: 'Vocal practice' },
          { time: '10:15 - 10:40', work: 'Choir practice(Uthera)' }
        ],
        sort_order: 2
      },
      {
        month_name: 'Bhadra',
        date_str: '27',
        items: [
          { time: '9:40 - 10:10', work: 'New Songs practice' },
          { time: '10:10 - 10:40', work: 'Choir practice' }
        ],
        sort_order: 3
      },
      {
        month_name: 'Ashoj',
        date_str: '3',
        items: [{ time: '9:40 - 10:40', work: 'prac + new songs/meetings' }],
        sort_order: 4
      },
      {
        month_name: 'Ashoj',
        date_str: '10',
        items: [{ time: '9:40 - 10:40', work: '(2 sat practice 30 min each)' }],
        sort_order: 5
      },
      {
        month_name: 'Ashoj',
        date_str: '17',
        items: [
          { time: '9:50 - 10:15', work: 'Vocal practice' },
          { time: '10:15 - 10:40', work: 'Choir practice(Uthera)' }
        ],
        sort_order: 6
      },
      {
        month_name: 'Ashoj',
        date_str: '24',
        items: [{ time: '9:40 - 10:40', work: '(2 sat practice 30 min each.)' }],
        sort_order: 7
      },
      {
        month_name: 'Ashoj',
        date_str: '31',
        items: [
          { time: '9:40 - 10:10', work: 'New Songs practice' },
          { time: '10:10 - 10:40', work: 'Choir practice' }
        ],
        sort_order: 8
      }
    ];
    for (const item of choirSchedules) {
      const firstItem = item.items[0] || {};
      await client.query(
        `INSERT INTO public.choir_schedules (month_name, date_str, time_str, work_str, items, sort_order) VALUES ($1, $2, $3, $4, $5, $6)`,
        [item.month_name, item.date_str, firstItem.time || '', firstItem.work || '', JSON.stringify(item.items), item.sort_order]
      );
    }

    // 7. Seed Choir Layouts
    console.log('Seeding Choir Layouts...');
    const choirLayouts = [
      {
        group_title: '5 Saturdays',
        saturday_title: '1st Saturday',
        activities: ['prac: 9:40 - 10:40 (prac + new songs/meetings)'],
        sort_order: 0
      },
      {
        group_title: '5 Saturdays',
        saturday_title: '2nd Saturday',
        activities: ['prac : 9:40 - 10:40 (2 sat practice 30 min each.)'],
        sort_order: 1
      },
      {
        group_title: '5 Saturdays',
        saturday_title: '3rd Saturday',
        activities: [
          'Vocal practice: 9:50 - 10:15',
          'prac : 10:15 - 10:40 (direct standing)',
          'or: prac : 9:10 - 9:40 (direct standing)',
          'Extra classes / new song prac => 9:40-10:40 (40 min)'
        ],
        sort_order: 2
      },
      {
        group_title: '5 Saturdays',
        saturday_title: '4th Saturday',
        activities: ['prac : 9:40 - 10:40 (2 sat practice 30 min each.)'],
        sort_order: 3
      },
      {
        group_title: '5 Saturdays',
        saturday_title: '5th Saturday',
        activities: [
          'Vocal practice: 9:50 - 10:15 (25 min)',
          'prac : 10:15 - 10:40 (direct standing)',
          'or: prac : 9:10 - 9:40 (direct standing)',
          'Extra classes / new song prac => 9:40-10:40 (40 min)'
        ],
        sort_order: 4
      },
      {
        group_title: '4 Saturdays',
        saturday_title: '1st Saturday',
        activities: ['prac: 9:40 - 10:40 (prac + new songs/meetings)'],
        sort_order: 5
      },
      {
        group_title: '4 Saturdays',
        saturday_title: '2nd Saturday',
        activities: ['prac : 9:40 - 10:40 (2 sat practice 30 min each.)'],
        sort_order: 6
      },
      {
        group_title: '4 Saturdays',
        saturday_title: '3rd Saturday',
        activities: [
          'Vocal practice: 9:30 - 10:15 (45 min)',
          'prac : 10:15 - 10:40 (direct standing)',
          'or: prac : 9:10 - 9:40 (direct standing)',
          'Extra classes / new song prac => 9:40-10:40 (40 min)'
        ],
        sort_order: 7
      },
      {
        group_title: '4 Saturdays',
        saturday_title: '4th Saturday',
        activities: ['prac : 9:40 - 10:40'],
        sort_order: 8
      }
    ];
    for (const l of choirLayouts) {
      await client.query(
        `INSERT INTO public.choir_layouts (group_title, saturday_title, activities, sort_order) VALUES ($1, $2, $3, $4)`,
        [l.group_title, l.saturday_title, l.activities, l.sort_order]
      );
    }

    // 8. Seed YouTube Songs
    console.log('Seeding YouTube Worship Songs...');
    const youtubeSongs = [
      { name: 'yogya kewal', link: 'https://youtu.be/-IDGFmqFiQY?si=HFO6UAuzJ_Yb2SAY&t=267', video_id: '-IDGFmqFiQY', sort_order: 0 },
      { name: 'jiwanko swami', link: 'https://youtu.be/rEgS8TClzuA?si=Y5HMRhwG6rwH8yDb', video_id: 'rEgS8TClzuA', sort_order: 1 },
      { name: 'swargama tapai bahek', link: 'https://youtu.be/OyNgnnEvyTA?si=NNvvp2ckoLnJqXBD', video_id: 'OyNgnnEvyTA', sort_order: 2 },
      { name: 'mero yeshu muktidata', link: 'https://youtu.be/aRiyC6rFdY4?si=albUwKMCfY8HSTOP', video_id: 'aRiyC6rFdY4', sort_order: 3 },
      { name: 'tapai jastai', link: 'https://youtu.be/ufE60MWJlS8?si=7h5JGR7PiDv92RpL', video_id: 'ufE60MWJlS8', sort_order: 4 },
      { name: 'yeshu jivit', link: 'https://youtu.be/hSOcjFKYdEg?si=qYqWUml2xuuNME6d', video_id: 'hSOcjFKYdEg', sort_order: 5 },
      { name: 'ma tapaiko muhar', link: 'https://youtu.be/O7gK7l8BSDU?si=4falWCOTCiaHs5vT', video_id: 'O7gK7l8BSDU', sort_order: 6 },
      { name: 'Bhagera kaha jau ma', link: 'https://youtu.be/QCmPLj7XkY0?si=RJhtTVeLWd5hGkiw', video_id: 'QCmPLj7XkY0', sort_order: 7 },
      { name: 'Ma sadhai tapaiko stuti & Tapai jastai kohi xaina', link: 'https://youtu.be/-IDGFmqFiQY?t=680&si=fuVZSzy6Zb36eJLK', video_id: '-IDGFmqFiQY', sort_order: 8 },
      { name: 'Tapai prabhu sab', link: 'https://youtu.be/-IDGFmqFiQY?t=680&si=fuVZSzy6Zb36eJLK', video_id: '-IDGFmqFiQY', sort_order: 9 }
    ];
    for (const s of youtubeSongs) {
      await client.query(
        `INSERT INTO public.youtube_songs (name, link, video_id, sort_order) VALUES ($1, $2, $3, $4)`,
        [s.name, s.link, s.video_id, s.sort_order]
      );
    }

    // 9. Seed Quiz Trivia Questions
    console.log('Seeding Bible Quiz Trivia Questions...');
    const triviaPath = path.join(rootDir, 'public', 'bible_trivia_validated.json');
    if (fs.existsSync(triviaPath)) {
      const triviaData = JSON.parse(fs.readFileSync(triviaPath, 'utf8'));
      const questions = Array.isArray(triviaData) ? triviaData : triviaData.questions || [];
      const questionsToSeed = questions.slice(0, 150); // Seed first 150 high quality questions
      for (let i = 0; i < questionsToSeed.length; i++) {
        const q = questionsToSeed[i];
        await client.query(
          `INSERT INTO public.quiz_questions (question, options, answer, reference, category, sort_order) VALUES ($1, $2, $3, $4, $5, $6)`,
          [
            q.question,
            JSON.stringify(q.options || []),
            q.answer_index !== undefined ? q.answer_index : 0,
            q.reference || q.category || '',
            q.category || 'General',
            i
          ]
        );
      }
      console.log(`Seeded ${questionsToSeed.length} Bible Quiz questions.`);
    }

    // 10. Seed FAQ Items
    console.log('Seeding FAQs...');
    const faqPath = path.join(rootDir, 'public', 'faq.json');
    if (fs.existsSync(faqPath)) {
      const faqData = JSON.parse(fs.readFileSync(faqPath, 'utf8'));
      const faqs = faqData.church_faq || faqData.faq || [];
      for (let i = 0; i < faqs.length; i++) {
        const f = faqs[i];
        await client.query(
          `INSERT INTO public.faq_items (question, answer, keywords, sort_order) VALUES ($1, $2, $3, $4)`,
          [f.question, f.answer, f.keywords || [], i]
        );
      }
      console.log(`Seeded ${faqs.length} FAQ items.`);
    }

    // 11. Print Verification Counts
    console.log('\n--- VERIFICATION OF SEEDED SUPABASE TABLES ---');
    const tables = [
      'youth_notices',
      'youth_schedules',
      'youth_groups',
      'choir_notices',
      'choir_schedules',
      'choir_layouts',
      'youtube_songs',
      'quiz_questions',
      'quiz_leaderboard',
      'faq_items'
    ];
    for (const tbl of tables) {
      const res = await client.query(`SELECT COUNT(*) FROM public.${tbl}`);
      console.log(`Table ${tbl}: ${res.rows[0].count} rows`);
    }

    console.log('\nSupabase Database Migration & Seeding COMPLETED SUCCESSFULLY! All data stored in Supabase.');
  } catch (err) {
    console.error('Migration failed:', err);
    process.exit(1);
  } finally {
    await client.end();
  }
}

run();
