import React, { useState, useEffect } from 'react';
import { useAuth } from '../context/AuthContext';

export default function Profile({ setCurrentView }) {
  const { user, token, updateUserData } = useAuth();

  const [name, setName] = useState(user?.name || '');
  const [isUpdatingName, setIsUpdatingName] = useState(false);
  const [nameSuccess, setNameSuccess] = useState('');
  const [nameError, setNameError] = useState('');

  const [currentPassword, setCurrentPassword] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [isChangingPass, setIsChangingPass] = useState(false);
  const [passSuccess, setPassSuccess] = useState('');
  const [passError, setPassError] = useState('');

  const [stats, setStats] = useState({
    totalRoutes: 0,
    totalDistance: 0,
    totalDuration: 0,
  });

  useEffect(() => {
    if (user?.name) {
      setName(user.name);
    }
  }, [user]);

  // Fetch saved routes to compute summary statistics
  useEffect(() => {
    const fetchStats = async () => {
      if (!token) return;
      try {
        const res = await fetch('/api/routes', {
          headers: {
            Authorization: `Bearer ${token}`,
            Accept: 'application/json',
          },
        });
        if (res.ok) {
          const data = await res.json();
          const routes = data.routes || [];
          const totalDist = routes.reduce((acc, r) => acc + (r.distance || 0), 0);
          const totalDur = routes.reduce((acc, r) => acc + (r.duration || 0), 0);
          setStats({
            totalRoutes: routes.length,
            totalDistance: totalDist,
            totalDuration: totalDur,
          });
        }
      } catch (err) {
        console.error('Error fetching stats:', err);
      }
    };
    fetchStats();
  }, [token]);

  const handleUpdateName = async (e) => {
    e.preventDefault();
    if (!name.trim()) {
      setNameError('Name cannot be empty.');
      return;
    }

    setNameError('');
    setNameSuccess('');
    setIsUpdatingName(true);

    try {
      const res = await fetch('/api/auth/profile', {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({ name: name.trim() }),
      });

      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.message || 'Failed to update name.');
      }

      updateUserData({ name: data.user.name });
      setNameSuccess('Profile name updated successfully.');
    } catch (err) {
      setNameError(err.message || 'Error updating profile name.');
    } finally {
      setIsUpdatingName(false);
    }
  };

  const handleChangePassword = async (e) => {
    e.preventDefault();
    setPassError('');
    setPassSuccess('');

    if (!currentPassword || !newPassword) {
      setPassError('Please fill in both current and new password.');
      return;
    }

    if (newPassword.length < 6) {
      setPassError('New password must be at least 6 characters.');
      return;
    }

    if (newPassword !== confirmPassword) {
      setPassError('New passwords do not match.');
      return;
    }

    setIsChangingPass(true);

    try {
      const res = await fetch('/api/auth/change-password', {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({ currentPassword, newPassword }),
      });

      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.message || 'Failed to change password.');
      }

      setPassSuccess('Password changed successfully.');
      setCurrentPassword('');
      setNewPassword('');
      setConfirmPassword('');
    } catch (err) {
      setPassError(err.message || 'Error changing password.');
    } finally {
      setIsChangingPass(false);
    }
  };

  const formatDistance = (meters) => {
    const km = meters / 1000;
    return km >= 100 ? `${Math.round(km)} km` : `${km.toFixed(1)} km`;
  };

  const formatDuration = (seconds) => {
    const min = Math.round(seconds / 60);
    if (min < 60) return `${Math.max(1, min)} min`;
    const hrs = Math.floor(min / 60);
    const remMin = min % 60;
    return remMin ? `${hrs} hr ${remMin} min` : `${hrs} hr`;
  };

  return (
    <div className="profile-page">
      <div className="profile-container">
        <div className="profile-header">
          <div className="profile-hero">
            <span className="profile-avatar-large">
              {user?.name ? user.name.charAt(0).toUpperCase() : 'U'}
            </span>
            <div>
              <span className="eyebrow">YOUR ACCOUNT</span>
              <h1 className="profile-title">{user?.name}</h1>
              <p className="profile-email">{user?.email}</p>
            </div>
          </div>
          <button
            type="button"
            className="btn-outline-sm"
            onClick={() => setCurrentView('planner')}
          >
            ← Back to Map
          </button>
        </div>

        {/* Stats Grid */}
        <div className="profile-stats-grid">
          <div className="profile-stat-card">
            <span className="stat-icon-wrap green">🗺️</span>
            <div>
              <span className="p-stat-label">SAVED ROUTES</span>
              <strong>{stats.totalRoutes}</strong>
            </div>
          </div>
          <div className="profile-stat-card">
            <span className="stat-icon-wrap orange">↗</span>
            <div>
              <span className="p-stat-label">TOTAL DISTANCE</span>
              <strong>{formatDistance(stats.totalDistance)}</strong>
            </div>
          </div>
          <div className="profile-stat-card">
            <span className="stat-icon-wrap purple">◷</span>
            <div>
              <span className="p-stat-label">EST. TIME SAVED</span>
              <strong>{formatDuration(stats.totalDuration)}</strong>
            </div>
          </div>
          <div className="profile-stat-card">
            <span className="stat-icon-wrap blue">🍃</span>
            <div>
              <span className="p-stat-label">DATABASE</span>
              <strong>MongoDB Local</strong>
            </div>
          </div>
        </div>

        {/* Profile Settings Panels */}
        <div className="profile-settings-grid">
          {/* Edit Name Card */}
          <div className="settings-card">
            <h2>Account Details</h2>
            <p className="settings-desc">Update your display name.</p>

            {nameSuccess && (
              <div className="feedback-banner success">{nameSuccess}</div>
            )}
            {nameError && (
              <div className="feedback-banner error">{nameError}</div>
            )}

            <form onSubmit={handleUpdateName} className="settings-form">
              <div className="form-group">
                <label htmlFor="p-name">Display Name</label>
                <div className="input-wrapper">
                  <input
                    id="p-name"
                    type="text"
                    value={name}
                    onChange={(e) => setName(e.target.value)}
                    required
                  />
                </div>
              </div>

              <div className="form-group">
                <label>Email Address (read only)</label>
                <div className="input-wrapper">
                  <input
                    type="email"
                    value={user?.email || ''}
                    disabled
                    className="input-disabled"
                  />
                </div>
              </div>

              <button
                type="submit"
                className="btn-primary-sm"
                disabled={isUpdatingName}
              >
                {isUpdatingName ? 'Saving...' : 'Save Name'}
              </button>
            </form>
          </div>

          {/* Change Password Card */}
          <div className="settings-card">
            <h2>Change Password</h2>
            <p className="settings-desc">Ensure your account uses a secure password.</p>

            {passSuccess && (
              <div className="feedback-banner success">{passSuccess}</div>
            )}
            {passError && (
              <div className="feedback-banner error">{passError}</div>
            )}

            <form onSubmit={handleChangePassword} className="settings-form">
              <div className="form-group">
                <label htmlFor="p-curr-pass">Current Password</label>
                <div className="input-wrapper">
                  <input
                    id="p-curr-pass"
                    type="password"
                    placeholder="Enter current password"
                    value={currentPassword}
                    onChange={(e) => setCurrentPassword(e.target.value)}
                    required
                  />
                </div>
              </div>

              <div className="form-group">
                <label htmlFor="p-new-pass">New Password</label>
                <div className="input-wrapper">
                  <input
                    id="p-new-pass"
                    type="password"
                    placeholder="At least 6 characters"
                    value={newPassword}
                    onChange={(e) => setNewPassword(e.target.value)}
                    required
                  />
                </div>
              </div>

              <div className="form-group">
                <label htmlFor="p-conf-pass">Confirm New Password</label>
                <div className="input-wrapper">
                  <input
                    id="p-conf-pass"
                    type="password"
                    placeholder="Re-enter new password"
                    value={confirmPassword}
                    onChange={(e) => setConfirmPassword(e.target.value)}
                    required
                  />
                </div>
              </div>

              <button
                type="submit"
                className="btn-primary-sm"
                disabled={isChangingPass}
              >
                {isChangingPass ? 'Changing Password...' : 'Update Password'}
              </button>
            </form>
          </div>
        </div>
      </div>
    </div>
  );
}

