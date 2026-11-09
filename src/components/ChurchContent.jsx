import React from 'react';
import { Link } from 'react-router-dom';
import '../church-content.css';

function Icon({ type }) {
  const paths = {
    book: 'M12 5v15M12 5C9 3 5 3 2 4v15c3-1 7-1 10 1 3-2 7-2 10-1V4c-3-1-7-1-10 1Z',
    music: 'M10 18V5l10-2v13M10 8l10-2M10 18a3 3 0 1 1-3-3c2 0 3 1 3 3Zm10-2a3 3 0 1 1-3-3c2 0 3 1 3 3Z',
    people: 'M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2M16 3a4 4 0 0 1 0 8M22 21v-2a4 4 0 0 0-3-4M13 7a4 4 0 1 1-8 0 4 4 0 0 1 8 0Z',
    calendar: 'M8 2v4M16 2v4M3 10h18M5 4h14a2 2 0 0 1 2 2v14a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V6a2 2 0 0 1 2-2Z',
    cross: 'M9 3h6v6h6v6h-6v6H9v-6H3V9h6Z',
    screen: 'M4 3h16v13H4ZM12 16v5M7 21l5-5 5 5M2 3h20',
  };
  return (
    <svg viewBox="0 0 24 24" width="24" height="24" fill="none" aria-hidden="true">
      <path d={paths[type] || paths.cross} stroke="currentColor" strokeWidth="1.3" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

function MinistryLink({ to, children }) {
  const isExternal = to.startsWith('http');
  const isHash = to.startsWith('#');

  if (isExternal) {
    return (
      <a className="church-content-link" href={to} target="_blank" rel="noopener noreferrer">
        {children}<span aria-hidden="true">↗</span>
      </a>
    );
  }
  if (isHash) {
    return (
      <a className="church-content-link" href={to}>
        {children}<span aria-hidden="true">↗</span>
      </a>
    );
  }
  return (
    <Link className="church-content-link" to={to}>
      {children}<span aria-hidden="true">↗</span>
    </Link>
  );
}

export function MinistriesSection({ ministries }) {
  const icons = ['cross', 'people', 'music', 'book', 'people', 'cross'];
  return (
    <section id="ministries" className="church-section ministry-section cv-auto" aria-labelledby="ministries-title">
      <div className="church-section-heading">
        <div className="section-label">GET INVOLVED</div>
        <h2 id="ministries-title">Faith in action.<br /><em>Our Ministries.</em></h2>
        <p>Worship, fellowship, biblical teaching, prayer, and community outreach.<br />All are welcome to join our services every Saturday.</p>
      </div>
      <div className="ministry-grid">
        {ministries.map((ministry, index) => (
          <article className="ministry-card" key={ministry.name}>
            <div className="ministry-card-top">
              <span className="church-icon"><Icon type={icons[index % icons.length]} /></span>
              <span className="church-number">0{index + 1}</span>
            </div>
            <h3>{ministry.name}</h3>
            <span className="ministry-time">{ministry.time}</span>
            <p>{ministry.description}</p>
            <MinistryLink to={ministry.link}>Learn more</MinistryLink>
          </article>
        ))}
      </div>
    </section>
  );
}

export default function ChurchContent() {
  return (
    <section id="contact" className="church-section contact-section cv-auto" aria-labelledby="contact-title">
      <div className="contact-copy">
        <div className="section-label">JOIN US IN PERSON</div>
        <h2 id="contact-title">Get in <em>touch.</em></h2>
        <p>We would love to welcome you to our fellowship! Reach out for prayer requests, directions, or ministry questions.</p>
        <div className="contact-detail">
          <span>LOCATION</span>
          <strong>Kathmandu, Nepal</strong>
        </div>
        <div className="contact-detail">
          <span>EMAIL US</span>
          <a href="mailto:sugamprathanabhawan@gmail.com">sugamprathanabhawan@gmail.com</a>
        </div>
        <div className="contact-detail">
          <span>SATURDAY WORSHIP</span>
          <strong>11:00 AM–1:00 PM</strong>
        </div>
        <div className="contact-links">
          <a className="church-content-link" href="https://www.facebook.com/share/19AMMJ1ini/?mibextid=wwXIfr" target="_blank" rel="noopener noreferrer">
            Facebook Page <span aria-hidden="true">↗</span>
          </a>
          <a className="church-content-link" href="https://youtube.com/@sugamchurchmedia?si=JCEBJlGDN92HzGJJ" target="_blank" rel="noopener noreferrer">
            YouTube Channel <span aria-hidden="true">↗</span>
          </a>
        </div>
        <a className="church-content-link" href="mailto:sugamprathanabhawan@gmail.com?subject=Prayer%20request">
          Send a prayer request <span aria-hidden="true">↗</span>
        </a>
      </div>
      <div className="contact-map">
        <iframe
          title="Sugam Church Location Map"
          loading="lazy"
          referrerPolicy="no-referrer-when-downgrade"
          src="https://www.google.com/maps/embed?pb=!1m18!1m12!1m3!1d3196.9589780403658!2d85.34025037492258!3d27.693976426082124!2m3!1f0!2f0!3f0!3m2!1i1024!2i768!4f13.1!3m3!1m2!1s0x39eb19005e2445d7%3A0xc9e961baf713c0ac!2sSugam%20Church!5e1!3m2!1sen!2snp!4v1784608050001!5m2!1sen!2snp"
        />
        <a className="church-content-link" href="https://maps.app.goo.gl/JccnzNUZQzF47xp6A" target="_blank" rel="noopener noreferrer">
          Get directions on Google Maps <span aria-hidden="true">↗</span>
        </a>
      </div>
    </section>
  );
}
