/**
 * ==============================================================================
 * MEU FINANCEIRO - MÓDULO DE RASTREABILIDADE & TRILHA DE AUDITORIA (LOGS)
 * ==============================================================================
 * Registra cronologicamente todas as ações do usuário e do sistema:
 * - Sessão de acesso única (hora em que entrou e hora em que saiu do sistema)
 * - Adição, alteração e exclusão de lançamentos financeiros
 * - Marcação e alterações em contas fixas
 * - Ajustes salariais, benefícios e planejamento
 * - Autenticação, login, logout e sincronização com Supabase
 * - Exportações, importações e limpeza de dados
 * ==============================================================================
 */

(function () {
    const ACTIVITY_STORAGE_KEY = "meuFinanceiro_activityLogs";
    const SESSION_ID_KEY = "meuFinanceiro_current_session_id";
    const SESSION_DATA_KEY = "meuFinanceiro_active_session_data";
    const MAX_LOGS = 350; // Mantém até 350 registros mais recentes localmente

    function safeGetLogs() {
        try {
            const raw = localStorage.getItem(ACTIVITY_STORAGE_KEY);
            return raw ? JSON.parse(raw) : [];
        } catch (e) {
            console.warn("Erro ao carregar logs de atividade:", e);
            return [];
        }
    }

    function safeSaveLogs(logs) {
        try {
            localStorage.setItem(ACTIVITY_STORAGE_KEY, JSON.stringify(logs.slice(0, MAX_LOGS)));
        } catch (e) {
            console.warn("Erro ao persistir logs de atividade:", e);
        }
    }

    function getActorIdentity() {
        if (window.MFAuth && typeof window.MFAuth.getUser === "function") {
            const user = window.MFAuth.getUser();
            if (user && user.email) return user.email;
        }
        return "Modo Local / Offline";
    }

    function getDeviceLabel() {
        const ua = navigator.userAgent || "";
        if (/android|iphone|ipad|ipod|mobile/i.test(ua)) {
            return "📱 Dispositivo Móvel";
        }
        return "💻 Computador";
    }

    function formatTimeHM(date) {
        if (!date) return "";
        const d = (date instanceof Date) ? date : new Date(date);
        if (isNaN(d.getTime())) return "";
        return d.toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit" });
    }

    function sanitizeCsvCell(val) {
        const str = String(val ?? "");
        // Prevenção contra Injeção de Fórmulas em CSV (CWE-1236):
        if (/^[=+\-@\t\r]/.test(str)) {
            return `"'${str.replace(/"/g, '""')}"`;
        }
        return `"${str.replace(/"/g, '""')}"`;
    }

    // =========================================================================
    // GERENCIAMENTO INTELIGENTE DE SESSÃO (ENTROU E SAIU SEM REPETIÇÕES)
    // =========================================================================

    function finalizeSessionLog(sessionId, endTimeIso, startTimeIso) {
        if (!sessionId) return;
        const logs = safeGetLogs();
        const index = logs.findIndex(l => l.id === sessionId);
        if (index === -1) return;

        const entry = logs[index];
        const start = startTimeIso ? new Date(startTimeIso) : new Date(entry.details?.startTime || entry.timestamp);
        const end = new Date(endTimeIso || Date.now());
        const diffMs = Math.max(0, end - start);
        const diffMin = Math.max(1, Math.round(diffMs / 60000));

        entry.description = `Entrou às ${formatTimeHM(start)} • Saiu às ${formatTimeHM(end)} (Duração: ${diffMin} min)`;
        if (!entry.details) entry.details = {};
        entry.details.endTime = end.toISOString();
        entry.details.lastActiveTime = end.toISOString();
        entry.details.durationMinutes = diffMin;
        entry.details.isActive = false;

        safeSaveLogs(logs);
        window.dispatchEvent(new CustomEvent("mf:activity-logged", { detail: entry }));
    }

    function recordSessionPause() {
        const currentTabSessionId = sessionStorage.getItem(SESSION_ID_KEY);
        if (!currentTabSessionId) return;

        const now = new Date();
        const nowIso = now.toISOString();

        const sessionRaw = localStorage.getItem(SESSION_DATA_KEY);
        let startTimeIso = nowIso;
        if (sessionRaw) {
            try {
                const s = JSON.parse(sessionRaw);
                startTimeIso = s.startTime || nowIso;
                s.lastActiveTime = nowIso;
                s.isActive = false;
                localStorage.setItem(SESSION_DATA_KEY, JSON.stringify(s));
            } catch (e) {}
        }

        finalizeSessionLog(currentTabSessionId, nowIso, startTimeIso);
    }

    function updateActiveSessionHeartbeat() {
        const currentTabSessionId = sessionStorage.getItem(SESSION_ID_KEY);
        if (!currentTabSessionId) return;

        const now = new Date();
        const nowIso = now.toISOString();

        const sessionRaw = localStorage.getItem(SESSION_DATA_KEY);
        let startTimeIso = nowIso;
        if (sessionRaw) {
            try {
                const s = JSON.parse(sessionRaw);
                startTimeIso = s.startTime || nowIso;
                s.lastActiveTime = nowIso;
                s.isActive = true;
                localStorage.setItem(SESSION_DATA_KEY, JSON.stringify(s));
            } catch (e) {}
        }

        // Mantém atualizado no log local
        const logs = safeGetLogs();
        const index = logs.findIndex(l => l.id === currentTabSessionId);
        if (index !== -1) {
            const start = new Date(startTimeIso);
            logs[index].description = `Entrou às ${formatTimeHM(start)} • Sessão ativa agora`;
            if (!logs[index].details) logs[index].details = {};
            logs[index].details.lastActiveTime = nowIso;
            logs[index].details.isActive = true;
            safeSaveLogs(logs);
            window.dispatchEvent(new CustomEvent("mf:activity-logged", { detail: logs[index] }));
        }
    }

    function initSessionTracking() {
        try {
            const currentTabSessionId = sessionStorage.getItem(SESSION_ID_KEY);
            const now = new Date();
            const nowIso = now.toISOString();

            if (!currentTabSessionId) {
                // Nova sessão na aba/aplicativo iniciada
                // Fecha a sessão anterior que tenha ficado pendente no localStorage
                const prevSessionRaw = localStorage.getItem(SESSION_DATA_KEY);
                if (prevSessionRaw) {
                    try {
                        const prevSession = JSON.parse(prevSessionRaw);
                        if (prevSession && prevSession.id && prevSession.isActive) {
                            finalizeSessionLog(prevSession.id, prevSession.lastActiveTime || nowIso, prevSession.startTime);
                        }
                    } catch (e) {}
                }

                const newSessionId = "sess_" + Date.now() + "_" + Math.random().toString(36).substr(2, 5);
                sessionStorage.setItem(SESSION_ID_KEY, newSessionId);

                const sessionPayload = {
                    id: newSessionId,
                    startTime: nowIso,
                    lastActiveTime: nowIso,
                    isActive: true
                };
                localStorage.setItem(SESSION_DATA_KEY, JSON.stringify(sessionPayload));

                // Registra o log único de entrada da sessão
                ActivityLogger.logSession(
                    newSessionId,
                    nowIso,
                    "SESSION_ACCESS",
                    "Sessão no aplicativo",
                    `Entrou às ${formatTimeHM(now)} • Sessão ativa agora`,
                    {
                        startTime: nowIso,
                        lastActiveTime: nowIso,
                        endTime: null,
                        isActive: true
                    }
                );
            } else {
                // Já está na mesma sessão do navegador: apenas atualiza status ativo e evita nova entrada repetida!
                updateActiveSessionHeartbeat();
            }

            // Escuta encerramento da página ou minimização
            window.addEventListener("pagehide", () => {
                recordSessionPause();
            });

            document.addEventListener("visibilitychange", () => {
                if (document.visibilityState === "hidden") {
                    recordSessionPause();
                } else if (document.visibilityState === "visible") {
                    updateActiveSessionHeartbeat();
                }
            });

            // Atualiza batimento periódico
            setInterval(() => {
                if (document.visibilityState === "visible") {
                    updateActiveSessionHeartbeat();
                }
            }, 25000);
        } catch (e) {
            console.warn("Erro no rastreamento de sessão:", e);
        }
    }

    const ActivityLogger = {
        /**
         * Registra uma nova atividade na trilha de auditoria
         * @param {string} category - "transactions" | "recurring" | "settings" | "planning" | "auth" | "system" | "session"
         * @param {string} action - Código da ação (ex: "TRANSACTION_CREATED")
         * @param {string} title - Título amigável da ação
         * @param {string} description - Descrição detalhada do evento
         * @param {object} [details] - Dados extras do evento
         */
        log(category, action, title, description, details = {}) {
            const entry = {
                id: "act_" + Date.now() + "_" + Math.random().toString(36).substr(2, 6),
                timestamp: new Date().toISOString(),
                category: category || "system",
                action: action || "GENERIC_ACTION",
                title: title || "Atividade registrada",
                description: description || "",
                details: details || {},
                user: getActorIdentity(),
                device: getDeviceLabel()
            };

            const logs = safeGetLogs();
            logs.unshift(entry); // Adiciona no início da lista (mais recente primeiro)
            safeSaveLogs(logs);

            // Dispara evento customizado no DOM para quem estiver escutando atualizar em tempo real
            window.dispatchEvent(new CustomEvent("mf:activity-logged", { detail: entry }));

            // Se o usuário estiver autenticado no Supabase, tenta persistir na nuvem em segundo plano
            this.syncLogToCloud(entry);

            return entry;
        },

        /**
         * Registra ou atualiza especificamente o log de sessão de uso
         */
        logSession(id, timestamp, action, title, description, details = {}) {
            const entry = {
                id: id,
                timestamp: timestamp || new Date().toISOString(),
                category: "session",
                action: action || "SESSION_ACCESS",
                title: title || "Sessão no aplicativo",
                description: description || "",
                details: details || {},
                user: getActorIdentity(),
                device: getDeviceLabel()
            };

            const logs = safeGetLogs();
            const existingIndex = logs.findIndex(l => l.id === id);
            if (existingIndex !== -1) {
                logs[existingIndex] = entry;
            } else {
                logs.unshift(entry);
            }
            safeSaveLogs(logs);

            window.dispatchEvent(new CustomEvent("mf:activity-logged", { detail: entry }));
            return entry;
        },

        async syncLogToCloud(entry) {
            if (!window.MFAuth || typeof window.MFAuth.getClient !== "function") return;
            const client = window.MFAuth.getClient();
            const user = window.MFAuth.getUser ? window.MFAuth.getUser() : null;
            if (!client || !user) return;

            try {
                await client.from("activity_logs").insert({
                    user_id: user.id,
                    action: entry.action,
                    category: entry.category,
                    description: `${entry.title}: ${entry.description}`,
                    details: {
                        actor: entry.user,
                        device: entry.device,
                        extra: entry.details
                    },
                    created_at: entry.timestamp
                });
            } catch (err) {
                // Falha silenciosa para não travar a experiência do usuário (Local-First)
                console.debug("Persistência em nuvem do log em fila/offline:", err.message);
            }
        },

        getLogs(categoryFilter = "all") {
            const logs = safeGetLogs();
            if (!categoryFilter || categoryFilter === "all") {
                return logs;
            }
            return logs.filter(l => l.category === categoryFilter);
        },

        clearLogs() {
            try {
                localStorage.removeItem(ACTIVITY_STORAGE_KEY);
                window.dispatchEvent(new CustomEvent("mf:activity-cleared"));
                return true;
            } catch (e) {
                return false;
            }
        },

        exportCSV() {
            const logs = safeGetLogs();
            if (!logs || logs.length === 0) {
                if (typeof window.showToast === "function") {
                    window.showToast("Nenhuma atividade registrada para exportar.");
                }
                return;
            }

            const headers = ["ID", "Data e Hora", "Categoria", "Ação", "Título", "Descrição", "Autor", "Dispositivo"];
            const rows = logs.map(l => [
                sanitizeCsvCell(l.id),
                sanitizeCsvCell(new Date(l.timestamp).toLocaleString("pt-BR")),
                sanitizeCsvCell(l.category),
                sanitizeCsvCell(l.action),
                sanitizeCsvCell(l.title || ""),
                sanitizeCsvCell(l.description || ""),
                sanitizeCsvCell(l.user || ""),
                sanitizeCsvCell(l.device || "")
            ]);

            const csvContent = "\uFEFF" + [headers.join(";"), ...rows.map(r => r.join(";"))].join("\r\n");
            const blob = new Blob([csvContent], { type: "text/csv;charset=utf-8;" });
            const url = URL.createObjectURL(blob);
            const a = document.createElement("a");
            a.href = url;
            a.download = `meu-financeiro-trilha-auditoria-${new Date().toISOString().split("T")[0]}.csv`;
            document.body.appendChild(a);
            a.click();
            document.body.removeChild(a);
            setTimeout(() => URL.revokeObjectURL(url), 1000);

            if (typeof window.showToast === "function") {
                window.showToast("Trilha de auditoria exportada em CSV com sucesso!");
            }
        },

        getCategoryBadge(category) {
            switch (category) {
                case "session":
                    return { label: "Sessão", icon: "🚪", className: "badge-session" };
                case "transactions":
                    return { label: "Lançamento", icon: "➕", className: "badge-transactions" };
                case "recurring":
                    return { label: "Conta Fixa", icon: "⟲", className: "badge-recurring" };
                case "settings":
                    return { label: "Configuração", icon: "⚙", className: "badge-settings" };
                case "planning":
                    return { label: "Planejamento", icon: "🎯", className: "badge-planning" };
                case "auth":
                    return { label: "Segurança & Nuvem", icon: "☁️", className: "badge-auth" };
                default:
                    return { label: "Sistema", icon: "💻", className: "badge-system" };
            }
        },

        formatRelativeTime(isoString) {
            const date = new Date(isoString);
            const now = new Date();
            const diffMs = now - date;
            const diffSec = Math.floor(diffMs / 1000);
            const diffMin = Math.floor(diffSec / 60);
            const diffHour = Math.floor(diffMin / 60);
            const diffDays = Math.floor(diffHour / 24);

            if (diffSec < 45) return "Agora mesmo";
            if (diffMin < 60) return `Há ${diffMin} min`;
            if (diffHour < 24) return `Hoje às ${date.toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit" })}`;
            if (diffDays === 1) return `Ontem às ${date.toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit" })}`;
            return date.toLocaleDateString("pt-BR", { day: "2-digit", month: "2-digit", year: "numeric", hour: "2-digit", minute: "2-digit" });
        }
    };

    window.MFActivityLogger = ActivityLogger;

    // Inicializa o rastreamento automático de sessão
    if (document.readyState === "loading") {
        document.addEventListener("DOMContentLoaded", initSessionTracking);
    } else {
        initSessionTracking();
    }
})();
