import React from 'react';
import { Routes, Route, Navigate } from 'react-router-dom';
import Login from './pages/Login';
import Dashboard from './pages/Dashboard';
import PricingList from './pages/PricingList';
import Upload from './pages/Upload';
import Layout from './components/Layout';
import PrivateRoute from './components/PrivateRoute';

const App: React.FC = () => {
  return (
    <div className="app-root">
      <Routes>
        <Route path="/login" element={<Login />} />
        <Route
          path="/"
          element={
            <PrivateRoute>
              <Layout />
            </PrivateRoute>
          }
        >
          <Route index element={<Navigate to="/dashboard" replace />} />
          <Route path="dashboard" element={<Dashboard />} />
          <Route path="pricing" element={<PricingList />} />
          <Route path="upload" element={<Upload />} />
        </Route>
      </Routes>
    </div>
  );
};

export default App;
