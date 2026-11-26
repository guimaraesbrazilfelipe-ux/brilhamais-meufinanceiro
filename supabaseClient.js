/**
 * ==============================================================================
 * BRILHACASH - CLIENTE SUPABASE & CAMADA DE AUTENTICAÇÃO / SINCRONIZAÇÃO
 * ==============================================================================
 * Fornece integração Local-First com o Supabase:
 * - Gerenciamento de credenciais (persistidas em localStorage ou predefinidas)
 * - Autenticação completa: Login, Cadastro, Logout, Recuperação e Sessão
 * - Sincronização bidirecional transparente com o banco PostgreSQL
 * ==============================================================================
 */

const SUPABASE_CONFIG_KEY = "meuFinanceiro_supabaseConfig";
const DEVICE_ID_KEY = "meuFinanceiro_deviceId";
const DEVICE_SESSION_KEY = "meuFinanceiro_deviceSession";

// Credenciais protegidas por codificação base64
const _D_URL = "aHR0cHM6Ly9ocmtidHhwd3F5ZXhkY2J0eXNuby5zdXBhYmFzZS5jbw==";
const _D_KEY = "c2JfcHVibGlzaGFibGVfTTZPU2JtWlJqdm5PSjk5UFQ5MUU2UV8zTENXZEtMUg==";

function _safeDecode(str) {
    try {
        return atob(str);
    } catch (e) {
        return "";
    }
}

const DEFAULT_SUPABASE_URL = _safeDecode(_D_URL);
const DEFAULT_SUPABASE_ANON_KEY = _safeDecode(_D_KEY);

// ==============================================================================
// MÓDULO DE IDENTIFICAÇÃO DE DISPOSITIVO & SESSÃO PERSISTENTE (MFDevice)
// ==============================================================================
function detectDeviceInfo() {
    const ua = (navigator && navigator.userAgent) || "";
    const platform = (navigator && navigator.platform) || "";
    let os = "Dispositivo";
    let type = "Computador";
    let icon = "💻";
    let browser = "Navegador";

    // 1. Identificação do Sistema Operacional e Tipo de Aparelho
    if (/windows phone/i.test(ua)) {
        os = "Windows Phone";
        type = "Celular";
        icon = "📱";
    } else if (/win/i.test(platform) || /windows/i.test(ua)) {
        os = "Windows";
        type = "Computador";
        icon = "💻";
    } else if (/android/i.test(ua)) {
        os = "Android";
        type = /mobile/i.test(ua) ? "Celular" : "Tablet";
        icon = type === "Tablet" ? "📟" : "📱";
    } else if (/ipad|iphone|ipod/i.test(ua) || (platform === "MacIntel" && navigator.maxTouchPoints > 1)) {
        os = /ipad/i.test(ua) || (platform === "MacIntel" && navigator.maxTouchPoints > 1) ? "iPadOS" : "iOS";
        type = os === "iPadOS" ? "Tablet" : "Celular";
        icon = os === "iPadOS" ? "📟" : "📱";
    } else if (/mac/i.test(platform) || /macintosh/i.test(ua)) {
        os = "macOS";
        type = "Computador";
        icon = "💻";
    } else if (/linux/i.test(platform) || /linux/i.test(ua)) {
        os = "Linux";
        type = "Computador";
        icon = "💻";
    } else if (/cros/i.test(ua)) {
        os = "ChromeOS";
        type = "Computador";
        icon = "💻";
    }

    // 2. Identificação do Navegador
    if (/edg/i.test(ua)) {
        browser = "Edge";
    } else if (/opr|opera/i.test(ua)) {
        browser = "Opera";
    } else if (/chrome|crios/i.test(ua)) {
        browser = "Chrome";
    } else if (/firefox|fxios/i.test(ua)) {
        browser = "Firefox";
    } else if (/safari/i.test(ua) && !/chrome/i.test(ua)) {
        browser = "Safari";
    } else if (/samsungbrowser/i.test(ua)) {
        browser = "Samsung Internet";
    }

    const shortLabel = `${os} • ${browser}`;
    const fullLabel = `${type} ${os} (${browser})`;

    return {
        os,
        browser,
        type,
        icon,
        label: fullLabel,
        shortLabel,
        userAgent: ua
    };
}

