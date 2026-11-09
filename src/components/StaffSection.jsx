import React, { useEffect, useRef, useState, useMemo } from 'react';
import { useData } from '../context/DataContext';
import '../staff.css';

const DEFAULT_TEAM = [
  { id: 'l1', name: 'किरण थापा', role: 'पास्टर (Senior Pastor)', group: 'Pastoral', image: '/images/ag1.webp', detail: 'Senior Pastor · Sugam Prathana Bhawan' },
  { id: 'l2', name: 'दीपक थापा', role: 'सह पास्टर (Co-Pastor)', group: 'Pastoral', image: '/images/ag2.webp', detail: 'Co-Pastor · Sugam Prathana Bhawan' },
  { id: 'l3', name: 'नरेश राई', role: 'एल्डर (Elder)', group: 'Pastoral', department: 'Elder', image: '/images/ag3.webp', detail: 'Elder · Church Leadership' },
  { id: 'l4', name: 'खड्क चौधरी', role: 'डिकन (Deacon)', group: 'Deacons', image: '/images/ag4.webp', detail: 'Deacon · Church Leadership' },
  { id: 'l5', name: 'बिलास पोख्रेल', role: 'डिकन (Deacon)', group: 'Deacons', image: '/images/ag5.webp', detail: 'Deacon · Church Leadership' },
  { id: 'l6', name: 'नरेन राई', role: 'डिकन (Deacon)', group: 'Deacons', image: '/images/ag6.webp', detail: 'Deacon · Church Leadership' },
  { id: 'l7', name: 'मान बहादुर श्रेष्ठ', role: 'डिकन (Deacon)', group: 'Deacons', image: '/images/ag7.webp', detail: 'Deacon · Church Leadership' },
  { id: 'l8', name: 'स्टीफन तामाङ', role: 'डिकन (Deacon)', group: 'Deacons', image: '/images/ag8.webp', detail: 'Deacon · Church Leadership' },
  { id: 'l9', name: 'आर्यन राई', role: 'युवा अगुवा तथा आराधक', group: 'Youth & Worship', image: '/images/you3.png', detail: 'Youth Leader & Worship' },
  { id: 'l10', name: 'सारा पौडेल', role: 'युवा क्याप्टेन (Youth Captain)', group: 'Youth & Worship', image: '/images/you1.jpg', detail: 'Youth Captain · Sugam Church' },
  { id: 'l11', name: 'सुरज पोख्रेल', role: 'युवा सदस्य / संगति (Yakub Group)', group: 'Youth & Worship', image: '/images/you2.jpg', detail: 'Yakub Fellowship Group · Sugam Church' },
  { id: 'l12', name: 'उर्मिला चौधरी', role: 'युवा सदस्य / संगति (Yahunna Group)', group: 'Youth & Worship', image: '/images/you4.jpg', detail: 'Yahunna Fellowship Group · Sugam Church' },
  { id: 'l13', name: 'ममता राई', role: 'आराधक (Worship Ministry)', group: 'Youth & Worship', image: '/images/choir1.webp', detail: 'Worship Ministry · Praise & Worship' },
  { id: 'l14', name: 'सृष्टि खड्का', role: 'आराधक (Worship Ministry)', group: 'Youth & Worship', image: '/images/choir2.webp', detail: 'Worship Ministry · Praise & Worship' },
  { id: 'com', name: 'Get Involved', role: 'Ministry & Fellowship', group: 'Community', image: '/images/com.webp', detail: 'Reach out to the church for ministry questions.' },
];

