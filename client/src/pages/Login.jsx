import React, { useState } from 'react';
import { useAuth } from '../context/AuthContext';

export default function Login({ setCurrentView }) {
  const { login } = useAuth();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [rememberMe, setRememberMe] = useState(true);
  const [error, setError] = useState('');
  const [isLoading, setIsLoading] = useState(false);

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!email.trim() || !password) {
      setError('Please fill in both email and password.');
      return;
    }

    setError('');
    setIsLoading(true);

    try {
      await login(email.trim(), password);
      // On success, redirect to the map planner
      setCurrentView('planner');
    } catch (err) {
      setError(err.message || 'Login failed. Please check your credentials.');
    } finally {
      setIsLoading(false);
    }
  };

  const handleDemoFill = () => {
    setEmail('traveler@routex.io');
    setPassword('RouteX2026!');
    setError('');
  };

  return (
    <div className="auth-page-container">
      <div className="auth-card">
        <div className="auth-header">
          <span className="eyebrow">WELCOME BACK</span>
          <h1 className="auth-title">Log in to RouteX</h1>
          <p className="auth-subtitle">
            Access your saved routes, favorite journeys, and trip history stored in MongoDB.
          </p>
        </div>

        {error && (
          <div className="feedback-banner error" role="alert">
            <svg viewBox="0 0 20 20" fill="currentColor" className="banner-icon" aria-hidden="true">
              <path
                fillRule="evenodd"
                d="M18 10a8 8 0 11-16 0 8 8 0 0116 0zm-7 4a1 1 0 11-2 0 1 1 0 012 0zm-1-9a1 1 0 00-1 1v4a1 1 0 102 0V6a1 1 0 00-1-1z"
                clipRule="evenodd"
              />
            </svg>
            <span>{error}</span>
          </div>
        )}

        <form onSubmit={handleSubmit} className="auth-form" noValidate>
          <div className="form-group">
            <label htmlFor="login-email">Email Address</label>
            <div className="input-wrapper">
              <input
                id="login-email"
                type="email"
                placeholder="you@example.com"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                required
                autoComplete="email"
                disabled={isLoading}
              />
              <span className="input-icon" aria-hidden="true">
                <svg viewBox="0 0 20 20" fill="none" stroke="currentColor">
                  <path
                    d="M2.5 6.5l7.5 5 7.5-5M2.5 5h15v10h-15V5z"
                    strokeWidth="1.5"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                  />
                </svg>
              </span>
            </div>
          </div>

          <div className="form-group">
            <div className="label-with-aside">
              <label htmlFor="login-password">Password</label>
              <button
                type="button"
                className="text-link"
                onClick={() => setShowPassword(!showPassword)}
                tabIndex="-1"
              >
                {showPassword ? 'Hide password' : 'Show password'}
              </button>
            </div>
            <div className="input-wrapper">
              <input
                id="login-password"
                type={showPassword ? 'text' : 'password'}
                placeholder="Enter your password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                required
                autoComplete="current-password"
                disabled={isLoading}
              />
              <span className="input-icon" aria-hidden="true">
                <svg viewBox="0 0 20 20" fill="none" stroke="currentColor">
                  <rect x="4" y="9" width="12" height="9" rx="2" strokeWidth="1.5" />
                  <path d="M7 9V6a3 3 0 016 0v3" strokeWidth="1.5" strokeLinecap="round" />
                </svg>
              </span>
            </div>
          </div>

          <div className="form-options">
            <label className="checkbox-label">
              <input
                type="checkbox"
                checked={rememberMe}
                onChange={(e) => setRememberMe(e.target.checked)}
              />
              <span>Remember me</span>
            </label>
          </div>

          <button
            type="submit"
            className="primary-button full-width"
            disabled={isLoading}
          >
            <span className="button-label">
              {isLoading ? 'Signing In...' : 'Sign In to Account'}
            </span>
            {isLoading ? (
              <span className="spinner" aria-hidden="true"></span>
            ) : (
              <svg className="button-arrow" viewBox="0 0 20 20" fill="none" aria-hidden="true">
                <path
                  d="M4 10h11m-4-4 4 4-4 4"
                  stroke="currentColor"
                  strokeWidth="1.8"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                />
              </svg>
            )}
          </button>

          <div className="demo-hint-box">
            <div className="demo-text">
              <strong>Need a test account?</strong>
              <span>Click below to autofill demo credentials:</span>
            </div>
            <button
              type="button"
              className="btn-outline-sm demo-btn"
              onClick={handleDemoFill}
            >
              Fill Demo Info
            </button>
          </div>
        </form>

        <div className="auth-footer">
          <p>
            Don't have an account yet?{' '}
            <button
              type="button"
              className="text-link-strong"
              onClick={() => setCurrentView('register')}
            >
              Create an account
            </button>
          </p>
        </div>
      </div>
    </div>
  );
}