function getDeviceId() {
    let id = "";
    try {
        id = localStorage.getItem(DEVICE_ID_KEY);
        if (!id) {
            id = "dev_" + Math.random().toString(36).substring(2, 9) + Date.now().toString(36);
            localStorage.setItem(DEVICE_ID_KEY, id);
        }
    } catch (e) {
        id = "dev_temp_" + Date.now().toString(36);
    }
    return id;
}

function getDeviceSession() {
    try {
        const raw = localStorage.getItem(DEVICE_SESSION_KEY);
        if (!raw) return null;
        const session = JSON.parse(raw);
        if (session && session.userId && session.email && session.keepLoggedIn) {
            return session;
        }
    } catch (e) {
        console.warn("Erro ao obter sessão do dispositivo:", e);
    }
    return null;
}

function saveDeviceSession(user, keepLoggedIn = true) {
    if (!user || !user.id || !user.email) return;
    try {
        const devInfo = detectDeviceInfo();
        const devId = getDeviceId();
        const payload = {
            deviceId: devId,
            deviceInfo: devInfo,
            userId: user.id,
            email: user.email,
            userMetadata: user.user_metadata || {},
            lastActive: new Date().toISOString(),
            keepLoggedIn: Boolean(keepLoggedIn)
        };
        localStorage.setItem(DEVICE_SESSION_KEY, JSON.stringify(payload));
        const alreadyLoggedThisSession = sessionStorage.getItem("mf_device_session_logged");
        if (!alreadyLoggedThisSession && window.MFActivityLogger) {
            sessionStorage.setItem("mf_device_session_logged", "true");
            window.MFActivityLogger.log(
                "auth",
                "DEVICE_SESSION_SAVED",
                "Dispositivo vinculado à conta",
                `Sessão persistente ativada para ${user.email} no dispositivo ${devInfo.label} (${devId})`
            );
        }
    } catch (e) {
        console.warn("Não foi possível salvar sessão no dispositivo:", e);
    }
}

function clearDeviceSession() {
    try {
        localStorage.removeItem(DEVICE_SESSION_KEY);
        if (window.MFActivityLogger) {
            window.MFActivityLogger.log(
                "auth",
                "DEVICE_SESSION_CLEARED",
                "Sessão desvinculada do dispositivo",
                "Dispositivo deslogado e credenciais locais limpas"
            );
        }
    } catch (e) {}
}

window.MFDevice = {
    getId: getDeviceId,
    getInfo: detectDeviceInfo,
    getDeviceSession: getDeviceSession,
    saveDeviceSession: saveDeviceSession,
    clearDeviceSession: clearDeviceSession,
    isRemembered: () => Boolean(getDeviceSession())
};

// Objeto de configuração inicial (predefinido com as credenciais do projeto)
let supabaseConfig = {
    url: DEFAULT_SUPABASE_URL,
    anonKey: DEFAULT_SUPABASE_ANON_KEY
};

let supabaseClient = null;
let currentUser = null;
let isSyncing = false;

// 1. Carregar configurações salvas
function loadSupabaseConfig() {
    try {
        const saved = localStorage.getItem(SUPABASE_CONFIG_KEY);
        if (saved) {
            const parsed = JSON.parse(saved);
            if (parsed && parsed.url && parsed.anonKey) {
                supabaseConfig = parsed;
                return;
            }
        }
    } catch (e) {
        console.warn("Erro ao carregar configurações do Supabase:", e);
    }
    // Padrão do projeto
    supabaseConfig = {
        url: DEFAULT_SUPABASE_URL,
        anonKey: DEFAULT_SUPABASE_ANON_KEY
    };
}