export default function StaffSection() {
  const { websitePictures } = useData();
  const [filter, setFilter] = useState('Everyone');
  const [visible, setVisible] = useState(false);
  const section = useRef(null);

  useEffect(() => {
    const observer = new IntersectionObserver(([entry]) => {
      if (entry.isIntersecting) {
        setVisible(true);
        observer.disconnect();
      }
    }, { threshold: 0.08 });

    if (section.current) observer.observe(section.current);
    return () => observer.disconnect();
  }, []);

  // Merge with live updated leaders from Supabase / Admin Console
  const displayTeam = useMemo(() => {
    const dynamicLeaders = websitePictures?.leaders || [];
    return DEFAULT_TEAM.map(member => {
      const matched = dynamicLeaders.find(l => 
        (l.id && member.id && l.id === member.id) ||
        (l.name && member.name && (l.name.includes(member.name) || member.name.includes(l.name)))
      );
      let role = matched?.role || member.role;

      // Invariant: Sara is the ONLY Youth Captain; Naresh is the ONLY Elder
      const isSara = member.id === 'l10' || (member.name && (member.name.includes('सारा') || member.name.toLowerCase().includes('sara')));
      const isNaresh = member.id === 'l3' || (member.name && (member.name.includes('नरेश') || member.name.toLowerCase().includes('naresh')));

      if (!isSara && /captain|क्याप्टेन/i.test(role)) {
        role = role.replace(/युवा क्याप्टेन/gi, 'युवा सदस्य / संगति')
                   .replace(/Youth Captain/gi, 'Fellowship Member')
                   .replace(/क्याप्टेन|Captain/gi, 'संगति')
                   .trim();
      }
      if (isSara) {
        role = 'युवा क्याप्टेन (Youth Captain)';
      }
      if (!isNaresh && /elder|एल्डर/i.test(role)) {
        role = role.replace(/एल्डर|Elder/gi, 'अगुवा (Leader)').trim();
      }
      if (isNaresh) {
        role = 'एल्डर (Elder)';
      }

      return {
        ...member,
        image: (matched && matched.image) ? matched.image : member.image,
        role,
        detail: isSara ? 'Youth Captain · Sugam Church' : (isNaresh ? 'Elder · Church Leadership' : member.detail),
        department: isNaresh ? 'Elder' : (member.department || member.group)
      };
    });
  }, [websitePictures?.leaders]);

  const people = displayTeam.filter(person => filter === 'Everyone' || person.group === filter);

  return (
    <section ref={section} id="leadership" className={`staff-section cv-auto ${visible ? 'staff-visible' : ''}`} aria-labelledby="staff-title">
      <div className="staff-heading">
        <div>
          <div className="section-label">OUR SERVANT LEADERS</div>
          <h2 id="staff-title">Church<br /><em>Leadership.</em></h2>
        </div>
        <div className="staff-intro">
          <div className="staff-seal" aria-hidden="true">
            <svg viewBox="0 0 80 80" fill="none">
              <circle cx="40" cy="40" r="32" stroke="currentColor" strokeDasharray="2 5" />
              <path d="M40 18v44M18 40h44M24 24l32 32M24 56l32-32" stroke="currentColor" strokeWidth="1.5" />
              <circle cx="40" cy="40" r="9" fill="#e9f5f9" stroke="currentColor" />
            </svg>
          </div>
          <p>Pastoral leadership, Elder Naresh Rai, deacons, worship leaders (आराधक), and youth fellowship leaders dedicated to serving Christ and our congregation.</p>
        </div>
      </div>
      <div className="staff-toolbar">
        <div className="staff-filters" aria-label="Filter church leadership">
          {['Everyone', 'Pastoral', 'Deacons', 'Youth & Worship', 'Community'].map(group => (
            <button key={group} onClick={() => setFilter(group)} aria-pressed={filter === group}>
              {group}
              {group === 'Everyone' && <span>14 + 1</span>}
            </button>
          ))}
        </div>
        <span className="staff-count" aria-live="polite">{String(people.length).padStart(2, '0')} PROFILES & MINISTRIES</span>
      </div>
      <div className="staff-grid" key={filter}>
        {people.map((person, index) => (
          <article className="staff-card" key={person.name} style={{ animationDelay: `${index * 65}ms` }} tabIndex={0}>
            <div className="staff-portrait">
              <img src={person.image} alt={person.name} loading="lazy" decoding="async" />
              <span className="staff-department">{person.department || person.group}</span>
              <div className="staff-quote">
                <span>{person.group === 'Community' ? 'GET INVOLVED' : 'SERVING OUR CONGREGATION'}</span>
                <p>{person.detail}</p>
              </div>
            </div>
            <div className="staff-card-caption">
              <div>
                <h3>{person.name}</h3>
                <p>{person.role}</p>
              </div>
              <span aria-hidden="true">↗</span>
            </div>
          </article>
        ))}
      </div>
      <div className="staff-bottom">
        <span>DEDICATED TO SERVING CHRIST.</span>
        <p>Church Leadership & Ministries · Sugam Prathana Bhawan</p>
      </div>
    </section>
  );
}
