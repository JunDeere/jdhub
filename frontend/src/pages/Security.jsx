import { useCallback, useEffect, useState } from "react";
import {
  CheckCircle2,
  CircleAlert,
  Globe2,
  KeyRound,
  MonitorSmartphone,
  RefreshCw,
  ShieldAlert,
  ShieldCheck,
  XCircle,
} from "lucide-react";
import {
  createUser,
  getSecurityOverview,
  getUsers,
  removeTrustedNetwork,
  revokeOtherSessions,
  revokeSession,
  revokeTrustedBrowser,
  trustNetwork,
  updateUserEmailVerification,
  updateUserStatus,
} from "../api/security.js";
import StatusToast from "../components/StatusToast.jsx";

function when(value) {
  return value ? new Date(value).toLocaleString() : "Never";
}

function userType(user) {
  if (user.role === "admin") return "Administrator";
  if (user.is_demo) return "Demo account";
  return "Member";
}

function browserName(value) {
  const agent = String(value || "");
  if (/Edg\//.test(agent)) return "Microsoft Edge";
  if (/OPR\//.test(agent)) return "Opera";
  if (/Chrome\//.test(agent)) return "Chrome";
  if (/Firefox\//.test(agent)) return "Firefox";
  if (/Safari\//.test(agent)) return "Safari";
  return "Browser session";
}

function checkIcon(status) {
  if (status === "pass") return <CheckCircle2 size={16} />;
  if (status === "critical") return <XCircle size={16} />;
  return <CircleAlert size={16} />;
}

function postureLabel(level) {
  if (level === "good") return "Good protection";
  if (level === "attention") return "Needs attention";
  return "High risk";
}

export default function Security({ token }) {
  const [activeTab, setActiveTab] = useState("users");
  const [securityData, setSecurityData] = useState(null);
  const [users, setUsers] = useState([]);
  const [usersLoading, setUsersLoading] = useState(true);
  const [emailVerificationEnabled, setEmailVerificationEnabled] = useState(false);
  const [error, setError] = useState("");
  const [ip, setIp] = useState("");
  const [label, setLabel] = useState("");
  const [newUser, setNewUser] = useState({
    name: "",
    email: "",
    password: "",
    email_verification_required: true,
  });
  const [creatingUser, setCreatingUser] = useState(false);
  const [updatingUserId, setUpdatingUserId] = useState(null);
  const [accountStatus, setAccountStatus] = useState(null);
  const [securityLoading, setSecurityLoading] = useState(true);
  const [securityBusy, setSecurityBusy] = useState("");

  const loadSecurity = useCallback(async () => {
    setSecurityLoading(true);
    try {
      const value = await getSecurityOverview(token);
      setSecurityData(value);
      setIp((current) => current || value.currentIp);
    } catch (err) {
      setError(err.message);
    } finally {
      setSecurityLoading(false);
    }
  }, [token]);

  const loadUsers = useCallback(async () => {
    setUsersLoading(true);
    try {
      const result = await getUsers(token);
      setUsers(result.users);
      setEmailVerificationEnabled(Boolean(result.emailVerificationEnabled));
    } catch (err) {
      setError(err.message);
    } finally {
      setUsersLoading(false);
    }
  }, [token]);

  useEffect(() => {
    let cancelled = false;

    Promise.all([getSecurityOverview(token), getUsers(token)])
      .then(([securityResult, usersResult]) => {
        if (cancelled) return;
        setSecurityData(securityResult);
        setIp((current) => current || securityResult.currentIp);
        setUsers(usersResult.users);
        setEmailVerificationEnabled(Boolean(usersResult.emailVerificationEnabled));
        setSecurityLoading(false);
      })
      .catch((err) => {
        if (!cancelled) setError(err.message);
      })
      .finally(() => {
        if (!cancelled) {
          setUsersLoading(false);
          setSecurityLoading(false);
        }
      });

    return () => {
      cancelled = true;
    };
  }, [token]);

  const addNetwork = async (event) => {
    event.preventDefault();
    setError("");
    try {
      await trustNetwork(token, { ip, label });
      setLabel("");
      await loadSecurity();
    } catch (err) {
      setError(err.message);
    }
  };

  const createAccount = async (event) => {
    event.preventDefault();
    setCreatingUser(true);
    setAccountStatus(null);

    try {
      const result = await createUser(token, newUser);
      setNewUser({ name: "", email: "", password: "", email_verification_required: true });
      setAccountStatus({
        type: "success",
        message: `Account created for ${result.user.email}.`,
      });
      await loadUsers();
    } catch (err) {
      setAccountStatus({ type: "error", message: err.message });
    } finally {
      setCreatingUser(false);
    }
  };

  const changeEmailVerification = async (user) => {
    const currentlyRequired = user.email_verification_required !== false;
    const required = !currentlyRequired;
    const action = required ? "require email verification for" : "allow password-only sign-in for";
    if (!window.confirm(`Do you want to ${action} ${user.email}?`)) return;

    setError("");
    setUpdatingUserId(user._id);
    try {
      await updateUserEmailVerification(token, user._id, required);
      await loadUsers();
    } catch (err) {
      setError(err.message);
    } finally {
      setUpdatingUserId(null);
    }
  };

  const changeUserStatus = async (user) => {
    const nextStatus = user.status === "disabled" ? "active" : "disabled";
    if (nextStatus === "disabled" && !window.confirm(`Disable access for ${user.email}?`)) return;

    setError("");
    setUpdatingUserId(user._id);
    try {
      await updateUserStatus(token, user._id, nextStatus);
      await loadUsers();
    } catch (err) {
      setError(err.message);
    } finally {
      setUpdatingUserId(null);
    }
  };

  const removeNetwork = async (id) => {
    setError("");
    try {
      await removeTrustedNetwork(token, id);
      await loadSecurity();
    } catch (err) {
      setError(err.message);
    }
  };

  const revokeBrowser = async (id) => {
    setError("");
    try {
      await revokeTrustedBrowser(token, id);
      await loadSecurity();
    } catch (err) {
      setError(err.message);
    }
  };

  const endSession = async (id) => {
    setSecurityBusy(id);
    setError("");
    try {
      await revokeSession(token, id);
      await loadSecurity();
    } catch (err) {
      setError(err.message);
    } finally {
      setSecurityBusy("");
    }
  };

  const endOtherSessions = async () => {
    if (!window.confirm("Sign out every other tracked JDHub session?")) return;
    setSecurityBusy("others");
    setError("");
    try {
      const result = await revokeOtherSessions(token);
      setAccountStatus({ type: "success", message: `${result.revoked} other sessions signed out.` });
      await loadSecurity();
    } catch (err) {
      setError(err.message);
    } finally {
      setSecurityBusy("");
    }
  };

  return (
    <section className="module-page security-page">
      <div className="segmented-control administration-tabs" role="tablist" aria-label="Administration sections">
        <button aria-selected={activeTab === "users"} className={activeTab === "users" ? "selected" : ""} onClick={() => setActiveTab("users")} role="tab" type="button">
          Users
        </button>
        <button aria-selected={activeTab === "security"} className={activeTab === "security" ? "selected" : ""} onClick={() => setActiveTab("security")} role="tab" type="button">
          Security
        </button>
      </div>

      {activeTab === "users" && (
        <div className="admin-users-layout" role="tabpanel">
          <article className="panel admin-users-panel">
            <div className="control-row">
              <div>
                <p className="eyebrow">Approved access</p>
                <h3>Users</h3>
                <p className="muted">Review the accounts that can access JDHub.</p>
                <p className={`email-verification-master ${emailVerificationEnabled ? "enabled" : "disabled"}`}>
                  Global email verification: {emailVerificationEnabled ? "Enabled" : "Disabled in the server environment"}
                </p>
              </div>
              <span className="status-chip">{users.length} accounts</span>
            </div>

            {usersLoading ? (
              <p className="muted">Loading users…</p>
            ) : users.length ? (
              <div className="admin-user-list">
                {users.map((user) => {
                  const status = user.status || "active";
                  const isProtected = user.role === "admin";
                  const verificationRequired = !user.is_demo && user.email_verification_required !== false;
                  const verificationLocked = isProtected || user.is_demo;
                  const isUpdating = updatingUserId === user._id;
                  return (
                    <div className="admin-user-row" key={user._id}>
                      <div className="admin-user-identity">
                        <strong>{user.name || "Unnamed user"}</strong>
                        <span>{user.email}</span>
                      </div>
                      <span className="admin-user-role">{userType(user)}</span>
                      <div className="admin-user-dates">
                        <span>Created {new Date(user.createdAt).toLocaleDateString()}</span>
                        <small>Last sign-in: {when(user.last_login_at)}</small>
                      </div>
                      <div className="admin-user-verification">
                        <span>Email verification</span>
                        <button
                          className={verificationRequired ? "verification-required" : "verification-optional"}
                          disabled={verificationLocked || isUpdating}
                          onClick={() => changeEmailVerification(user)}
                          title={user.is_demo ? "The demo account bypasses email verification" : isProtected ? "The primary administrator must keep email verification enabled" : undefined}
                          type="button"
                        >
                          {user.is_demo ? "Bypassed" : verificationRequired ? "Required" : "Password only"}
                        </button>
                      </div>
                      <span className={`account-status ${status}`}>{status}</span>
                      <button className="secondary-button" disabled={isProtected || isUpdating} onClick={() => changeUserStatus(user)} title={isProtected ? "The primary administrator is protected" : undefined} type="button">
                        {isUpdating ? "Updating…" : status === "disabled" ? "Enable" : "Disable"}
                      </button>
                    </div>
                  );
                })}
              </div>
            ) : (
              <p className="muted">No accounts found.</p>
            )}
          </article>

          <article className="panel admin-account-panel">
            <div className="compact-panel-heading">
              <div><p className="eyebrow">New access</p><h3>Create member</h3></div>
            </div>
            <p className="muted">Create an approved member account. Public registration remains disabled.</p>
            <form className="admin-account-form" onSubmit={createAccount}>
              <label>
                Name
                <input autoComplete="off" value={newUser.name} onChange={(event) => setNewUser((current) => ({ ...current, name: event.target.value }))} placeholder="Full name" />
              </label>
              <label>
                Email
                <input autoComplete="off" type="email" value={newUser.email} onChange={(event) => setNewUser((current) => ({ ...current, email: event.target.value }))} placeholder="name@example.com" required />
              </label>
              <label>
                Initial password
                <input autoComplete="new-password" minLength="12" type="password" value={newUser.password} onChange={(event) => setNewUser((current) => ({ ...current, password: event.target.value }))} placeholder="At least 12 characters" required />
              </label>
              <label className="admin-account-checkbox">
                <input
                  checked={newUser.email_verification_required}
                  onChange={(event) => setNewUser((current) => ({ ...current, email_verification_required: event.target.checked }))}
                  type="checkbox"
                />
                Require email verification on untrusted browsers
              </label>
              <button className="primary-button" disabled={creatingUser} type="submit">{creatingUser ? "Creating…" : "Create member"}</button>
            </form>
          </article>
        </div>
      )}

      {activeTab === "security" && (
        <div className="administration-security" role="tabpanel">
          <div className="security-dashboard-heading">
            <div>
              <p className="eyebrow">Security dashboard</p>
              <h2>Protection and exposure</h2>
              <p className="muted">Account security, active sessions, configuration checks, and public service posture.</p>
            </div>
            <button className="secondary-button" disabled={securityLoading} onClick={loadSecurity} type="button">
              <RefreshCw className={securityLoading ? "spin" : ""} size={16} />Refresh checks
            </button>
          </div>

          <section className={`security-posture ${securityData?.posture?.level || "loading"}`}>
            <div className="security-score">
              <span>{securityData?.posture?.score ?? "—"}</span>
              <small>out of 100</small>
            </div>
            <div>
              <span className="security-posture-label"><ShieldCheck size={17} />{postureLabel(securityData?.posture?.level)}</span>
              <h3>{securityData?.posture?.level === "good" ? "Core protections are in place" : "Review the findings below"}</h3>
              <p>The score combines server configuration, recent sign-in failures, account verification, and public-service checks.</p>
            </div>
          </section>

          <div className="security-summary">
            <article><span><ShieldAlert size={15} />Failed sign-ins · 24h</span><strong>{securityData?.failures24h ?? "—"}</strong></article>
            <article><span><MonitorSmartphone size={15} />Active sessions</span><strong>{securityData?.sessions?.length ?? "—"}</strong></article>
            <article><span><KeyRound size={15} />Trusted browsers</span><strong>{securityData?.browsers?.length ?? "—"}</strong></article>
            <article><span><Globe2 size={15} />Public services reachable</span><strong>{securityData?.services?.filter((service) => service.reachable).length ?? "—"}/{securityData?.services?.length ?? "—"}</strong></article>
          </div>

          <article className="panel security-checks-panel">
            <div className="compact-panel-heading">
              <div><p className="eyebrow">Application controls</p><h3>Configuration checks</h3></div>
              <span className="status-chip">No secrets displayed</span>
            </div>
            <div className="security-check-grid">
              {securityData?.posture?.checks?.map((check) => (
                <div className={`security-check ${check.status}`} key={check.id}>
                  <span>{checkIcon(check.status)}</span>
                  <div><strong>{check.label}</strong><p>{check.detail}</p>{check.status !== "pass" && <small>{check.recommendation}</small>}</div>
                </div>
              ))}
            </div>
          </article>

          <article className="panel security-services-panel">
            <div className="compact-panel-heading">
              <div><p className="eyebrow">Public exposure</p><h3>Internet-facing services</h3></div>
              <span className="status-chip">Live check</span>
            </div>
            <p className="muted">Reachability and browser-security headers are checked without signing in or exposing credentials.</p>
            <div className="security-service-list">
              {securityData?.services?.map((service) => (
                <div className="security-service" key={service.name}>
                  <span className={`service-health ${service.reachable ? "online" : "offline"}`} />
                  <div className="security-service-name"><strong>{service.name}</strong><small>{service.url}</small></div>
                  <div className="security-service-response"><strong>{service.reachable ? `HTTP ${service.statusCode}` : service.error}</strong><small>{service.latencyMs} ms</small></div>
                  <div className="security-header-chips">
                    <span className={service.https ? "pass" : "fail"}>HTTPS</span>
                    <span className={service.headers.hsts ? "pass" : "fail"}>HSTS</span>
                    <span className={service.headers.csp ? "pass" : "warn"}>CSP</span>
                    <span className={service.headers.noSniff ? "pass" : "fail"}>No-sniff</span>
                    <span className={service.headers.frameProtection ? "pass" : "fail"}>Frame guard</span>
                  </div>
                </div>
              ))}
            </div>
          </article>

          <div className="security-grid">
            <article className="panel">
              <div className="compact-panel-heading">
                <div><p className="eyebrow">Access control</p><h3>Active sessions</h3></div>
                <button className="secondary-button" disabled={securityBusy === "others" || (securityData?.sessions?.length || 0) < 2} onClick={endOtherSessions} type="button">
                  {securityBusy === "others" ? "Signing out…" : "Sign out others"}
                </button>
              </div>
              <p className="muted">New sign-ins are tracked individually. Existing sessions from before this update disappear when their token expires or you sign in again.</p>
              <div className="security-session-list">
                {securityData?.sessions?.length ? securityData.sessions.map((session) => (
                  <div className="security-session" key={session._id}>
                    <span className="security-session-icon"><MonitorSmartphone size={17} /></span>
                    <div><strong>{browserName(session.user_agent)} {session.current && <em>Current</em>}</strong><p>{session.user_id?.email || "Account"}</p><small>{session.ip} · active {when(session.last_seen_at)} · expires {when(session.expires_at)}</small></div>
                    <button className="secondary-button" disabled={session.current || securityBusy === session._id} onClick={() => endSession(session._id)} type="button">
                      {session.current ? "Current" : securityBusy === session._id ? "Revoking…" : "Revoke"}
                    </button>
                  </div>
                )) : <p className="muted">No tracked sessions yet. Your next sign-in will appear here.</p>}
              </div>
            </article>

            <div className="security-side">
              <article className="panel">
                <h3>Trusted browsers</h3>
                <p className="muted">These browsers can skip the emailed sign-in code until revoked or expired.</p>
                {securityData?.browsers?.length ? securityData.browsers.map((item) => (
                  <div className="security-row" key={item._id}>
                    <div><strong>{item.user_id?.email || "Account"}</strong><small>{item.last_ip} · seen {when(item.last_seen_at)}</small></div>
                    <button className="secondary-button" onClick={() => revokeBrowser(item._id)} type="button">Revoke trust</button>
                  </div>
                )) : <p className="muted">No trusted browsers yet.</p>}
              </article>

              <article className="panel">
                <h3>Trusted network labels</h3>
                <p className="muted">Monitoring labels only. An IP never replaces password or email verification.</p>
                <form className="security-network-form" onSubmit={addNetwork}>
                  <input aria-label="IP address" value={ip} onChange={(event) => setIp(event.target.value)} placeholder="IP address" required />
                  <input aria-label="Network label" value={label} onChange={(event) => setLabel(event.target.value)} placeholder="Home, office…" />
                  <button type="submit">Add label</button>
                </form>
                {securityData?.networks?.map((item) => (
                  <div className="security-row" key={item._id}>
                    <div><strong>{item.label}</strong><small>{item.ip}</small></div>
                    <button className="secondary-button" onClick={() => removeNetwork(item._id)} type="button">Remove</button>
                  </div>
                ))}
              </article>
            </div>
          </div>

          <article className="panel security-events-panel">
            <div className="compact-panel-heading"><div><p className="eyebrow">Audit trail</p><h3>Recent security activity</h3></div><span className="status-chip">90-day retention</span></div>
            <div className="security-list">
              {securityData?.events?.length ? securityData.events.map((event) => (
                <div key={event._id}>
                  <span className={`security-outcome ${event.outcome}`}>{event.outcome}</span>
                  <div><strong>{event.email || event.type.replaceAll("_", " ")}</strong><p>{event.detail || event.type.replaceAll("_", " ")}</p><small>{event.ip} · {when(event.createdAt)}</small></div>
                </div>
              )) : <p className="muted">No security activity recorded yet.</p>}
            </div>
          </article>
        </div>
      )}
      <StatusToast
        error={error || (accountStatus?.type === "error" ? accountStatus.message : null)}
        success={accountStatus?.type === "success" ? accountStatus.message : null}
        onDismiss={() => { setError(""); setAccountStatus(null); }}
      />
    </section>
  );
}