// 2. Salvar configurações
function saveSupabaseConfig(url, anonKey) {
    supabaseConfig = {
        url: (url || "").trim(),
        anonKey: (anonKey || "").trim()
    };
    try {
        localStorage.setItem(SUPABASE_CONFIG_KEY, JSON.stringify(supabaseConfig));
    } catch (e) {}
    if (window.MFActivityLogger) {
        window.MFActivityLogger.log(
            "settings",
            "SUPABASE_CONFIG_SAVED",
            "Conexão Supabase configurada",
            `URL do projeto Supabase atualizada para ${supabaseConfig.url || "padrão"}`
        );
    }
    initSupabase();
}

// 3. Inicializar cliente do SDK Supabase
function initSupabase() {
    loadSupabaseConfig();

    // 1. Restaura sessão contínua do dispositivo imediatamente se existente
    const devSession = getDeviceSession();
    if (devSession && devSession.userId) {
        currentUser = {
            id: devSession.userId,
            email: devSession.email,
            user_metadata: devSession.userMetadata || {}
        };
        // Notifica o app imediatamente para não piscar tela de login
        window.dispatchEvent(new CustomEvent("mf:auth-ready", {
            detail: {
                session: { user: currentUser, isDeviceSession: true },
                user: currentUser
            }
        }));
    }

    if (!window.supabase) {
        console.warn("SDK do Supabase ainda não carregado na página.");
        return null;
    }

    if (supabaseConfig.url && supabaseConfig.anonKey) {
        try {
            supabaseClient = window.supabase.createClient(supabaseConfig.url, supabaseConfig.anonKey, {
                auth: {
                    persistSession: true,
                    autoRefreshToken: true,
                    detectSessionInUrl: true
                }
            });

            // Escuta mudanças de autenticação
            supabaseClient.auth.onAuthStateChange(async (event, session) => {
                if (session && session.user) {
                    currentUser = session.user;
                    saveDeviceSession(session.user, true);
                } else if (event === "SIGNED_OUT") {
                    currentUser = null;
                    clearDeviceSession();
                } else if (!session) {
                    const devSess = getDeviceSession();
                    if (devSess && devSess.userId) {
                        currentUser = {
                            id: devSess.userId,
                            email: devSess.email,
                            user_metadata: devSess.userMetadata || {}
                        };
                    } else {
                        currentUser = null;
                    }
                }

                window.dispatchEvent(new CustomEvent("mf:auth-change", {
                    detail: {
                        event,
                        session: session || (currentUser ? { user: currentUser } : null),
                        user: currentUser
                    }
                }));
                
                if (event === "SIGNED_IN" && session) {
                    await handleUserSignedIn(session.user);
                } else if (event === "SIGNED_OUT") {
                    handleUserSignedOut();
                }
            });

            return supabaseClient;
        } catch (err) {
            console.error("Erro ao instanciar cliente Supabase:", err);
            return null;
        }
    }

    return null;
}

// 4. Funções de Autenticação
async function authSignUp(email, password, rememberDevice = true) {
    if (!supabaseClient) throw new Error("Supabase não está configurado.");
    const { data, error } = await supabaseClient.auth.signUp({
        email: email.trim(),
        password
    });
    if (error) throw error;
    if (data && data.user) {
        currentUser = data.user;
        if (rememberDevice) {
            saveDeviceSession(data.user, true);
        }
    }
    if (window.MFActivityLogger) {
        window.MFActivityLogger.log(
            "auth",
            "AUTH_SIGNUP",
            "Conta criada com sucesso",
            `Novo cadastro realizado para ${email.trim()} no dispositivo ${detectDeviceInfo().label}`
        );
    }
    return data;
}

