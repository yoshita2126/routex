import React from 'react';

export default function Footer({ setCurrentView }) {
  return (
    <footer className="site-footer">
      <div className="footer-content">
        <span>
          <strong>RouteX</strong> <span className="footer-separator">/</span> MERN Stack Route Planner
        </span>
        <div className="footer-links">
          <button type="button" className="footer-btn" onClick={() => setCurrentView('planner')}>
            Route Map
          </button>
          <span className="footer-separator">·</span>
          <button type="button" className="footer-btn" onClick={() => setCurrentView('login')}>
            Login
          </button>
          <span className="footer-separator">·</span>
          <button type="button" className="footer-btn" onClick={() => setCurrentView('register')}>
            Register
          </button>
        </div>
        <span>MongoDB Database: <code>mongodb://localhost:27017/routex</code></span>
      </div>
    </footer>
  );
}

