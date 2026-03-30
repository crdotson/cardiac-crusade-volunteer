import { BrowserRouter as Router, Routes, Route, Navigate } from 'react-router-dom';
import { AuthProvider, useAuth } from './context/AuthContext';
import Navbar from './components/Navbar';
import Login from './pages/Login';
import ForgotPassword from './pages/ForgotPassword';
import Users from './pages/Users';
import Settings from './pages/Settings';
import Map from './pages/Map';
import List from './pages/List';
import LocationDetails from './pages/LocationDetails';
import Reporting from './pages/Reporting';
import { type FC, type ReactNode } from 'react';
import './index.css';

const PrivateRoute: FC<{ children: ReactNode; roles?: string[] }> = ({ children, roles }) => {
  const { user, loading } = useAuth();

  if (loading) return <div>Loading...</div>;
  if (!user) return <Navigate to="/login" />;
  if (roles && !roles.includes(user.role)) return <Navigate to="/" />;

  return <>{children}</>;
};

const Dashboard: FC = () => {
  return (
    <div className="container">
      <div className="card">
        <h1>Welcome to Cardiac Crusade</h1>
        <p>Please use the navigation bar to access different sections of the application.</p>
      </div>
    </div>
  );
};

function App() {
  return (
    <AuthProvider>
      <Router basename="/cardiac-crusade">
        <div className="App">
          <Navbar />
          <Routes>
            <Route path="/login" element={<Login />} />
            <Route path="/forgot-password" element={<ForgotPassword />} />
            
            <Route path="/" element={
              <PrivateRoute>
                <Dashboard />
              </PrivateRoute>
            } />
            
            <Route path="/users" element={
              <PrivateRoute roles={['Application Administrator', 'City Coordinator', 'CHAARG leader']}>
                <Users />
              </PrivateRoute>
            } />
            
            <Route path="/settings" element={
              <PrivateRoute>
                <Settings />
              </PrivateRoute>
            } />

            <Route path="/map" element={
              <PrivateRoute>
                <Map />
              </PrivateRoute>
            } />

            <Route path="/list" element={
              <PrivateRoute>
                <List />
              </PrivateRoute>
            } />

            <Route path="/locations/:id" element={
              <PrivateRoute>
                <LocationDetails />
              </PrivateRoute>
            } />

            <Route path="/reporting" element={
              <PrivateRoute>
                <Reporting />
              </PrivateRoute>
            } />

            <Route path="*" element={<Navigate to="/" />} />
          </Routes>
        </div>
      </Router>
    </AuthProvider>
  );
}

export default App;
