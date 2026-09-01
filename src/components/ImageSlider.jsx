import React, { useState, useEffect, useRef } from 'react';
import { ChevronLeft, ChevronRight } from 'lucide-react';

const CAROUSEL_DATA = [
  { image: "/images/start.webp", text: "Welcome to Our Saturday Service" },
  { image: "/images/com.webp", text: "Community & Fellowship Programs" },
  { image: "/images/js3.webp", text: "Empowering Next Generation Youth" },
  { image: "/images/js2.webp", text: "Youth Fellowship in Action" },
  { image: "/images/js.webp", text: "Youth Praise & Prayer" },
  { image: "/images/gs.webp", text: "House Fellowship Ministry" },
  { image: "/images/bs.webp", text: "Joyful Children's Ministry" },
  { image: "/images/bs2.webp", text: "Sunday School & Kids Fellowship" },
  { image: "/images/bs4.webp", text: "Bible Teaching for Children" },
  { image: "/images/ama4.webp", text: "Mothers' Prayer Fellowship" },
  { image: "/images/ama.webp", text: "Women's Ministry in Faith" },
  { image: "/images/carol1.webp", text: "Christmas Carol Celebration" },
  { image: "/images/carol2.webp", text: "Joyous Carol Service" },
  { image: "/images/choir1.webp", text: "Harmonious Choir Ministry" },
  { image: "/images/choir2.webp", text: "Choir Praise and Worship" },
];

export default function ImageSlider() {
  const [currentIndex, setCurrentIndex] = useState(0);
  const [isPaused, setIsPaused] = useState(false);
  const touchStartX = useRef(0);
  const touchEndX = useRef(0);

  useEffect(() => {
    if (isPaused) return;
    const interval = setInterval(() => {
      setCurrentIndex(prev => (prev + 1) % CAROUSEL_DATA.length);
    }, 3200);
    return () => clearInterval(interval);
  }, [isPaused]);

  const handleNext = () => {
    setCurrentIndex(prev => (prev + 1) % CAROUSEL_DATA.length);
  };

  const handlePrev = () => {
    setCurrentIndex(prev => (prev - 1 + CAROUSEL_DATA.length) % CAROUSEL_DATA.length);
  };

  // Touch Swipe for mobile devices
  const handleTouchStart = (e) => {
    touchStartX.current = e.touches[0].clientX;
  };

  const handleTouchEnd = (e) => {
    touchEndX.current = e.changedTouches[0].clientX;
    const diff = touchStartX.current - touchEndX.current;
    if (Math.abs(diff) > 50) {
      if (diff > 0) handleNext();
      else handlePrev();
    }
  };

  return (
    <section 
      id="slider" 
      className="relative bg-slate-950 h-[50vh] sm:h-[65vh] md:h-[80vh] overflow-hidden group select-none"
      onMouseEnter={() => setIsPaused(true)}
      onMouseLeave={() => setIsPaused(false)}
      onTouchStart={handleTouchStart}
      onTouchEnd={handleTouchEnd}
    >
      {/* Slides */}
      {CAROUSEL_DATA.map((item, index) => {
        const isActive = index === currentIndex;
        return (
          <div
            key={index}
            className={`absolute inset-0 transition-opacity duration-1000 ease-in-out ${
              isActive ? 'opacity-100 z-10' : 'opacity-0 z-0 pointer-events-none'
            }`}
          >
            <img 
              src={item.image} 
              alt={`Slide ${index + 1}`} 
              className="w-full h-full object-cover sm:object-contain bg-slate-950" 
              loading={index < 2 ? 'eager' : 'lazy'}
            />
            {item.text && (
              <div className="absolute inset-0 bg-gradient-to-t from-black/80 via-transparent to-transparent flex items-end justify-center pb-12 sm:pb-16 px-6">
                <h3 className="text-white text-xl sm:text-3xl md:text-4xl font-bold font-serif text-center drop-shadow-lg tracking-wide max-w-2xl animate-fade-in-up">
                  {item.text}
                </h3>
              </div>
            )}
          </div>
        );
      })}

      {/* Navigation Arrows */}
      <button 
        onClick={handlePrev}
        className="absolute left-4 top-1/2 -translate-y-1/2 z-20 w-11 h-11 rounded-full bg-black/40 hover:bg-black/80 text-white flex items-center justify-center transition-all opacity-80 sm:opacity-0 group-hover:opacity-100 backdrop-blur-sm"
        aria-label="Previous Slide"
      >
        <ChevronLeft className="w-6 h-6" />
      </button>

      <button 
        onClick={handleNext}
        className="absolute right-4 top-1/2 -translate-y-1/2 z-20 w-11 h-11 rounded-full bg-black/40 hover:bg-black/80 text-white flex items-center justify-center transition-all opacity-80 sm:opacity-0 group-hover:opacity-100 backdrop-blur-sm"
        aria-label="Next Slide"
      >
        <ChevronRight className="w-6 h-6" />
      </button>

      {/* Dots Indicator */}
      <div className="absolute bottom-4 sm:bottom-6 left-1/2 -translate-x-1/2 flex space-x-2 z-20">
        {CAROUSEL_DATA.map((_, index) => (
          <button
            key={index}
            onClick={() => setCurrentIndex(index)}
            className={`h-2.5 rounded-full transition-all duration-300 ${
              index === currentIndex ? 'bg-sky-400 w-8' : 'bg-white/40 hover:bg-white/70 w-2.5'
            }`}
            aria-label={`Go to slide ${index + 1}`}
          />
        ))}
      </div>
    </section>
  );
}
