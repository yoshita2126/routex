import React, { useState } from 'react';
import { useAuth } from '../context/AuthContext';

export default function Register({ setCurrentView }) {
  const { register } = useAuth();
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [error, setError] = useState('');
  const [isLoading, setIsLoading] = useState(false);

  // Compute password strength
  const getPasswordStrength = (pass) => {
    if (!pass) return { score: 0, label: '', color: '' };
    let score = 0;
    if (pass.length >= 6) score += 1;
    if (pass.length >= 8) score += 1;
    if (/[A-Z]/.test(pass) && /[a-z]/.test(pass)) score += 1;
    if (/\d/.test(pass) || /[^A-Za-z0-9]/.test(pass)) score += 1;

    if (score <= 1) return { score: 1, label: 'Weak', color: '#e53e3e' };
    if (score === 2) return { score: 2, label: 'Fair', color: '#dd6b20' };
    if (score === 3) return { score: 3, label: 'Good', color: '#3182ce' };
    return { score: 4, label: 'Strong', color: '#315e49' };
  };

  const strength = getPasswordStrength(password);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');

    if (!name.trim() || !email.trim() || !password) {
      setError('Please fill in all required fields.');
      return;
    }

    if (password.length < 6) {
      setError('Password must be at least 6 characters long.');
      return;
    }

    if (password !== confirmPassword) {
      setError('Passwords do not match. Please re-enter.');
      return;
    }

    setIsLoading(true);

    try {
      await register(name.trim(), email.trim(), password);
      // On success, redirect to the map planner
      setCurrentView('planner');
    } catch (err) {
      setError(err.message || 'Registration failed. Please try again.');
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="auth-page-container">
      <div className="auth-card">
        <div className="auth-header">
          <span className="eyebrow">GET STARTED</span>
          <h1 className="auth-title">Create your account</h1>
          <p className="auth-subtitle">
            Sign up to plan routes, save frequent trips, and sync journeys to your MongoDB database.
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
            <label htmlFor="register-name">Full Name</label>
            <div className="input-wrapper">
              <input
                id="register-name"
                type="text"
                placeholder="e.g. Alex Morgan"
                value={name}
                onChange={(e) => setName(e.target.value)}
                required
                autoComplete="name"
                disabled={isLoading}
              />
              <span className="input-icon" aria-hidden="true">
                <svg viewBox="0 0 20 20" fill="none" stroke="currentColor">
                  <path
                    d="M10 10a4 4 0 100-8 4 4 0 000 8zm-7 8a7 7 0 0114 0H3z"
                    strokeWidth="1.5"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                  />
                </svg>
              </span>
            </div>
          </div>

          <div className="form-group">
            <label htmlFor="register-email">Email Address</label>
            <div className="input-wrapper">
              <input
                id="register-email"
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
              <label htmlFor="register-password">Password</label>
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
                id="register-password"
                type={showPassword ? 'text' : 'password'}
                placeholder="At least 6 characters"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                required
                autoComplete="new-password"
                disabled={isLoading}
              />
              <span className="input-icon" aria-hidden="true">
                <svg viewBox="0 0 20 20" fill="none" stroke="currentColor">
                  <rect x="4" y="9" width="12" height="9" rx="2" strokeWidth="1.5" />
                  <path d="M7 9V6a3 3 0 016 0v3" strokeWidth="1.5" strokeLinecap="round" />
                </svg>
              </span>
            </div>

            {password && (
              <div className="password-meter-wrap">
                <div className="password-meter-bars">
                  {[1, 2, 3, 4].map((level) => (
                    <div
                      key={level}
                      className="meter-bar"
                      style={{
                        backgroundColor:
                          level <= strength.score ? strength.color : '#e2e8f0',
                      }}
                    />
                  ))}
                </div>
                <span className="strength-label" style={{ color: strength.color }}>
                  {strength.label}
                </span>
              </div>
            )}
          </div>

          <div className="form-group">
            <label htmlFor="register-confirm-password">Confirm Password</label>
            <div className="input-wrapper">
              <input
                id="register-confirm-password"
                type={showPassword ? 'text' : 'password'}
                placeholder="Confirm password"
                value={confirmPassword}
                onChange={(e) => setConfirmPassword(e.target.value)}
                required
                autoComplete="new-password"
                disabled={isLoading}
              />
              <span className="input-icon" aria-hidden="true">
                <svg viewBox="0 0 20 20" fill="none" stroke="currentColor">
                  <path
                    d="M5 10l3 3 7-7"
                    strokeWidth="1.8"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                  />
                </svg>
              </span>
            </div>
          </div>

          <button
            type="submit"
            className="primary-button full-width"
            disabled={isLoading}
          >
            <span className="button-label">
              {isLoading ? 'Creating Account...' : 'Create Account'}
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
        </form>

        <div className="auth-footer">
          <p>
            Already have an account?{' '}
            <button
              type="button"
              className="text-link-strong"
              onClick={() => setCurrentView('login')}
            >
              Log in
            </button>
          </p>
        </div>
      </div>
    </div>
  );
}

