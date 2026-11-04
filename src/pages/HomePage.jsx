import React, { useEffect, useRef, useState, useMemo } from 'react';
import { Link } from 'react-router-dom';
import StaffSection from '../components/StaffSection';
import ChurchContent, { MinistriesSection } from '../components/ChurchContent';
import AudioSermonsSection from '../components/AudioSermonsSection';
import Lightbox from '../components/Lightbox';
import { useData } from '../context/DataContext';

const terrace = '/images/start.webp';
const backgroundVideoWebm = '/vid.webm';
const backgroundVideoMp4 = '/vid.mp4';

const DEFAULT_GALLERY = [
  { id: 'g1', image: '/images/img1.webp', caption: 'Fellowship & Community', alt: 'Church Fellowship & Community' },
  { id: 'g2', image: '/images/img2.webp', caption: 'Worship & Praise', alt: 'Worship & Praise Service' },
  { id: 'g3', image: '/images/img3.webp', caption: 'Youth Gathering', alt: 'Youth Gathering' },
  { id: 'g4', image: '/images/img4.webp', caption: 'Prayer Meeting Moments', alt: 'Prayer Meeting Moments' },
  { id: 'g5', image: '/images/img5.webp', caption: 'Church Celebration', alt: 'Church Celebration' },
  { id: 'g6', image: '/images/img6.webp', caption: 'Community & Outreach', alt: 'Worship & Outreach' },
];

const ministries = [
  { name: 'Saturday Worship Service', time: '11:00 AM – 1:00 PM', description: 'Our weekly gathering for congregation worship, heartfelt prayer, and biblical preachings in Nepali.', link: '#contact' },
  { name: 'Youth Fellowship (संगति)', time: 'Saturday 1:00 PM – 3:00 PM', description: 'Energetic worship, Bible discussion, fellowship groups (Patrus, Yakub, Yahunna), and youth routine activities.', link: '/youth' },
  { name: 'Choir & Music Ministry', time: 'Saturday 9:00 AM – 10:50 AM', description: 'Dedicated practice, vocal harmony training, and leading the congregation in praises to the Almighty.', link: '/choir' },
  { name: 'Fasting & Prayer (उपवास)', time: 'Tuesday & Friday Morning', description: "Seeking the Holy Spirit's guidance, interceding for our community, healing, and spiritual renewal.", link: '#contact' },
  { name: 'House Fellowship (संगति)', time: 'Weekly in Local Areas', description: 'Intimate neighborhood group gatherings for prayer, Bible study, and mutual encouragement.', link: '#contact' },
  { name: 'Outreach & Mission', time: 'Monthly Initiatives', description: 'Sharing the Good News and love of Jesus Christ to the unreached areas of Nepal and beyond.', link: '#contact' },
];

function Arrow({ diagonal = false }) {
  return (
    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" aria-hidden="true">
      <path d={diagonal ? 'M6 18 18 6M6 6h12v12' : 'M4 12h16m-6-6 6 6-6 6'} stroke="currentColor" strokeWidth="1.5" />
    </svg>
  );
}

