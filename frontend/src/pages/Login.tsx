import React, { useState, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';
import './Login.css';

const Login = () => {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const { login, isAuthenticated } = useAuth();
  const navigate = useNavigate();

  React.useEffect(() => {
    if (isAuthenticated) navigate('/dashboard');
  }, [isAuthenticated, navigate]);

  const handleSubmit = useCallback(async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setLoading(true);
    try {
      await login(email, password);
    } catch (err: any) {
      setError(err.message || 'Login failed');
    } finally {
      setLoading(false);
    }
  }, [email, password, login]);

  const handleEmailChange = useCallback((e: React.ChangeEvent<HTMLInputElement>) => setEmail(e.target.value), []);
  const handlePasswordChange = useCallback((e: React.ChangeEvent<HTMLInputElement>) => setPassword(e.target.value), []);

  return (
    <div className="login-page">
      <div className="login-card">
        <h1>Pricing Feed Management</h1>
        <div className="login-subtitle">Sign in to your account</div>

        {error && <div className="login-alert">{error}</div>}

        <form className="login-form" onSubmit={handleSubmit} noValidate>
          <div className="form-field">
            <label htmlFor="email">Email Address</label>
            <input
              id="email"
              type="email"
              autoComplete="email"
              autoFocus
              value={email}
              onChange={handleEmailChange}
              placeholder="you@example.com"
            />
          </div>
          <div className="form-field">
            <label htmlFor="password">Password</label>
            <input
              id="password"
              type="password"
              autoComplete="current-password"
              value={password}
              onChange={handlePasswordChange}
              placeholder="Enter your password"
            />
          </div>
          <button type="submit" className="login-submit" disabled={loading}>
            {loading ? 'Signing in...' : 'Sign In'}
          </button>
        </form>

        <div className="demo-creds">
          <div className="demo-title">Demo Credentials (password: manager123)</div>
          <div className="demo-line">admin@example.com / admin123 (All stores)</div>
          <div className="demo-line">newyork@example.com (New York Store)</div>
          <div className="demo-line">london@example.com (London Store)</div>
          <div className="demo-line">tokyo@example.com (Tokyo Store)</div>
          <div className="demo-line">paris@example.com (Paris Store)</div>
          <div className="demo-line">sydney@example.com (Sydney Store)</div>
        </div>
      </div>
    </div>
  );
};

export default Login;