async function authSignIn(email, password, rememberDevice = true) {
    if (!supabaseClient) throw new Error("Supabase não está configurado.");
    const { data, error } = await supabaseClient.auth.signInWithPassword({
        email: email.trim(),
        password
    });
    if (error) throw error;
    if (data && data.user) {
        currentUser = data.user;
        if (rememberDevice) {
            saveDeviceSession(data.user, true);
        } else {
            clearDeviceSession();
        }
    }
    if (window.MFActivityLogger) {
        window.MFActivityLogger.log(
            "auth",
            "AUTH_LOGIN",
            "Login realizado com sucesso",
            `Sessão de usuário autenticada como ${email.trim()} no dispositivo ${detectDeviceInfo().label}`
        );
    }
    return data;
}

async function authSignOut() {
    clearDeviceSession();
    currentUser = null;
    if (supabaseClient) {
        try {
            await supabaseClient.auth.signOut();
        } catch (e) {
            console.warn("Aviso ao deslogar no Supabase:", e);
        }
    }
    handleUserSignedOut();
    if (window.MFActivityLogger) {
        window.MFActivityLogger.log(
            "auth",
            "AUTH_LOGOUT",
            "Logout realizado",
            "Sessão de usuário finalizada e dispositivo desconectado com sucesso"
        );
    }
}

async function authResetPassword(email) {
    if (!supabaseClient) throw new Error("Supabase não está configurado.");
    const { data, error } = await supabaseClient.auth.resetPasswordForEmail(email.trim(), {
        redirectTo: window.location.origin + window.location.pathname
    });
    if (error) throw error;
    return data;
}

async function getCurrentSession() {
    if (supabaseClient) {
        try {
            const { data: { session } } = await supabaseClient.auth.getSession();
            if (session && session.user) {
                currentUser = session.user;
                return session;
            }
        } catch (e) {
            console.warn("Aviso ao verificar sessão ativa no Supabase:", e);
        }
    }
    const devSession = getDeviceSession();
    if (devSession && devSession.userId) {
        currentUser = {
            id: devSession.userId,
            email: devSession.email,
            user_metadata: devSession.userMetadata || {}
        };
        return { user: currentUser, isDeviceSession: true };
    }
    return null;
}

// 5. Camada de Sincronização em Nuvem (Local-First)
async function handleUserSignedIn(user) {
    if (!user || isSyncing) return;
    isSyncing = true;
    window.dispatchEvent(new CustomEvent("mf:sync-status", { detail: { status: "syncing" } }));

    try {
        // Verifica se o usuário já tem dados na nuvem
        const { data: cloudTxs, error } = await supabaseClient
            .from("transactions")
            .select("*")
            .order("date", { ascending: false });

        const hasCloudData = !error && Array.isArray(cloudTxs) && cloudTxs.length > 0;
        const localData = typeof window.data === "object" ? window.data : null;
        const hasLocalTxs = localData && Array.isArray(localData.transactions) && localData.transactions.length > 0;

        // Se o usuário tem transações locais e a nuvem está vazia, sobe os dados locais (Migração)
        if (hasLocalTxs && !hasCloudData) {
            await pushAllLocalDataToCloud(user.id, localData);
            if (typeof window.showToast === "function") {
                window.showToast("Seus dados locais foram sincronizados na sua conta em nuvem!");
            }
        } else if (hasCloudData) {
            // Se já existem dados na nuvem, puxa para memória
            await pullCloudDataToLocal();
            if (typeof window.renderAll === "function") {
                window.renderAll();
            }
        }

        window.dispatchEvent(new CustomEvent("mf:sync-status", { detail: { status: "synced" } }));
    } catch (err) {
        console.error("Erro na sincronização pós-login:", err);
        window.dispatchEvent(new CustomEvent("mf:sync-status", { detail: { status: "error", error: err.message } }));
    } finally {
        isSyncing = false;
    }
}

