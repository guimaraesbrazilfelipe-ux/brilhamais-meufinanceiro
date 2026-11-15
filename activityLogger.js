/**
 * ==============================================================================
 * MEU FINANCEIRO - MÓDULO DE RASTREABILIDADE & TRILHA DE AUDITORIA (LOGS)
 * ==============================================================================
 * Registra cronologicamente todas as ações do usuário e do sistema:
 * - Adição, alteração e exclusão de lançamentos financeiros
 * - Marcação e alterações em contas fixas
 * - Ajustes salariais, benefícios e planejamento
 * - Autenticação, login, logout e sincronização com Supabase
 * - Exportações, importações e limpeza de dados
 * ==============================================================================
 */

(function () {
    const ACTIVITY_STORAGE_KEY = "meuFinanceiro_activityLogs";
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

    function sanitizeCsvCell(val) {
        const str = String(val ?? "");
        // Prevenção contra Injeção de Fórmulas em CSV (CWE-1236):
        // Se a célula iniciar com '=', '+', '-', '@', tabulação ou retorno, prefixa com apóstrofe de escape (')
        if (/^[=+\-@\t\r]/.test(str)) {
            return `"'${str.replace(/"/g, '""')}"`;
        }
        return `"${str.replace(/"/g, '""')}"`;
    }

    const ActivityLogger = {
        /**
         * Registra uma nova atividade na trilha de auditoria
         * @param {string} category - "transactions" | "recurring" | "settings" | "planning" | "auth" | "system"
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
})();
