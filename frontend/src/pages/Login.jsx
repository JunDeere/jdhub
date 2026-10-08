import { useState } from "react";
import { login, register, verifyEmailLogin } from "../api/auth.js";

export default function Login({ onLogin }) {
  const registrationAllowed =
    import.meta.env.VITE_ALLOW_REGISTRATION === "true";
  const [mode, setMode] = useState("login");
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState(null);
  const [loading, setLoading] = useState(false);
  const [challenge, setChallenge] = useState(null);
  const [code, setCode] = useState("");
  const [trustBrowser, setTrustBrowser] = useState(true);

  const isRegistering = mode === "register";

  const handleSubmit = async (event) => {
    event.preventDefault();
    setError(null);
    setLoading(true);

    try {
      const data = isRegistering
        ? await register({ email, password, name })
        : await login({ email, password });
      if (data.verificationRequired) {
        setChallenge(data);
      } else {
        onLogin(data.token, data.user);
      }
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  const handleVerification = async (event) => {
    event.preventDefault();
    setError(null);
    setLoading(true);
    try {
      const data = await verifyEmailLogin({
        challengeId: challenge.challengeId,
        code,
        trustBrowser,
      });
      onLogin(data.token, data.user);
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  const handleDemoLogin = async () => {
    setError(null);
    setLoading(true);
    try {
      const data = await login({ email: "demo@demo.com", password: "demo" });
      onLogin(data.token, data.user);
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  const toggleMode = () => {
    setMode(isRegistering ? "login" : "register");
    setError(null);
  };

  if (challenge)
    return (
      <div className="auth-verification">
        <h2>Check your email</h2>
        <p>
          Enter the six-digit code sent to{" "}
          <strong>{challenge.maskedEmail}</strong>.
        </p>
        <form onSubmit={handleVerification}>
          <label>
            Verification code
            <input
              autoComplete="one-time-code"
              inputMode="numeric"
              maxLength="6"
              onChange={(event) =>
                setCode(event.target.value.replace(/\D/g, ""))
              }
              value={code}
              required
            />
          </label>
          <label className="auth-check">
            <input
              checked={trustBrowser}
              onChange={(event) => setTrustBrowser(event.target.checked)}
              type="checkbox"
            />{" "}
            Trust this browser for 30 days
          </label>
          <button disabled={loading || code.length !== 6} type="submit">
            {loading ? "Verifying…" : "Verify and sign in"}
          </button>
          <button
            type="button"
            onClick={() => {
              setChallenge(null);
              setCode("");
              setError(null);
            }}
          >
            Use another account
          </button>
          {error && <div className="auth-error">{error}</div>}
        </form>
      </div>
    );

  return (
    <div style={{ maxWidth: 420, margin: "0 auto" }}>
      <h2>{isRegistering ? "Create account" : "Login"}</h2>
      <form onSubmit={handleSubmit} style={{ display: "grid", gap: 12 }}>
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
          {loading
            ? "Working..."
            : isRegistering
              ? "Create account"
              : "Sign in"}
        </button>

        {!isRegistering && (
          <div className="auth-demo-entry">
            <span>Public portfolio demo</span>
            <button disabled={loading} onClick={handleDemoLogin} type="button">
              {loading ? "Opening demo…" : "Enter fictional demo"}
            </button>
            <small>Resets isolated sample data on every login. Private JDHub records are never used.</small>
          </div>
        )}

        {registrationAllowed && (
          <button type="button" onClick={toggleMode}>
            {isRegistering ? "Use existing account" : "Create a new account"}
          </button>
        )}

        {error && (
          <div style={{ color: "crimson", padding: 8, background: "#fff0f0" }}>
            {error}
          </div>
        )}
      </form>
    </div>
  );
}