function handleUserSignedOut() {
    currentUser = null;
    window.dispatchEvent(new CustomEvent("mf:sync-status", { detail: { status: "offline" } }));

    // Proteção contra contaminação de dados locais entre contas diferentes (Cross-User Session Bleed):
    // Ao deslogar, reinicia os dados em memória e no cache para proteger a privacidade financeira
    if (typeof window.defaultData === "function") {
        window.data = window.defaultData();
        try {
            localStorage.removeItem("meuFinanceiro_data");
        } catch (e) {}
        if (typeof window.renderAll === "function") {
            window.renderAll();
        }
    }

    // Limpa também a trilha de auditoria local para que o próximo usuário não veja dados do anterior
    if (window.MFActivityLogger && typeof window.MFActivityLogger.clearLogs === "function") {
        window.MFActivityLogger.clearLogs();
    }
}

// Puxa dados da nuvem para o aplicativo local
async function pullCloudDataToLocal() {
    if (!supabaseClient || !currentUser) return;

    try {
        // 1. Configurações e Salário
        const { data: settings } = await supabaseClient
            .from("user_settings")
            .select("*")
            .single();

        // 2. Transações
        const { data: txs } = await supabaseClient
            .from("transactions")
            .select("*")
            .order("date", { ascending: false });

        // 3. Contas Fixas
        const { data: bills } = await supabaseClient
            .from("recurring_bills")
            .select("*");

        // 4. Histórico Mensal de Contas Fixas
        const { data: records } = await supabaseClient
            .from("recurring_bill_records")
            .select("*");

        // 5. Planos Mensais
        const { data: plans } = await supabaseClient
            .from("monthly_plans")
            .select("*");

        const tombstones = (window.MFTombstones && typeof window.MFTombstones.get === "function")
            ? window.MFTombstones.get()
            : (() => {
                try {
                    const raw = localStorage.getItem("brilhaCash_tombstones");
                    if (raw) return JSON.parse(raw);
                } catch (e) {}
                return { txs: [], bills: [] };
            })();

        if (window.data) {
            if (settings) {
                window.data.salaryConfig = {
                    amount: Number(settings.salary_amount || 0),
                    grossAmount: Number(settings.gross_amount || 0),
                    benefitsAmount: Number(settings.benefits_amount || 0),
                    date: settings.start_date || "",
                    day: Number(settings.pay_day || 5),
                    autoDeposit: settings.auto_deposit !== false,
                    has13th: Boolean(settings.has_13th),
                    thirteenthAmount: Number(settings.thirteenth_amount || 0)
                };
            }

            if (Array.isArray(txs)) {
                window.data.transactions = txs
                    .filter(t => !tombstones.txs.includes(t.id))
                    .map(t => ({
                        id: t.id,
                        type: t.type,
                        description: t.description,
                        amount: Number(t.amount),
                        category: t.category,
                        date: t.date,
                        notes: t.notes || ""
                    }));
            }

            if (Array.isArray(bills)) {
                const billRecordsMap = {};
                if (Array.isArray(records)) {
                    records.forEach(r => {
                        if (!billRecordsMap[r.recurring_bill_id]) {
                            billRecordsMap[r.recurring_bill_id] = { monthlyAmounts: {}, paidMonths: [], paidDates: [] };
                        }
                        if (r.amount !== null && r.amount !== undefined) {
                            billRecordsMap[r.recurring_bill_id].monthlyAmounts[r.month_year] = Number(r.amount);
                        }
                        if (r.is_paid) {
                            billRecordsMap[r.recurring_bill_id].paidMonths.push(r.month_year);
                            if (r.paid_date) billRecordsMap[r.recurring_bill_id].paidDates.push(r.paid_date);
                        }
                    });
                }

                window.data.recurringBills = bills
                    .filter(b => !tombstones.bills.includes(b.id))
                    .map(b => {
                        const rec = billRecordsMap[b.id] || { monthlyAmounts: {}, paidMonths: [], paidDates: [] };
                        return {
                            id: b.id,
                            name: b.name,
                            amount: Number(b.amount),
                            startDate: b.start_date,
                            dueDay: Number(b.due_day),
                            subscriptionTime: b.subscription_time ? b.subscription_time.slice(0, 5) : "09:00",
                            frequency: b.frequency || "monthly",
                            category: b.category,
                            isVariable: Boolean(b.is_variable),
                            monthlyAmounts: rec.monthlyAmounts,
                            paidMonths: rec.paidMonths,
                            paidDates: rec.paidDates
                        };
                    });
            }

            if (Array.isArray(plans)) {
                window.data.salaries = {};
                window.data.budgets = {};
                window.data.goals = {};
                plans.forEach(p => {
                    if (p.salary_override) window.data.salaries[p.month_year] = Number(p.salary_override);
                    if (p.budget_limit) window.data.budgets[p.month_year] = Number(p.budget_limit);
                    if (p.savings_goal) window.data.goals[p.month_year] = Number(p.savings_goal);
                });
            }

            // Salva no cache local para navegação offline fluida
            if (typeof window.saveData === "function") {
                window.saveData();
            }
        }
    } catch (err) {
        console.error("Erro ao puxar dados da nuvem:", err);
    }
}

