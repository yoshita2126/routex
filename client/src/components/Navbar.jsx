import React from 'react';
import { useAuth } from '../context/AuthContext';

export default function Navbar({ currentView, setCurrentView }) {
  const { user, isAuthenticated, logout } = useAuth();

  return (
    <header className="topbar">
      <div className="topbar-inner">
        <a
          className="brand"
          href="#planner"
          onClick={(e) => {
            e.preventDefault();
            setCurrentView('planner');
          }}
          aria-label="RouteX home"
        >
          <span className="brand-mark" aria-hidden="true">
            <svg viewBox="0 0 32 32" fill="none">
              <path
                d="M7 25.5 13.8 6l4.1 12.1L25 6.5"
                stroke="currentColor"
                strokeWidth="3.2"
                strokeLinecap="round"
                strokeLinejoin="round"
              />
              <circle cx="7" cy="25" r="3" fill="#E2744B" />
              <circle cx="25" cy="6.5" r="3" fill="#E2744B" />
            </svg>
          </span>
          <span className="brand-copy">
            <strong>RouteX</strong>
            <span>MERN Route Planner</span>
          </span>
        </a>

        <nav className="main-nav" aria-label="Main navigation">
          <button
            type="button"
            className={`nav-link ${currentView === 'planner' ? 'active' : ''}`}
            onClick={() => setCurrentView('planner')}
          >
            Route Map
          </button>

          {isAuthenticated && (
            <button
              type="button"
              className={`nav-link ${currentView === 'saved' ? 'active' : ''}`}
              onClick={() => setCurrentView('saved')}
            >
              Saved Routes
              {user?.savedRoutesCount > 0 && (
                <span className="nav-badge">{user.savedRoutesCount}</span>
              )}
            </button>
          )}
        </nav>

        <div className="header-actions">
          <div className="service-indicator">
            <span className="live-dot"></span> MongoDB &amp; OSM Live
          </div>

          {isAuthenticated ? (
            <div className="user-menu">
              <button
                type="button"
                className={`user-pill-btn ${currentView === 'profile' ? 'active' : ''}`}
                onClick={() => setCurrentView('profile')}
                title="View Profile, Stats & Settings"
              >
                <span className="avatar-circle">
                  {user?.name ? user.name.charAt(0).toUpperCase() : 'U'}
                </span>
                <span className="user-name">{user?.name}</span>
              </button>
              <button
                type="button"
                className="btn-outline-sm"
                onClick={logout}
                title="Log out of your account"
              >
                Log Out
              </button>
            </div>
          ) : (
            <div className="auth-buttons">
              <button
                type="button"
                className={`btn-ghost-sm ${currentView === 'login' ? 'active' : ''}`}
                onClick={() => setCurrentView('login')}
              >
                Sign In
              </button>
              <button
                type="button"
                className={`btn-primary-sm ${currentView === 'register' ? 'active' : ''}`}
                onClick={() => setCurrentView('register')}
              >
                Register
              </button>
            </div>
          )}
        </div>
      </div>
    </header>
  );
}

