import React, { useState } from 'react';
import { AuthProvider } from './context/AuthContext';
import Navbar from './components/Navbar';
import Planner from './pages/Planner';
import Login from './pages/Login';
import Register from './pages/Register';
import SavedRoutes from './pages/SavedRoutes';
import Profile from './pages/Profile';
import Footer from './components/Footer';

function MainApp() {
  const [currentView, setCurrentView] = useState('planner');
  const [routeToLoad, setRouteToLoad] = useState(null);

  const handleLoadRouteOnMap = (route) => {
    setRouteToLoad(route);
    setCurrentView('planner');
  };

  return (
    <div className="app-shell">
      <Navbar currentView={currentView} setCurrentView={setCurrentView} />

      <div className="main-content-area">
        {currentView === 'planner' && (
          <Planner
            setCurrentView={setCurrentView}
            initialRouteToLoad={routeToLoad}
          />
        )}
        {currentView === 'login' && (
          <Login setCurrentView={setCurrentView} />
        )}
        {currentView === 'register' && (
          <Register setCurrentView={setCurrentView} />
        )}
        {currentView === 'saved' && (
          <SavedRoutes
            setCurrentView={setCurrentView}
            onLoadRoute={handleLoadRouteOnMap}
          />
        )}
        {currentView === 'profile' && (
          <Profile setCurrentView={setCurrentView} />
        )}
      </div>

      <Footer setCurrentView={setCurrentView} />
    </div>
  );
}

export default function App() {
  return (
    <AuthProvider>
      <MainApp />
    </AuthProvider>
  );
}