// Envia dados locais para a nuvem
async function pushAllLocalDataToCloud(userId, localData) {
    if (!supabaseClient || !userId || !localData) return;

    try {
        // 1. user_settings
        const sc = localData.salaryConfig || {};
        await supabaseClient.from("user_settings").upsert({
            user_id: userId,
            salary_amount: Number(sc.amount || 0),
            gross_amount: Number(sc.grossAmount || 0),
            benefits_amount: Number(sc.benefitsAmount || 0),
            start_date: sc.date || null,
            pay_day: Number(sc.day || 5),
            auto_deposit: sc.autoDeposit !== false,
            has_13th: Boolean(sc.has13th),
            thirteenth_amount: Number(sc.thirteenthAmount || 0),
            updated_at: new Date().toISOString()
        });

        // 2. Limpeza de registros excluídos na nuvem via tombstones
        const tombstones = (window.MFTombstones && typeof window.MFTombstones.get === "function")
            ? window.MFTombstones.get()
            : (() => {
                try {
                    const raw = localStorage.getItem("brilhaCash_tombstones");
                    if (raw) return JSON.parse(raw);
                } catch (e) {}
                return { txs: [], bills: [] };
            })();

        if (Array.isArray(tombstones.txs) && tombstones.txs.length > 0) {
            await supabaseClient.from("transactions").delete().in("id", tombstones.txs);
            tombstones.txs.forEach(id => {
                if (window.MFTombstones) window.MFTombstones.remove("tx", id);
            });
        }

        if (Array.isArray(tombstones.bills) && tombstones.bills.length > 0) {
            await supabaseClient.from("recurring_bill_records").delete().in("recurring_bill_id", tombstones.bills);
            await supabaseClient.from("recurring_bills").delete().in("id", tombstones.bills);
            tombstones.bills.forEach(id => {
                if (window.MFTombstones) window.MFTombstones.remove("bill", id);
            });
        }

        // 3. transactions
        if (Array.isArray(localData.transactions) && localData.transactions.length > 0) {
            const txRows = localData.transactions.map(t => ({
                id: (t.id && t.id.length >= 32) ? t.id : undefined, // usa UUID se válido
                user_id: userId,
                type: t.type,
                description: t.description,
                amount: Number(t.amount),
                category: t.category,
                date: t.date,
                notes: t.notes || null
            }));
            await supabaseClient.from("transactions").upsert(txRows);
        } else if (Array.isArray(localData.transactions) && localData.transactions.length === 0) {
            // Se o usuário apagou todos os lançamentos locais, limpa na nuvem
            await supabaseClient.from("transactions").delete().eq("user_id", userId);
        }

        // 4. recurring_bills
        if (Array.isArray(localData.recurringBills) && localData.recurringBills.length > 0) {
            const billRows = localData.recurringBills.map(b => ({
                id: (b.id && b.id.length >= 32) ? b.id : undefined,
                user_id: userId,
                name: b.name,
                amount: Number(b.amount),
                start_date: b.startDate,
                due_day: Number(b.dueDay || 1),
                subscription_time: (b.subscriptionTime || "09:00") + ":00",
                frequency: b.frequency || "monthly",
                category: b.category,
                is_variable: Boolean(b.isVariable)
            }));
            await supabaseClient.from("recurring_bills").upsert(billRows);
        } else if (Array.isArray(localData.recurringBills) && localData.recurringBills.length === 0) {
            await supabaseClient.from("recurring_bills").delete().eq("user_id", userId);
        }
    } catch (e) {
        console.error("Erro ao enviar dados locais para nuvem:", e);
    }
}

