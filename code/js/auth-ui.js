/**
 * Login / Register UI screens.
 */
window.CBAuthUI = (function () {
  let mode = "login"; // login | register
  let onReady = null;

  function $(id) {
    return document.getElementById(id);
  }

  function setError(msg) {
    const el = $("auth-error");
    if (el) el.textContent = msg || "";
  }

  function setBusy(busy) {
    ["btn-auth-submit", "btn-auth-switch", "auth-username", "auth-password", "auth-confirm"].forEach(
      function (id) {
        const el = $(id);
        if (el) el.disabled = !!busy;
      }
    );
    const submit = $("btn-auth-submit");
    if (submit && !busy) {
      submit.textContent = mode === "register" ? "Create account" : "Sign in";
    } else if (submit && busy) {
      submit.textContent = "Please wait…";
    }
  }

  function showConfirm(show) {
    const row = $("auth-confirm-row");
    if (row) row.classList.toggle("screen-hidden", !show);
  }

  function setMode(next) {
    mode = next === "register" ? "register" : "login";
    const title = $("auth-title");
    const lead = $("auth-lead");
    const switchBtn = $("btn-auth-switch");
    const submit = $("btn-auth-submit");
    if (title) title.textContent = mode === "register" ? "Register" : "Login";
    if (lead) {
      lead.textContent =
        mode === "register"
          ? "Create an account — progress saves to the cloud."
          : "Sign in to load your Countryballs progress.";
    }
    if (switchBtn) {
      switchBtn.textContent =
        mode === "register"
          ? "Already have an account? Sign in"
          : "New here? Create an account";
    }
    if (submit) {
      submit.textContent = mode === "register" ? "Create account" : "Sign in";
    }
    showConfirm(mode === "register");
    setError("");
    console.log("[CBAuthUI] mode=" + mode);
  }

  function show() {
    const auth = $("screen-auth");
    const menu = $("screen-menu");
    if (menu) menu.classList.add("screen-hidden");
    if (auth) auth.classList.remove("screen-hidden");
    setMode(mode);
  }

  function hide() {
    const auth = $("screen-auth");
    if (auth) auth.classList.add("screen-hidden");
  }

  async function submit() {
    if (!window.CBAuth) {
      setError("Auth module missing");
      return;
    }
    const username = ($("auth-username") && $("auth-username").value) || "";
    const password = ($("auth-password") && $("auth-password").value) || "";
    const confirm = ($("auth-confirm") && $("auth-confirm").value) || "";
    setBusy(true);
    setError("");
    let result;
    try {
      if (mode === "register") {
        result = await CBAuth.register(username, password, confirm);
      } else {
        result = await CBAuth.login(username, password);
      }
    } catch (err) {
      result = { ok: false, error: (err && err.message) || "Request failed" };
    }
    setBusy(false);
    if (!result || !result.ok) {
      setError((result && result.error) || "Failed");
      return;
    }
    hide();
    if (typeof onReady === "function") onReady(result);
  }

  function init(handlers) {
    onReady = handlers && handlers.onReady;
    const form = $("auth-form");
    if (form) {
      form.addEventListener("submit", function (e) {
        e.preventDefault();
        submit();
      });
    }
    const switchBtn = $("btn-auth-switch");
    if (switchBtn) {
      switchBtn.addEventListener("click", function () {
        setMode(mode === "register" ? "login" : "register");
      });
    }
    const importBtn = $("btn-auth-import-local");
    if (importBtn) {
      importBtn.addEventListener("click", function () {
        setError("Sign in first, then use Countryballs → Import old browser progress.");
      });
    }
    setMode("login");
    console.log("[CBAuthUI] init OK");
  }

  return { init, show, hide, setMode };
})();
