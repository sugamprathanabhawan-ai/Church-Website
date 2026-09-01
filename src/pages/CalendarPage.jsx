import React, { useState, useEffect } from 'react';
import PDFViewer from '../components/PDFViewer';
import { Calendar as CalendarIcon, Sparkles, Download, RotateCw } from 'lucide-react';

const FALLBACK_CALENDARS = [
  { name: "Church Worship Calendar", file: "/calender/calender.pdf" }
];

export default function CalendarPage() {
  const [calendars, setCalendars] = useState(FALLBACK_CALENDARS);
  const [selectedIndex, setSelectedIndex] = useState(0);

  useEffect(() => {
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
  }, []);

  const activeCalendar = calendars[selectedIndex] || calendars[0];

  return (
    <div className="flex-grow flex flex-col items-center px-4 pb-16 w-full pt-28 sm:pt-32 max-w-6xl mx-auto">
      
      {/* Header */}
      <div className="text-center max-w-2xl mx-auto mb-8 animate-fade-in">
        <span className="inline-flex items-center gap-1.5 px-3.5 py-1 rounded-full bg-sky-100/80 border border-sky-200 text-sky-800 text-xs font-bold uppercase tracking-wider mb-3">
          <CalendarIcon className="w-3.5 h-3.5 text-sky-600" />
          Worship Schedule
        </span>
        <h1 className="text-3xl sm:text-5xl font-serif font-bold text-slate-900 mb-2">
          Church Calendar
        </h1>
        <p className="text-xs sm:text-sm text-slate-600">
          View official worship calendar, festive events, prayer fasting schedules, and fellowship dates.
        </p>
      </div>

      {/* Calendar Selector Bar if multiple exist */}
      {calendars.length > 1 && (
        <div className="w-full max-w-lg mb-6 bg-white p-2.5 rounded-2xl border border-sky-100 shadow-2xs flex items-center gap-3">
          <label htmlFor="calendar-select" className="text-xs font-bold text-slate-600 pl-2">
            Select:
          </label>
          <select
            id="calendar-select"
            value={selectedIndex}
            onChange={(e) => setSelectedIndex(Number(e.target.value))}
            className="flex-1 px-3 py-2 bg-slate-50 border border-sky-100 rounded-xl text-xs sm:text-sm font-semibold text-slate-800 focus:outline-none focus:ring-2 focus:ring-sky-400"
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
            fileUrl={activeCalendar.file}
            fileName={activeCalendar.name + ".pdf"}
            title={activeCalendar.name}
          />
        )}
      </div>

    </div>
  );
}
