/**
 * Cloud auth + save (Supabase).
 * Username UI → synthetic email for Auth.
 * Roster JSON stored in player_saves.
 */
window.CBAuth = (function () {
  const USERNAME_RE = /^[A-Za-z0-9_]{3,24}$/;
  let client = null;
  let session = null;
  let profile = null;
  let saveTimer = 0;
  let cloudEnabled = false;
  let onAuthChange = null;

  function cfg() {
    return window.CBSupabaseConfig || null;
  }

  function emailFromUsername(username) {
    const u = String(username || "")
      .trim()
      .toLowerCase();
    const domain = (cfg() && cfg().emailDomain) || "players.countryball-arena.local";
    return u + "@" + domain;
  }

  function getClient() {
    if (client) return client;
    const c = cfg();
    if (!c || !c.url || !c.anonKey) {
      console.error("[CBAuth] missing CBSupabaseConfig");
      return null;
    }
    if (!window.supabase || !window.supabase.createClient) {
      console.error("[CBAuth] supabase-js not loaded");
      return null;
    }
    client = window.supabase.createClient(c.url, c.anonKey, {
      auth: {
        persistSession: true,
        autoRefreshToken: true,
        detectSessionInUrl: true,
      },
    });
    return client;
  }

  function validateUsername(username) {
    const u = String(username || "").trim();
    if (!USERNAME_RE.test(u)) {
      return "Username: 3–24 letters, numbers, or _";
    }
    return null;
  }

  function validatePassword(password) {
    if (!password || String(password).length < 6) {
      return "Password must be at least 6 characters";
    }
    return null;
  }

  function setSession(s) {
    session = s || null;
  }

  function getSession() {
    return session;
  }

  function getUser() {
    return session && session.user ? session.user : null;
  }

  function getUsername() {
    return profile && profile.username ? profile.username : null;
  }

  function isLoggedIn() {
    return !!(session && session.user);
  }

  function notify() {
    if (typeof onAuthChange === "function") onAuthChange(isLoggedIn(), getUsername());
  }

  async function fetchProfile(userId) {
    const sb = getClient();
    if (!sb || !userId) return null;
    const { data, error } = await sb
      .from("profiles")
      .select("id, username, created_at")
      .eq("id", userId)
      .maybeSingle();
    if (error) {
      console.warn("[CBAuth] fetchProfile", error.message);
      return null;
    }
    profile = data;
    return data;
  }

  async function ensureProfile(userId, username) {
    const sb = getClient();
    if (!sb || !userId) return { ok: false, error: "no client" };
    const existing = await fetchProfile(userId);
    if (existing) {
      // Backfill username if empty
      if (!existing.username && username) {
        await sb
          .from("profiles")
          .update({ username: String(username).trim() })
          .eq("id", userId);
        existing.username = String(username).trim();
      }
      profile = existing;
      return { ok: true, profile: existing };
    }

    const uname = String(username).trim();
    const { data, error } = await sb
      .from("profiles")
      .insert({
        id: userId,
        username: uname,
        email: emailFromUsername(uname),
        full_name: uname,
      })
      .select("id, username, created_at")
      .single();
    if (error) {
      console.warn("[CBAuth] ensureProfile", error.message);
      // Race: trigger may have inserted profile already
      const again = await fetchProfile(userId);
      if (again) {
        if (!again.username && uname) {
          await sb.from("profiles").update({ username: uname }).eq("id", userId);
          again.username = uname;
        }
        profile = again;
        return { ok: true, profile: again };
      }
      return { ok: false, error: error.message };
    }
    profile = data;
    return { ok: true, profile: data };
  }

  async function pullSave() {
    const sb = getClient();
    const user = getUser();
    if (!sb || !user) return { ok: false, error: "not logged in" };
    const { data, error } = await sb
      .from("player_saves")
      .select("roster, updated_at")
      .eq("user_id", user.id)
      .maybeSingle();
    if (error) {
      console.warn("[CBAuth] pullSave", error.message);
      return { ok: false, error: error.message };
    }
    if (!data) return { ok: true, roster: null, missing: true };
    return { ok: true, roster: data.roster, updatedAt: data.updated_at };
  }

  async function pushSave(roster) {
    const sb = getClient();
    const user = getUser();
    if (!sb || !user) return { ok: false, error: "not logged in" };
    if (!roster) return { ok: false, error: "no roster" };
    const payload = {
      user_id: user.id,
      roster: roster,
      updated_at: new Date().toISOString(),
    };
    const { error } = await sb.from("player_saves").upsert(payload, {
      onConflict: "user_id",
    });
    if (error) {
      console.warn("[CBAuth] pushSave", error.message);
      return { ok: false, error: error.message };
    }
    console.log("[CBAuth] cloud save ok");
    return { ok: true };
  }

  function scheduleCloudSave() {
    if (!cloudEnabled || !isLoggedIn()) return;
    if (saveTimer) clearTimeout(saveTimer);
    saveTimer = setTimeout(function () {
      saveTimer = 0;
      if (!window.CBCountryballs || !CBCountryballs.getRosterSnapshot) return;
      pushSave(CBCountryballs.getRosterSnapshot());
    }, 900);
  }

  async function hydrateCountryballsFromCloud() {
    if (!window.CBCountryballs) return { ok: false };
    const pulled = await pullSave();
    if (!pulled.ok) return pulled;
    if (pulled.missing || !pulled.roster) {
      const seed = CBCountryballs.resetToSeed();
      await pushSave(seed);
      console.log("[CBAuth] seeded cloud save");
      return { ok: true, seeded: true };
    }
    CBCountryballs.hydrateFromCloud(pulled.roster);
    return { ok: true };
  }

  async function register(username, password, confirm) {
    const uErr = validateUsername(username);
    if (uErr) return { ok: false, error: uErr };
    const pErr = validatePassword(password);
    if (pErr) return { ok: false, error: pErr };
    if (password !== confirm) {
      return { ok: false, error: "Passwords do not match" };
    }

    const sb = getClient();
    if (!sb) return { ok: false, error: "Auth not ready" };

    const email = emailFromUsername(username);
    const { data, error } = await sb.auth.signUp({
      email: email,
      password: password,
      options: {
        data: { username: String(username).trim() },
      },
    });
    if (error) {
      console.warn("[CBAuth] signUp", error.message);
      return { ok: false, error: error.message };
    }
    if (!data.session) {
      return {
        ok: false,
        error:
          "Account created but email confirmation is ON. In Supabase → Authentication → Providers → Email, turn OFF “Confirm email”, then try Login.",
      };
    }
    setSession(data.session);
    const prof = await ensureProfile(data.user.id, username);
    if (!prof.ok) return { ok: false, error: prof.error || "Profile failed" };

    cloudEnabled = true;
    if (window.CBCountryballs) {
      const seed = CBCountryballs.resetToSeed();
      await pushSave(seed);
    }
    notify();
    console.log("[CBAuth] registered", username);
    return { ok: true, username: String(username).trim() };
  }

  async function login(username, password) {
    const uErr = validateUsername(username);
    if (uErr) return { ok: false, error: uErr };
    const pErr = validatePassword(password);
    if (pErr) return { ok: false, error: pErr };

    const sb = getClient();
    if (!sb) return { ok: false, error: "Auth not ready" };

    const email = emailFromUsername(username);
    const { data, error } = await sb.auth.signInWithPassword({
      email: email,
      password: password,
    });
    if (error) {
      console.warn("[CBAuth] login", error.message);
      return { ok: false, error: error.message };
    }
    setSession(data.session);
    await ensureProfile(data.user.id, username);
    cloudEnabled = true;
    await hydrateCountryballsFromCloud();
    notify();
    console.log("[CBAuth] login", getUsername());
    return { ok: true, username: getUsername() };
  }

  async function logout() {
    const sb = getClient();
    cloudEnabled = false;
    if (saveTimer) {
      clearTimeout(saveTimer);
      saveTimer = 0;
    }
    if (sb) await sb.auth.signOut();
    setSession(null);
    profile = null;
    if (window.CBCountryballs && CBCountryballs.resetToSeed) {
      CBCountryballs.resetToSeed();
    }
    notify();
    console.log("[CBAuth] logout");
    return { ok: true };
  }

  async function importLocalProgress() {
    if (!isLoggedIn() || !window.CBCountryballs) {
      return { ok: false, error: "Not logged in" };
    }
    const local = CBCountryballs.readLocalCacheOnly();
    if (!local) return { ok: false, error: "No local progress found" };
    CBCountryballs.hydrateFromCloud(local);
    const pushed = await pushSave(CBCountryballs.getRosterSnapshot());
    if (!pushed.ok) return pushed;
    console.log("[CBAuth] imported local progress to cloud");
    return { ok: true };
  }

  async function init(handlers) {
    onAuthChange = handlers && handlers.onAuthChange;
    const sb = getClient();
    if (!sb) {
      notify();
      return { ok: false, error: "no client" };
    }

    const { data } = await sb.auth.getSession();
    setSession(data.session || null);
    if (session && session.user) {
      const metaName =
        (session.user.user_metadata && session.user.user_metadata.username) ||
        (session.user.email || "").split("@")[0];
      await ensureProfile(session.user.id, metaName);
      cloudEnabled = true;
      await hydrateCountryballsFromCloud();
    }
    sb.auth.onAuthStateChange(function (event, s) {
      setSession(s);
      console.log("[CBAuth] auth state", event, !!s);
    });
    notify();
    return { ok: true, loggedIn: isLoggedIn() };
  }

  return {
    init,
    register,
    login,
    logout,
    getSession,
    getUser,
    getUsername,
    isLoggedIn,
    scheduleCloudSave,
    pushSaveNow: function () {
      if (!window.CBCountryballs) return Promise.resolve({ ok: false });
      return pushSave(CBCountryballs.getRosterSnapshot());
    },
    importLocalProgress,
    emailFromUsername,
    validateUsername,
  };
})();
