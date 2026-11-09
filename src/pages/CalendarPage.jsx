import React, { useState, useEffect } from 'react';
import { useData } from '../context/DataContext';
import PDFViewer from '../components/PDFViewer';
import { Calendar as CalendarIcon } from 'lucide-react';

const FALLBACK_CALENDARS = [
  { name: "Church Worship Calendar", file: "/calender/calender.pdf" }
];

function resolveCalendarUrl(cal) {
  if (!cal) return '';
  const file = cal.fileUrl || cal.file_url || cal.file;
  if (!file || typeof file !== 'string') return '';
  if (file.startsWith('http://') || file.startsWith('https://') || file.startsWith('/') || file.startsWith('data:')) {
    return file;
  }
  return `/calender/${encodeURIComponent(file)}`;
}

export default function CalendarPage() {
  const { documents } = useData();
  const [calendars, setCalendars] = useState(FALLBACK_CALENDARS);
  const [selectedIndex, setSelectedIndex] = useState(0);

  useEffect(() => {
    const dbCalendars = documents?.calendar || [];
    if (dbCalendars.length > 0) {
      setCalendars(dbCalendars.map(d => ({
        id: d.id,
        name: d.title || d.name || 'Church Calendar',
        file: d.fileUrl || d.file_url || d.file || '/calender/calender.pdf'
      })));
      return;
    }

    fetch('/calender/pdf-manifest.json')
      .then(res => res.json())
      .then(manifest => {
        const files = Array.isArray(manifest) ? manifest : manifest.files || [];
        if (files.length > 0) {
          const parsed = files.map(f => ({
            name: typeof f === 'string' ? f.replace(/\.[^/.]+$/, '').replace(/[-_]/g, ' ') : 'Church Calendar',
            file: typeof f === 'string' && f.startsWith('/') ? f : `/calender/${f}`
          }));
          setCalendars(parsed);
        }
      })
      .catch(() => {
        // use fallback
      });
  }, [documents?.calendar]);

  const safeIndex = (calendars.length > 0 && selectedIndex >= 0 && selectedIndex < calendars.length)
    ? selectedIndex
    : 0;
  const activeCalendar = calendars[safeIndex] || calendars[0];
  const activeCalendarUrl = resolveCalendarUrl(activeCalendar);

  return (
    <div className="min-h-screen bg-[#f8faf7] flex flex-col items-center px-4 pb-20 w-full pt-28 sm:pt-36">
      <div className="max-w-6xl w-full mx-auto">
        
        {/* Header */}
        <div className="text-center max-w-2xl mx-auto mb-10 animate-fade-in">
          <span className="inline-flex items-center gap-1.5 px-4 py-1.5 rounded-full bg-[#dceef5] border border-[#d4e8ee] text-[#214b60] text-xs font-bold uppercase tracking-wider mb-4 shadow-2xs">
            <CalendarIcon className="w-3.5 h-3.5 text-[#285c73]" />
            Worship Schedule
          </span>
          <h1 className="text-3xl sm:text-5xl font-serif font-bold text-[#214b60] mb-3 tracking-tight">
            Church Calendar
          </h1>
          <p className="text-sm sm:text-base text-[#395e70] font-normal leading-relaxed">
            Official worship calendars, fasting prayers, special feast days, and annual fellowship schedule.
          </p>
          <div className="w-16 h-1 bg-[#4b9fb9] mx-auto rounded-full mt-4" />
        </div>

        {/* Calendar Selector Bar if multiple exist */}
        {calendars.length > 1 && (
          <div className="w-full max-w-md mx-auto mb-8 bg-white p-3 rounded-2xl border border-[#d4e8ee] shadow-sm flex items-center gap-3">
            <label htmlFor="calendar-select" className="text-xs font-bold text-[#214b60] pl-2 whitespace-nowrap">
              Select Schedule:
            </label>
            <select
              id="calendar-select"
              value={selectedIndex}
              onChange={(e) => setSelectedIndex(Number(e.target.value))}
              className="flex-1 px-3 py-2 bg-[#f8faf7] border border-[#d4e8ee] rounded-xl text-xs sm:text-sm font-semibold text-[#214b60] focus:outline-none focus:ring-2 focus:ring-[#285c73]"
            >
              {calendars.map((cal, idx) => (
                <option key={idx} value={idx}>
                  {cal.name}
                </option>
              ))}
            </select>
          </div>
        )}

        {/* Document Viewer Container */}
        <div className="w-full">
          {activeCalendar && (
            <PDFViewer
              fileUrl={activeCalendarUrl}
              fileName={activeCalendar.fileName || (activeCalendar.name ? `${activeCalendar.name}.pdf` : 'calendar.pdf')}
              title={activeCalendar.name || 'Church Worship Calendar'}
            />
          )}
        </div>

      </div>
    </div>
  );
}
