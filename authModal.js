/**
 * ==============================================================================
 * MEU FINANCEIRO - MODAL DE AUTENTICAÇÃO E PERFIL DO USUÁRIO
 * ==============================================================================
 * Injeta o componente modal de login/cadastro/configuração e o botão na topbar
 * ==============================================================================
 */

(function () {
    // 1. Injeta o HTML do Modal no final do body
    function injectAuthModalHtml() {
        if (document.getElementById("authModal")) return;

        const modalHtml = `
        <div id="authModal" class="auth-modal-backdrop hidden" aria-hidden="true" role="dialog" aria-modal="true">
            <div class="auth-modal-card">
                <button type="button" class="auth-modal-close" id="authModalCloseBtn" aria-label="Fechar janela">✕</button>

                <div class="auth-modal-header">
                    <div class="auth-brand-badge">
                        <span class="auth-brand-icon">⚡</span>
                        <span>Meu Financeiro Nuvem</span>
                    </div>
                    <h2 id="authModalTitle">Acesse sua conta</h2>
                    <p id="authModalSubtitle">Sincronize suas despesas e acesse de qualquer aparelho com segurança.</p>
                </div>

                <!-- Abas: Entrar, Cadastrar e Configurar Nuvem -->
                <div class="auth-tabs" role="tablist">
                    <button type="button" class="auth-tab active" data-auth-tab="signin" role="tab">Entrar</button>
                    <button type="button" class="auth-tab" data-auth-tab="signup" role="tab">Criar conta</button>
                    <button type="button" class="auth-tab" data-auth-tab="config" role="tab">⚙️ Conexão</button>
                </div>

                <div id="authAlertBox" class="auth-alert hidden"></div>

                <!-- Formulário de Login -->
                <form id="authSignInForm" class="auth-form" novalidate>
                    <div class="field">
                        <label for="authSignInEmail">E-mail</label>
                        <input type="email" id="authSignInEmail" placeholder="seu@email.com" required autocomplete="email">
                    </div>
                    <div class="field">
                        <div class="label-with-link">
                            <label for="authSignInPassword">Senha</label>
                            <button type="button" id="authForgotPwdBtn" class="auth-text-link">Esqueceu a senha?</button>
                        </div>
                        <input type="password" id="authSignInPassword" placeholder="Sua senha" required autocomplete="current-password">
                    </div>
                    <button type="submit" class="button button-primary auth-submit-btn" id="btnSubmitSignIn">
                        <span>Entrar</span>
                    </button>
                </form>

                <!-- Formulário de Cadastro -->
                <form id="authSignUpForm" class="auth-form hidden" novalidate>
                    <div class="field">
                        <label for="authSignUpEmail">E-mail</label>
                        <input type="email" id="authSignUpEmail" placeholder="seu@email.com" required autocomplete="email">
                    </div>
                    <div class="field">
                        <label for="authSignUpPassword">Criar senha</label>
                        <input type="password" id="authSignUpPassword" placeholder="Mínimo de 6 caracteres" required minlength="6" autocomplete="new-password">
                    </div>
                    <div class="field">
                        <label for="authSignUpPasswordConfirm">Confirmar senha</label>
                        <input type="password" id="authSignUpPasswordConfirm" placeholder="Repita sua senha" required minlength="6" autocomplete="new-password">
                    </div>
                    <button type="submit" class="button button-primary auth-submit-btn" id="btnSubmitSignUp">
                        <span>Criar minha conta</span>
                    </button>
                    <p class="auth-footnote">Ao cadastrar, seus dados locais serão preservados e vinculados à sua conta com isolamento seguro (RLS).</p>
                </form>

                <!-- Painel de Configurações do Supabase -->
                <div id="authConfigPanel" class="auth-form hidden">
                    <p class="auth-config-intro">Insira as credenciais do seu projeto Supabase para habilitar a nuvem:</p>
                    <div class="field">
                        <label for="authSupabaseUrl">Project URL</label>
                        <input type="url" id="authSupabaseUrl" placeholder="https://xyzproject.supabase.co" autocomplete="off">
                    </div>
                    <div class="field">
                        <label for="authSupabaseAnonKey">Anon / Public Key</label>
                        <input type="password" id="authSupabaseAnonKey" placeholder="eyJhbGciOiJIUzI1NiIs..." autocomplete="off">
                    </div>
                    <div class="auth-config-actions">
                        <button type="button" class="button button-primary" id="btnSaveSupabaseConfig">Salvar Conexão</button>
                    </div>
                </div>

                <div class="auth-modal-footer">
                    <span class="auth-security-badge">🔒 Criptografia ponta a ponta & Row Level Security</span>
                </div>
            </div>
        </div>
        `;

        document.body.insertAdjacentHTML("beforeend", modalHtml);
        setupAuthModalEvents();
    }

    // 2. Injeta o Botão/Perfil de Auth na Topbar
    function injectTopbarAuthElement() {
        const topbarActions = document.querySelector(".topbar-actions");
        if (!topbarActions || document.getElementById("topbarAuthContainer")) return;

        const authContainer = document.createElement("div");
        authContainer.id = "topbarAuthContainer";
        authContainer.className = "topbar-auth-container";

        authContainer.innerHTML = `
            <!-- Botão quando deslogado -->
            <button type="button" class="auth-trigger-btn" id="authTriggerBtn" title="Entrar ou criar conta para sincronizar na nuvem">
                <span class="auth-trigger-icon">☁️</span>
                <span class="auth-trigger-text">Entrar</span>
            </button>

            <!-- Dropdown quando logado -->
            <div class="user-profile-widget hidden" id="userProfileWidget">
                <button type="button" class="user-profile-btn" id="userProfileBtn" aria-expanded="false" aria-haspopup="menu">
                    <span class="user-avatar" id="userAvatarChar">U</span>
                    <span class="user-email-label" id="userEmailLabel">usuario@email.com</span>
                    <span class="sync-dot" id="syncStatusDot" title="Sincronizado com a nuvem"></span>
                    <span class="dropdown-arrow">▾</span>
                </button>
                <div class="user-profile-dropdown hidden" id="userProfileDropdown" role="menu">
                    <div class="user-dropdown-header">
                        <strong id="userDropdownEmail">usuario@email.com</strong>
                        <span class="user-status-text" id="userSyncStatusText">● Sincronizado</span>
                    </div>
                    <div class="user-dropdown-divider"></div>
                    <button type="button" class="user-dropdown-item" id="btnSyncNow">
                        <span>🔄 Sincronizar agora</span>
                    </button>
                    <a href="configuracoes.html" class="user-dropdown-item">
                        <span>⚙️ Configurações</span>
                    </a>
                    <div class="user-dropdown-divider"></div>
                    <button type="button" class="user-dropdown-item text-danger" id="btnLogout">
                        <span>🚪 Sair da conta</span>
                    </button>
                </div>
            </div>
        `;

        // Insere logo antes do botão de privacidade 👁️ ou no final
        const privacyBtn = topbarActions.querySelector(".privacy-btn");
        if (privacyBtn) {
            topbarActions.insertBefore(authContainer, privacyBtn);
        } else {
            topbarActions.appendChild(authContainer);
        }

        setupTopbarEvents();
    }

    // 3. Gerenciamento de eventos do Modal
    function setupAuthModalEvents() {
        const modal = document.getElementById("authModal");
        const closeBtn = document.getElementById("authModalCloseBtn");
        const tabs = document.querySelectorAll(".auth-tab");
        const alertBox = document.getElementById("authAlertBox");

        const formSignIn = document.getElementById("authSignInForm");
        const formSignUp = document.getElementById("authSignUpForm");
        const panelConfig = document.getElementById("authConfigPanel");

        function showAlert(msg, isSuccess = false) {
            if (!alertBox) return;
            alertBox.textContent = msg;
            alertBox.className = `auth-alert ${isSuccess ? "alert-success" : "alert-error"}`;
            alertBox.classList.remove("hidden");
        }

        function clearAlert() {
            if (alertBox) alertBox.classList.add("hidden");
        }

        function switchTab(target) {
            tabs.forEach(t => t.classList.toggle("active", t.dataset.authTab === target));
            clearAlert();

            formSignIn.classList.toggle("hidden", target !== "signin");
            formSignUp.classList.toggle("hidden", target !== "signup");
            panelConfig.classList.toggle("hidden", target !== "config");

            const title = document.getElementById("authModalTitle");
            const sub = document.getElementById("authModalSubtitle");

            if (target === "signin") {
                title.textContent = "Acesse sua conta";
                sub.textContent = "Sincronize suas despesas e acesse de qualquer aparelho.";
            } else if (target === "signup") {
                title.textContent = "Criar conta gratuita";
                sub.textContent = "Cadastre-se para manter suas finanças salvas na nuvem com isolamento.";
            } else if (target === "config") {
                title.textContent = "Conexão com o Supabase";
                sub.textContent = "Conecte seu projeto inserindo sua URL e chave pública (Anon).";
                // Preenche valores atuais se existirem
                if (window.MFAuth) {
                    const cfg = window.MFAuth.getConfig();
                    document.getElementById("authSupabaseUrl").value = cfg.url || "";
                    document.getElementById("authSupabaseAnonKey").value = cfg.anonKey || "";
                }
            }
        }

        tabs.forEach(t => {
            t.addEventListener("click", () => switchTab(t.dataset.authTab));
        });

        // Fechar modal
        function closeModal() {
            modal.classList.add("hidden");
            modal.setAttribute("aria-hidden", "true");
            clearAlert();
        }

        if (closeBtn) closeBtn.addEventListener("click", closeModal);
        modal.addEventListener("click", (e) => {
            if (e.target === modal) closeModal();
        });

        // Submit Sign In
        formSignIn.addEventListener("submit", async (e) => {
            e.preventDefault();
            clearAlert();
            const email = document.getElementById("authSignInEmail").value;
            const pwd = document.getElementById("authSignInPassword").value;
            const btn = document.getElementById("btnSubmitSignIn");

            if (!email || !pwd) {
                showAlert("Informe seu email e senha.");
                return;
            }

            try {
                btn.disabled = true;
                btn.innerHTML = `<span class="auth-spinner"></span> Entrando...`;
                await window.MFAuth.signIn(email, pwd);
                closeModal();
                if (typeof window.showToast === "function") {
                    window.showToast("Login realizado com sucesso!");
                }
            } catch (err) {
                console.error("Erro de login:", err);
                const msg = err.message.includes("Invalid login credentials")
                    ? "Email ou senha incorretos."
                    : (err.message.includes("Email not confirmed")
                        ? "Email não confirmado. Verifique sua caixa de entrada."
                        : (err.message || "Erro ao entrar na conta."));
                showAlert(msg);
            } finally {
                btn.disabled = false;
                btn.innerHTML = `<span>Entrar</span>`;
            }
        });

        // Submit Sign Up
        formSignUp.addEventListener("submit", async (e) => {
            e.preventDefault();
            clearAlert();
            const email = document.getElementById("authSignUpEmail").value;
            const pwd = document.getElementById("authSignUpPassword").value;
            const pwdConfirm = document.getElementById("authSignUpPasswordConfirm").value;
            const btn = document.getElementById("btnSubmitSignUp");

            if (!email || !pwd) {
                showAlert("Preencha todos os campos.");
                return;
            }

            if (pwd.length < 6) {
                showAlert("A senha deve ter pelo menos 6 caracteres.");
                return;
            }

            if (pwd !== pwdConfirm) {
                showAlert("As senhas digitadas não coincidem.");
                return;
            }

            try {
                btn.disabled = true;
                btn.innerHTML = `<span class="auth-spinner"></span> Cadastrando...`;
                const res = await window.MFAuth.signUp(email, pwd);
                
                if (res.session) {
                    closeModal();
                    if (typeof window.showToast === "function") {
                        window.showToast("Conta criada e sincronizada com sucesso!");
                    }
                } else {
                    showAlert("Conta criada com sucesso! Verifique seu email para confirmar o cadastro.", true);
                    formSignUp.reset();
                }
            } catch (err) {
                console.error("Erro de cadastro:", err);
                showAlert(err.message || "Não foi possível criar a conta.");
            } finally {
                btn.disabled = false;
                btn.innerHTML = `<span>Criar minha conta</span>`;
            }
        });

        // Esqueci a senha
        const forgotBtn = document.getElementById("authForgotPwdBtn");
        if (forgotBtn) {
            forgotBtn.addEventListener("click", async () => {
                const email = document.getElementById("authSignInEmail").value.trim();
                if (!email) {
                    showAlert("Digite seu email no campo acima para recuperar a senha.");
                    return;
                }
                try {
                    await window.MFAuth.resetPassword(email);
                    showAlert("Email de recuperação enviado! Verifique sua caixa de entrada.", true);
                } catch (err) {
                    showAlert(err.message || "Erro ao solicitar recuperação.");
                }
            });
        }

        // Salvar Configurações de Conexão Supabase
        const btnSaveConfig = document.getElementById("btnSaveSupabaseConfig");
        if (btnSaveConfig) {
            btnSaveConfig.addEventListener("click", () => {
                const url = document.getElementById("authSupabaseUrl").value.trim();
                const key = document.getElementById("authSupabaseAnonKey").value.trim();

                if (!url || !key) {
                    showAlert("Informe a Project URL e a Anon Key.");
                    return;
                }

                window.MFAuth.saveConfig(url, key);
                showAlert("Configurações do Supabase salvas com sucesso!", true);
                setTimeout(() => switchTab("signin"), 1000);
            });
        }
    }

    // 4. Gerenciamento da Topbar e Dropdown
    function setupTopbarEvents() {
        const triggerBtn = document.getElementById("authTriggerBtn");
        const profileBtn = document.getElementById("userProfileBtn");
        const dropdown = document.getElementById("userProfileDropdown");
        const btnLogout = document.getElementById("btnLogout");
        const btnSyncNow = document.getElementById("btnSyncNow");

        if (triggerBtn) {
            triggerBtn.addEventListener("click", () => {
                const modal = document.getElementById("authModal");
                if (modal) {
                    modal.classList.remove("hidden");
                    modal.setAttribute("aria-hidden", "false");
                }
            });
        }

        if (profileBtn && dropdown) {
            profileBtn.addEventListener("click", (e) => {
                e.stopPropagation();
                const isOpen = !dropdown.classList.contains("hidden");
                dropdown.classList.toggle("hidden", isOpen);
                profileBtn.setAttribute("aria-expanded", String(!isOpen));
            });

            document.addEventListener("click", (e) => {
                if (!profileBtn.contains(e.target) && !dropdown.contains(e.target)) {
                    dropdown.classList.add("hidden");
                    profileBtn.setAttribute("aria-expanded", "false");
                }
            });
        }

        if (btnLogout) {
            btnLogout.addEventListener("click", async () => {
                dropdown.classList.add("hidden");
                if (window.MFAuth) {
                    await window.MFAuth.signOut();
                    if (typeof window.showToast === "function") {
                        window.showToast("Você saiu da conta.");
                    }
                }
            });
        }

        if (btnSyncNow) {
            btnSyncNow.addEventListener("click", async () => {
                dropdown.classList.add("hidden");
                if (window.MFAuth) {
                    window.dispatchEvent(new CustomEvent("mf:sync-status", { detail: { status: "syncing" } }));
                    await window.MFAuth.pullData();
                    window.dispatchEvent(new CustomEvent("mf:sync-status", { detail: { status: "synced" } }));
                    if (typeof window.showToast === "function") {
                        window.showToast("Dados sincronizados com a nuvem!");
                    }
                }
            });
        }
    }

    // 5. Atualiza a UI quando a sessão muda
    function updateAuthUi(session, user) {
        const triggerBtn = document.getElementById("authTriggerBtn");
        const profileWidget = document.getElementById("userProfileWidget");
        const emailLabel = document.getElementById("userEmailLabel");
        const dropdownEmail = document.getElementById("userDropdownEmail");
        const avatarChar = document.getElementById("userAvatarChar");

        if (session && user) {
            if (triggerBtn) triggerBtn.classList.add("hidden");
            if (profileWidget) profileWidget.classList.remove("hidden");

            const email = user.email || "Usuário";
            if (emailLabel) emailLabel.textContent = email;
            if (dropdownEmail) dropdownEmail.textContent = email;
            if (avatarChar) avatarChar.textContent = email.charAt(0).toUpperCase();
        } else {
            if (triggerBtn) triggerBtn.classList.remove("hidden");
            if (profileWidget) profileWidget.classList.add("hidden");
        }
    }

    // 6. Atualiza dot de status de sincronização
    function updateSyncDot(status) {
        const dot = document.getElementById("syncStatusDot");
        const statusText = document.getElementById("userSyncStatusText");
        if (!dot) return;

        dot.className = `sync-dot sync-${status}`;
        if (statusText) {
            if (status === "syncing") statusText.textContent = "⏳ Sincronizando...";
            else if (status === "synced") statusText.textContent = "● Sincronizado";
            else if (status === "error") statusText.textContent = "⚠️ Falha ao sincronizar";
            else statusText.textContent = "○ Modo local";
        }
    }

    // 7. Listeners de eventos customizados
    window.addEventListener("mf:auth-ready", (e) => {
        updateAuthUi(e.detail.session, e.detail.user);
    });

    window.addEventListener("mf:auth-change", (e) => {
        updateAuthUi(e.detail.session, e.detail.user);
    });

    window.addEventListener("mf:sync-status", (e) => {
        updateSyncDot(e.detail.status);
    });

    // Injeção ao carregar o DOM
    document.addEventListener("DOMContentLoaded", () => {
        injectAuthModalHtml();
        injectTopbarAuthElement();
        if (window.MFAuth) {
            window.MFAuth.getSession().then(s => updateAuthUi(s, window.MFAuth.getUser()));
        }
    });

    // Fallback caso script execute após DOMContentLoaded
    if (document.readyState === "interactive" || document.readyState === "complete") {
        injectAuthModalHtml();
        injectTopbarAuthElement();
    }
})();
