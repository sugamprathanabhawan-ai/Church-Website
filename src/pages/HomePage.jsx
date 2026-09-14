import React, { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { 
  Music, 
  Users, 
  Mic2, 
  HeartHandshake, 
  Flame, 
  Globe2, 
  Quote, 
  MapPin, 
  Mail, 
  ChevronDown, 
  Sparkles,
  ArrowRight
} from 'lucide-react';
import ImageSlider from '../components/ImageSlider';
import Lightbox from '../components/Lightbox';
import { useData } from '../context/DataContext';

function FacebookIcon({ className = "w-4 h-4" }) {
  return (
    <svg className={className} fill="currentColor" viewBox="0 0 24 24">
      <path d="M24 12.073c0-6.627-5.373-12-12-12s-12 5.373-12 12c0 5.99 4.388 10.954 10.125 11.854v-8.385H7.078v-3.47h3.047V9.43c0-3.007 1.792-4.669 4.533-4.669 1.312 0 2.686.235 2.686.235v2.953H15.83c-1.491 0-1.956.925-1.956 1.874v2.25h3.328l-.532 3.47h-2.796v8.385C19.612 23.027 24 18.062 24 12.073z"/>
    </svg>
  );
}

function YoutubeIcon({ className = "w-4 h-4" }) {
  return (
    <svg className={className} fill="currentColor" viewBox="0 0 24 24">
      <path d="M23.498 6.186a3.016 3.016 0 0 0-2.122-2.136C19.505 3.545 12 3.545 12 3.545s-7.505 0-9.377.505A3.017 3.017 0 0 0 .502 6.186C0 8.07 0 12 0 12s0 3.93.502 5.814a3.016 3.016 0 0 0 2.122 2.136c1.871.505 9.376.505 9.376.505s7.505 0 9.377-.505a3.015 3.015 0 0 0 2.122-2.136C24 15.93 24 12 24 12s0-3.93-.502-5.814zM9.545 15.568V8.432L15.818 12l-6.273 3.568z"/>
    </svg>
  );
}

const MINISTRIES = [
  {
    title: "Saturday Worship Service",
    time: "11:00 AM - 1:00 PM",
    icon: Music,
    color: "from-sky-500 to-blue-600",
    desc: "Our weekly gathering for congregation worship, heartfelt prayer, and biblical preachings in Nepali.",
    link: "/#contact"
  },
  {
    title: "Youth Fellowship (संगति)",
    time: "Saturday 1:00 PM - 3:00 PM",
    icon: Users,
    color: "from-blue-600 to-indigo-600",
    desc: "Energetic worship, Bible discussion, fellowship groups (Patrus, Yakub, Yahunna), and youth routine activities.",
    link: "/youth"
  },
  {
    title: "Choir & Music Ministry",
    time: "Saturday 9:00 AM - 10:50 AM",
    icon: Mic2,
    color: "from-indigo-600 to-purple-600",
    desc: "Dedicated practice, vocal harmony training, and leading the congregation in praises to the Almighty.",
    link: "/choir"
  },
  {
    title: "Fasting & Prayer (उपवास)",
    time: "Tuesday & Friday Morning",
    icon: Flame,
    color: "from-rose-500 to-amber-600",
    desc: "Seeking the Holy Spirit's guidance, interceding for our community, healing, and spiritual renewal.",
    link: "/#contact"
  },
  {
    title: "House Fellowship (संगति)",
    time: "Weekly in Local Areas",
    icon: HeartHandshake,
    color: "from-teal-500 to-emerald-600",
    desc: "Intimate neighborhood group gatherings for prayer, Bible study, and mutual encouragement.",
    link: "/#contact"
  },
  {
    title: "Outreach & Mission",
    time: "Monthly Initiatives",
    icon: Globe2,
    color: "from-violet-600 to-sky-600",
    desc: "Sharing the Good News and love of Jesus Christ to the unreached areas of Nepal and beyond.",
    link: "/#contact"
  }
];

const DEFAULT_LEADERS = [
  { id: 'l1', name: "किरण थापा", role: "पास्टर (Senior Pastor)", image: "/images/ag1.webp", category: "pastoral" },
  { id: 'l2', name: "दीपक थापा", role: "सह पास्टर (Co-Pastor)", image: "/images/ag2.webp", category: "pastoral" },
  { id: 'l3', name: "नरेश राई", role: "एल्डर (Elder)", image: "/images/ag3.webp", category: "pastoral" },
  { id: 'l4', name: "खड्क चौधरी", role: "डिकन (Deacon)", image: "/images/ag4.webp", category: "deacon" },
  { id: 'l5', name: "बिलास पोख्रेल", role: "डिकन (Deacon)", image: "/images/ag5.webp", category: "deacon" },
  { id: 'l6', name: "नरेन राई", role: "डिकन (Deacon)", image: "/images/ag6.webp", category: "deacon" },
  { id: 'l7', name: "मान बहादुर श्रेष्ठ", role: "डिकन (Deacon)", image: "/images/ag7.webp", category: "deacon" },
  { id: 'l8', name: "स्टीफन तामाङ", role: "डिकन (Deacon)", image: "/images/ag8.webp", category: "deacon" },
  { id: 'l9', name: "आर्यन राई", role: "युवा अगुवा तथा आराधक (Youth Leader & Worship)", image: "/images/you3.png", category: "youth_worship" },
  { id: 'l10', name: "सारा पौडेल", role: "आराधना अगुवा / युवा क्याप्टेन (Worship & Patrus Captain)", image: "/images/you1.jpg", category: "youth_worship" },
  { id: 'l11', name: "सुरज पोख्रेल", role: "युवा क्याप्टेन (Youth Captain - Yakub)", image: "/images/you2.jpg", category: "youth_worship" },
  { id: 'l12', name: "उर्मिला चौधरी", role: "युवा क्याप्टेन (Youth Captain - Yahunna)", image: "/images/you4.jpg", category: "youth_worship" },
  { id: 'l13', name: "ममता राई", role: "आराधक (Worship Ministry)", image: "/images/logos.webp", category: "worship" },
  { id: 'l14', name: "सृष्टि खड्का", role: "आराधक (Worship Ministry)", image: "/images/logos.webp", category: "worship" },
];

const DEFAULT_GALLERY = [
  { src: "/images/img1.webp", caption: "Church Fellowship & Community" },
  { src: "/images/img2.webp", caption: "Worship & Praise Service" },
  { src: "/images/img3.webp", caption: "Youth Gathering" },
  { src: "/images/img4.webp", caption: "Prayer Meeting Moments" },
  { src: "/images/img5.webp", caption: "Church Celebration" },
  { src: "/images/img6.webp", caption: "Worship Time" },
  { src: "/images/img7.webp", caption: "Church Events & Fellowship" },
  { src: "/images/img8.webp", caption: "Community Outreach" },
  { src: "/images/img9.webp", caption: "Choir Practice" },
  { src: "/images/img10.webp", caption: "Joyful Worship Service" },
  { src: "/images/img11.webp", caption: "Church Family Gathering" },
];

export default function HomePage() {
  const { websitePictures } = useData();
  const leadersList = (websitePictures?.leaders && websitePictures.leaders.length > 0)
    ? websitePictures.leaders
    : DEFAULT_LEADERS;
  const galleryList = (websitePictures?.gallery && websitePictures.gallery.length > 0)
    ? websitePictures.gallery
    : DEFAULT_GALLERY;

  const [stats, setStats] = useState({ years: 0, members: 0, youth: 0 });
  const [lightboxOpen, setLightboxOpen] = useState(false);
  const [lightboxIndex, setLightboxIndex] = useState(0);
  const [leaderFilter, setLeaderFilter] = useState('all');

  const filteredLeaders = leadersList.filter(leader => {
    if (leaderFilter === 'all') return true;
    const cat = leader.category || '';
    const roleLower = (leader.role || '').toLowerCase();
    if (leaderFilter === 'pastoral_deacons') {
      return cat === 'pastoral' || cat === 'deacon' || roleLower.includes('पास्टर') || roleLower.includes('एल्डर') || roleLower.includes('डिकन') || roleLower.includes('pastor') || roleLower.includes('elder') || roleLower.includes('deacon');
    }
    if (leaderFilter === 'youth_worship') {
      return cat === 'youth_worship' || cat === 'worship' || roleLower.includes('युवा') || roleLower.includes('आराधक') || roleLower.includes('आराधना') || roleLower.includes('youth') || roleLower.includes('worship') || roleLower.includes('captain');
    }
    return true;
  });

  // Animated counters on mount
  useEffect(() => {
    let start = 0;
    const duration = 1800;
    const stepTime = 20;
    const steps = duration / stepTime;

    const timer = setInterval(() => {
      start++;
      const progress = start / steps;
      setStats({
        years: Math.min(9, Math.floor(progress * 9)),
        members: Math.min(120, Math.floor(progress * 120)),
        youth: Math.min(30, Math.floor(progress * 30))
      });

      if (start >= steps) {
        clearInterval(timer);
        setStats({ years: 9, members: 120, youth: 30 });
      }
    }, stepTime);

    return () => clearInterval(timer);
  }, []);

  const openLightbox = (index) => {
    setLightboxIndex(index);
    setLightboxOpen(true);
  };

  return (
    <div className="flex flex-col min-h-screen">
      
      {/* 1. Hero Section */}
      <section id="home" className="relative h-screen flex items-center justify-center overflow-hidden">
        <div 
          className="absolute inset-0 bg-cover bg-center" 
          style={{ backgroundImage: "url('/images/bg.webp')" }}
        />        
        <div className="absolute inset-0 bg-gradient-to-b from-black/75 via-black/50 to-sky-950/90" />
        
        <div className="relative z-10 text-center px-6 max-w-4xl mx-auto animate-fade-in-up">
          <span className="inline-flex items-center gap-2 px-4 py-1.5 rounded-full bg-sky-500/20 border border-sky-400/30 text-sky-300 text-xs font-semibold uppercase tracking-widest mb-6 backdrop-blur-md">
            <Sparkles className="w-3.5 h-3.5" />
            Sugam Prathana Bhawan
          </span>

          <h1 className="font-serif text-4xl sm:text-6xl lg:text-7xl text-white font-bold mb-6 drop-shadow-lg leading-tight">
            Welcome to <br />
            <span className="text-sky-400">Sugam Church</span>
          </h1>

          <p className="text-base sm:text-xl text-slate-200 mb-10 font-light drop-shadow max-w-2xl mx-auto leading-relaxed">
            A place to worship God, grow in biblical faith, and build a loving, united Christian fellowship in Nepal.
          </p>

          <div className="flex flex-col sm:flex-row justify-center gap-4">
            <Link 
              to="/calendar" 
              className="px-8 py-3.5 bg-sky-500 hover:bg-sky-400 text-white rounded-full font-semibold shadow-[0_0_25px_rgba(56,189,248,0.45)] hover:shadow-[0_0_35px_rgba(56,189,248,0.65)] hover:-translate-y-0.5 transition-all duration-300"
            >
              Join Saturday Worship
            </Link>
            <a 
              href="#contact" 
              className="px-8 py-3.5 bg-white/10 hover:bg-white/20 backdrop-blur-md border border-white/30 text-white rounded-full font-semibold hover:-translate-y-0.5 transition-all duration-300"
            >
              Contact & Location
            </a>
          </div>
        </div>
        
        {/* Scroll indicator */}
        <a 
          href="#slider" 
          className="absolute bottom-8 left-1/2 -translate-x-1/2 text-white/70 hover:text-white animate-bounce transition"
          aria-label="Scroll down"
        >
          <ChevronDown className="w-8 h-8" />
        </a>
      </section>

      {/* 2. Image Carousel Slider */}
      <ImageSlider />

      {/* 3. Bible Verse Section */}
      <section className="py-20 relative bg-sky-950 text-white px-6 overflow-hidden">
        <div className="absolute inset-0 bg-[radial-gradient(#38bdf8_1px,transparent_1px)] [background-size:24px_24px] opacity-10" />
        <div className="relative z-10 max-w-4xl mx-auto text-center space-y-6">
          <Quote className="w-12 h-12 sm:w-16 sm:h-16 text-sky-400/40 mx-auto" />
          <h2 className="text-2xl sm:text-4xl font-serif font-bold leading-relaxed text-slate-100">
            "आफ्‍ना सारा मार्गमा उहाँलाई सम्‍झी, र उहाँले तेरा मार्गहरू सुगम तुल्‍याइदिनुहुनेछ।"
          </h2>
          <p className="text-lg sm:text-xl text-sky-400 font-semibold tracking-wide font-serif">
            — हितोपदेश ३ : ६ (Proverbs 3:6)
          </p>
        </div>
      </section>

      {/* 4. Ministries Section */}
      <section id="ministries" className="py-24 bg-white px-6">
        <div className="max-w-7xl mx-auto">
          <div className="text-center mb-16">
            <span className="text-sky-600 font-semibold tracking-widest uppercase text-xs sm:text-sm">Get Involved</span>
            <h2 className="text-3xl sm:text-5xl font-serif font-bold text-slate-900 mt-2">Our Ministries</h2>
            <div className="w-20 h-1 bg-sky-400 mx-auto rounded-full mt-4" />
          </div>
          
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6 sm:gap-8">
            {MINISTRIES.map((min, idx) => {
              const Icon = min.icon;
              return (
                <Link
                  key={idx}
                  to={min.link}
                  className="group p-8 rounded-3xl bg-sky-50/60 border border-sky-100 hover:border-sky-300 hover:bg-white hover:shadow-xl transition-all duration-300 flex flex-col items-center text-center cursor-pointer hover:-translate-y-1.5"
                >
                  <div className="w-16 h-16 rounded-2xl bg-sky-100 text-sky-600 flex items-center justify-center mb-6 group-hover:bg-sky-500 group-hover:text-white group-hover:scale-110 transition-all duration-300 shadow-sm">
                    <Icon className="w-8 h-8" />
                  </div>
                  <h3 className="text-xl font-bold text-slate-900 mb-3 group-hover:text-sky-600 transition-colors">
                    {min.title}
                  </h3>
                  <p className="text-slate-600 text-sm leading-relaxed mb-4">
                    {min.desc}
                  </p>
                  <span className="mt-auto text-xs font-semibold text-sky-600 flex items-center gap-1 group-hover:gap-2 transition-all">
                    <span>Learn more</span>
                    <ArrowRight className="w-3.5 h-3.5" />
                  </span>
                </Link>
              );
            })}
          </div>
        </div>
      </section>

      {/* 5. Animated Stats Section */}
      <section className="py-16 bg-gradient-to-r from-sky-600 via-sky-500 to-sky-600 text-white px-6 shadow-inner">
        <div className="max-w-6xl mx-auto grid grid-cols-1 sm:grid-cols-3 gap-8 text-center">
          <div className="p-4">
            <div className="text-4xl sm:text-5xl font-black font-serif mb-1 tracking-tight">
              {stats.years}+
            </div>
            <p className="text-sky-100 font-medium text-sm sm:text-base">Years Serving the Lord</p>
          </div>
          
          <div className="p-4">
            <div className="text-4xl sm:text-5xl font-black font-serif mb-1 tracking-tight">
              {stats.members}+
            </div>
            <p className="text-sky-100 font-medium text-sm sm:text-base">Church Members</p>
          </div>
          
          <div className="p-4">
            <div className="text-4xl sm:text-5xl font-black font-serif mb-1 tracking-tight">
              {stats.youth}+
            </div>
            <p className="text-sky-100 font-medium text-sm sm:text-base">Youth Fellowship Members</p>
          </div>
        </div>
      </section>

      {/* 6. Leadership Section */}
      <section id="leadership" className="py-24 bg-slate-50/60 px-6">
        <div className="max-w-7xl mx-auto text-center">
          <span className="text-sky-600 font-semibold tracking-widest uppercase text-xs sm:text-sm">Our Servant Leaders</span>
          <h2 className="text-3xl sm:text-5xl font-serif font-bold text-slate-900 mt-2 mb-3">Church Leadership</h2>
          <p className="text-slate-600 max-w-2xl mx-auto text-xs sm:text-sm mb-8">
            Pastoral elders, deacons, worship leaders (आराधक), and youth fellowship leaders dedicated to serving Christ and our congregation.
          </p>

          {/* Ministry Category Filter Pills */}
          <div className="flex flex-wrap items-center justify-center gap-2 mb-12">
            {[
              { id: 'all', label: 'All Leadership' },
              { id: 'pastoral_deacons', label: 'Pastoral & Deacons (पास्टर तथा डिकन)' },
              { id: 'youth_worship', label: 'Youth & Worship (युवा अगुवा तथा आराधक)' }
            ].map(tab => (
              <button
                key={tab.id}
                type="button"
                onClick={() => setLeaderFilter(tab.id)}
                className={`px-4 py-2 rounded-full text-xs font-bold transition-all shadow-2xs ${
                  leaderFilter === tab.id
                    ? 'bg-sky-600 text-white shadow-md shadow-sky-600/20 scale-105'
                    : 'bg-white text-slate-600 hover:bg-slate-100 border border-slate-200/80'
                }`}
              >
                {tab.label}
              </button>
            ))}
          </div>
          
          <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-6 gap-6">
            {filteredLeaders.map((leader, index) => (
              <div key={leader.id || index} className="group flex flex-col items-center">
                <div className="w-28 h-28 sm:w-32 sm:h-32 rounded-full overflow-hidden mb-4 border-4 border-white shadow-md group-hover:border-sky-400 group-hover:shadow-lg transition-all duration-300">
                  <img 
                    src={leader.image} 
                    alt={leader.name} 
                    className="w-full h-full object-cover group-hover:scale-110 transition-transform duration-500"
                    loading="lazy"
                    onError={(e) => { e.currentTarget.src = '/images/logos.webp'; }}
                  />
                </div>
                <h4 className="font-bold text-slate-900 text-sm sm:text-base">{leader.name}</h4>
                <p className="text-sky-600 text-xs font-semibold mt-0.5 max-w-[160px] mx-auto text-center leading-tight">
                  {leader.role}
                </p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* 7. Gallery Section */}
      <section id="gallery" className="py-24 bg-sky-950 text-white px-6">
        <div className="max-w-7xl mx-auto text-center">
          <span className="text-sky-400 font-semibold tracking-widest uppercase text-xs sm:text-sm">Moments of Worship</span>
          <h2 className="text-3xl sm:text-5xl font-serif font-bold text-white mt-2 mb-16">Church Gallery</h2>
          
          <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4">
            {galleryList.map((img, idx) => (
              <button 
                key={img.id || idx} 
                type="button"
                onClick={() => openLightbox(idx)}
                aria-label={`View photo: ${img.caption}`}
                className="group relative overflow-hidden rounded-2xl cursor-pointer bg-slate-900 border border-sky-900/60 aspect-[4/3] text-left block w-full focus:outline-none focus:ring-2 focus:ring-sky-400"
              >
                <img 
                  src={img.src} 
                  alt={img.caption} 
                  className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-500"
                  loading="lazy"
                />
                <div className="absolute inset-0 bg-sky-950/50 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center p-4">
                  <span className="text-white text-xs font-semibold bg-sky-600/80 px-3 py-1.5 rounded-full backdrop-blur-xs">
                    {img.caption}
                  </span>
                </div>
              </button>
            ))}
          </div>
        </div>
      </section>

      {/* 8. Contact & Map Section */}
      <section id="contact" className="py-24 bg-white px-6">
        <div className="max-w-7xl mx-auto grid grid-cols-1 lg:grid-cols-2 gap-12 items-center">
          
          {/* Contact Details */}
          <div className="space-y-8">
            <div>
              <span className="text-sky-600 font-semibold tracking-widest uppercase text-xs sm:text-sm">Join Us In Person</span>
              <h2 className="text-3xl sm:text-5xl font-serif font-bold text-slate-900 mt-2">Get In Touch</h2>
              <p className="text-slate-600 text-sm sm:text-base mt-3">
                We would love to welcome you to our fellowship! Reach out for prayer requests, directions, or ministry questions.
              </p>
            </div>

            <div className="space-y-6">
              <div className="flex items-start gap-4">
                <div className="w-12 h-12 rounded-2xl bg-sky-50 border border-sky-100 text-sky-600 flex items-center justify-center shrink-0">
                  <MapPin className="w-6 h-6" />
                </div>
                <div>
                  <h4 className="font-bold text-slate-900 text-base">Location</h4>
                  <p className="text-slate-600 text-sm">Kathmandu, Nepal</p>
                  <a 
                    href="https://maps.app.goo.gl/eWkhT7WZdFveRtus7" 
                    target="_blank" 
                    rel="noopener noreferrer" 
                    className="text-sky-600 hover:text-sky-700 font-semibold text-xs inline-flex items-center gap-1 mt-1"
                  >
                    <span>Get Directions on Google Maps</span>
                    <ArrowRight className="w-3 h-3" />
                  </a>
                </div>
              </div>

              <div className="flex items-start gap-4">
                <div className="w-12 h-12 rounded-2xl bg-sky-50 border border-sky-100 text-sky-600 flex items-center justify-center shrink-0">
                  <Mail className="w-6 h-6" />
                </div>
                <div>
                  <h4 className="font-bold text-slate-900 text-base">Email Us</h4>
                  <a href="mailto:sugamprathanabhawan@gmail.com" className="text-slate-600 hover:text-sky-600 text-sm font-medium">
                    sugamprathanabhawan@gmail.com
                  </a>
                </div>
              </div>

              <div className="flex gap-3 pt-2">
                <a 
                  href="https://www.facebook.com/share/19AMMJ1ini/?mibextid=wwXIfr" 
                  target="_blank" 
                  rel="noopener noreferrer"
                  className="px-4 py-2.5 rounded-xl bg-blue-600 text-white font-medium text-xs flex items-center gap-2 hover:bg-blue-700 transition shadow-sm"
                >
                  <FacebookIcon className="w-4 h-4" />
                  <span>Facebook Page</span>
                </a>
                <a 
                  href="https://youtube.com/@sugamchurchmedia?si=JCEBJlGDN92HzGJJ" 
                  target="_blank" 
                  rel="noopener noreferrer"
                  className="px-4 py-2.5 rounded-xl bg-red-600 text-white font-medium text-xs flex items-center gap-2 hover:bg-red-700 transition shadow-sm"
                >
                  <YoutubeIcon className="w-4 h-4" />
                  <span>YouTube Channel</span>
                </a>
              </div>
            </div>
          </div>

          {/* Interactive Google Map */}
          <div className="w-full h-80 sm:h-96 rounded-3xl overflow-hidden shadow-xl border border-sky-100">
            <iframe
              src="https://www.google.com/maps/embed?pb=!1m18!1m12!1m3!1d3196.9589780403658!2d85.34025037492258!3d27.693976426082124!2m3!1f0!2f0!3f0!3m2!1i1024!2i768!4f13.1!3m3!1m2!1s0x39eb19005e2445d7%3A0xc9e961baf713c0ac!2sSugam%20Church!5e1!3m2!1sen!2snp!4v1784608050001!5m2!1sen!2snp"
              title="Sugam Church Location Map"
              className="w-full h-full border-0"
              allowFullScreen
              loading="lazy"
              referrerPolicy="strict-origin-when-cross-origin"
            />
          </div>

        </div>
      </section>

      {/* Lightbox Component */}
      <Lightbox
        isOpen={lightboxOpen}
        images={galleryList}
        currentIndex={lightboxIndex}
        onClose={() => setLightboxOpen(false)}
        onPrev={() => setLightboxIndex(prev => (prev - 1 + galleryList.length) % galleryList.length)}
        onNext={() => setLightboxIndex(prev => (prev + 1) % galleryList.length)}
      />

    </div>
  );
}
