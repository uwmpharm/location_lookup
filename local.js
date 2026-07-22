(function () {
  const SUPABASE_URL = 'https://iynuqsbgnshlromwkzfl.supabase.co';
  const SUPABASE_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Iml5bnVxc2JnbnNobHJvbXdremZsIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzU1MDQ5NzcsImV4cCI6MjA5MTA4MDk3N30.SGvfrCXQbgbZk_ptt97R3sYGetFdB6KfRmJvoF1LpGI';

  function createSupabaseClient(options) {
    if (!window.supabase) {
      console.error('Local Supabase client is missing.');
      return null;
    }
    return window.supabase.createClient(SUPABASE_URL, SUPABASE_KEY, options);
  }

  window.inventorySb = createSupabaseClient();
  window.adminSb = createSupabaseClient({
    auth: {
      persistSession: false,
      autoRefreshToken: false,
      detectSessionInUrl: false
    }
  });

  function initInventoryPage() {
    const searchInput = document.getElementById('search-input');
    if (!searchInput) return;

    document.querySelectorAll('.gate-option').forEach((button) => {
      button.addEventListener('click', () => selectSite(button));
    });

    const gateButton = document.getElementById('gate-btn');
    if (gateButton) gateButton.addEventListener('click', confirmSite);

    const headerSite = document.getElementById('header-site');
    if (headerSite) {
      headerSite.addEventListener('change', (event) => {
        changeSiteFromHeader(event.target.value);
      });
    }

    searchInput.addEventListener('input', (event) => {
      onSearchInput(event.target.value);
    });

    const searchClear = document.getElementById('search-clear');
    if (searchClear) searchClear.addEventListener('click', clearSearch);

    document.addEventListener('click', (event) => {
      if (event.target.closest('.debug-toggle-btn')) {
        toggleDebug();
      }
    });
  }

  function initAdminPage() {
    const gate = document.getElementById('gate');
    const adminPanel = document.getElementById('adminPanel');
    const passwordInput = document.getElementById('passwordInput');
    const submitPassword = document.getElementById('submitPassword');
    const errorMessage = document.getElementById('errorMessage');
    const logoutButton = document.getElementById('logout-btn');
    if (!gate || !adminPanel || !passwordInput || !submitPassword || !errorMessage) return;

    gate.style.display = 'block';
    adminPanel.style.display = 'none';

    async function login() {
      const password = passwordInput.value.trim();
      if (!password) {
        errorMessage.textContent = 'Please enter the password.';
        errorMessage.style.display = 'block';
        return;
      }

      try {
        const response = await fetch('http://localhost:3001/admin-auth', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ password })
        });
        const result = await response.json();

        if (result.ok) {
          gate.style.display = 'none';
          adminPanel.style.display = 'block';
          errorMessage.style.display = 'none';
        } else {
          errorMessage.textContent = result.error || 'Incorrect password.';
          errorMessage.style.display = 'block';
        }
      } catch (error) {
        errorMessage.textContent = 'Unable to reach the admin server.';
        errorMessage.style.display = 'block';
      }
    }

    submitPassword.addEventListener('click', () => {
      login();
    });

    passwordInput.addEventListener('keypress', (event) => {
      if (event.key === 'Enter') {
        login();
      }
    });

    if (logoutButton) {
      logoutButton.addEventListener('click', () => {
        adminPanel.style.display = 'none';
        gate.style.display = 'block';
        passwordInput.value = '';
        errorMessage.style.display = 'none';
        errorMessage.textContent = '';
      });
    }
  }

  if ('serviceWorker' in navigator) {
    navigator.serviceWorker.register('cache.js', { scope: './' })
      .then((registration) => {
        console.log('Cache registered');
        if (registration.waiting) {
          registration.waiting.postMessage({ type: 'SKIP_WAITING' });
        }
      })
      .catch((error) => console.error(error));
  }

  document.addEventListener('DOMContentLoaded', () => {
    initInventoryPage();
    initAdminPage();
  });
})();
