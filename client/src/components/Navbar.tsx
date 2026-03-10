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

  const canViewUsers = ['Application Administrator', 'City Coordinator', 'CHAARG leader'].includes(user.role);

  return (
    <nav className="nav-bar">
      <div style={{ display: 'flex', alignItems: 'center' }}>
        <h2 style={{ margin: 0, color: 'var(--primary-color)', marginRight: '2rem' }}>Cardiac Crusade</h2>
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
      </div>
      <div className="nav-links">
        <span>{user.email} ({user.role})</span>
        <Link to="/settings" title="Settings">
          <span style={{ fontSize: '1.2rem' }}>⚙️</span>
        </Link>
        <button onClick={handleLogout} className="secondary" style={{ padding: '0.25rem 0.5rem' }}>Logout</button>
      </div>
    </nav>
  );
};

export default Navbar;
