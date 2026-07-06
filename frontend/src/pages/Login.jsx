import { useState } from 'react';
import { login, register } from '../api/auth.js';

export default function Login({ onLogin }) {
  const [mode, setMode] = useState('login');
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState(null);
  const [loading, setLoading] = useState(false);

  const isRegistering = mode === 'register';

  const handleSubmit = async (event) => {
    event.preventDefault();
    setError(null);
    setLoading(true);

    try {
      const data = isRegistering
        ? await register({ email, password, name })
        : await login({ email, password });
      onLogin(data.token, data.user);
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  const toggleMode = () => {
    setMode(isRegistering ? 'login' : 'register');
    setError(null);
  };

  return (
    <div style={{ maxWidth: 420, margin: '0 auto' }}>
      <h2>{isRegistering ? 'Create account' : 'Login'}</h2>
      <form onSubmit={handleSubmit} style={{ display: 'grid', gap: 12 }}>
        {isRegistering && (
          <label>
            Name
            <input
              type="text"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="Your name"
            />
          </label>
        )}

        <label>
          Email
          <input
            type="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            placeholder="you@example.com"
            required
          />
        </label>

        <label>
          Password
          <input
            type="password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            required
          />
        </label>

        <button type="submit" disabled={loading}>
          {loading ? 'Working...' : isRegistering ? 'Create account' : 'Sign in'}
        </button>

        <button type="button" onClick={toggleMode}>
          {isRegistering ? 'Use existing account' : 'Create a new account'}
        </button>

        {error && (
          <div style={{ color: 'crimson', padding: 8, background: '#fff0f0' }}>
            {error}
          </div>
        )}
      </form>
    </div>
  );
}