export default function HomePage() {
  const { websitePictures } = useData();
  const video = useRef(null);
  const [dialog, setDialog] = useState(null);

  // Gallery items from live church settings or high-res fallbacks
  const galleryItems = useMemo(() => {
    const list = websitePictures?.gallery && websitePictures.gallery.length > 0
      ? websitePictures.gallery
      : DEFAULT_GALLERY;
    return list.map((item, idx) => ({
      id: item.id || `g-${idx}`,
      image: item.src || item.image || `/images/img${(idx % 6) + 1}.webp`,
      caption: item.caption || `Church Moment 0${idx + 1}`,
      alt: item.caption || `Church Moment 0${idx + 1}`
    }));
  }, [websitePictures?.gallery]);

  // Calculate dynamic 3D radius based on photo count so cards never overlap
  const dynamicRadius = useMemo(() => {
    const count = galleryItems.length || 6;
    return Math.max(340, Math.round((125 / Math.tan(Math.PI / count)) + 35));
  }, [galleryItems.length]);

  const [activeSlide, setActiveSlide] = useState(0);
  const [galleryPaused, setGalleryPaused] = useState(false);
  const [lightboxIndex, setLightboxIndex] = useState(null);

  const heroRef = useRef(null);
  const gallerySectionRef = useRef(null);
  const isGalleryVisibleRef = useRef(false);

  const orbitRef = useRef(null);
  const angleRef = useRef(0);
  const isDraggingRef = useRef(false);
  const dragStartXRef = useRef(0);
  const dragStartAngleRef = useRef(0);
  const isHoveredRef = useRef(false);

  // IntersectionObserver to pause 3D loop when gallery is offscreen
  useEffect(() => {
    const el = gallerySectionRef.current;
    if (!el || typeof IntersectionObserver === 'undefined') {
      isGalleryVisibleRef.current = true;
      return;
    }

    const observer = new IntersectionObserver(([entry]) => {
      isGalleryVisibleRef.current = entry.isIntersecting;
    }, { threshold: 0.05 });

    observer.observe(el);
    return () => observer.disconnect();
  }, []);

  // Smooth GPU continuous rotation loop (imperative transform updates with zero React re-render overhead)
  useEffect(() => {
    let animId;
    let lastTime = performance.now();

    const loop = (time) => {
      const delta = time - lastTime;
      lastTime = time;

      // Only animate if gallery is currently intersecting the viewport, on desktop, and not paused/dragged/hovered
      const isDesktop = typeof window !== 'undefined' && window.innerWidth > 768;
      if (
        isGalleryVisibleRef.current &&
        isDesktop &&
        !galleryPaused &&
        lightboxIndex === null &&
        !isDraggingRef.current &&
        !isHoveredRef.current
      ) {
        // Rotates full 360 degrees in ~26 seconds (0.0138 deg/ms)
        angleRef.current = (angleRef.current - delta * 0.0138) % 360;
        if (orbitRef.current) {
          orbitRef.current.style.transform = `rotateX(-7deg) rotateY(${angleRef.current}deg)`;
        }
      }

      animId = requestAnimationFrame(loop);
    };

    animId = requestAnimationFrame(loop);
    return () => cancelAnimationFrame(animId);
  }, [galleryPaused, lightboxIndex]);

  const rotateBy = (direction) => {
    const count = galleryItems.length || 6;
    const step = 360 / count;
    angleRef.current = angleRef.current + (direction * step);
    if (orbitRef.current) {
      orbitRef.current.style.transform = `rotateX(-7deg) rotateY(${angleRef.current}deg)`;
    }
  };

  const handleStagePointerDown = (e) => {
    isDraggingRef.current = true;
    dragStartXRef.current = e.clientX;
    dragStartAngleRef.current = angleRef.current;
  };

  const handleStagePointerMove = (e) => {
    if (!isDraggingRef.current) return;
    const diff = e.clientX - dragStartXRef.current;
    angleRef.current = dragStartAngleRef.current + (diff * 0.4);
    if (orbitRef.current) {
      orbitRef.current.style.transform = `rotateX(-7deg) rotateY(${angleRef.current}deg)`;
    }
  };

  const handleStagePointerUp = () => {
    isDraggingRef.current = false;
  };

  const touchStartX = useRef(null);
  const touchEndX = useRef(null);

  const prevSlide = () => {
    setActiveSlide(prev => (prev - 1 + galleryItems.length) % galleryItems.length);
  };

  const nextSlide = () => {
    setActiveSlide(prev => (prev + 1) % galleryItems.length);
  };

  // Auto-advance mobile gallery slides unless paused or lightbox is open
  useEffect(() => {
    if (galleryPaused || lightboxIndex !== null) return;
    const timer = setInterval(() => {
      setActiveSlide(prev => (prev + 1) % galleryItems.length);
    }, 4500);
    return () => clearInterval(timer);
  }, [galleryPaused, lightboxIndex, galleryItems.length]);

  const handleTouchStart = (e) => {
    touchStartX.current = e.touches[0].clientX;
    touchEndX.current = null;
  };

  const handleTouchMove = (e) => {
    touchEndX.current = e.touches[0].clientX;
  };

  const handleTouchEnd = () => {
    if (touchStartX.current === null || touchEndX.current === null) return;
    const diff = touchStartX.current - touchEndX.current;
    if (diff > 40) {
      nextSlide();
    } else if (diff < -40) {
      prevSlide();
    }
    touchStartX.current = null;
    touchEndX.current = null;
  };

  const openVisit = (e) => {
    modalTriggerRef.current = e?.currentTarget || document.activeElement;
    setDialog('visit');
  };

  const modalTriggerRef = useRef(null);
  const closeBtnRef = useRef(null);

  // Accessible Escape key listener & focus management for dialog
  useEffect(() => {
    if (!dialog) return;

    const handleKeyDown = (e) => {
      if (e.key === 'Escape') {
        setDialog(null);
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    // Focus close button on open
    const focusTimer = setTimeout(() => {
      closeBtnRef.current?.focus();
    }, 50);

    return () => {
      window.removeEventListener('keydown', handleKeyDown);
      clearTimeout(focusTimer);
      modalTriggerRef.current?.focus();
    };
  }, [dialog]);

  useEffect(() => {
    const element = video.current;
    if (!element) return;

    // Respect user reduced-motion preference
    const prefersReducedMotion = typeof window !== 'undefined' &&
      window.matchMedia('(prefers-reduced-motion: reduce)').matches;

    if (prefersReducedMotion) {
      return;
    }

    element.muted = true;
    const play = () => {
      void element.play().catch(() => {});
    };

    // Pause video playback when offscreen to completely halt GPU frame decoding
    let observer;
    if (heroRef.current && typeof IntersectionObserver !== 'undefined') {
      observer = new IntersectionObserver(([entry]) => {
        if (entry.isIntersecting) {
          if (!document.hidden) play();
        } else {
          element.pause();
        }
      }, { threshold: 0.05 });
      observer.observe(heroRef.current);
    } else {
      play();
    }

    const resume = () => {
      if (!document.hidden) play();
    };
    document.addEventListener('visibilitychange', resume);
    document.addEventListener('pointerdown', play);
    return () => {
      if (observer) observer.disconnect();
      document.removeEventListener('visibilitychange', resume);
      document.removeEventListener('pointerdown', play);
    };
  }, []);

  return (
    <div className="home-newfron-page">
      {/* Video Hero Section */}
      <section ref={heroRef} className="hero">
        <video
          ref={video}
          className="hero-video"
          autoPlay
          muted
          loop
          playsInline
          controls={false}
          preload="metadata"
          poster={terrace}
        >
          <source src={backgroundVideoWebm} type="video/webm" />
          <source src={backgroundVideoMp4} type="video/mp4" />
        </video>
        <div className="hero-shade" />
        <div className="hero-topline">
          <span>SUGAM PRATHANA BHAWAN</span>
          <span>WORSHIP. PRAYER. FELLOWSHIP.</span>
        </div>
        <div className="hero-content">
          <div className="eyebrow">
            <span /> जयमसीह! PEACE BE WITH YOU
          </div>
          <h1>Sugam<br /><em>Church.</em></h1>
          <p>
            A place to worship God, grow in biblical faith,<br className="desktop-break" />
            and build a loving, united Christian fellowship in Nepal.
          </p>
          <div className="hero-actions">
            <button className="light-button" onClick={openVisit} type="button">
              Join Saturday Worship <Arrow diagonal />
            </button>
            <a className="menu-link" href="#ministries">
              Our ministries <Arrow />
            </a>
          </div>
        </div>
        <div className="hero-bottom">
          <a href="#story" className="scroll-link">
            <span>↓</span> DISCOVER OUR FELLOWSHIP
          </a>
          <span className="coordinates">KATHMANDU, NEPAL</span>
        </div>
      </section>

      {/* Decorative Strip */}
      <div className="welcome-strip">
        <span>Worship &amp; Prayer</span>
        <i>✳</i>
        <span>Youth Fellowship</span>
        <i>✳</i>
        <span>Choir &amp; Music</span>
        <i>✳</i>
        <span>Community &amp; Faith</span>
        <i>✳</i>
      </div>

      {/* About & Story Section */}
      <section id="story" className="story cv-auto">
        <div className="story-copy">
          <div className="section-label">सुगम प्रार्थना भवन</div>
          <h2>Grow in faith.<br />United in <em>fellowship.</em></h2>
          <p>
            Sugam Prathana Bhawan is a Christian church in Kathmandu, Nepal, dedicated to worship, prayer, fellowship, and community service. Join our congregation for heartfelt prayer and biblical teaching in Nepali.
          </p>
          <div className="glass-card p-4 sm:p-5 my-4 border border-white/95 shadow-xs">
            <p className="italic font-serif text-[#214b60] text-sm sm:text-base leading-relaxed !max-w-none m-0">
              “आफ्‍ना सारा मार्गमा उहाँलाई सम्‍झी, र उहाँले तेरा मार्गहरू सुगम तुल्‍याइदिनुहुनेछ।” — हितोपदेश ३ : ६ (Proverbs 3:6)
            </p>
            <div className="text-[11px] font-semibold text-[#4b9fb9] tracking-wider uppercase mt-2">
              9 years serving the Lord · 120 church members · 30 youth fellowship members
            </div>
          </div>
          <a className="text-link" href="#ministries">
            Get involved in our ministries <Arrow diagonal />
          </a>
        </div>
        <figure className="story-photo">
          <img src={terrace} alt="Sugam Church Sanctuary" loading="lazy" decoding="async" />
          <figcaption>WORSHIP GOD. GROW IN BIBLICAL FAITH.</figcaption>
        </figure>
      </section>

      {/* Ministries Section */}
      <MinistriesSection ministries={ministries} />

      {/* Church Gallery Section */}
      <section ref={gallerySectionRef} id="gallery" className="gallery-section cv-auto" aria-labelledby="gallery-heading">
        <div className="section-label">MOMENTS OF WORSHIP</div>
        <h2 id="gallery-heading">Church <em>Gallery.</em></h2>
        <p>Worship, prayer, fellowship, and community.</p>

        {/* 1. Desktop 3D Rotating Orbit Stage (Visible on > 768px) */}
        <div 
          className="gallery-desktop-stage gallery-stage"
          style={{ '--gallery-radius': `${dynamicRadius}px` }}
          onPointerDown={handleStagePointerDown}
          onPointerMove={handleStagePointerMove}
          onPointerUp={handleStagePointerUp}
          onPointerCancel={handleStagePointerUp}
          onMouseEnter={() => { isHoveredRef.current = true; }}
          onMouseLeave={() => { isHoveredRef.current = false; isDraggingRef.current = false; }}
          title="Drag left or right to spin gallery"
        >
          {/* Previous Desktop Arrow */}
          <button 
            type="button" 
            className="gallery-desktop-arrow gallery-desktop-prev" 
            onClick={(e) => { e.stopPropagation(); rotateBy(1); }}
            aria-label="Rotate previous photos"
            title="Previous photos"
          >
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
              <polyline points="15 18 9 12 15 6"></polyline>
            </svg>
          </button>

          <div ref={orbitRef} className="gallery-orbit">
            {galleryItems.map((item, index) => {
              const count = galleryItems.length || 6;
              const angle = (360 / count) * index;
              return (
                <figure 
                  className="gallery-card" 
                  key={item.id || item.image} 
                  style={{ transform: `rotateY(${angle}deg) translateZ(var(--gallery-radius))` }}
                  onClick={() => setLightboxIndex(index)}
                  title="Click to view full photo"
                  role="button"
                  tabIndex={0}
                  onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); setLightboxIndex(index); }}}
                >
                  <img src={item.image} alt={item.alt} loading="lazy" decoding="async" />
                  <figcaption>
                    <span>{String(index + 1).padStart(2, '0')}</span>
                    {item.caption}
                  </figcaption>
                </figure>
              );
            })}
          </div>

          {/* Next Desktop Arrow */}
          <button 
            type="button" 
            className="gallery-desktop-arrow gallery-desktop-next" 
            onClick={(e) => { e.stopPropagation(); rotateBy(-1); }}
            aria-label="Rotate next photos"
            title="Next photos"
          >
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
              <polyline points="9 18 15 12 9 6"></polyline>
            </svg>
          </button>
        </div>

        {/* 2. Responsive Mobile Phone Touch Carousel (Visible on <= 768px) */}
        <div 
          className="gallery-mobile-slider"
          onTouchStart={handleTouchStart}
          onTouchMove={handleTouchMove}
          onTouchEnd={handleTouchEnd}
          aria-roledescription="carousel"
          aria-label="Church photo gallery carousel"
        >
          <div className="gallery-mobile-viewport">
            {/* Prev Button */}
            <button 
              type="button" 
              className="gallery-mobile-arrow gallery-mobile-prev"
              onClick={prevSlide}
              aria-label="Previous gallery image"
            >
              <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                <polyline points="15 18 9 12 15 6"></polyline>
              </svg>
            </button>

            {/* Current Active Card */}
            {galleryItems[activeSlide] && (
              <figure 
                className="gallery-mobile-card"
                onClick={() => setLightboxIndex(activeSlide)}
                role="button"
                tabIndex={0}
                onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); setLightboxIndex(activeSlide); }}}
                aria-label={`View full photo: ${galleryItems[activeSlide].caption}`}
              >
                <div className="gallery-mobile-media">
                  <img 
                    src={galleryItems[activeSlide].image} 
                    alt={galleryItems[activeSlide].alt} 
                    loading="lazy" 
                    decoding="async"
                  />
                  <div className="gallery-mobile-expand-badge">
                    <span>Tap to enlarge</span>
                    <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                      <polyline points="15 3 21 3 21 9"></polyline>
                      <polyline points="9 21 3 21 3 15"></polyline>
                      <line x1="21" y1="3" x2="14" y2="10"></line>
                      <line x1="3" y1="21" x2="10" y2="14"></line>
                    </svg>
                  </div>
                </div>
                <figcaption className="gallery-mobile-caption">
                  <div className="gallery-mobile-title">
                    <span className="gallery-mobile-number">{String(activeSlide + 1).padStart(2, '0')}</span>
                    <h3>{galleryItems[activeSlide].caption}</h3>
                  </div>
                  <span className="gallery-mobile-counter">
                    {activeSlide + 1} / {galleryItems.length}
                  </span>
                </figcaption>
              </figure>
            )}

            {/* Next Button */}
            <button 
              type="button" 
              className="gallery-mobile-arrow gallery-mobile-next"
              onClick={nextSlide}
              aria-label="Next gallery image"
            >
              <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                <polyline points="9 18 15 12 9 6"></polyline>
              </svg>
            </button>
          </div>

          {/* Interactive Pagination Dots */}
          <div className="gallery-mobile-dots" role="tablist" aria-label="Choose gallery slide">
            {galleryItems.map((_, dotIdx) => (
              <button
                key={dotIdx}
                type="button"
                className={`gallery-mobile-dot ${dotIdx === activeSlide ? 'active' : ''}`}
                onClick={() => setActiveSlide(dotIdx)}
                aria-label={`Go to slide ${dotIdx + 1}`}
                aria-selected={dotIdx === activeSlide}
                role="tab"
              />
            ))}
          </div>

          <p className="gallery-mobile-hint">
            ‹ Swipe or tap arrows to navigate · Tap photo to enlarge ›
          </p>
        </div>

        {/* Gallery Controls Note */}
        <div className="gallery-note">
          <span>MOMENTS OF WORSHIP · SUGAM CHURCH FELLOWSHIP</span>
          <button onClick={() => setGalleryPaused(!galleryPaused)} aria-pressed={galleryPaused} type="button">
            {galleryPaused ? 'Resume auto-play' : 'Pause auto-play'} <span aria-hidden="true">{galleryPaused ? '↻' : 'Ⅱ'}</span>
          </button>
        </div>
      </section>

      {/* Fullscreen Lightbox Modal */}
      <Lightbox
        isOpen={lightboxIndex !== null}
        images={galleryItems.map(g => ({ src: g.image, alt: g.alt, caption: g.caption }))}
        currentIndex={lightboxIndex ?? 0}
        onClose={() => setLightboxIndex(null)}
        onPrev={() => setLightboxIndex(prev => (prev - 1 + galleryItems.length) % galleryItems.length)}
        onNext={() => setLightboxIndex(prev => (prev + 1) % galleryItems.length)}
      />

      {/* Servant Leadership Section */}
      <StaffSection />

      {/* Contact & Map Section */}
      <ChurchContent />

      {/* Audio Bible & Sermons Streaming Section (at last on landing page) */}
      <AudioSermonsSection />

      {/* Visit / Ministries Modal */}
      {dialog && (
        <div className="modal-backdrop" onClick={() => setDialog(null)}>
          <section className="modal" role="dialog" aria-modal="true" aria-labelledby="dialog-title" onClick={e => e.stopPropagation()}>
            <button ref={closeBtnRef} className="close-button" aria-label="Close dialog" onClick={() => setDialog(null)} type="button">×</button>
            <div className="section-label">JOIN US IN PERSON</div>
            <h2 id="dialog-title">Join Saturday Worship</h2>
            <p>
              We would love to welcome you to our fellowship! Reach out for prayer requests, directions, or ministry questions.
            </p>
            <div className="contact-detail" style={{ marginTop: '20px' }}>
              <span className="section-label">WORSHIP TIME</span>
              <p className="font-bold text-[#214b60]">Every Saturday · 11:00 AM – 1:00 PM</p>
            </div>
            <div className="contact-detail" style={{ marginTop: '12px' }}>
              <span className="section-label">LOCATION</span>
              <p className="text-[#214b60]">Sugam Prathana Bhawan, Kathmandu, Nepal</p>
            </div>
            <div className="contact-detail" style={{ marginTop: '12px' }}>
              <span className="section-label">EMAIL</span>
              <p><a className="text-[#519eb8] underline" href="mailto:sugamprathanabhawan@gmail.com">sugamprathanabhawan@gmail.com</a></p>
            </div>
            <a className="blue-button" href="#contact" onClick={() => setDialog(null)}>
              <span>View Location on Map</span>
              <Arrow diagonal />
            </a>
            <small>All are welcome to join our services.</small>
          </section>
        </div>
      )}
    </div>
  );
}
