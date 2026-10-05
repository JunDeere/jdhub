import { useCallback, useEffect, useState } from "react";
import {
  createUser,
  getSecurityOverview,
  getUsers,
  removeTrustedNetwork,
  revokeTrustedBrowser,
  trustNetwork,
  updateUserStatus,
} from "../api/security.js";

function when(value) {
  return value ? new Date(value).toLocaleString() : "Never";
}

function userType(user) {
  if (user.role === "admin") return "Administrator";
  if (user.is_demo) return "Demo account";
  return "Member";
}

export default function Security({ token }) {
  const [activeTab, setActiveTab] = useState("users");
  const [securityData, setSecurityData] = useState(null);
  const [users, setUsers] = useState([]);
  const [usersLoading, setUsersLoading] = useState(true);
  const [error, setError] = useState("");
  const [ip, setIp] = useState("");
  const [label, setLabel] = useState("");
  const [newUser, setNewUser] = useState({ name: "", email: "", password: "" });
  const [creatingUser, setCreatingUser] = useState(false);
  const [updatingUserId, setUpdatingUserId] = useState(null);
  const [accountStatus, setAccountStatus] = useState(null);

  const loadSecurity = useCallback(async () => {
    try {
      const value = await getSecurityOverview(token);
      setSecurityData(value);
      setIp((current) => current || value.currentIp);
    } catch (err) {
      setError(err.message);
    }
  }, [token]);

  const loadUsers = useCallback(async () => {
    setUsersLoading(true);
    try {
      const result = await getUsers(token);
      setUsers(result.users);
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
      })
      .catch((err) => {
        if (!cancelled) setError(err.message);
      })
      .finally(() => {
        if (!cancelled) setUsersLoading(false);
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
      setNewUser({ name: "", email: "", password: "" });
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

  return (
    <section className="module-page security-page">
      <div className="page-heading-row">
        <div>
          <p className="eyebrow">System management</p>
          <h2>Administration</h2>
          <p className="module-description">
            Manage approved users, authentication activity, and access protection.
          </p>
        </div>
        <span className="status-chip">Admin only</span>
      </div>

      <div className="segmented-control administration-tabs" role="tablist" aria-label="Administration sections">
        <button aria-selected={activeTab === "users"} className={activeTab === "users" ? "selected" : ""} onClick={() => setActiveTab("users")} role="tab" type="button">
          Users
        </button>
        <button aria-selected={activeTab === "security"} className={activeTab === "security" ? "selected" : ""} onClick={() => setActiveTab("security")} role="tab" type="button">
          Security
        </button>
      </div>

      {error && <div className="error-banner">{error}</div>}

      {activeTab === "users" && (
        <div className="admin-users-layout" role="tabpanel">
          <article className="panel admin-users-panel">
            <div className="control-row">
              <div>
                <p className="eyebrow">Approved access</p>
                <h3>Users</h3>
                <p className="muted">Review the accounts that can access JDHub.</p>
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
              <button className="primary-button" disabled={creatingUser} type="submit">{creatingUser ? "Creating…" : "Create member"}</button>
            </form>
            {accountStatus && (
              <div aria-live="polite" className={accountStatus.type === "error" ? "alert-error" : "alert-success"}>{accountStatus.message}</div>
            )}
          </article>
        </div>
      )}

      {activeTab === "security" && (
        <div className="administration-security" role="tabpanel">
          <div className="security-summary">
            <article><span>Failed sign-ins · 24h</span><strong>{securityData?.failures24h ?? "—"}</strong></article>
            <article><span>Trusted browsers</span><strong>{securityData?.browsers?.length ?? "—"}</strong></article>
            <article><span>Trusted networks</span><strong>{securityData?.networks?.length ?? "—"}</strong></article>
          </div>
          <div className="security-grid">
            <article className="panel">
              <h3>Recent sign-in activity</h3>
              <p className="muted">Authentication activity for JDHub. Other subdomains require a future audit-log connection.</p>
              <div className="security-list">
                {securityData?.events?.length ? securityData.events.map((event) => (
                  <div key={event._id}>
                    <span className={`security-outcome ${event.outcome}`}>{event.outcome}</span>
                    <div><strong>{event.email || "Unknown account"}</strong><p>{event.detail || event.type}</p><small>{event.ip} · {when(event.createdAt)}</small></div>
                  </div>
                )) : <p className="muted">No authentication activity recorded yet.</p>}
              </div>
            </article>
            <div className="security-side">
              <article className="panel">
                <h3>Trusted networks</h3>
                <p className="muted">Monitoring labels only. An IP never replaces password or email verification.</p>
                <form className="security-network-form" onSubmit={addNetwork}>
                  <input aria-label="IP address" value={ip} onChange={(event) => setIp(event.target.value)} placeholder="IP address" required />
                  <input aria-label="Network label" value={label} onChange={(event) => setLabel(event.target.value)} placeholder="Home, office…" />
                  <button type="submit">Trust network</button>
                </form>
                {securityData?.networks?.map((item) => (
                  <div className="security-row" key={item._id}>
                    <div><strong>{item.label}</strong><small>{item.ip}</small></div>
                    <button className="secondary-button" onClick={() => removeNetwork(item._id)} type="button">Remove</button>
                  </div>
                ))}
              </article>
              <article className="panel">
                <h3>Trusted browsers</h3>
                {securityData?.browsers?.length ? securityData.browsers.map((item) => (
                  <div className="security-row" key={item._id}>
                    <div><strong>{item.user_id?.email || "Account"}</strong><small>{item.last_ip} · seen {when(item.last_seen_at)}</small></div>
                    <button className="secondary-button" onClick={() => revokeBrowser(item._id)} type="button">Revoke</button>
                  </div>
                )) : <p className="muted">No trusted browsers yet.</p>}
              </article>
            </div>
          </div>
        </div>
      )}
    </section>
  );
}