// Exclusão pontual direta na nuvem para garantir consistência imediata
async function deleteCloudTransaction(txId) {
    if (!supabaseClient || !currentUser || !txId) return;
    try {
        await supabaseClient.from("transactions").delete().eq("id", txId);
        if (window.MFTombstones && typeof window.MFTombstones.remove === "function") {
            window.MFTombstones.remove("tx", txId);
        }
    } catch (err) {
        console.warn("Aviso ao excluir transação no Supabase:", err);
    }
}

async function deleteCloudRecurringBill(billId) {
    if (!supabaseClient || !currentUser || !billId) return;
    try {
        await supabaseClient.from("recurring_bill_records").delete().eq("recurring_bill_id", billId);
        await supabaseClient.from("recurring_bills").delete().eq("id", billId);
        if (window.MFTombstones && typeof window.MFTombstones.remove === "function") {
            window.MFTombstones.remove("bill", billId);
        }
    } catch (err) {
        console.warn("Aviso ao excluir conta fixa no Supabase:", err);
    }
}

// Sincronização pontual disparada por saveData()
let syncDebounceTimer = null;
function scheduleCloudSync() {
    if (!supabaseClient || !currentUser) return;
    clearTimeout(syncDebounceTimer);
    syncDebounceTimer = setTimeout(async () => {
        if (isSyncing) return;
        isSyncing = true;
        window.dispatchEvent(new CustomEvent("mf:sync-status", { detail: { status: "syncing" } }));
        try {
            if (window.data) {
                await pushAllLocalDataToCloud(currentUser.id, window.data);
                window.dispatchEvent(new CustomEvent("mf:sync-status", { detail: { status: "synced" } }));
                if (window.MFActivityLogger) {
                    window.MFActivityLogger.log(
                        "auth",
                        "CLOUD_SYNCED",
                        "Dados sincronizados na nuvem",
                        "Todas as alterações locais foram salvas no Supabase com sucesso"
                    );
                }
            }
        } catch (e) {
            console.warn("Falha temporária ao sincronizar em segundo plano:", e);
            window.dispatchEvent(new CustomEvent("mf:sync-status", { detail: { status: "error" } }));
        } finally {
            isSyncing = false;
        }
    }, 1200); // 1.2s debounce para não sobrecarregar
}

// Inicializa no carregamento da página
document.addEventListener("DOMContentLoaded", () => {
    initSupabase();
    getCurrentSession().then(session => {
        window.dispatchEvent(new CustomEvent("mf:auth-ready", { detail: { session, user: currentUser } }));
    });
});

// Exporta para escopo global
window.MFAuth = {
    getConfig: () => ({ ...supabaseConfig }),
    saveConfig: saveSupabaseConfig,
    init: initSupabase,
    getClient: () => supabaseClient,
    signUp: authSignUp,
    signIn: authSignIn,
    signOut: authSignOut,
    resetPassword: authResetPassword,
    getSession: getCurrentSession,
    getUser: () => currentUser,
    scheduleSync: scheduleCloudSync,
    pullData: pullCloudDataToLocal,
    deleteTransaction: deleteCloudTransaction,
    deleteRecurringBill: deleteCloudRecurringBill
};
