import React from 'react';
import { Link, useNavigate, useLocation } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';

const Navbar: React.FC = () => {
  const { user, logout } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();

  const handleLogout = async () => {
    await logout();
    navigate('/login');
  };

  const isActive = (path: string) => location.pathname === path ? 'active' : '';

  if (!user) return null;

  const canViewUsers = ['Application Administrator', 'City Coordinator', 'Volunteer leader'].includes(user.role);

  return (
    <nav className="nav-bar">
      <div className="nav-brand">
        <h2 className="brand-title">Cardiac Crusade</h2>
      </div>
      
      <div className="nav-user-controls">
        <span className="user-email">{user.email}</span>
        <span className="user-role">({user.role})</span>
        <Link to="/settings" title="Settings" className="settings-link">
          <span style={{ fontSize: '1.2rem' }}>⚙️</span>
        </Link>
        <button onClick={handleLogout} className="secondary logout-button" title="Logout">
          <span className="logout-text">Logout</span>
          <span className="logout-icon" style={{ display: 'none' }}>⏻</span>
        </button>
      </div>

      <ul className="nav-links">
        {canViewUsers && (
          <li>
            <Link to="/users" className={isActive('/users')}>Users</Link>
          </li>
        )}
        <li>
          <Link to="/map" className={isActive('/map')}>Map</Link>
        </li>
        <li>
          <Link to="/list" className={isActive('/list')}>List</Link>
        </li>
        <li>
          <Link to="/reporting" className={isActive('/reporting')}>Reporting</Link>
        </li>
      </ul>
    </nav>
  );
};

export default Navbar;
