"use strict";

const $ = (selector) => document.querySelector(selector);

const STORAGE_KEY = "meuFinanceiro.v1";

const COLORS = [
    "#9475ff", "#45d6a0", "#61a5ff", "#ff7485",
    "#f7bd62", "#46c7d9", "#ed86d1", "#a4c66b",
    "#b4a0ff", "#e99b70", "#6ca4ec", "#9ca9bd"
];

const EXPENSE_CATEGORIES = [
    { name: "Alimentação", icon: "🍽️" },
    { name: "Moradia", icon: "🏠" },
    { name: "Água e luz", icon: "💡" },
    { name: "Transporte", icon: "🚗" },
    { name: "Saúde", icon: "💊" },
    { name: "Educação", icon: "📚" },
    { name: "Lazer", icon: "🎮" },
    { name: "Compras", icon: "🛍️" },
    { name: "Assinaturas", icon: "📱" },
    { name: "Investimentos", icon: "📈" },
    { name: "Outros", icon: "📦" }
];

const INCOME_CATEGORIES = [
    { name: "Freelance / Bico", icon: "💻" },
    { name: "Vendas / Desapego", icon: "🏷️" },
    { name: "Rendimentos / Dividendos", icon: "📈" },
    { name: "Bônus / Premiação", icon: "🎁" },
    { name: "Reembolso", icon: "🔄" },
    { name: "Presente / Doação", icon: "🎉" },
    { name: "Aluguel / Locação", icon: "🔑" },
    { name: "Prestação de serviços", icon: "🛠️" },
    { name: "Outros", icon: "📦" }
];

const CATEGORY_ICONS = {
    // Categorias de Despesas
    "Alimentação": "🍽️",
    "Moradia": "🏠",
    "Água e luz": "💡",
    "Transporte": "🚗",
    "Saúde": "💊",
    "Educação": "📚",
    "Lazer": "🎮",
    "Compras": "🛍️",
    "Assinaturas": "📱",
    "Investimentos": "📈",
    // Categorias de Receitas Extras
    "Freelance / Bico": "💻",
    "Freelance": "💻",
    "Bico": "💻",
    "Vendas / Desapego": "🏷️",
    "Vendas": "🏷️",
    "Rendimentos / Dividendos": "📈",
    "Rendimentos": "📈",
    "Bônus / Premiação": "🎁",
    "Bônus": "🎁",
    "Reembolso": "🔄",
    "Presente / Doação": "🎉",
    "Presente": "🎉",
    "Aluguel / Locação": "🔑",
    "Prestação de serviços": "🛠️",
    "Serviços": "🛠️",
    "Outros": "📦"
};

const CATEGORY_OPTIONS = [
    ...EXPENSE_CATEGORIES.map((c) => c.name),
    ...INCOME_CATEGORIES.map((c) => c.name)
];

function todayISO() {
    const now = new Date();
    const local = new Date(
        now.getTime() - now.getTimezoneOffset() * 60000
    );

    return local.toISOString().slice(0, 10);
}

function toISODate(d) {
    if (!d) return todayISO();
    if (typeof d === "string") return d.slice(0, 10);
    const year = d.getFullYear();
    const month = String(d.getMonth() + 1).padStart(2, "0");
    const day = String(d.getDate()).padStart(2, "0");
    return `${year}-${month}-${day}`;
}

function yesterdayISO() {
    const now = new Date();
    now.setDate(now.getDate() - 1);
    const local = new Date(
        now.getTime() - now.getTimezoneOffset() * 60000
    );

    return local.toISOString().slice(0, 10);
}

function currentMonth() {
    return todayISO().slice(0, 7);
}

function money(value) {
    return Number(value || 0).toLocaleString("pt-BR", {
        style: "currency",
        currency: "BRL"
    });
}

function monthLabel(month) {
    const [year, number] = month.split("-").map(Number);
    const date = new Date(year, number - 1, 1, 12);

    return date.toLocaleDateString("pt-BR", {
        month: "short",
        year: "2-digit"
    }).replace(".", "");
}

function escapeHTML(value) {
    return String(value).replace(/[&<>"']/g, (char) => ({
        "&": "&amp;",
        "<": "&lt;",
        ">": "&gt;",
        '"': "&quot;",
        "'": "&#39;"
    })[char]);
}

function createId() {
    if (crypto.randomUUID) {
        return crypto.randomUUID();
    }

    return Date.now().toString(36) +
        Math.random().toString(36).slice(2);
}

function defaultData() {
    return {
        transactions: [],
        salaries: {},
        budgets: {},
        goals: {},
        recurringBills: []
    };
}

function loadData() {
    try {
        const saved = localStorage.getItem(STORAGE_KEY);

        if (!saved) {
            return defaultData();
        }

        const data = JSON.parse(saved);

        if (!data || !Array.isArray(data.transactions)) {
            throw new Error("Dados inválidos");
        }

        return {
            transactions: (data.transactions || []).filter((t) => !t.recurringBillId),
            salaries: data.salaries || {},
            budgets: data.budgets || {},
            goals: data.goals || {},
            recurringBills: Array.isArray(data.recurringBills) ? data.recurringBills : []
        };
    } catch (error) {
        console.error("Não foi possível carregar os dados:", error);

        alert(
            "Não foi possível ler os dados salvos. " +
            "Seus dados antigos não foram apagados automaticamente."
        );

        return defaultData();
    }
}

let data = loadData();
let monthlyChart = null;
let categoryChart = null;
let showAllTransactions = false;
let toastTimeout;

function saveData() {
    try {
        localStorage.setItem(STORAGE_KEY, JSON.stringify(data));
        return true;
    } catch (error) {
        console.error("Erro ao salvar:", error);

        showToast(
            "Não foi possível salvar. Exporte seus dados e verifique o espaço disponível."
        );

        return false;
    }
}

function selectedMonth() {
    const monthInput = $("#dashboardMonth");
    if (monthInput && monthInput.value) {
        const val = monthInput.value.slice(0, 7);
        sessionStorage.setItem("meuFinanceiro.month", val);
        return val;
    }
    return sessionStorage.getItem("meuFinanceiro.month") || currentMonth();
}

function selectedDate() {
    const dateInput = $("#dashboardMonth") || $("#transactionDate");
    if (dateInput && dateInput.value && dateInput.value.length === 10) {
        sessionStorage.setItem("meuFinanceiro.date", dateInput.value);
        return dateInput.value;
    }
    return sessionStorage.getItem("meuFinanceiro.date") || todayISO();
}

function transactionsForMonth(month) {
    return data.transactions.filter(
        (transaction) => transaction.date.startsWith(month)
    );
}

function transactionsForDate(date) {
    return data.transactions.filter(
        (transaction) => transaction.date === date
    );
}

function transactionsForYear(year) {
    const yearStr = String(year);
    return data.transactions.filter(
        (transaction) => transaction.date.startsWith(yearStr)
    );
}

function getPeriodSummary(periodType = "month", value = null) {
    if (periodType === "month") {
        const targetMonth = value || selectedMonth();
        return getMonthlySummary(targetMonth);
    }

    let transactions = [];
    let salaryConfig = 0;
    const currentM = selectedMonth();
    const currentD = selectedDate();

    if (periodType === "day") {
        const targetDate = value || currentD;
        transactions = transactionsForDate(targetDate).filter((t) => !t.recurringBillId);
        salaryConfig = 0;
    } else if (periodType === "year") {
        const targetYear = String(value || (currentD ? currentD.slice(0, 4) : new Date().getFullYear()));
        transactions = transactionsForYear(targetYear).filter((t) => !t.recurringBillId);
        salaryConfig = Object.entries(data.salaries)
            .filter(([m]) => m.startsWith(targetYear))
            .reduce((sum, [, val]) => sum + Number(val || 0), 0);
    } else if (periodType === "all") {
        transactions = (data.transactions || []).filter((t) => !t.recurringBillId);
        salaryConfig = Object.values(data.salaries || {}).reduce((sum, val) => sum + Number(val || 0), 0);
    }

    // Evita duplicar salário se foi lançado manualmente como 'Salário'
    const salaryFromTransactions = transactions
        .filter((t) => t.type === "receita" && t.category === "Salário")
        .reduce((sum, t) => sum + t.amount, 0);

    const otherExtraIncome = transactions
        .filter((t) => t.type === "receita" && t.category !== "Salário")
        .reduce((sum, t) => sum + t.amount, 0);

    const effectiveSalary = salaryFromTransactions > 0 ? salaryFromTransactions : salaryConfig;
    const extraIncome = otherExtraIncome;
    const income = effectiveSalary + extraIncome;

    const manualExpenses = sumTransactions(transactions, "despesa");

    // Despesas de contas fixas pagas e previstas no período
    let paidRecurringTotal = 0;
    let allRecurringTotal = 0;

    (data.recurringBills || []).forEach((b) => {
        if (periodType === "day") {
            const targetDate = value || currentD;
            const mStr = targetDate.slice(0, 7);
            const occs = getBillOccurrencesInMonth(b, mStr);
            if (occs.includes(targetDate)) {
                const amt = Number(b.amount || 0);
                allRecurringTotal += amt;
                if (isBillOccurrencePaid(b, targetDate)) {
                    paidRecurringTotal += amt;
                }
            }
        } else if (periodType === "year") {
            const targetYear = String(value || (currentD ? currentD.slice(0, 4) : new Date().getFullYear()));
            for (let mon = 1; mon <= 12; mon++) {
                const mStr = `${targetYear}-${String(mon).padStart(2, "0")}`;
                const occs = getBillOccurrencesInMonth(b, mStr);
                occs.forEach((d) => {
                    const amt = Number(b.amount || 0);
                    allRecurringTotal += amt;
                    if (isBillOccurrencePaid(b, d)) {
                        paidRecurringTotal += amt;
                    }
                });
            }
        } else if (periodType === "all") {
            (b.paidDates || []).forEach(() => {
                paidRecurringTotal += Number(b.amount || 0);
            });
            allRecurringTotal += paidRecurringTotal;
        }
    });

    const expenses = manualExpenses + paidRecurringTotal;
    const balance = income - expenses;
    const savingsRate = income > 0 ? (balance / income) * 100 : 0;

    return {
        salary: effectiveSalary,
        extraIncome,
        income,
        manualExpenses,
        paidRecurringExpenses: paidRecurringTotal,
        allRecurringExpenses: allRecurringTotal,
        pendingRecurringExpenses: Math.max(0, allRecurringTotal - paidRecurringTotal),
        expenses,
        balance,
        savingsRate,
        transactions
    };
}

function sumTransactions(transactions, type) {
    return transactions
        .filter((transaction) => transaction.type === type)
        .reduce((total, transaction) => total + transaction.amount, 0);
}

function getMonthlySummary(month) {
    const rawTransactions = transactionsForMonth(month);
    const transactions = rawTransactions.filter((t) => !t.recurringBillId);
    const salaryConfig = Number(data.salaries[month] || 0);

    // Evita o bug de duplicar o salário se o usuário lançar na categoria 'Salário' e também salvar nas Configurações
    const salaryFromTransactions = transactions
        .filter((t) => t.type === "receita" && t.category === "Salário")
        .reduce((sum, t) => sum + t.amount, 0);

    const otherExtraIncome = transactions
        .filter((t) => t.type === "receita" && t.category !== "Salário")
        .reduce((sum, t) => sum + t.amount, 0);

    const effectiveSalary = salaryFromTransactions > 0 ? salaryFromTransactions : salaryConfig;
    const extraIncome = otherExtraIncome;
    const income = effectiveSalary + extraIncome;

    // Despesas de lançamentos avulsos
    const manualExpenses = sumTransactions(transactions, "despesa");

    // Despesas de contas fixas pagas e previstas no mês
    let paidRecurringTotal = 0;
    let allRecurringTotal = 0;
    (data.recurringBills || []).forEach((b) => {
        const occs = getBillOccurrencesInMonth(b, month);
        occs.forEach((d) => {
            const amt = Number(b.amount || 0);
            allRecurringTotal += amt;
            if (isBillOccurrencePaid(b, d)) {
                paidRecurringTotal += amt;
            }
        });
    });

    const expenses = manualExpenses + paidRecurringTotal;
    const balance = income - expenses;

    return {
        salary: effectiveSalary,
        extraIncome,
        income,
        manualExpenses,
        paidRecurringExpenses: paidRecurringTotal,
        allRecurringExpenses: allRecurringTotal,
        pendingRecurringExpenses: Math.max(0, allRecurringTotal - paidRecurringTotal),
        expenses,
        balance,
        savingsRate: income > 0 ? (balance / income) * 100 : 0,
        transactions
    };
}

function showToast(message) {
    const toast = $("#toast");
    if (!toast) return;

    toast.textContent = message;
    toast.classList.add("show");

    clearTimeout(toastTimeout);

    toastTimeout = setTimeout(() => {
        toast.classList.remove("show");
    }, 3000);
}

function renderSummary() {
    const balanceElement = $("#monthBalance");
    const incomeElement = $("#monthIncome");
    const expensesElement = $("#monthExpenses");
    const savingsElement = $("#savingsRate");
    const txCountPill = $("#txCountPill");
    const incomeCountPill = $("#incomeCountPill");
    const expenseCountPill = $("#expenseCountPill");
    const savingsProgressBar = $("#savingsProgressBar");

    const m = selectedMonth();
    const summary = getMonthlySummary(m);
    const monthTx = transactionsForMonth(m).filter((t) => !t.recurringBillId);
    const incomeCount = monthTx.filter(t => t.type === "receita").length;
    const expenseCount = monthTx.filter(t => t.type === "despesa").length;

    if (balanceElement) {
        balanceElement.textContent = money(summary.balance);
        balanceElement.style.color = summary.balance < 0 ? "var(--red)" : "var(--text)";
    }
    if (incomeElement) {
        incomeElement.textContent = money(summary.income);
    }
    if (expensesElement) {
        expensesElement.textContent = money(summary.expenses);
    }
    if (savingsElement) {
        savingsElement.textContent = `${summary.savingsRate.toLocaleString("pt-BR", {
            maximumFractionDigits: 1
        })}%`;
    }
    if (txCountPill) {
        txCountPill.textContent = `${monthTx.length} lançamento${monthTx.length !== 1 ? "s" : ""}`;
    }
    if (incomeCountPill) {
        incomeCountPill.textContent = `${incomeCount} entrada${incomeCount !== 1 ? "s" : ""}`;
    }
    if (expenseCountPill) {
        expenseCountPill.textContent = `${expenseCount} saída${expenseCount !== 1 ? "s" : ""}`;
    }
    if (savingsProgressBar) {
        const clampedPct = Math.max(0, Math.min(100, summary.savingsRate));
        savingsProgressBar.style.width = `${clampedPct}%`;
    }
}

function renderMonthlyChart() {
    const canvas = $("#monthlyChart");
    if (!canvas) return;

    const labels = [];
    const incomeValues = [];
    const expenseValues = [];

    // Se estiver na página de relatórios e um período específico estiver ativo
    const isReportsPage = !!$("#reportPeriodPicker");
    const filter = isReportsPage ? getReportDateFilter() : null;

    if (isReportsPage && filter && filter.mode === "this_week") {
        const days = ["Seg", "Ter", "Qua", "Qui", "Sex", "Sáb", "Dom"];
        const d = new Date(`${selectedDate() || todayISO()}T12:00:00`);
        const dayOfWeek = (d.getDay() + 6) % 7;
        const monday = new Date(d);
        monday.setDate(d.getDate() - dayOfWeek);

        for (let i = 0; i < 7; i++) {
            const curDay = new Date(monday);
            curDay.setDate(monday.getDate() + i);
            const iso = toISODate(curDay);
            const dayNum = String(curDay.getDate()).padStart(2, "0");
            const monNum = String(curDay.getMonth() + 1).padStart(2, "0");
            labels.push(`${days[i]} ${dayNum}/${monNum}`);

            const dayTxs = (data.transactions || []).filter(t => !t.recurringBillId && t.date === iso);
            const dayInc = dayTxs.filter(t => t.type === "receita").reduce((s, t) => s + t.amount, 0);
            let dayExp = dayTxs.filter(t => t.type === "despesa").reduce((s, t) => s + t.amount, 0);

            (data.recurringBills || []).forEach(b => {
                if (isBillOccurrencePaid(b, iso)) dayExp += Number(b.amount || 0);
            });

            incomeValues.push(dayInc);
            expenseValues.push(dayExp);
        }
    } else if (isReportsPage && filter && filter.mode === "this_year") {
        const y = selectedMonth().slice(0, 4);
        const monthNames = ["Jan", "Fev", "Mar", "Abr", "Mai", "Jun", "Jul", "Ago", "Set", "Out", "Nov", "Dez"];
        for (let m = 1; m <= 12; m++) {
            const k = `${y}-${String(m).padStart(2, "0")}`;
            const sum = getMonthlySummary(k);
            labels.push(monthNames[m - 1]);
            incomeValues.push(sum.income);
            expenseValues.push(sum.expenses);
        }
    } else if (isReportsPage && filter && filter.mode === "last_2_years") {
        const [year, month] = selectedMonth().split("-").map(Number);
        for (let i = 23; i >= 0; i--) {
            const date = new Date(year, month - 1 - i, 1, 12);
            const key = [
                date.getFullYear(),
                String(date.getMonth() + 1).padStart(2, "0")
            ].join("-");
            const sum = getMonthlySummary(key);
            labels.push(monthLabel(key));
            incomeValues.push(sum.income);
            expenseValues.push(sum.expenses);
        }
    } else {
        const [year, month] = selectedMonth().split("-").map(Number);

        for (let i = 5; i >= 0; i--) {
            const date = new Date(year, month - 1 - i, 1, 12);

            const key = [
                date.getFullYear(),
                String(date.getMonth() + 1).padStart(2, "0")
            ].join("-");

            const summary = getMonthlySummary(key);

            labels.push(monthLabel(key));
            incomeValues.push(summary.income);
            expenseValues.push(summary.expenses);
        }
    }

    if (monthlyChart) {
        monthlyChart.destroy();
    }

    monthlyChart = new Chart(canvas, {
        type: "bar",

        data: {
            labels,

            datasets: [
                {
                    label: "Receitas",
                    data: incomeValues,
                    backgroundColor: "#45d6a0",
                    borderRadius: 5,
                    maxBarThickness: 24
                },
                {
                    label: "Despesas",
                    data: expenseValues,
                    backgroundColor: "#9475ff",
                    borderRadius: 5,
                    maxBarThickness: 24
                }
            ]
        },

        options: {
            responsive: true,
            maintainAspectRatio: false,

            interaction: {
                intersect: false,
                mode: "index"
            },

            plugins: {
                legend: {
                    position: "bottom",

                    labels: {
                        color: "#a4b1c5",
                        usePointStyle: true,
                        boxWidth: 8,
                        padding: 18,
                        font: {
                            size: 10
                        }
                    }
                },

                tooltip: {
                    callbacks: {
                        label: (context) =>
                            `${context.dataset.label}: ${money(context.raw)}`
                    }
                }
            },

            scales: {
                x: {
                    grid: {
                        display: false
                    },

                    ticks: {
                        color: "#92a1b8",
                        font: {
                            size: 10
                        }
                    },

                    border: {
                        display: false
                    }
                },

                y: {
                    beginAtZero: true,

                    ticks: {
                        color: "#92a1b8",

                        font: {
                            size: 9
                        },

                        callback: (value) => {
                            if (value >= 1000) {
                                return `R$ ${(value / 1000)
                                    .toLocaleString("pt-BR")} mil`;
                            }

                            return `R$ ${value}`;
                        }
                    },

                    grid: {
                        color: "#2a3850"
                    },

                    border: {
                        display: false
                    }
                }
            }
        }
    });
}

let currentReportPeriod = "this_month"; // "this_week" | "this_month" | "this_year" | "last_2_years"
let syncReportPeriodPicker = null;

function getReportDateFilter() {
    const curDate = selectedDate() || todayISO();
    const curMonth = selectedMonth() || currentMonth();
    const curYear = curMonth.slice(0, 4);

    if (currentReportPeriod === "this_week") {
        const d = new Date(`${curDate}T12:00:00`);
        const dayOfWeek = (d.getDay() + 6) % 7;
        const monday = new Date(d);
        monday.setDate(d.getDate() - dayOfWeek);
        const sunday = new Date(monday);
        sunday.setDate(monday.getDate() + 6);
        const startISO = toISODate(monday);
        const endISO = toISODate(sunday);

        return {
            mode: "this_week",
            startDate: startISO,
            endDate: endISO,
            matchesDate: (isoDate) => Boolean(isoDate && isoDate >= startISO && isoDate <= endISO),
            label: `Esta semana (${String(monday.getDate()).padStart(2, "0")}/${String(monday.getMonth() + 1).padStart(2, "0")} a ${String(sunday.getDate()).padStart(2, "0")}/${String(sunday.getMonth() + 1).padStart(2, "0")})`,
            periodTitle: "da semana"
        };
    } else if (currentReportPeriod === "this_year") {
        return {
            mode: "this_year",
            year: curYear,
            matchesDate: (isoDate) => Boolean(isoDate && isoDate.startsWith(curYear)),
            label: `Ano de ${curYear}`,
            periodTitle: "do ano"
        };
    } else if (currentReportPeriod === "last_2_years") {
        const y = parseInt(curYear, 10);
        const y1 = String(y - 1);
        const y2 = String(y);
        return {
            mode: "last_2_years",
            years: [y1, y2],
            matchesDate: (isoDate) => Boolean(isoDate && (isoDate.startsWith(y1) || isoDate.startsWith(y2))),
            label: `Últimos 2 anos (${y1} - ${y2})`,
            periodTitle: "dos últimos 2 anos"
        };
    } else {
        return {
            mode: "this_month",
            month: curMonth,
            matchesDate: (isoDate) => Boolean(isoDate && isoDate.startsWith(curMonth)),
            label: monthLabel(curMonth),
            periodTitle: "do mês"
        };
    }
}

function setupReportPeriodPicker() {
    const picker = $("#reportPeriodPicker");
    const button = $("#reportPeriodPickerButton");
    const options = $("#reportPeriodOptions");
    const select = $("#reportPeriodSelect");
    const label = $("#reportPeriodPickerLabel");

    if (!picker || !button || !options || !select || !label) {
        return;
    }

    function closeDrawer() {
        picker.classList.remove("open");
        button.setAttribute("aria-expanded", "false");
    }

    function openDrawer() {
        picker.classList.add("open");
        button.setAttribute("aria-expanded", "true");
    }

    function sync(val) {
        const targetVal = val || select.value || "this_month";
        currentReportPeriod = targetVal;
        select.value = targetVal;

        const option = [...select.options].find((item) => item.value === targetVal);
        if (option) {
            label.textContent = option.textContent;
        }

        options.querySelectorAll(".category-option").forEach((btn) => {
            const isSelected = btn.dataset.value === targetVal;
            btn.classList.toggle("selected", isSelected);
            btn.setAttribute("aria-selected", String(isSelected));
        });
    }

    syncReportPeriodPicker = sync;
    sync(currentReportPeriod);

    button.addEventListener("click", (e) => {
        e.stopPropagation();
        if (picker.classList.contains("open")) {
            closeDrawer();
        } else {
            openDrawer();
        }
    });

    options.addEventListener("click", (e) => {
        const optBtn = e.target.closest(".category-option");
        if (!optBtn) return;
        const val = optBtn.dataset.value;
        sync(val);
        closeDrawer();
        renderReports();
        renderMonthlyChart();
        renderCategoryChart();
    });

    document.addEventListener("click", (e) => {
        if (!picker.contains(e.target)) {
            closeDrawer();
        }
    });

    document.addEventListener("keydown", (e) => {
        if (e.key === "Escape" && picker.classList.contains("open")) {
            closeDrawer();
            button.focus();
        }
    });
}

let currentReportFilter = "all"; // "all" | "lancamentos" | "contas-fixas"

function setReportFilter(filter) {
    currentReportFilter = filter;
    document.querySelectorAll(".report-filter-btn").forEach((btn) => {
        const isActive = btn.dataset.reportFilter === filter;
        btn.classList.toggle("active", isActive);
        btn.setAttribute("aria-selected", String(isActive));
    });
    renderCategoryChart();
    renderReports();
}

function renderCategoryChart() {
    const canvas = $("#categoryChart");
    const legend = $("#categoryLegend");
    if (!canvas) return;

    const isReportsPage = !!$("#reportPeriodPicker");
    const filter = isReportsPage ? getReportDateFilter() : null;
    const mStr = selectedMonth();
    const totals = {};

    // 1. Lançamentos manuais de despesa (se não estiver filtrado apenas para contas fixas)
    if (currentReportFilter !== "contas-fixas") {
        const manualExpenses = (data.transactions || [])
            .filter((t) => t.type === "despesa" && !t.recurringBillId && (filter ? filter.matchesDate(t.date) : t.date.startsWith(mStr)));
        manualExpenses.forEach((t) => {
            totals[t.category] = (totals[t.category] || 0) + Number(t.amount || 0);
        });
    }

    // 2. Contas fixas (se não estiver filtrado apenas para lançamentos)
    if (currentReportFilter !== "lancamentos") {
        (data.recurringBills || []).forEach((b) => {
            if (filter && (filter.mode === "this_year" || filter.mode === "last_2_years")) {
                const y = parseInt(mStr.slice(0, 4), 10);
                const years = filter.mode === "this_year" ? [y] : [y - 1, y];
                years.forEach(yr => {
                    for (let m = 1; m <= 12; m++) {
                        const k = `${yr}-${String(m).padStart(2, "0")}`;
                        getBillOccurrencesInMonth(b, k).forEach(d => {
                            if (isBillOccurrencePaid(b, d) || currentReportFilter === "contas-fixas") {
                                const cat = b.category || "Assinaturas";
                                totals[cat] = (totals[cat] || 0) + Number(b.amount || 0);
                            }
                        });
                    }
                });
            } else if (filter && filter.mode === "this_week") {
                getBillOccurrencesInMonth(b, mStr).forEach(d => {
                    if (filter.matchesDate(d) && (isBillOccurrencePaid(b, d) || currentReportFilter === "contas-fixas")) {
                        const cat = b.category || "Assinaturas";
                        totals[cat] = (totals[cat] || 0) + Number(b.amount || 0);
                    }
                });
            } else {
                const occs = getBillOccurrencesInMonth(b, mStr);
                occs.forEach((d) => {
                    const isPaid = isBillOccurrencePaid(b, d);
                    const shouldInclude = (currentReportFilter === "contas-fixas") ? true : isPaid;
                    if (shouldInclude) {
                        const cat = b.category || "Assinaturas";
                        totals[cat] = (totals[cat] || 0) + Number(b.amount || 0);
                    }
                });
            }
        });
    }

    const entries = Object.entries(totals)
        .sort((a, b) => b[1] - a[1]);

    const labels = entries.map(([category]) => category);
    const values = entries.map(([, value]) => value);

    if (categoryChart) {
        categoryChart.destroy();
    }

    categoryChart = new Chart(canvas, {
        type: "doughnut",

        data: {
            labels,

            datasets: [{
                data: values,

                backgroundColor: labels.map(
                    (_, index) => COLORS[index % COLORS.length]
                ),

                borderColor: "#182438",
                borderWidth: 4,
                hoverOffset: 5
            }]
        },

        options: {
            responsive: true,
            maintainAspectRatio: false,
            cutout: "70%",

            plugins: {
                legend: {
                    display: false
                },

                tooltip: {
                    callbacks: {
                        label: (context) =>
                            `${context.label}: ${money(context.raw)}`
                    }
                }
            }
        }
    });

    if (!legend) return;

    if (!entries.length) {
        legend.innerHTML =
            '<p class="empty-state">Adicione despesas para visualizar suas categorias.</p>';

        return;
    }

    const total = values.reduce((sum, value) => sum + value, 0);

    legend.innerHTML = entries.map(([category, value], index) => `
        <div class="legend-row">
            <span class="legend-dot"
                style="background:${COLORS[index % COLORS.length]}"></span>

            <span class="legend-name">${escapeHTML(category)}</span>

            <span class="legend-value">${money(value)}</span>

            <span class="legend-name">
                ${total ? (value / total * 100).toLocaleString("pt-BR", {
                    maximumFractionDigits: 1
                }) : 0}%
            </span>
        </div>
    `).join("");
}

function formatDate(dateString) {
    if (!dateString || typeof dateString !== "string") return "";
    const parts = dateString.split("-").map(Number);
    if (parts.length < 3) return dateString;
    const [year, month, day] = parts;

    return new Date(year, month - 1, day, 12)
        .toLocaleDateString("pt-BR");
}

function renderTransactions() {
    const list = $("#transactionList");
    if (!list) return;

    const searchInput = $("#searchTransactions");
    const search = searchInput ? searchInput.value.trim().toLocaleLowerCase("pt-BR") : "";

    const typeFilter = $("#typeFilter");
    const type = typeFilter ? typeFilter.value : "todos";

    // Se estiver na Visão Geral (dashboard), limita automaticamente aos lançamentos mais recentes
    const isDashboard = !$("#searchTransactions");

    const filtered = [...data.transactions]
        .filter((transaction) => {
            const matchesSearch = [
                transaction.description,
                transaction.category,
                transaction.notes || ""
            ]
                .join(" ")
                .toLocaleLowerCase("pt-BR")
                .includes(search);

            const matchesType =
                type === "todos" || transaction.type === type;

            return matchesSearch && matchesType;
        })
        .sort((a, b) => {
            return b.date.localeCompare(a.date) ||
                b.id.localeCompare(a.id);
        });

    const maxItems = isDashboard ? 4 : (showAllTransactions ? filtered.length : 6);
    const visible = filtered.slice(0, maxItems);

    if (!visible.length) {
        list.innerHTML = `
            <div class="empty-state">
                <div style="font-size:30px;margin-bottom:8px">🧾</div>
                <p>Nenhum lançamento encontrado.</p>
                <p>${isDashboard ? '<a href="lancamentos.html" class="text-button">+ Fazer lançamento</a>' : 'Adicione uma movimentação ou altere sua busca.'}</p>
            </div>
        `;
    } else {
        list.innerHTML = visible.map((transaction) => {
            const isIncome = transaction.type === "receita";
            const icon = CATEGORY_ICONS[transaction.category] || "📦";

            return `
                <div class="transaction-item">
                    <div class="transaction-icon">${icon}</div>

                    <div class="transaction-info">
                        <h3>${escapeHTML(transaction.description)}</h3>

                        <p>
                            ${escapeHTML(transaction.category)} ·
                            ${formatDate(transaction.date)}
                        </p>
                    </div>

                    <div class="transaction-right">
                        <div class="transaction-amount ${
                            isIncome ? "income-text" : "expense-text"
                        }">
                            ${isIncome ? "+" : "−"}${money(transaction.amount)}
                        </div>

                        <div class="transaction-actions">
                            <button
                                type="button"
                                class="mini-button"
                                data-action="edit"
                                data-id="${escapeHTML(transaction.id)}">
                                Editar
                            </button>

                            <button
                                type="button"
                                class="mini-button"
                                data-action="delete"
                                data-id="${escapeHTML(transaction.id)}">
                                Excluir
                            </button>
                        </div>
                    </div>
                </div>
            `;
        }).join("");
    }

    const countElem = $("#transactionCount");
    if (countElem) {
        countElem.textContent = `${filtered.length} lançamento${filtered.length === 1 ? "" : "s"}`;
    }

    const showAllBtn = $("#showAllBtn");
    if (showAllBtn) {
        showAllBtn.textContent = showAllTransactions
            ? "Mostrar menos"
            : "Ver todos";

        showAllBtn.classList.toggle("hidden", filtered.length <= 6);
    }
}

function renderPlanning() {
    const budgetInput = $("#budget");
    if (!budgetInput) return;

    const month = selectedMonth();
    const summary = getMonthlySummary(month);

    const budget = Number(data.budgets[month] || 0);
    const spent = summary.expenses;

    budgetInput.value = budget || "";

    const budgetPercent = budget > 0 ? spent / budget * 100 : 0;

    const budgetProgress = $("#budgetProgress");
    if (budgetProgress) {
        budgetProgress.style.width = `${Math.min(100, budgetPercent)}%`;
        budgetProgress.style.background =
            budget > 0 && spent > budget ? "var(--red)" : "var(--purple)";
    }

    const budgetStatus = $("#budgetStatus");
    if (budgetStatus) {
        if (!budget) {
            budgetStatus.textContent = "Nenhum limite definido.";
        } else if (spent > budget) {
            budgetStatus.textContent =
                `Você ultrapassou o limite em ${money(spent - budget)}.`;
        } else {
            budgetStatus.textContent =
                `${money(budget - spent)} disponíveis de ${money(budget)} (${budgetPercent.toLocaleString("pt-BR", {
                    maximumFractionDigits: 1
                })}% utilizado).`;
        }
    }

    const goalInput = $("#goal");
    if (goalInput) {
        const goal = Number(data.goals[month] || 0);
        goalInput.value = goal || "";

        const saved = Math.max(0, summary.balance);
        const goalPercent = goal > 0 ? saved / goal * 100 : 0;

        const goalProgress = $("#goalProgress");
        if (goalProgress) {
            goalProgress.style.width = `${Math.min(100, goalPercent)}%`;
        }

        const goalStatus = $("#goalStatus");
        if (goalStatus) {
            if (!goal) {
                goalStatus.textContent = "Nenhuma meta definida.";
            } else if (saved >= goal) {
                goalStatus.textContent =
                    `Parabéns! Sua meta de ${money(goal)} foi alcançada.`;
            } else {
                goalStatus.textContent =
                    `Faltam ${money(goal - saved)} para sua meta de ${money(goal)}.`;
            }
        }
    }
}

function renderSettings() {
    const salaryInput = $("#salary");
    if (salaryInput) {
        salaryInput.value = data.salaries[selectedMonth()] || "";
    }
}

/* =========================================
   CONTAS FIXAS E ASSINATURAS RECORRENTES
========================================= */

const FREQUENCY_LABELS = {
    weekly: "Semanal",
    biweekly: "Quinzenal",
    monthly: "Mensal",
    bimonthly: "Bimestral",
    quarterly: "Trimestral",
    semiannual: "Semestral",
    annual: "Anual"
};

function getFrequencyLabel(freq) {
    return FREQUENCY_LABELS[freq] || "Mensal";
}

function addCycleToDate(isoDate, frequency, step = 1) {
    if (!isoDate) return todayISO();
    const [y, m, d] = isoDate.split("-").map(Number);
    if (frequency === "weekly") {
        const dt = new Date(Date.UTC(y, m - 1, d + 7 * step));
        return dt.toISOString().slice(0, 10);
    }
    if (frequency === "biweekly") {
        const dt = new Date(Date.UTC(y, m - 1, d + 14 * step));
        return dt.toISOString().slice(0, 10);
    }
    let monthsToAdd = 1;
    if (frequency === "bimonthly") monthsToAdd = 2;
    else if (frequency === "quarterly") monthsToAdd = 3;
    else if (frequency === "semiannual") monthsToAdd = 6;
    else if (frequency === "annual") monthsToAdd = 12;

    monthsToAdd *= step;
    let newYear = y;
    let newMonth = m - 1 + monthsToAdd;
    newYear += Math.floor(newMonth / 12);
    newMonth = ((newMonth % 12) + 12) % 12;

    const maxDays = new Date(Date.UTC(newYear, newMonth + 1, 0)).getUTCDate();
    const newDay = Math.min(d, maxDays);
    return `${newYear}-${String(newMonth + 1).padStart(2, "0")}-${String(newDay).padStart(2, "0")}`;
}

function isBillOccurrencePaid(bill, dateStr) {
    if (!dateStr) return false;
    if (Array.isArray(bill.paidDates) && bill.paidDates.includes(dateStr)) {
        return true;
    }
    const month = dateStr.slice(0, 7);
    if ((!bill.frequency || bill.frequency === "monthly") && Array.isArray(bill.paidMonths) && bill.paidMonths.includes(month)) {
        return true;
    }
    return false;
}

function getBillOccurrencesInMonth(bill, monthStr) {
    const [targetY, targetM] = monthStr.split("-").map(Number);
    const startStr = bill.startDate || `${monthStr.slice(0, 4)}-01-${String(bill.dueDay || 1).padStart(2, "0")}`;
    const frequency = bill.frequency || "monthly";
    const daysInMonth = new Date(targetY, targetM, 0).getDate();
    const monthStartStr = `${monthStr}-01`;
    const monthEndStr = `${monthStr}-${String(daysInMonth).padStart(2, "0")}`;

    if (frequency === "monthly") {
        if (startStr.slice(0, 7) > monthStr) return [];
        const rawDay = bill.dueDay || parseInt(startStr.slice(8, 10), 10) || 1;
        const effectiveDay = Math.min(Math.max(1, rawDay), daysInMonth);
        return [`${monthStr}-${String(effectiveDay).padStart(2, "0")}`];
    }

    if (frequency === "weekly" || frequency === "biweekly") {
        const stepDays = frequency === "weekly" ? 7 : 14;
        const occurrences = [];
        let [sY, sM, sD] = startStr.split("-").map(Number);
        let curr = new Date(sY, sM - 1, sD, 12, 0, 0);
        const monthStart = new Date(targetY, targetM - 1, 1, 0, 0, 0);
        const monthEnd = new Date(targetY, targetM - 1, daysInMonth, 23, 59, 59);

        if (curr > monthEnd) return [];

        if (curr < monthStart) {
            const diffMs = monthStart.getTime() - curr.getTime();
            const diffDays = Math.floor(diffMs / 86400000);
            const steps = Math.floor(diffDays / stepDays);
            curr.setDate(curr.getDate() + steps * stepDays);
            while (curr < monthStart) {
                curr.setDate(curr.getDate() + stepDays);
            }
        }

        while (curr <= monthEnd) {
            const y = curr.getFullYear();
            const m = String(curr.getMonth() + 1).padStart(2, "0");
            const d = String(curr.getDate()).padStart(2, "0");
            occurrences.push(`${y}-${m}-${d}`);
            curr.setDate(curr.getDate() + stepDays);
        }

        return occurrences;
    }

    let interval = 1;
    if (frequency === "bimonthly") interval = 2;
    else if (frequency === "quarterly") interval = 3;
    else if (frequency === "semiannual") interval = 6;
    else if (frequency === "annual") interval = 12;

    const [sY, sM, sD] = startStr.split("-").map(Number);
    const monthsDiff = (targetY - sY) * 12 + (targetM - sM);
    if (monthsDiff < 0 || monthsDiff % interval !== 0) {
        return [];
    }

    const effectiveDay = Math.min(sD, daysInMonth);
    return [`${monthStr}-${String(effectiveDay).padStart(2, "0")}`];
}

function getNextUnpaidOccurrence(bill) {
    const today = todayISO();
    const frequency = bill.frequency || "monthly";
    let curr = bill.startDate || `${today.slice(0, 4)}-01-${String(bill.dueDay || 1).padStart(2, "0")}`;

    for (let i = 0; i < 300; i++) {
        if (!isBillOccurrencePaid(bill, curr)) {
            return curr;
        }
        curr = addCycleToDate(curr, frequency, 1);
    }
    return curr;
}

function getRecurringBillStatus(bill, month) {
    const occurrences = getBillOccurrencesInMonth(bill, month);
    const today = todayISO();

    if (occurrences.length === 0) {
        const nextOcc = getNextUnpaidOccurrence(bill);
        return {
            status: "pending",
            label: `Próximo: ${formatDate(nextOcc)}`,
            className: "status-pending",
            icon: "📅",
            isPaid: false,
            nextDueDate: nextOcc
        };
    }

    const unpaid = occurrences.filter((d) => !isBillOccurrencePaid(bill, d));
    const paid = occurrences.filter((d) => isBillOccurrencePaid(bill, d));

    if (unpaid.length === 0) {
        const lastPaid = paid[paid.length - 1];
        const nextAfterMonth = addCycleToDate(lastPaid, bill.frequency || "monthly", 1);
        return {
            status: "paid",
            label: `Paga (${formatDate(lastPaid)})`,
            className: "status-paid",
            icon: "✓",
            isPaid: true,
            lastPaidDate: lastPaid,
            nextDueDate: nextAfterMonth
        };
    }

    const nextTarget = unpaid[0];
    const targetDateObj = new Date(nextTarget + "T12:00:00");
    const todayDateObj = new Date(today + "T12:00:00");
    const diffDays = Math.round((targetDateObj - todayDateObj) / 86400000);

    if (nextTarget < today) {
        return {
            status: "overdue",
            label: `Venceu dia ${formatDate(nextTarget)}`,
            className: "status-overdue",
            icon: "⚠️",
            isPaid: false,
            nextDueDate: nextTarget
        };
    } else if (nextTarget === today) {
        return {
            status: "today",
            label: `Vence Hoje! (${formatDate(nextTarget)})`,
            className: "status-today",
            icon: "🚨",
            isPaid: false,
            nextDueDate: nextTarget
        };
    } else if (diffDays <= 3) {
        return {
            status: "soon",
            label: `Vence em ${diffDays} ${diffDays === 1 ? "dia" : "dias"} (${formatDate(nextTarget)})`,
            className: "status-soon",
            icon: "⏳",
            isPaid: false,
            nextDueDate: nextTarget
        };
    } else {
        return {
            status: "pending",
            label: `Vence dia ${formatDate(nextTarget)}`,
            className: "status-pending",
            icon: "📅",
            isPaid: false,
            nextDueDate: nextTarget
        };
    }
}

function payRecurringBill(billId, targetDate) {
    const bill = (data.recurringBills || []).find((b) => b.id === billId);
    if (!bill) return;

    if (!Array.isArray(bill.paidDates)) {
        bill.paidDates = [];
    }
    if (!Array.isArray(bill.paidMonths)) {
        bill.paidMonths = [];
    }

    const dateToPay = targetDate || getNextUnpaidOccurrence(bill);
    if (!dateToPay) return;

    if (isBillOccurrencePaid(bill, dateToPay)) {
        showToast(`O vencimento de ${formatDate(dateToPay)} da conta "${bill.name}" já está marcado como pago.`);
        return;
    }

    bill.paidDates.push(dateToPay);
    const mStr = dateToPay.slice(0, 7);
    if (!bill.paidMonths.includes(mStr)) {
        bill.paidMonths.push(mStr);
    }

    saveData();
    showToast(`Conta "${bill.name}" marcada como paga para ${formatDate(dateToPay)}!`);
    renderAll();
}

function unpayRecurringBill(billId, targetDate) {
    const bill = (data.recurringBills || []).find((b) => b.id === billId);
    if (!bill) return;

    const dateToUnpay = targetDate || (Array.isArray(bill.paidDates) && bill.paidDates.length ? bill.paidDates[bill.paidDates.length - 1] : null);
    const mStr = dateToUnpay ? dateToUnpay.slice(0, 7) : selectedMonth();

    if (Array.isArray(bill.paidDates) && dateToUnpay) {
        bill.paidDates = bill.paidDates.filter((d) => d !== dateToUnpay);
    }
    if (Array.isArray(bill.paidMonths)) {
        const stillHasPaidInMonth = (bill.paidDates || []).some((d) => d.startsWith(mStr));
        if (!stillHasPaidInMonth) {
            bill.paidMonths = bill.paidMonths.filter((m) => m !== mStr);
        }
    }

    saveData();
    showToast(`Pagamento de "${bill.name}" desmarcado.`);
    renderAll();
}

async function deleteRecurringBill(billId) {
    const bill = (data.recurringBills || []).find((b) => b.id === billId);
    if (!bill) return;

    const confirmed = await showConfirmDialog({
        title: "Excluir conta fixa?",
        message: `Tem certeza de que deseja remover "${bill.name}" das suas contas fixas?`,
        confirmLabel: "Excluir conta"
    });

    if (!confirmed) return;

    data.recurringBills = (data.recurringBills || []).filter((b) => b.id !== billId);
    saveData();
    showToast("Conta fixa excluída com sucesso.");
    renderAll();
}

function renderRecurringBills() {
    const listEl = $("#recurringBillsList");
    const month = selectedMonth();
    const bills = data.recurringBills || [];

    let totalAmount = 0;
    let paidAmount = 0;
    let paidCount = 0;
    let occurrencesCount = 0;

    bills.forEach((b) => {
        const occs = getBillOccurrencesInMonth(b, month);
        const amt = Number(b.amount) || 0;
        occs.forEach((occDate) => {
            occurrencesCount++;
            totalAmount += amt;
            if (isBillOccurrencePaid(b, occDate)) {
                paidAmount += amt;
                paidCount++;
            }
        });
    });

    const pendingAmount = Math.max(0, totalAmount - paidAmount);
    const pendingCount = Math.max(0, occurrencesCount - paidCount);

    const kpiTotal = $("#recurringKpiTotal");
    const kpiPaid = $("#recurringKpiPaid");
    const kpiPending = $("#recurringKpiPending");
    const kpiCount = $("#recurringKpiCount");
    const kpiPaidCount = $("#recurringKpiPaidCount");
    const kpiPendingCount = $("#recurringKpiPendingCount");

    if (kpiTotal) kpiTotal.textContent = money(totalAmount);
    if (kpiPaid) kpiPaid.textContent = money(paidAmount);
    if (kpiPending) kpiPending.textContent = money(pendingAmount);
    if (kpiCount) kpiCount.textContent = `${bills.length} ${bills.length === 1 ? "cadastrada" : "cadastradas"}`;
    if (kpiPaidCount) kpiPaidCount.textContent = `${paidCount} ${paidCount === 1 ? "paga" : "pagas"}`;
    if (kpiPendingCount) kpiPendingCount.textContent = `${pendingCount} ${pendingCount === 1 ? "pendente" : "pendentes"}`;

    const progressPct = occurrencesCount > 0 ? Math.round((paidCount / occurrencesCount) * 100) : (bills.length > 0 ? 100 : 0);
    const progressPctEl = $("#recurringProgressPct");
    const progressBarEl = $("#recurringProgressBar");
    if (progressPctEl) progressPctEl.textContent = `${progressPct}% concluído (${paidCount}/${occurrencesCount} pagas)`;
    if (progressBarEl) progressBarEl.style.width = `${progressPct}%`;

    if (listEl) {
        if (!bills.length) {
            listEl.innerHTML = `
                <div class="empty-state" style="grid-column: 1 / -1; padding: 32px 16px;">
                    <p>Nenhuma conta fixa ou assinatura cadastrada ainda.</p>
                    <p style="font-size: 13px; color: var(--muted); margin-top: 4px;">Cadastre seu aluguel, internet, contas de consumo e assinaturas para controlar o vencimento e pagar em 1 clique!</p>
                    <button type="button" class="button button-primary" id="btnEmptyAddRecurring" style="margin-top: 14px;">
                        + Cadastrar primeira conta fixa
                    </button>
                </div>
            `;
            const btnEmpty = $("#btnEmptyAddRecurring");
            if (btnEmpty) {
                btnEmpty.addEventListener("click", () => {
                    const form = $("#recurringForm");
                    if (form) {
                        form.classList.remove("hidden");
                        const nameInput = $("#recurringName");
                        if (nameInput) nameInput.focus();
                        const dateInput = $("#recurringDate");
                        if (dateInput && !dateInput.value) dateInput.value = todayISO();
                        syncDatePicker();
                    }
                });
            }
        } else {
            const sorted = [...bills].sort((a, b) => (a.dueDay || 1) - (b.dueDay || 1));

            listEl.innerHTML = sorted.map((bill) => {
                const statusInfo = getRecurringBillStatus(bill, month);
                const icon = CATEGORY_ICONS[bill.category] || "📄";
                const freqName = getFrequencyLabel(bill.frequency);
                const targetDueFormatted = statusInfo.nextDueDate ? formatDate(statusInfo.nextDueDate) : `Dia ${bill.dueDay}`;

                return `
                    <article class="recurring-card ${statusInfo.isPaid ? "paid" : ""}">
                        <div class="recurring-card-top">
                            <div class="recurring-card-identity">
                                <div class="recurring-card-icon">${icon}</div>
                                <div class="recurring-card-title">
                                    <h4>${escapeHTML(bill.name)}</h4>
                                    <span style="display: flex; align-items: center; gap: 6px; margin-top: 2px;">
                                        <span>${icon} ${escapeHTML(bill.category)}</span>
                                        <span class="recurring-frequency-badge">${freqName}</span>
                                    </span>
                                </div>
                            </div>
                            <div class="recurring-card-amount">
                                <strong>${money(bill.amount)}</strong>
                                <span class="recurring-due-tag">Vence: ${targetDueFormatted}</span>
                            </div>
                        </div>

                        <div>
                            <span class="recurring-status-badge ${statusInfo.className}">
                                <span>${statusInfo.icon}</span>
                                <span>${statusInfo.label}</span>
                            </span>
                        </div>

                        <div class="recurring-card-footer">
                            <div>
                                ${statusInfo.isPaid ? `
                                    <button type="button" class="btn-unpay-recurring" data-action="unpay-recurring" data-id="${bill.id}" data-date="${statusInfo.lastPaidDate || ""}" title="Desmarcar pagamento desta conta">
                                        Desmarcar pagamento
                                    </button>
                                ` : `
                                    <button type="button" class="btn-pay-recurring" data-action="pay-recurring" data-id="${bill.id}" data-date="${statusInfo.nextDueDate || ""}">
                                        ✓ Pagar (${targetDueFormatted})
                                    </button>
                                `}
                            </div>
                            <button type="button" class="btn-delete-recurring" data-action="delete-recurring" data-id="${bill.id}" title="Excluir conta fixa">
                                🗑️
                            </button>
                        </div>
                    </article>
                `;
            }).join("");
        }
    }

    renderRecurringRowsList();
}

function renderRecurringRowsList() {
    const containers = document.querySelectorAll("#recurringBillsRowsList, #indexRecurringBillsList, #historyRecurringBillsList, .recurring-rows-list");
    if (!containers.length) return;

    const month = selectedMonth();
    const bills = data.recurringBills || [];
    const searchInput = document.querySelector("#searchRecurringRows, .search-recurring-input");
    const query = searchInput ? searchInput.value.trim().toLocaleLowerCase("pt-BR") : "";

    const filtered = bills.filter((b) => {
        if (!query) return true;
        const text = [
            b.name || "",
            b.category || "",
            getFrequencyLabel(b.frequency) || ""
        ].join(" ").toLocaleLowerCase("pt-BR");
        return text.includes(query);
    });

    const sorted = [...filtered].sort((a, b) => (a.dueDay || 1) - (b.dueDay || 1));

    containers.forEach((container) => {
        const isDashboard = container.id === "indexRecurringBillsList";
        const visibleBills = isDashboard ? sorted.slice(0, 4) : sorted;

        if (!visibleBills.length) {
            container.innerHTML = `
                <div class="empty-state" style="padding: 24px 16px;">
                    <div style="font-size: 26px; margin-bottom: 6px;">📋</div>
                    <p style="font-size: 13px; margin: 0;">Nenhuma conta fixa ou assinatura ${query ? "encontrada" : "cadastrada para este período"}.</p>
                    <p style="font-size: 12px; color: var(--muted); margin-top: 4px;">
                        ${bills.length === 0 ? '<a href="contas-fixas.html" class="text-button">+ Cadastrar conta fixa</a>' : 'Altere sua busca para ver outros itens.'}
                    </p>
                </div>
            `;
            return;
        }

        container.innerHTML = visibleBills.map((bill) => {
            const statusInfo = getRecurringBillStatus(bill, month);
            const icon = CATEGORY_ICONS[bill.category] || "📄";
            const freqName = getFrequencyLabel(bill.frequency);
            const targetDueFormatted = statusInfo.nextDueDate ? formatDate(statusInfo.nextDueDate) : `Dia ${bill.dueDay}`;

            return `
                <div class="transaction-item recurring-row-item ${statusInfo.isPaid ? "paid" : ""}">
                    <div class="transaction-icon">${icon}</div>

                    <div class="transaction-info">
                        <div style="display: flex; align-items: center; gap: 8px; flex-wrap: wrap;">
                            <h3 style="margin: 0; font-size: 13px; font-weight: 600;">${escapeHTML(bill.name)}</h3>
                            <span class="recurring-status-badge ${statusInfo.className}" style="font-size: 10px; padding: 2px 7px;">
                                <span>${statusInfo.icon}</span>
                                <span>${statusInfo.label}</span>
                            </span>
                        </div>

                        <p style="display: flex; align-items: center; gap: 6px; flex-wrap: wrap; margin-top: 4px; font-size: 11px; color: var(--muted);">
                            <span>${escapeHTML(bill.category)}</span>
                            <span>·</span>
                            <span class="recurring-frequency-badge" style="font-size: 10px; padding: 1px 6px;">${freqName}</span>
                            <span>·</span>
                            <span>Vence: <strong style="color: var(--text);">${targetDueFormatted}</strong></span>
                        </p>
                    </div>

                    <div class="transaction-right">
                        <div class="transaction-amount expense-text" style="font-size: 13px; font-weight: 700;">
                            −${money(bill.amount)}
                        </div>

                        <div class="transaction-actions" style="margin-top: 5px;">
                            ${statusInfo.isPaid ? `
                                <button
                                    type="button"
                                    class="mini-button btn-unpay-recurring"
                                    data-action="unpay-recurring"
                                    data-id="${bill.id}"
                                    data-date="${statusInfo.lastPaidDate || ""}"
                                    title="Desmarcar pagamento desta conta">
                                    Desmarcar
                                </button>
                            ` : `
                                <button
                                    type="button"
                                    class="mini-button btn-pay-recurring"
                                    data-action="pay-recurring"
                                    data-id="${bill.id}"
                                    data-date="${statusInfo.nextDueDate || ""}"
                                    title="Pagar conta">
                                    ✓ Pagar
                                </button>
                            `}

                            <button
                                type="button"
                                class="mini-button btn-delete-recurring"
                                data-action="delete-recurring"
                                data-id="${bill.id}"
                                title="Excluir conta fixa">
                                Excluir
                            </button>
                        </div>
                    </div>
                </div>
            `;
        }).join("");
    });
}

function renderRecurringAlertBanner() {
    const banner = $("#recurringAlertBanner");
    if (!banner) return;

    const bills = data.recurringBills || [];
    if (!bills.length) {
        banner.classList.add("hidden");
        return;
    }

    const month = selectedMonth();
    let pendingCount = 0;
    let pendingTotal = 0;

    bills.forEach((b) => {
        const occs = getBillOccurrencesInMonth(b, month);
        occs.forEach((d) => {
            if (!isBillOccurrencePaid(b, d)) {
                pendingCount++;
                pendingTotal += Number(b.amount || 0);
            }
        });
    });

    banner.classList.remove("hidden");

    if (pendingCount > 0) {
        banner.classList.remove("all-paid");
        banner.innerHTML = `
            <div class="recurring-alert-content">
                <span class="recurring-alert-icon">🔔</span>
                <div>
                    <strong>Contas do mês a pagar:</strong> Você tem ${pendingCount} ${pendingCount === 1 ? "vencimento pendente" : "vencimentos pendentes"} somando ${money(pendingTotal)}.
                </div>
            </div>
            <a href="contas-fixas.html" class="recurring-alert-btn">Ver contas fixas →</a>
        `;
    } else {
        banner.classList.add("all-paid");
        banner.innerHTML = `
            <div class="recurring-alert-content">
                <span class="recurring-alert-icon">🎉</span>
                <div>
                    <strong>Tudo em dia!</strong> Todas as suas contas fixas deste mês (${bills.length}) estão pagas.
                </div>
            </div>
            <a href="contas-fixas.html" class="recurring-alert-btn">Gerenciar contas fixas →</a>
        `;
    }
}

function renderAll() {
    renderSummary();
    renderMonthlyChart();
    renderCategoryChart();
    renderTransactions();
    renderPlanning();
    renderSettings();
    renderAgenda();
    renderHistoricalReports();
    renderRecurringBills();
    renderRecurringAlertBanner();
    renderReports();
}

/* ==============================
   SELETOR DE CATEGORIAS
================================ */

function closeCategoryDrawer() {
    const picker = $("#categoryPicker");
    const button = $("#categoryPickerButton");
    const form = $("#transactionForm");

    if (!picker || !button) return;

    picker.classList.remove("open");
    button.setAttribute("aria-expanded", "false");
    if (form) form.classList.remove("category-drawer-open");
}

function openCategoryDrawer() {
    const picker = $("#categoryPicker");
    const button = $("#categoryPickerButton");
    const form = $("#transactionForm");

    if (!picker || !button) return;

    picker.classList.add("open");
    button.setAttribute("aria-expanded", "true");
    if (form) form.classList.add("category-drawer-open");
}

function syncCategoryPicker(value) {
    const select = $("#category");
    const label = $("#categoryPickerLabel");
    const customInput = $("#customCategory");

    if (!select || !label) return;

    const option = [...select.options].find(
        (item) => item.value === value
    );

    if (option) {
        select.value = value;
        label.textContent = option.textContent;
    } else {
        select.value = "Outros";
        label.textContent = "📦 Outros";

        if (customInput) {
            customInput.value = value || "";
        }
    }

    document.querySelectorAll(".category-option").forEach((button) => {
        const selected = button.dataset.value === select.value;

        button.classList.toggle("selected", selected);
        button.setAttribute("aria-selected", String(selected));
    });
}

function renderCategoryOptions(type = "despesa", selectedValue = null) {
    const select = $("#category");
    const drawer = $("#categoryOptions");
    const label = $("#categoryPickerLabel");
    const customInput = $("#customCategory");

    if (!select || !drawer) return;

    const categories = type === "receita" ? INCOME_CATEGORIES : EXPENSE_CATEGORIES;
    const currentVal = selectedValue || select.value;
    const isValidCategory = categories.some((c) => c.name === currentVal);
    const targetValue = isValidCategory
        ? currentVal
        : (categories.find((c) => c.name === "Outros") ? "Outros" : categories[0].name);

    select.innerHTML = "";
    categories.forEach((cat) => {
        const opt = document.createElement("option");
        opt.value = cat.name;
        opt.textContent = `${cat.icon} ${cat.name}`;
        if (cat.name === targetValue) opt.selected = true;
        select.appendChild(opt);
    });

    drawer.innerHTML = "";
    categories.forEach((cat) => {
        const btn = document.createElement("button");
        btn.type = "button";
        btn.className = "category-option";
        btn.setAttribute("role", "option");
        btn.dataset.value = cat.name;
        btn.textContent = `${cat.icon} ${cat.name}`;
        const isSelected = cat.name === targetValue;
        btn.classList.toggle("selected", isSelected);
        btn.setAttribute("aria-selected", String(isSelected));
        drawer.appendChild(btn);
    });

    const selectedCat = categories.find((c) => c.name === targetValue) || categories[0];
    if (label) {
        label.textContent = `${selectedCat.icon} ${selectedCat.name}`;
    }

    if (customInput) {
        customInput.placeholder = type === "receita"
            ? "Ex.: Consultoria, venda de artesanato..."
            : "Ex.: Academia, dentista...";
        if (!selectedValue) {
            customInput.value = "";
        }
    }
}

function setupCategoryPicker() {
    const picker = $("#categoryPicker");
    const button = $("#categoryPickerButton");
    const options = $("#categoryOptions");
    const select = $("#category");
    const customInput = $("#customCategory");

    if (!picker || !button || !options || !select || !customInput) {
        return;
    }

    const typeSelect = $("#type");
    if (typeSelect) {
        typeSelect.addEventListener("change", (e) => {
            renderCategoryOptions(e.target.value);
        });
    }

    button.addEventListener("click", () => {
        if (picker.classList.contains("open")) {
            closeCategoryDrawer();
        } else {
            openCategoryDrawer();
        }
    });

    options.addEventListener("click", (event) => {
        const optionButton = event.target.closest(".category-option");

        if (!optionButton) return;

        select.value = optionButton.dataset.value;
        customInput.value = "";

        syncCategoryPicker(select.value);
        closeCategoryDrawer();
    });

    document.addEventListener("click", (event) => {
        if (!picker.contains(event.target)) {
            closeCategoryDrawer();
        }
    });

    document.addEventListener("keydown", (event) => {
        if (event.key === "Escape") {
            closeCategoryDrawer();
        }
    });

    customInput.addEventListener("input", () => {
        if (customInput.value.trim()) {
            closeCategoryDrawer();
        }
    });

    const initialType = typeSelect ? typeSelect.value : "despesa";
    renderCategoryOptions(initialType, select.value);
}

/* =========================================
   SELETOR DE DATAS MODERNO UNIVERSAL (DIA, MÊS E ANO)
========================================= */

const DP_MONTH_NAMES = [
    "Janeiro", "Fevereiro", "Março", "Abril", "Maio", "Junho",
    "Julho", "Agosto", "Setembro", "Outubro", "Novembro", "Dezembro"
];

const DP_MONTH_NAMES_SHORT = [
    "Jan", "Fev", "Mar", "Abr", "Mai", "Jun",
    "Jul", "Ago", "Set", "Out", "Nov", "Dez"
];

function syncDatePicker() {
    document.querySelectorAll(".custom-datepicker").forEach((c) => {
        if (c._syncDatePicker) c._syncDatePicker();
    });
}

function syncMonthPicker() {
    syncDatePicker();
}

function setupDatePicker() {
    const containers = document.querySelectorAll(".custom-datepicker");
    containers.forEach((container) => {
        initSingleDatePicker(container);
    });
}

function setupMonthPicker() {
    setupDatePicker();
}

function initSingleDatePicker(container) {
    if (container._dpInitialized) {
        if (container._syncDatePicker) container._syncDatePicker();
        return;
    }
    container._dpInitialized = true;

    const input = container.querySelector(".datepicker-native-input") || container.querySelector("input[type='date'], input[type='month']");
    const trigger = container.querySelector(".datepicker-trigger") || container.querySelector("button");
    const label = container.querySelector(".datepicker-text");
    const backdrop = container.querySelector(".datepicker-backdrop");
    const closeBtn = container.querySelector(".dp-close-btn") || container.querySelector("#dpCloseBtn");
    const prevBtn = container.querySelector(".dp-prev-btn") || container.querySelector("#dpPrevBtn");
    const nextBtn = container.querySelector(".dp-next-btn") || container.querySelector("#dpNextBtn");
    const viewBtn = container.querySelector(".dp-btn-view") || container.querySelector("#dpViewBtn");
    const todayBtn = container.querySelector(".dp-today-btn") || container.querySelector("#dpTodayBtn");
    const yesterdayBtn = container.querySelector(".dp-yesterday-btn") || container.querySelector("#dpYesterdayBtn");
    const prevYearBtn = container.querySelector(".dp-prev-year-btn") || container.querySelector("#dpPrevYearBtn");
    const nextYearBtn = container.querySelector(".dp-next-year-btn") || container.querySelector("#dpNextYearBtn");
    const daysGrid = container.querySelector(".dp-grid") || container.querySelector("#dpGrid");
    const monthsGrid = container.querySelector(".dp-months-grid") || container.querySelector("#dpMonthsGrid");
    const headerTitle = container.querySelector(".dp-current-month-year") || container.querySelector("#dpCurrentMonthYear") || container.querySelector(".dp-btn-view span:first-child");
    const yearDisplay = container.querySelector(".dp-year-display") || container.querySelector("#dpSelectedYear");
    const daysView = container.querySelector(".dp-days-view") || container.querySelector("#dpDaysView");
    const monthsView = container.querySelector(".dp-months-view") || container.querySelector("#dpMonthsView");
    const viewBtnChevron = container.querySelector(".dp-view-chevron");

    if (!input || !trigger) return;

    let localYear = new Date().getFullYear();
    let localMonth = new Date().getMonth();
    let viewMode = "days";

    function parseInputValue() {
        let val = input.value;
        if (!val) {
            if (input.id === "dashboardMonth") {
                val = sessionStorage.getItem("meuFinanceiro.date") || todayISO();
                input.value = val;
            } else {
                val = todayISO();
                input.value = val;
            }
        }
        const parts = val.split("-");
        if (parts.length === 3) {
            localYear = parseInt(parts[0], 10);
            localMonth = parseInt(parts[1], 10) - 1;
            return { year: localYear, month: localMonth, day: parseInt(parts[2], 10), val };
        } else if (parts.length === 2) {
            localYear = parseInt(parts[0], 10);
            localMonth = parseInt(parts[1], 10) - 1;
            return { year: localYear, month: localMonth, day: 1, val };
        }
        return { year: localYear, month: localMonth, day: 1, val: todayISO() };
    }

    function sync() {
        const info = parseInputValue();
        if (!label) return;

        const todayStr = todayISO();
        const yesterdayStr = yesterdayISO();

        let suffix = "";
        if (info.val === todayStr) suffix = " (Hoje)";
        else if (info.val === yesterdayStr) suffix = " (Ontem)";

        if (container.id === "recurringDatePickerContainer") {
            label.textContent = `${info.day} de ${DP_MONTH_NAMES_SHORT[info.month]} ${info.year}${suffix}`;
        } else {
            label.textContent = `${info.day} de ${DP_MONTH_NAMES[info.month]} de ${info.year}${suffix}`;
        }
        renderDays();
    }
    container._syncDatePicker = sync;

    function renderDays() {
        if (!daysGrid) return;
        if (headerTitle) {
            headerTitle.textContent = `${DP_MONTH_NAMES[localMonth]} de ${localYear}`;
        }

        const selectedVal = input.value || todayISO();
        const todayStr = todayISO();

        const firstDayIndex = new Date(localYear, localMonth, 1).getDay();
        const daysInMonth = new Date(localYear, localMonth + 1, 0).getDate();
        const daysInPrevMonth = new Date(localYear, localMonth, 0).getDate();

        daysGrid.innerHTML = "";

        // Dias do mês anterior
        for (let i = firstDayIndex - 1; i >= 0; i--) {
            const dayNum = daysInPrevMonth - i;
            const prevM = localMonth === 0 ? 11 : localMonth - 1;
            const prevY = localMonth === 0 ? localYear - 1 : localYear;
            const iso = `${prevY}-${String(prevM + 1).padStart(2, "0")}-${String(dayNum).padStart(2, "0")}`;

            const btn = document.createElement("button");
            btn.type = "button";
            btn.className = "dp-day other-month";
            btn.textContent = String(dayNum);
            btn.addEventListener("click", () => selectDate(iso));
            daysGrid.appendChild(btn);
        }

        // Dias do mês atual
        for (let dayNum = 1; dayNum <= daysInMonth; dayNum++) {
            const iso = `${localYear}-${String(localMonth + 1).padStart(2, "0")}-${String(dayNum).padStart(2, "0")}`;

            const btn = document.createElement("button");
            btn.type = "button";
            btn.className = "dp-day";
            btn.textContent = String(dayNum);

            if (iso === todayStr) btn.classList.add("today");
            if (iso === selectedVal) btn.classList.add("selected");

            btn.addEventListener("click", () => selectDate(iso));
            daysGrid.appendChild(btn);
        }

        // Dias do próximo mês
        const currentSlots = firstDayIndex + daysInMonth;
        const totalSlots = currentSlots > 35 ? 42 : 35;
        const remainingSlots = totalSlots - currentSlots;
        for (let dayNum = 1; dayNum <= remainingSlots; dayNum++) {
            const nextM = localMonth === 11 ? 0 : localMonth + 1;
            const nextY = localMonth === 11 ? localYear + 1 : localYear;
            const iso = `${nextY}-${String(nextM + 1).padStart(2, "0")}-${String(dayNum).padStart(2, "0")}`;

            const btn = document.createElement("button");
            btn.type = "button";
            btn.className = "dp-day other-month";
            btn.textContent = String(dayNum);
            btn.addEventListener("click", () => selectDate(iso));
            daysGrid.appendChild(btn);
        }
    }

    function renderMonths() {
        if (!monthsGrid) return;
        if (yearDisplay) yearDisplay.textContent = String(localYear);
        monthsGrid.innerHTML = "";

        DP_MONTH_NAMES_SHORT.forEach((name, idx) => {
            const btn = document.createElement("button");
            btn.type = "button";
            btn.className = "dp-month-btn";
            if (idx === localMonth) btn.classList.add("selected");
            btn.textContent = name;
            btn.addEventListener("click", () => {
                localMonth = idx;
                switchView("days");
                renderDays();
            });
            monthsGrid.appendChild(btn);
        });
    }

    function switchView(mode) {
        viewMode = mode;
        if (mode === "months") {
            if (daysView) daysView.classList.add("hidden");
            if (monthsView) monthsView.classList.remove("hidden");
            if (viewBtnChevron) viewBtnChevron.textContent = "▴";
            renderMonths();
        } else {
            if (monthsView) monthsView.classList.add("hidden");
            if (daysView) daysView.classList.remove("hidden");
            if (viewBtnChevron) viewBtnChevron.textContent = "▾";
            renderDays();
        }
    }

    function selectDate(isoString) {
        input.value = isoString;
        input.dispatchEvent(new Event("change", { bubbles: true }));
        sync();
        close();
    }

    function open() {
        switchView("days");
        parseInputValue();
        renderDays();
        container.classList.add("open");
        trigger.setAttribute("aria-expanded", "true");
    }

    function close() {
        container.classList.remove("open");
        trigger.setAttribute("aria-expanded", "false");
    }

    trigger.addEventListener("click", (e) => {
        e.stopPropagation();
        if (container.classList.contains("open")) close();
        else open();
    });

    if (backdrop) backdrop.addEventListener("click", close);
    if (closeBtn) closeBtn.addEventListener("click", close);

    if (prevBtn) {
        prevBtn.addEventListener("click", (e) => {
            e.stopPropagation();
            if (localMonth === 0) {
                localMonth = 11;
                localYear--;
            } else {
                localMonth--;
            }
            renderDays();
        });
    }

    if (nextBtn) {
        nextBtn.addEventListener("click", (e) => {
            e.stopPropagation();
            if (localMonth === 11) {
                localMonth = 0;
                localYear++;
            } else {
                localMonth++;
            }
            renderDays();
        });
    }

    if (viewBtn) {
        viewBtn.addEventListener("click", (e) => {
            e.stopPropagation();
            switchView(viewMode === "days" ? "months" : "days");
        });
    }

    if (prevYearBtn) {
        prevYearBtn.addEventListener("click", (e) => {
            e.stopPropagation();
            localYear--;
            renderMonths();
        });
    }

    if (nextYearBtn) {
        nextYearBtn.addEventListener("click", (e) => {
            e.stopPropagation();
            localYear++;
            renderMonths();
        });
    }

    if (todayBtn) {
        todayBtn.addEventListener("click", (e) => {
            e.stopPropagation();
            selectDate(todayISO());
        });
    }

    if (yesterdayBtn) {
        yesterdayBtn.addEventListener("click", (e) => {
            e.stopPropagation();
            selectDate(yesterdayISO());
        });
    }

    document.addEventListener("click", (e) => {
        if (!container.contains(e.target)) close();
    });

    document.addEventListener("keydown", (e) => {
        if (e.key === "Escape" && container.classList.contains("open")) close();
    });

    input.addEventListener("change", (e) => {
        sync();
        if (input.id === "dashboardMonth") {
            sessionStorage.setItem("meuFinanceiro.date", input.value);
            sessionStorage.setItem("meuFinanceiro.month", input.value.slice(0, 7));
            renderAll();
        }
    });

    sync();
}

/* =========================================
   AGENDA FINANCEIRA (CALENDÁRIO INTERATIVO)
========================================= */

let agendaSelectedDate = todayISO();

function setupAgenda() {
    const agendaLayout = $("#agendaLayout");
    if (!agendaLayout) return;

    agendaSelectedDate = selectedDate() || todayISO();

    const prevMonthBtn = $("#agendaPrevMonthBtn");
    const nextMonthBtn = $("#agendaNextMonthBtn");
    const todayBtn = $("#agendaTodayBtn");

    if (prevMonthBtn) {
        prevMonthBtn.addEventListener("click", () => {
            const [y, m] = selectedMonth().split("-").map(Number);
            const prevD = new Date(y, m - 2, 1);
            const isoMonth = `${prevD.getFullYear()}-${String(prevD.getMonth() + 1).padStart(2, "0")}`;
            const isoDate = `${isoMonth}-01`;
            sessionStorage.setItem("meuFinanceiro.date", isoDate);
            sessionStorage.setItem("meuFinanceiro.month", isoMonth);
            const dashInput = $("#dashboardMonth");
            if (dashInput) dashInput.value = isoDate;
            syncDatePicker();
            renderAll();
        });
    }

    if (nextMonthBtn) {
        nextMonthBtn.addEventListener("click", () => {
            const [y, m] = selectedMonth().split("-").map(Number);
            const nextD = new Date(y, m, 1);
            const isoMonth = `${nextD.getFullYear()}-${String(nextD.getMonth() + 1).padStart(2, "0")}`;
            const isoDate = `${isoMonth}-01`;
            sessionStorage.setItem("meuFinanceiro.date", isoDate);
            sessionStorage.setItem("meuFinanceiro.month", isoMonth);
            const dashInput = $("#dashboardMonth");
            if (dashInput) dashInput.value = isoDate;
            syncDatePicker();
            renderAll();
        });
    }

    if (todayBtn) {
        todayBtn.addEventListener("click", () => {
            const isoDate = todayISO();
            const isoMonth = currentMonth();
            sessionStorage.setItem("meuFinanceiro.date", isoDate);
            sessionStorage.setItem("meuFinanceiro.month", isoMonth);
            const dashInput = $("#dashboardMonth");
            if (dashInput) dashInput.value = isoDate;
            agendaSelectedDate = isoDate;
            syncDatePicker();
            renderAll();
        });
    }
}

function formatChipMoney(value) {
    const val = Number(value || 0);
    if (val >= 10000) {
        return "R$" + Math.round(val / 1000) + "k";
    }
    if (val >= 1000) {
        return "R$" + (val / 1000).toFixed(1).replace(".0", "").replace(".", ",") + "k";
    }
    return "R$" + Math.round(val);
}

function renderAgenda() {
    const agendaLayout = $("#agendaLayout");
    if (!agendaLayout) return;

    const currentM = selectedMonth();
    const [y, m] = currentM.split("-").map(Number);
    const monthYearTitle = $("#agendaMonthYearTitle");
    if (monthYearTitle) {
        monthYearTitle.textContent = `${DP_MONTH_NAMES[m - 1]} de ${y}`;
    }

    const monthSummary = getMonthlySummary(currentM);
    const monthIncomeEl = $("#agendaMonthIncome");
    const monthExpensesEl = $("#agendaMonthExpenses");
    const monthBalanceEl = $("#agendaMonthBalance");
    const monthCountEl = $("#agendaMonthCount");

    if (monthIncomeEl) monthIncomeEl.textContent = money(monthSummary.income);
    if (monthExpensesEl) monthExpensesEl.textContent = money(monthSummary.expenses);
    if (monthBalanceEl) {
        monthBalanceEl.textContent = money(monthSummary.balance);
        monthBalanceEl.style.color = monthSummary.balance >= 0 ? "var(--green)" : "var(--red)";
    }
    if (monthCountEl) {
        const count = monthSummary.transactions.length;
        monthCountEl.textContent = `${count} ${count === 1 ? "movimentação" : "movimentações"}`;
    }

    const grid = $("#agendaCalendarGrid");
    if (grid) {
        grid.innerHTML = "";
        const firstDayIdx = new Date(y, m - 1, 1).getDay();
        const daysInMonth = new Date(y, m, 0).getDate();
        const daysInPrevMonth = new Date(y, m - 1, 0).getDate();
        const todayStr = todayISO();

        function buildDayEvents(dayIso, monthStr) {
            const evts = [];
            // Transações do dia
            const dayTxs = data.transactions.filter((t) => t.date === dayIso);
            dayTxs.forEach((t) => {
                evts.push({
                    type: t.type,
                    title: t.description || (t.type === "receita" ? "Receita" : "Despesa"),
                    amount: t.amount,
                    isPaid: true
                });
            });

            // Contas fixas / recorrentes com vencimento no dia
            const dayBills = (data.recurringBills || []).filter((b) => {
                return getBillOccurrencesInMonth(b, monthStr).includes(dayIso);
            });
            dayBills.forEach((b) => {
                evts.push({
                    type: "recurring",
                    title: b.name,
                    amount: b.amount,
                    isPaid: isBillOccurrencePaid(b, dayIso)
                });
            });

            return evts;
        }

        function renderChipsHtml(evts) {
            if (!evts.length) return "";
            const maxChips = 2;
            const visible = evts.slice(0, maxChips);
            const remaining = evts.length - maxChips;

            let html = visible.map((evt) => {
                if (evt.type === "receita") {
                    return `
                        <div class="agenda-chip chip-income" title="Receita: ${escapeHTML(evt.title)} - ${money(evt.amount)}">
                            <span class="chip-dot">●</span>
                            <span class="chip-title">${escapeHTML(evt.title)}</span>
                            <span class="chip-val">+${formatChipMoney(evt.amount)}</span>
                        </div>
                    `;
                } else if (evt.type === "despesa") {
                    return `
                        <div class="agenda-chip chip-expense" title="Despesa: ${escapeHTML(evt.title)} - ${money(evt.amount)}">
                            <span class="chip-dot">●</span>
                            <span class="chip-title">${escapeHTML(evt.title)}</span>
                            <span class="chip-val">−${formatChipMoney(evt.amount)}</span>
                        </div>
                    `;
                } else {
                    return `
                        <div class="agenda-chip chip-recurring ${evt.isPaid ? "paid" : "due"}" title="Conta Fixa: ${escapeHTML(evt.title)} - ${money(evt.amount)} (${evt.isPaid ? "Paga" : "A vencer"})">
                            <span class="chip-icon">${evt.isPaid ? "✓" : "⟳"}</span>
                            <span class="chip-title">${escapeHTML(evt.title)}</span>
                            <span class="chip-val">${formatChipMoney(evt.amount)}</span>
                        </div>
                    `;
                }
            }).join("");

            if (remaining > 0) {
                html += `<div class="agenda-chip chip-more">+${remaining} mais</div>`;
            }

            return `<div class="agenda-day-chips">${html}</div>`;
        }

        // Prev month days
        for (let i = firstDayIdx - 1; i >= 0; i--) {
            const dayNum = daysInPrevMonth - i;
            const prevM = m === 1 ? 12 : m - 1;
            const prevY = m === 1 ? y - 1 : y;
            const iso = `${prevY}-${String(prevM).padStart(2, "0")}-${String(dayNum).padStart(2, "0")}`;
            const mStr = `${prevY}-${String(prevM).padStart(2, "0")}`;
            const evts = buildDayEvents(iso, mStr);

            const cell = document.createElement("div");
            cell.className = "agenda-day other-month";
            if (iso === agendaSelectedDate) cell.classList.add("selected");
            cell.innerHTML = `
                <div class="agenda-day-header">
                    <span class="agenda-day-num is-other-month">${dayNum}</span>
                </div>
                ${renderChipsHtml(evts)}
            `;
            cell.addEventListener("click", () => {
                agendaSelectedDate = iso;
                sessionStorage.setItem("meuFinanceiro.date", iso);
                sessionStorage.setItem("meuFinanceiro.month", mStr);
                const dashInput = $("#dashboardMonth");
                if (dashInput) dashInput.value = iso;
                syncDatePicker();
                renderAll();
            });
            grid.appendChild(cell);
        }

        // Current month days
        for (let d = 1; d <= daysInMonth; d++) {
            const iso = `${y}-${String(m).padStart(2, "0")}-${String(d).padStart(2, "0")}`;
            const evts = buildDayEvents(iso, currentM);

            const cell = document.createElement("div");
            cell.className = "agenda-day";
            if (iso === todayStr) cell.classList.add("today");
            if (iso === agendaSelectedDate) cell.classList.add("selected");

            cell.innerHTML = `
                <div class="agenda-day-header">
                    <span class="agenda-day-num ${iso === todayStr ? "today-circle" : ""}">${d}</span>
                </div>
                ${renderChipsHtml(evts)}
            `;

            cell.addEventListener("click", () => {
                agendaSelectedDate = iso;
                sessionStorage.setItem("meuFinanceiro.date", iso);
                const dashInput = $("#dashboardMonth");
                if (dashInput) dashInput.value = iso;
                syncDatePicker();
                renderAgenda();
            });

            grid.appendChild(cell);
        }

        // Next month days
        const currentSlots = firstDayIdx + daysInMonth;
        const totalSlots = currentSlots > 35 ? 42 : 35;
        const remainingSlots = totalSlots - currentSlots;
        for (let d = 1; d <= remainingSlots; d++) {
            const nextM = m === 12 ? 1 : m + 1;
            const nextY = m === 12 ? y + 1 : y;
            const iso = `${nextY}-${String(nextM).padStart(2, "0")}-${String(d).padStart(2, "0")}`;
            const mStr = `${nextY}-${String(nextM).padStart(2, "0")}`;
            const evts = buildDayEvents(iso, mStr);

            const cell = document.createElement("div");
            cell.className = "agenda-day other-month";
            if (iso === agendaSelectedDate) cell.classList.add("selected");
            cell.innerHTML = `
                <div class="agenda-day-header">
                    <span class="agenda-day-num is-other-month">${d}</span>
                </div>
                ${renderChipsHtml(evts)}
            `;
            cell.addEventListener("click", () => {
                agendaSelectedDate = iso;
                sessionStorage.setItem("meuFinanceiro.date", iso);
                sessionStorage.setItem("meuFinanceiro.month", mStr);
                const dashInput = $("#dashboardMonth");
                if (dashInput) dashInput.value = iso;
                syncDatePicker();
                renderAll();
            });
            grid.appendChild(cell);
        }
    }

    renderAgendaDayDetails();
}

function renderAgendaDayDetails() {
    const detailsContainer = $("#agendaDayDetails");
    if (!detailsContainer) return;

    const iso = agendaSelectedDate || todayISO();
    const parts = iso.split("-");
    const day = parseInt(parts[2], 10);
    const month = parseInt(parts[1], 10) - 1;
    const year = parseInt(parts[0], 10);

    const titleEl = $("#agendaSelectedDayTitle");
    if (titleEl) {
        titleEl.textContent = `${day} de ${DP_MONTH_NAMES[month]} de ${year}`;
    }

    const dayTxs = data.transactions.filter((t) => t.date === iso);
    const dayIncome = dayTxs.filter((t) => t.type === "receita").reduce((sum, t) => sum + t.amount, 0);
    const dayExpenses = dayTxs.filter((t) => t.type === "despesa").reduce((sum, t) => sum + t.amount, 0);
    const dayBalance = dayIncome - dayExpenses;

    const dayIncomeEl = $("#agendaDayIncome");
    const dayExpensesEl = $("#agendaDayExpenses");
    const dayBalanceEl = $("#agendaDayBalance");

    if (dayIncomeEl) dayIncomeEl.textContent = money(dayIncome);
    if (dayExpensesEl) dayExpensesEl.textContent = money(dayExpenses);
    if (dayBalanceEl) dayBalanceEl.textContent = money(dayBalance);

    const listEl = $("#agendaDayList");
    if (!listEl) return;

    if (!dayTxs.length) {
        listEl.innerHTML = `
            <div class="empty-state" style="padding: 24px 10px;">
                <p>Nenhuma movimentação para este dia.</p>
                <p><a href="lancamentos.html" class="text-button">+ Fazer lançamento neste dia</a></p>
            </div>
        `;
    } else {
        listEl.innerHTML = dayTxs.map((t) => {
            const isIncome = t.type === "receita";
            const icon = CATEGORY_ICONS[t.category] || "📦";
            return `
                <div class="transaction-item">
                    <div class="transaction-icon">${icon}</div>
                    <div class="transaction-info">
                        <h3>${escapeHTML(t.description)}</h3>
                        <p>${escapeHTML(t.category)} · ${formatDate(t.date)}</p>
                    </div>
                    <div class="transaction-right">
                        <div class="transaction-amount ${isIncome ? "income-text" : "expense-text"}">
                            ${isIncome ? "+" : "−"}${money(t.amount)}
                        </div>
                        <div class="transaction-actions">
                            <button type="button" class="btn-action edit" data-action="edit" data-id="${t.id}" title="Editar">✎</button>
                            <button type="button" class="btn-action delete" data-action="delete" data-id="${t.id}" title="Excluir">🗑</button>
                        </div>
                    </div>
                </div>
            `;
        }).join("");
    }

    // Contas fixas / recorrentes que vencem neste dia
    const recurringEl = $("#agendaDayRecurring");
    if (recurringEl) {
        const mStr = `${year}-${String(month + 1).padStart(2, "0")}`;
        const dayBills = (data.recurringBills || []).filter((b) => {
            return getBillOccurrencesInMonth(b, mStr).includes(iso);
        });
        if (!dayBills.length) {
            recurringEl.innerHTML = "";
        } else {
            recurringEl.innerHTML = `
                <div class="agenda-recurring-header">
                    <h4>🔔 Contas com vencimento neste dia (${dayBills.length})</h4>
                </div>
                ${dayBills.map((b) => {
                    const isPaid = isBillOccurrencePaid(b, iso);
                    const icon = CATEGORY_ICONS[b.category] || "📄";
                    const freqName = getFrequencyLabel(b.frequency);
                    return `
                        <div class="agenda-recurring-item">
                            <div class="agenda-recurring-info">
                                <span style="font-size: 20px;">${icon}</span>
                                <div>
                                    <div class="agenda-recurring-title">${escapeHTML(b.name)}</div>
                                    <div class="agenda-recurring-sub">${escapeHTML(b.category)} · ${freqName} · <strong>${money(b.amount)}</strong></div>
                                </div>
                            </div>
                            <div>
                                ${isPaid ? `
                                    <div style="display: flex; align-items: center; gap: 6px;">
                                        <span class="recurring-status-badge status-paid">✓ Paga</span>
                                        <button type="button" class="mini-button btn-unpay-recurring" data-action="unpay-recurring" data-id="${b.id}" data-date="${iso}" title="Desmarcar pagamento desta data" style="padding: 3px 8px; font-size: 11px;">
                                            Desfazer
                                        </button>
                                    </div>
                                ` : `
                                    <button type="button" class="btn-pay-recurring" data-action="pay-recurring" data-id="${b.id}" data-date="${iso}">
                                        ✓ Pagar
                                    </button>
                                `}
                            </div>
                        </div>
                    `;
                }).join("")}
            `;
        }
    }
}

/* =========================================
   HISTÓRICO & RELATÓRIOS POR DIA, MÊS E ANO
========================================= */

let historyFilterMode = "day"; // 'day', 'month', 'year', 'all'

function setupHistoricalReports() {
    const tabs = document.querySelectorAll(".period-tab-btn");
    if (!tabs.length) return;

    tabs.forEach((tab) => {
        tab.addEventListener("click", () => {
            tabs.forEach((t) => t.classList.remove("active"));
            tab.classList.add("active");
            historyFilterMode = tab.dataset.mode || "day";
            renderHistoricalReports();
        });
    });
}

function renderHistoricalReports() {
    const container = $("#historicalReportsContainer");
    if (!container) return;

    const currentD = selectedDate() || todayISO();
    const currentM = selectedMonth() || currentMonth();
    const currentY = currentD.slice(0, 4);

    let periodLabel = "";
    let filteredTxs = [];
    let summary = {};

    if (historyFilterMode === "day") {
        const parts = currentD.split("-");
        const day = parseInt(parts[2], 10);
        const month = parseInt(parts[1], 10) - 1;
        const year = parseInt(parts[0], 10);
        periodLabel = `${day} de ${DP_MONTH_NAMES[month]} de ${year}`;
        filteredTxs = data.transactions.filter((t) => t.date === currentD);
        summary = getPeriodSummary("day", currentD);
    } else if (historyFilterMode === "month") {
        const parts = currentM.split("-");
        const month = parseInt(parts[1], 10) - 1;
        const year = parseInt(parts[0], 10);
        periodLabel = `${DP_MONTH_NAMES[month]} de ${year}`;
        filteredTxs = data.transactions.filter((t) => t.date.startsWith(currentM));
        summary = getMonthlySummary(currentM);
    } else if (historyFilterMode === "year") {
        periodLabel = `Ano de ${currentY}`;
        filteredTxs = data.transactions.filter((t) => t.date.startsWith(currentY));
        summary = getPeriodSummary("year", currentY);
    } else {
        periodLabel = "Todos os lançamentos";
        filteredTxs = [...data.transactions];
        summary = getPeriodSummary("all");
    }

    const titleEl = $("#historyCurrentPeriodLabel");
    if (titleEl) titleEl.textContent = periodLabel;

    const balEl = $("#historyPeriodBalance");
    const incEl = $("#historyPeriodIncome");
    const expEl = $("#historyPeriodExpenses");
    const savEl = $("#historyPeriodSavings");

    if (balEl) {
        balEl.textContent = money(summary.balance);
        balEl.style.color = summary.balance < 0 ? "var(--red)" : "var(--text)";
    }
    if (incEl) incEl.textContent = money(summary.income);
    if (expEl) expEl.textContent = money(summary.expenses);
    if (savEl) savEl.textContent = `${summary.savingsRate.toFixed(1)}%`;

    // Category Breakdown Report (Despesas)
    const breakdownContainer = $("#historyCategoryBreakdown");
    if (breakdownContainer) {
        const expensesTxs = filteredTxs.filter((t) => t.type === "despesa");
        const catTotals = {};
        expensesTxs.forEach((t) => {
            catTotals[t.category] = (catTotals[t.category] || 0) + Number(t.amount || 0);
        });

        // Inclui contas fixas pagas no período
        (data.recurringBills || []).forEach((b) => {
            const cat = b.category || "Assinaturas";
            if (historyFilterMode === "day") {
                const mStr = currentD.slice(0, 7);
                if (getBillOccurrencesInMonth(b, mStr).includes(currentD) && isBillOccurrencePaid(b, currentD)) {
                    catTotals[cat] = (catTotals[cat] || 0) + Number(b.amount || 0);
                }
            } else if (historyFilterMode === "month") {
                const occs = getBillOccurrencesInMonth(b, currentM);
                occs.forEach((d) => {
                    if (isBillOccurrencePaid(b, d)) {
                        catTotals[cat] = (catTotals[cat] || 0) + Number(b.amount || 0);
                    }
                });
            } else if (historyFilterMode === "year") {
                for (let mon = 1; mon <= 12; mon++) {
                    const mStr = `${currentY}-${String(mon).padStart(2, "0")}`;
                    getBillOccurrencesInMonth(b, mStr).forEach((d) => {
                        if (isBillOccurrencePaid(b, d)) {
                            catTotals[cat] = (catTotals[cat] || 0) + Number(b.amount || 0);
                        }
                    });
                }
            } else if (historyFilterMode === "all") {
                (b.paidDates || []).forEach(() => {
                    catTotals[cat] = (catTotals[cat] || 0) + Number(b.amount || 0);
                });
            }
        });

        const totalExp = Object.values(catTotals).reduce((sum, v) => sum + v, 0);
        const entries = Object.entries(catTotals).sort((a, b) => b[1] - a[1]);

        if (!entries.length) {
            breakdownContainer.innerHTML = `<p style="font-size: 13px; color: var(--muted); margin: 0;">Nenhuma despesa registrada para ${periodLabel}.</p>`;
        } else {
            breakdownContainer.innerHTML = entries.map(([cat, amt], idx) => {
                const icon = CATEGORY_ICONS[cat] || "📦";
                const pct = totalExp > 0 ? (amt / totalExp) * 100 : 0;
                const color = COLORS[idx % COLORS.length];
                return `
                    <div class="breakdown-item">
                        <div class="breakdown-info">
                            <span>${icon} <strong>${escapeHTML(cat)}</strong></span>
                            <span>${money(amt)} <small style="color: var(--muted);">(${pct.toFixed(1)}%)</small></span>
                        </div>
                        <div class="breakdown-bar-bg">
                            <div class="breakdown-bar-fill" style="width: ${pct}%; background: ${color};"></div>
                        </div>
                    </div>
                `;
            }).join("");
        }
    }

    // Category Breakdown Report (Receitas que Entraram)
    const incomeBreakdownContainer = $("#historyIncomeBreakdown");
    if (incomeBreakdownContainer) {
        const incomeTotals = {};
        if (summary.salary > 0) {
            incomeTotals["Salário"] = summary.salary;
        }

        const incomeTxs = filteredTxs.filter((t) => t.type === "receita");
        incomeTxs.forEach((t) => {
            if (t.category === "Salário" && summary.salary > 0) return; // evita duplicar salário já listado
            incomeTotals[t.category] = (incomeTotals[t.category] || 0) + Number(t.amount || 0);
        });

        const totalInc = Object.values(incomeTotals).reduce((sum, v) => sum + v, 0);
        const entries = Object.entries(incomeTotals).sort((a, b) => b[1] - a[1]);

        if (!entries.length) {
            incomeBreakdownContainer.innerHTML = `<p style="font-size: 13px; color: var(--muted); margin: 0;">Nenhuma receita registrada para ${periodLabel}.</p>`;
        } else {
            incomeBreakdownContainer.innerHTML = entries.map(([cat, amt], idx) => {
                const icon = CATEGORY_ICONS[cat] || "💰";
                const pct = totalInc > 0 ? (amt / totalInc) * 100 : 0;
                const color = ["#10b981", "#059669", "#34d399", "#6ee7b7", "#047857"][idx % 5];
                return `
                    <div class="breakdown-item">
                        <div class="breakdown-info">
                            <span>${icon} <strong>${escapeHTML(cat)}</strong></span>
                            <span>${money(amt)} <small style="color: var(--muted);">(${pct.toFixed(1)}%)</small></span>
                        </div>
                        <div class="breakdown-bar-bg">
                            <div class="breakdown-bar-fill" style="width: ${pct}%; background: ${color};"></div>
                        </div>
                    </div>
                `;
            }).join("");
        }
    }

    // Histórico de Contas Fixas e Assinaturas no Período
    const historyRecurringListEl = $("#historyRecurringList");
    if (historyRecurringListEl) {
        const periodBillsOccurrences = [];
        (data.recurringBills || []).forEach((b) => {
            if (historyFilterMode === "day") {
                const mStr = currentD.slice(0, 7);
                const occs = getBillOccurrencesInMonth(b, mStr);
                if (occs.includes(currentD)) {
                    periodBillsOccurrences.push({
                        bill: b,
                        date: currentD,
                        isPaid: isBillOccurrencePaid(b, currentD)
                    });
                }
            } else if (historyFilterMode === "month") {
                const occs = getBillOccurrencesInMonth(b, currentM);
                occs.forEach((d) => {
                    periodBillsOccurrences.push({
                        bill: b,
                        date: d,
                        isPaid: isBillOccurrencePaid(b, d)
                    });
                });
            } else if (historyFilterMode === "year") {
                for (let mon = 1; mon <= 12; mon++) {
                    const mStr = `${currentY}-${String(mon).padStart(2, "0")}`;
                    getBillOccurrencesInMonth(b, mStr).forEach((d) => {
                        periodBillsOccurrences.push({
                            bill: b,
                            date: d,
                            isPaid: isBillOccurrencePaid(b, d)
                        });
                    });
                }
            } else {
                // "all" - exibe o próximo vencimento e todos os pagos
                (b.paidDates || []).forEach((d) => {
                    periodBillsOccurrences.push({
                        bill: b,
                        date: d,
                        isPaid: true
                    });
                });
                const nextOcc = getNextUnpaidOccurrence(b);
                if (nextOcc) {
                    periodBillsOccurrences.push({
                        bill: b,
                        date: nextOcc,
                        isPaid: false
                    });
                }
            }
        });

        periodBillsOccurrences.sort((a, b) => a.date.localeCompare(b.date));

        if (!periodBillsOccurrences.length) {
            historyRecurringListEl.innerHTML = `
                <div class="empty-state" style="padding: 24px 10px;">
                    <div style="font-size: 28px; margin-bottom: 8px;">⟳</div>
                    <p>Nenhuma conta fixa ou assinatura encontrada para este período (${periodLabel}).</p>
                    <p><a href="contas-fixas.html" class="text-button">+ Cadastrar conta fixa</a></p>
                </div>
            `;
        } else {
            historyRecurringListEl.innerHTML = periodBillsOccurrences.map(({ bill, date, isPaid }) => {
                const icon = CATEGORY_ICONS[bill.category] || "📄";
                const freqName = getFrequencyLabel(bill.frequency);
                return `
                    <div class="transaction-item">
                        <div class="transaction-icon">${icon}</div>
                        <div class="transaction-info">
                            <h3>${escapeHTML(bill.name)}</h3>
                            <p>${escapeHTML(bill.category)} · ${freqName} · Vencimento: ${formatDate(date)}</p>
                        </div>
                        <div class="transaction-right">
                            <span class="recurring-status-badge ${isPaid ? "status-paid" : "status-pending"}" style="font-size: 11px;">
                                ${isPaid ? "✓ Paga" : "⏳ A vencer"}
                            </span>
                            <div class="transaction-amount expense-text">
                                ${money(bill.amount)}
                            </div>
                        </div>
                    </div>
                `;
            }).join("");
        }
    }

    // Receitas que Entraram no Período
    const historyIncomeListEl = $("#historyIncomeList");
    if (historyIncomeListEl) {
        const incomeItems = [];

        // Salário configurado/efetivo do período
        if (summary.salary > 0) {
            incomeItems.push({
                isSalary: true,
                title: "Salário do período",
                category: "Salário",
                date: (historyFilterMode === "day" ? currentD : (historyFilterMode === "month" ? `${currentM}-05` : (historyFilterMode === "year" ? `${currentY}-01-05` : ""))),
                amount: summary.salary,
                notes: "Entrada principal configurada"
            });
        }

        // Lançamentos manuais de receita
        const incomeTxs = filteredTxs
            .filter((t) => t.type === "receita")
            .filter((t) => !(t.category === "Salário" && summary.salary > 0));

        incomeTxs.forEach((t) => {
            incomeItems.push({
                isSalary: false,
                id: t.id,
                title: t.description || "Receita avulsa",
                category: t.category || "Outros",
                date: t.date,
                amount: t.amount,
                notes: t.notes || ""
            });
        });

        incomeItems.sort((a, b) => (b.date || "").localeCompare(a.date || ""));

        if (!incomeItems.length) {
            historyIncomeListEl.innerHTML = `
                <div class="empty-state" style="padding: 24px 10px;">
                    <div style="font-size: 28px; margin-bottom: 8px;">💰</div>
                    <p>Nenhuma receita registrada para este período (${periodLabel}).</p>
                    <p><a href="lancamentos.html" class="text-button">+ Registrar receita</a></p>
                </div>
            `;
        } else {
            historyIncomeListEl.innerHTML = incomeItems.map((item) => {
                const icon = CATEGORY_ICONS[item.category] || "💰";
                return `
                    <div class="transaction-item">
                        <div class="transaction-icon">${icon}</div>
                        <div class="transaction-info">
                            <h3>${escapeHTML(item.title)}</h3>
                            <p>${escapeHTML(item.category)}${item.date ? ` · ${formatDate(item.date)}` : ""}${item.notes ? ` · <span style="opacity:0.8">${escapeHTML(item.notes)}</span>` : ""}</p>
                        </div>
                        <div class="transaction-right">
                            <div class="transaction-amount income-text">
                                +${money(item.amount)}
                            </div>
                        </div>
                    </div>
                `;
            }).join("");
        }
    }

    // Filter transactions list with search and type
    const searchInput = $("#searchTransactions");
    const query = searchInput ? searchInput.value.trim().toLowerCase() : "";
    const typeFilter = $("#typeFilter");
    const type = typeFilter ? typeFilter.value : "todos";

    let visible = filteredTxs.filter((t) => {
        const matchesQuery = !query || t.description.toLowerCase().includes(query) || t.category.toLowerCase().includes(query);
        const matchesType = type === "todos" || t.type === type;
        return matchesQuery && matchesType;
    });

    visible.sort((a, b) => new Date(b.date) - new Date(a.date));

    const countEl = $("#transactionCount");
    if (countEl) {
        countEl.textContent = `${visible.length} ${visible.length === 1 ? "lançamento encontrado" : "lançamentos encontrados"}`;
    }

    const listEl = $("#transactionList");
    if (listEl) {
        if (!visible.length) {
            listEl.innerHTML = `
                <div class="empty-state">
                    <p>Nenhuma movimentação encontrada para o período selecionado (${periodLabel}).</p>
                    <p><a href="lancamentos.html" class="text-button">+ Fazer lançamento</a></p>
                </div>
            `;
        } else {
            listEl.innerHTML = visible.map((t) => {
                const isIncome = t.type === "receita";
                const icon = CATEGORY_ICONS[t.category] || "📦";
                return `
                    <div class="transaction-item">
                        <div class="transaction-icon">${icon}</div>
                        <div class="transaction-info">
                            <h3>${escapeHTML(t.description)}</h3>
                            <p>${escapeHTML(t.category)} · ${formatDate(t.date)}</p>
                        </div>
                        <div class="transaction-right">
                            <div class="transaction-amount ${isIncome ? "income-text" : "expense-text"}">
                                ${isIncome ? "+" : "−"}${money(t.amount)}
                            </div>
                            <div class="transaction-actions">
                                <button type="button" class="btn-action edit" data-action="edit" data-id="${t.id}" title="Editar">✎</button>
                                <button type="button" class="btn-action delete" data-action="delete" data-id="${t.id}" title="Excluir">🗑</button>
                            </div>
                        </div>
                    </div>
                `;
            }).join("");
        }
    }
}

function renderReports() {
    const currentM = selectedMonth() || currentMonth();
    const filter = getReportDateFilter();
    let summary = {};

    if (filter.mode === "this_week") {
        const curDate = selectedDate() || todayISO();
        const d = new Date(`${curDate}T12:00:00`);
        const dayOfWeek = (d.getDay() + 6) % 7;
        const monday = new Date(d);
        monday.setDate(d.getDate() - dayOfWeek);

        const weekDates = [];
        for (let i = 0; i < 7; i++) {
            const curDay = new Date(monday);
            curDay.setDate(monday.getDate() + i);
            weekDates.push(toISODate(curDay));
        }

        const manualTxs = (data.transactions || []).filter((t) => !t.recurringBillId && weekDates.includes(t.date));
        const salaryFromTransactions = manualTxs.filter((t) => t.type === "receita" && t.category === "Salário").reduce((s, t) => s + t.amount, 0);
        const extraIncome = manualTxs.filter((t) => t.type === "receita" && t.category !== "Salário").reduce((s, t) => s + t.amount, 0);
        const effectiveSalary = salaryFromTransactions;
        const income = effectiveSalary + extraIncome;
        const manualExpenses = sumTransactions(manualTxs, "despesa");

        let paidRecurringTotal = 0;
        let allRecurringTotal = 0;
        (data.recurringBills || []).forEach((b) => {
            weekDates.forEach((iso) => {
                const mStr = iso.slice(0, 7);
                if (getBillOccurrencesInMonth(b, mStr).includes(iso)) {
                    const amt = Number(b.amount || 0);
                    allRecurringTotal += amt;
                    if (isBillOccurrencePaid(b, iso)) {
                        paidRecurringTotal += amt;
                    }
                }
            });
        });

        const expenses = manualExpenses + paidRecurringTotal;
        const balance = income - expenses;
        const savingsRate = income > 0 ? (balance / income) * 100 : 0;

        summary = {
            salary: effectiveSalary,
            extraIncome,
            income,
            manualExpenses,
            paidRecurringExpenses: paidRecurringTotal,
            allRecurringExpenses: allRecurringTotal,
            pendingRecurringExpenses: Math.max(0, allRecurringTotal - paidRecurringTotal),
            expenses,
            balance,
            savingsRate
        };
    } else if (filter.mode === "this_year") {
        summary = getPeriodSummary("year", filter.year);
    } else if (filter.mode === "last_2_years") {
        const sum1 = getPeriodSummary("year", filter.years[0]);
        const sum2 = getPeriodSummary("year", filter.years[1]);
        const totalIncome = sum1.income + sum2.income;
        const totalExpenses = sum1.expenses + sum2.expenses;
        const totalBal = totalIncome - totalExpenses;
        summary = {
            salary: sum1.salary + sum2.salary,
            extraIncome: sum1.extraIncome + sum2.extraIncome,
            income: totalIncome,
            manualExpenses: sum1.manualExpenses + sum2.manualExpenses,
            paidRecurringExpenses: sum1.paidRecurringExpenses + sum2.paidRecurringExpenses,
            allRecurringExpenses: sum1.allRecurringExpenses + sum2.allRecurringExpenses,
            pendingRecurringExpenses: sum1.pendingRecurringExpenses + sum2.pendingRecurringExpenses,
            expenses: totalExpenses,
            balance: totalBal,
            savingsRate: totalIncome > 0 ? (totalBal / totalIncome) * 100 : 0
        };
    } else {
        // "this_month"
        summary = getMonthlySummary(currentM);
    }

    // 1. Atualizar títulos, descrições e valores dos 4 Cards de Resumo
    const titleBal = $("#reportSummaryTitleBalance");
    const descBal = $("#reportSummaryDescBalance");
    const titleInc = $("#reportSummaryTitleIncome");
    const descInc = $("#reportSummaryDescIncome");
    const titleExp = $("#reportSummaryTitleExpenses");
    const descExp = $("#reportSummaryDescExpenses");
    const titleSav = $("#reportSummaryTitleSavings");
    const descSav = $("#reportSummaryDescSavings");

    if (titleBal) titleBal.textContent = `Saldo ${filter.periodTitle}`;
    if (descBal) descBal.textContent = `Receitas menos despesas (${filter.label})`;
    if (titleInc) titleInc.textContent = `Receitas ${filter.periodTitle}`;
    if (descInc) descInc.textContent = `Salário e entradas extras (${filter.label})`;
    if (titleExp) titleExp.textContent = `Despesas ${filter.periodTitle}`;
    if (descExp) descExp.textContent = `Saídas e contas pagas (${filter.label})`;
    if (titleSav) titleSav.textContent = `Taxa de economia`;
    if (descSav) descSav.textContent = `Percentual poupado (${filter.label})`;

    const monthBalEl = $("#monthBalance");
    const monthIncEl = $("#monthIncome");
    const monthExpEl = $("#monthExpenses");
    const savingsEl = $("#savingsRate");

    if (monthBalEl) {
        monthBalEl.textContent = money(summary.balance);
        monthBalEl.style.color = summary.balance < 0 ? "var(--red)" : "var(--text)";
    }
    if (monthIncEl) monthIncEl.textContent = money(summary.income);
    if (monthExpEl) monthExpEl.textContent = money(summary.expenses);
    if (savingsEl) savingsEl.textContent = `${summary.savingsRate.toFixed(1)}%`;

    // 2. Atualizar KPIs de detalhamento em relatórios
    const totalExpEl = $("#reportTotalExpensesSpent");
    const manExpEl = $("#reportManualExpensesVal");
    const manIncEl = $("#reportManualIncomeVal");
    const recPaidEl = $("#reportRecurringPaidVal");
    const recPendingEl = $("#reportRecurringPendingVal");
    const salaryEl = $("#reportSalaryBaseVal");

    if (totalExpEl) totalExpEl.textContent = money(summary.expenses);
    if (manExpEl) manExpEl.textContent = money(summary.manualExpenses);
    if (manIncEl) manIncEl.textContent = money(summary.extraIncome);
    if (recPaidEl) recPaidEl.textContent = money(summary.paidRecurringExpenses);
    if (recPendingEl) recPendingEl.textContent = money(summary.pendingRecurringExpenses);
    if (salaryEl) salaryEl.textContent = money(summary.salary);

    // 3. Controlar visibilidade de painéis conforme o filtro ativo
    const recPanel = $("#reportRecurringPanel");
    const txPanel = $("#reportTransactionsPanel");

    if (recPanel) {
        recPanel.style.display = (currentReportFilter === "lancamentos") ? "none" : "";
    }
    if (txPanel) {
        txPanel.style.display = (currentReportFilter === "contas-fixas") ? "none" : "";
    }

    const recurringListEl = $("#reportRecurringList");
    const transactionsListEl = $("#reportTransactionsList");

    // 4. Renderizar Lista de Contas Fixas e Assinaturas no Relatório conforme Período
    if (recurringListEl) {
        const periodBillsOccurrences = [];
        (data.recurringBills || []).forEach((b) => {
            if (filter.mode === "this_week") {
                const curDate = selectedDate() || todayISO();
                const d = new Date(`${curDate}T12:00:00`);
                const dayOfWeek = (d.getDay() + 6) % 7;
                const monday = new Date(d);
                monday.setDate(d.getDate() - dayOfWeek);
                for (let i = 0; i < 7; i++) {
                    const curDay = new Date(monday);
                    curDay.setDate(monday.getDate() + i);
                    const iso = toISODate(curDay);
                    const mStr = iso.slice(0, 7);
                    if (getBillOccurrencesInMonth(b, mStr).includes(iso)) {
                        periodBillsOccurrences.push({
                            bill: b,
                            date: iso,
                            isPaid: isBillOccurrencePaid(b, iso)
                        });
                    }
                }
            } else if (filter.mode === "this_year") {
                for (let mon = 1; mon <= 12; mon++) {
                    const mStr = `${filter.year}-${String(mon).padStart(2, "0")}`;
                    getBillOccurrencesInMonth(b, mStr).forEach((d) => {
                        periodBillsOccurrences.push({
                            bill: b,
                            date: d,
                            isPaid: isBillOccurrencePaid(b, d)
                        });
                    });
                }
            } else if (filter.mode === "last_2_years") {
                filter.years.forEach((yr) => {
                    for (let mon = 1; mon <= 12; mon++) {
                        const mStr = `${yr}-${String(mon).padStart(2, "0")}`;
                        getBillOccurrencesInMonth(b, mStr).forEach((d) => {
                            periodBillsOccurrences.push({
                                bill: b,
                                date: d,
                                isPaid: isBillOccurrencePaid(b, d)
                            });
                        });
                    }
                });
            } else {
                const occs = getBillOccurrencesInMonth(b, currentM);
                occs.forEach((d) => {
                    periodBillsOccurrences.push({
                        bill: b,
                        date: d,
                        isPaid: isBillOccurrencePaid(b, d)
                    });
                });
            }
        });

        periodBillsOccurrences.sort((a, b) => a.date.localeCompare(b.date));

        if (!periodBillsOccurrences.length) {
            recurringListEl.innerHTML = `
                <div class="empty-state" style="padding: 24px 10px;">
                    <div style="font-size: 28px; margin-bottom: 8px;">⟳</div>
                    <p>Nenhuma conta fixa ou assinatura encontrada para ${escapeHTML(filter.label)}.</p>
                    <p><a href="contas-fixas.html" class="text-button">+ Cadastrar conta fixa</a></p>
                </div>
            `;
        } else {
            recurringListEl.innerHTML = periodBillsOccurrences.map(({ bill, date, isPaid }) => {
                const icon = CATEGORY_ICONS[bill.category] || "📄";
                const freqName = getFrequencyLabel(bill.frequency);
                return `
                    <div class="transaction-item">
                        <div class="transaction-icon">${icon}</div>
                        <div class="transaction-info">
                            <h3>${escapeHTML(bill.name)}</h3>
                            <p>${escapeHTML(bill.category)} · ${freqName} · Vencimento: ${formatDate(date)}</p>
                        </div>
                        <div class="transaction-right">
                            <span class="recurring-status-badge ${isPaid ? "status-paid" : "status-pending"}" style="font-size: 11px;">
                                ${isPaid ? "✓ Paga" : "⏳ A vencer"}
                            </span>
                            <div class="transaction-amount expense-text">
                                ${money(bill.amount)}
                            </div>
                        </div>
                    </div>
                `;
            }).join("");
        }
    }

    // 5. Renderizar Lista de Lançamentos Avulsos no Relatório conforme Período
    if (transactionsListEl) {
        const periodTxs = (data.transactions || [])
            .filter((t) => !t.recurringBillId && filter.matchesDate(t.date))
            .sort((a, b) => b.date.localeCompare(a.date));

        if (!periodTxs.length) {
            transactionsListEl.innerHTML = `
                <div class="empty-state" style="padding: 24px 10px;">
                    <div style="font-size: 28px; margin-bottom: 8px;">🧾</div>
                    <p>Nenhum lançamento avulso registrado para ${escapeHTML(filter.label)}.</p>
                    <p><a href="lancamentos.html" class="text-button">+ Novo lançamento</a></p>
                </div>
            `;
        } else {
            transactionsListEl.innerHTML = periodTxs.map((t) => {
                const isIncome = t.type === "receita";
                const icon = CATEGORY_ICONS[t.category] || (isIncome ? "💰" : "📦");
                return `
                    <div class="transaction-item">
                        <div class="transaction-icon">${icon}</div>
                        <div class="transaction-info">
                            <h3>${escapeHTML(t.description)}</h3>
                            <p>${escapeHTML(t.category)} · ${formatDate(t.date)}${t.notes ? ` · <span style="opacity:0.8">${escapeHTML(t.notes)}</span>` : ""}</p>
                        </div>
                        <div class="transaction-right">
                            <div class="transaction-amount ${isIncome ? "income-text" : "expense-text"}">
                                ${isIncome ? "+" : "−"}${money(t.amount)}
                            </div>
                        </div>
                    </div>
                `;
            }).join("");
        }
    }
}

/* ==============================
   FORMULÁRIO DE LANÇAMENTOS
================================ */

function resetTransactionForm() {
    const form = $("#transactionForm");
    if (!form) return;

    form.reset();

    if ($("#editId")) $("#editId").value = "";
    if ($("#transactionDate")) $("#transactionDate").value = todayISO();
    if ($("#type")) $("#type").value = "despesa";
    if ($("#category")) $("#category").value = "Alimentação";
    if ($("#customCategory")) $("#customCategory").value = "";

    const typeLabel = $("#typeLabel");
    if (typeLabel) typeLabel.textContent = "Despesa";
    document.querySelectorAll("#typeOptions .filter-select-option").forEach((opt) => {
        const isDespesa = opt.dataset.value === "despesa";
        opt.classList.toggle("selected", isDespesa);
        opt.setAttribute("aria-selected", String(isDespesa));
    });

    renderCategoryOptions("despesa", "Alimentação");
    closeCategoryDrawer();
    syncDatePicker();

    const title = $("#formTitle");
    if (title) title.textContent = "Novo lançamento";

    const saveBtn = $("#saveBtn");
    if (saveBtn) saveBtn.textContent = "Salvar lançamento";

    const cancelBtn = $("#cancelEditBtn");
    if (cancelBtn && !form.classList.contains("recurring-form")) {
        cancelBtn.classList.add("hidden");
    }

    if (form.classList.contains("recurring-form")) {
        form.classList.add("hidden");
    }
}

function editTransaction(id) {
    const transaction = data.transactions.find(
        (item) => item.id === id
    );

    if (!transaction) return;

    // Se estiver em outra página (como historico.html ou index.html), navega para lancamentos.html com o ID
    if (!$("#transactionForm")) {
        window.location.href = `lancamentos.html?edit=${encodeURIComponent(id)}`;
        return;
    }

    const form = $("#transactionForm");
    if (form) {
        form.classList.remove("hidden");
    }

    if ($("#editId")) $("#editId").value = transaction.id;
    if ($("#type")) $("#type").value = transaction.type;

    const typeLabel = $("#typeLabel");
    if (typeLabel) {
        typeLabel.textContent = transaction.type === "receita" ? "Receita extra" : "Despesa";
    }
    document.querySelectorAll("#typeOptions .filter-select-option").forEach((opt) => {
        const match = opt.dataset.value === transaction.type;
        opt.classList.toggle("selected", match);
        opt.setAttribute("aria-selected", String(match));
    });

    if ($("#description")) $("#description").value = transaction.description;
    if ($("#amount")) $("#amount").value = transaction.amount;

    const isBuiltInCategory =
        CATEGORY_OPTIONS.includes(transaction.category);

    if ($("#customCategory")) {
        $("#customCategory").value =
            isBuiltInCategory ? "" : transaction.category;
    }

    renderCategoryOptions(
        transaction.type,
        isBuiltInCategory ? transaction.category : "Outros"
    );

    closeCategoryDrawer();

    if ($("#transactionDate")) $("#transactionDate").value = transaction.date;
    syncDatePicker();
    if ($("#notes")) $("#notes").value = transaction.notes || "";

    const formTitle = $("#formTitle");
    if (formTitle) formTitle.textContent = "Editar lançamento";

    const saveBtn = $("#saveBtn");
    if (saveBtn) saveBtn.textContent = "Salvar alterações";

    const cancelBtn = $("#cancelEditBtn");
    if (cancelBtn) cancelBtn.classList.remove("hidden");

    window.scrollTo({ top: 0, behavior: "smooth" });
}

function showConfirmDialog({ title, message, confirmLabel = "Excluir", danger = true }) {
    const dialog = $("#confirmDialog");
    if (!dialog) {
        return Promise.resolve(confirm(message));
    }

    const titleElement = $("#confirmDialogTitle");
    const messageElement = $("#confirmDialogMessage");
    const confirmButton = $("#confirmDialogConfirm");

    titleElement.textContent = title;
    messageElement.textContent = message;
    confirmButton.textContent = confirmLabel;
    confirmButton.classList.toggle("button-danger", danger);

    dialog.classList.add("is-open");
    dialog.setAttribute("aria-hidden", "false");
    document.body.classList.add("dialog-open");
    confirmButton.focus();

    const cancelBtn = $("#confirmDialogCancel");
    const closeBtn = $("#confirmDialogClose");

    return new Promise((resolve) => {
        const finish = (result) => {
            dialog.classList.remove("is-open");
            dialog.setAttribute("aria-hidden", "true");
            document.body.classList.remove("dialog-open");
            confirmButton.removeEventListener("click", onConfirm);
            if (cancelBtn) cancelBtn.removeEventListener("click", onCancel);
            if (closeBtn) closeBtn.removeEventListener("click", onCancel);
            dialog.removeEventListener("click", onBackdrop);
            document.removeEventListener("keydown", onEscape);
            resolve(result);
        };
        const onConfirm = () => finish(true);
        const onCancel = () => finish(false);
        const onBackdrop = (event) => { if (event.target === dialog) onCancel(); };
        const onEscape = (event) => { if (event.key === "Escape") onCancel(); };

        confirmButton.addEventListener("click", onConfirm);
        if (cancelBtn) cancelBtn.addEventListener("click", onCancel);
        if (closeBtn) closeBtn.addEventListener("click", onCancel);
        dialog.addEventListener("click", onBackdrop);
        document.addEventListener("keydown", onEscape);
    });
}

async function deleteTransaction(id) {
    const transaction = data.transactions.find(
        (item) => item.id === id
    );

    if (!transaction) return;

    const confirmed = await showConfirmDialog({
        title: "Excluir lançamento?",
        message: `Tem certeza de que deseja excluir “${transaction.description}”? Essa ação não pode ser desfeita.`,
        confirmLabel: "Excluir lançamento"
    });

    if (!confirmed) return;

    const previous = data.transactions;

    data.transactions = previous.filter(
        (item) => item.id !== id
    );

    if (transaction.recurringBillId) {
        const bill = (data.recurringBills || []).find((b) => b.id === transaction.recurringBillId);
        if (bill) {
            const txMonth = transaction.date.slice(0, 7);
            const txDate = transaction.date;
            if (Array.isArray(bill.paidDates)) {
                bill.paidDates = bill.paidDates.filter((d) => d !== txDate);
            }
            if (Array.isArray(bill.paidMonths)) {
                const stillPaidInMonth = (bill.paidDates || []).some((d) => d.startsWith(txMonth));
                if (!stillPaidInMonth) {
                    bill.paidMonths = bill.paidMonths.filter((m) => m !== txMonth);
                }
            }
        }
    }

    if (!saveData()) {
        data.transactions = previous;
        return;
    }

    if ($("#editId") && $("#editId").value === id) {
        resetTransactionForm();
    }

    renderAll();
    showToast("Lançamento excluído.");
}

function handleTransactionSubmit(event) {
    event.preventDefault();

    const id = $("#editId").value;
    const type = $("#type").value;
    const description = $("#description").value.trim();
    const rawAmount = String($("#amount").value || "").trim().replace("R$", "").trim();
    const normalizedAmount = rawAmount.includes(",")
        ? rawAmount.replace(/\./g, "").replace(",", ".")
        : rawAmount;
    const amount = Number(normalizedAmount);
    const customCategory = $("#customCategory").value.trim();
    const category = customCategory || $("#category").value;
    const date = $("#transactionDate").value;
    const notes = $("#notes").value.trim();

    if (!["receita", "despesa"].includes(type)) {
        showToast("Selecione um tipo válido.");
        return;
    }

    if (!description || description.length > 100) {
        showToast("Informe uma descrição válida.");
        return;
    }

    if (
        !Number.isFinite(amount) ||
        amount <= 0 ||
        amount > 100000000
    ) {
        showToast("Informe um valor maior que zero e dentro do limite.");
        return;
    }

    if (!date || !/^\d{4}-\d{2}-\d{2}$/.test(date)) {
        showToast("Informe uma data válida.");
        return;
    }

    const parsedDate = new Date(`${date}T12:00:00`);

    if (
        Number.isNaN(parsedDate.getTime()) ||
        (todayISO() < date && parsedDate.getFullYear() < 1900)
    ) {
        showToast("Confira a data informada.");
        return;
    }

    if (!category || category.length > 50) {
        showToast("Informe uma categoria válida com até 50 caracteres.");
        return;
    }

    const oldTransactions = [...data.transactions];

    if (id) {
        const index = data.transactions.findIndex(
            (item) => item.id === id
        );

        if (index === -1) {
            showToast("Esse lançamento não foi encontrado.");
            return;
        }

        data.transactions[index] = {
            ...data.transactions[index],
            type,
            description,
            amount,
            category,
            date,
            notes
        };
    } else {
        data.transactions.push({
            id: createId(),
            type,
            description,
            amount,
            category,
            date,
            notes
        });
    }

    if (!saveData()) {
        data.transactions = oldTransactions;
        return;
    }

    sessionStorage.setItem("meuFinanceiro.date", date);
    sessionStorage.setItem("meuFinanceiro.month", date.slice(0, 7));
    if ($("#dashboardMonth")) {
        $("#dashboardMonth").value = date;
    }

    showToast(
        id
            ? "Lançamento atualizado com sucesso!"
            : "Lançamento salvo com sucesso!"
    );

    // Se estiver na página de lançamentos e estava editando de outra página, pode voltar para o histórico
    const urlParams = new URLSearchParams(window.location.search);
    if (urlParams.get("edit")) {
        setTimeout(() => {
            window.location.href = "historico.html";
        }, 1200);
        return;
    }

    resetTransactionForm();
    renderAll();
}

/* ==============================
   SALÁRIO, LIMITE E META
================================ */

function handleSalarySubmit(event) {
    event.preventDefault();

    const raw = String($("#salary").value || "").trim().replace("R$", "").trim();
    const normalized = raw.includes(",") ? raw.replace(/\./g, "").replace(",", ".") : raw;
    const salary = Number(normalized);
    const month = selectedMonth();

    if (
        !Number.isFinite(salary) ||
        salary < 0 ||
        salary > 100000000
    ) {
        showToast("Informe um salário válido.");
        return;
    }

    const previous = data.salaries[month];

    data.salaries[month] = salary;

    if (!saveData()) {
        if (previous === undefined) {
            delete data.salaries[month];
        } else {
            data.salaries[month] = previous;
        }

        return;
    }

    renderAll();
    showToast("Salário mensal salvo!");
}

function handleBudgetSubmit(event) {
    event.preventDefault();

    const raw = String($("#budget").value || "").trim().replace("R$", "").trim();
    const normalized = raw.includes(",") ? raw.replace(/\./g, "").replace(",", ".") : raw;
    const budget = Number(normalized);
    const month = selectedMonth();

    if (
        !Number.isFinite(budget) ||
        budget < 0 ||
        budget > 100000000
    ) {
        showToast("Informe um limite válido.");
        return;
    }

    const previous = data.budgets[month];

    data.budgets[month] = budget;

    if (!saveData()) {
        if (previous === undefined) {
            delete data.budgets[month];
        } else {
            data.budgets[month] = previous;
        }

        return;
    }

    renderPlanning();
    showToast("Limite mensal atualizado!");
}

function handleGoalSubmit(event) {
    event.preventDefault();

    const raw = String($("#goal").value || "").trim().replace("R$", "").trim();
    const normalized = raw.includes(",") ? raw.replace(/\./g, "").replace(",", ".") : raw;
    const goal = Number(normalized);
    const month = selectedMonth();

    if (
        !Number.isFinite(goal) ||
        goal < 0 ||
        goal > 100000000
    ) {
        showToast("Informe uma meta válida.");
        return;
    }

    const previous = data.goals[month];

    data.goals[month] = goal;

    if (!saveData()) {
        if (previous === undefined) {
            delete data.goals[month];
        } else {
            data.goals[month] = previous;
        }

        return;
    }

    renderPlanning();
    showToast("Meta de economia atualizada!");
}

/* ==============================
   BACKUP E RESTAURAÇÃO
================================ */

function exportBackup() {
    const backup = {
        app: "MeuFinanceiro",
        version: 1,
        exportedAt: new Date().toISOString(),
        data
    };

    const blob = new Blob(
        [JSON.stringify(backup, null, 2)],
        { type: "application/json" }
    );

    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");

    link.href = url;
    link.download = `backup-financeiro-${todayISO()}.json`;

    link.click();

    setTimeout(() => URL.revokeObjectURL(url), 1000);

    showToast("Backup exportado!");
}

function exportCSV() {
    if (!data.transactions || !data.transactions.length) {
        showToast("Nenhum lançamento para exportar.");
        return;
    }

    const headers = ["Data", "Tipo", "Descrição", "Categoria", "Valor (R$)", "Observações"];
    const rows = [...data.transactions]
        .sort((a, b) => b.date.localeCompare(a.date))
        .map((t) => [
            formatDate(t.date),
            t.type === "receita" ? "Receita" : "Despesa",
            `"${(t.description || "").replace(/"/g, '""')}"`,
            `"${(t.category || "").replace(/"/g, '""')}"`,
            Number(t.amount || 0).toFixed(2).replace(".", ","),
            `"${(t.notes || "").replace(/"/g, '""')}"`
        ]);

    const csvContent = "\uFEFF" + [headers.join(";"), ...rows.map((r) => r.join(";"))].join("\r\n");
    const blob = new Blob([csvContent], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = `meu-financeiro-${todayISO()}.csv`;
    link.click();
    setTimeout(() => URL.revokeObjectURL(url), 1000);
    showToast("Planilha CSV exportada com sucesso!");
}

function updatePrivacyButtons(isPrivate) {
    document.querySelectorAll(".privacy-btn").forEach((btn) => {
        const icon = btn.querySelector(".privacy-icon") || btn;
        if (icon) icon.textContent = isPrivate ? "🙈" : "👁️";
        const text = btn.querySelector(".privacy-text");
        if (text) text.remove();
        btn.setAttribute("title", isPrivate ? "Exibir valores na tela" : "Ocultar valores na tela");
        btn.setAttribute("aria-label", isPrivate ? "Exibir valores na tela" : "Ocultar valores na tela");
        btn.setAttribute("aria-pressed", String(isPrivate));
    });
}

function setupPrivacyMode() {
    const isPrivate = localStorage.getItem("meuFinanceiro.privacy") === "true";
    document.body.classList.toggle("privacy-mode", isPrivate);
    updatePrivacyButtons(isPrivate);

    document.querySelectorAll(".privacy-btn").forEach((btn) => {
        btn.addEventListener("click", () => {
            const current = document.body.classList.toggle("privacy-mode");
            localStorage.setItem("meuFinanceiro.privacy", String(current));
            updatePrivacyButtons(current);
            showToast(current ? "Valores ocultados na tela." : "Valores visíveis.");
        });
    });
}

function validBackup(imported) {
    if (!imported || typeof imported !== "object") {
        return false;
    }

    const importedData = imported.data || imported;

    if (!Array.isArray(importedData.transactions)) {
        return false;
    }

    if (
        !importedData.salaries ||
        !importedData.budgets ||
        !importedData.goals
    ) {
        return false;
    }

    const validTransactions = importedData.transactions.every((item) =>
        item &&
        typeof item.id === "string" &&
        ["receita", "despesa"].includes(item.type) &&
        typeof item.description === "string" &&
        item.description.length <= 100 &&
        Number.isFinite(item.amount) &&
        item.amount > 0 &&
        item.amount <= 100000000 &&
        typeof item.category === "string" &&
        item.category.trim().length > 0 &&
        item.category.trim().length <= 50 &&
        typeof item.date === "string" &&
        /^\d{4}-\d{2}-\d{2}$/.test(item.date) &&
        typeof (item.notes || "") === "string" &&
        (item.notes || "").length <= 300
    );

    const validMap = (map) =>
        map &&
        typeof map === "object" &&
        !Array.isArray(map) &&
        Object.entries(map).every(([key, value]) =>
            /^\d{4}-\d{2}$/.test(key) &&
            Number.isFinite(value) &&
            value >= 0 &&
            value <= 100000000
        );

    return validTransactions &&
        validMap(importedData.salaries) &&
        validMap(importedData.budgets) &&
        validMap(importedData.goals);
}

async function importBackup(file) {
    if (!file) return;

    try {
        if (file.size > 10 * 1024 * 1024) {
            throw new Error("O arquivo é muito grande.");
        }

        const imported = JSON.parse(await file.text());

        if (!validBackup(imported)) {
            throw new Error("O arquivo não possui um formato válido.");
        }

        const confirmed = confirm(
            "Importar este backup substituirá os dados atuais. " +
            "Exporte um backup atual antes de continuar. Deseja prosseguir?"
        );

        if (!confirmed) return;

        const importedData = imported.data || imported;
        const previous = data;

        data = {
            transactions: importedData.transactions,
            salaries: importedData.salaries,
            budgets: importedData.budgets,
            goals: importedData.goals,
            recurringBills: Array.isArray(importedData.recurringBills) ? importedData.recurringBills : []
        };

        if (!saveData()) {
            data = previous;
            return;
        }

        resetTransactionForm();
        renderAll();

        showToast("Backup importado com sucesso!");
    } catch (error) {
        showToast(
            error.message || "Não foi possível importar o arquivo."
        );
    } finally {
        const fileInput = $("#importFile");
        if (fileInput) fileInput.value = "";
    }
}

/* ==============================
   NAVEGAÇÃO E VALIDAÇÃO
================================ */

function setupNavigation() {
    // Detecta a página atual pela URL e marca a classe active no link correto
    const currentPath = window.location.pathname.split("/").pop() || "index.html";

    let activeLink = null;
    document.querySelectorAll(".nav-link").forEach((link) => {
        const href = link.getAttribute("href");
        if (!href) return;

        const isCurrent = href === currentPath ||
            (href === "index.html" && (currentPath === "" || currentPath === "index1.html"));

        link.classList.toggle("active", isCurrent);
        if (isCurrent) {
            activeLink = link;
        }
    });
}

function setupMobileMenu() {
    const menuBtn = document.getElementById("mobileMenuBtn");
    const closeBtn = document.getElementById("mobileMenuCloseBtn");
    const backdrop = document.getElementById("mobileMenuBackdrop");
    const drawer = document.getElementById("mobileMenuDrawer");

    function closeMenu() {
        document.body.classList.remove("mobile-nav-open");
        if (menuBtn) {
            menuBtn.setAttribute("aria-expanded", "false");
        }
    }

    function openMenu() {
        document.body.classList.add("mobile-nav-open");
        if (menuBtn) {
            menuBtn.setAttribute("aria-expanded", "true");
        }
        if (closeBtn) {
            closeBtn.focus();
        }
    }

    // Garante que comece sempre fechado
    closeMenu();

    if (menuBtn) {
        menuBtn.addEventListener("click", (e) => {
            e.stopPropagation();
            const isOpen = document.body.classList.contains("mobile-nav-open");
            if (isOpen) {
                closeMenu();
            } else {
                openMenu();
            }
        });
    }

    if (closeBtn) {
        closeBtn.addEventListener("click", (e) => {
            e.stopPropagation();
            closeMenu();
        });
    }

    if (backdrop) {
        backdrop.addEventListener("click", (e) => {
            e.stopPropagation();
            closeMenu();
        });
    }

    document.addEventListener("keydown", (e) => {
        if (e.key === "Escape" && document.body.classList.contains("mobile-nav-open")) {
            closeMenu();
        }
    });

    window.addEventListener("resize", () => {
        if (window.innerWidth > 650 && document.body.classList.contains("mobile-nav-open")) {
            closeMenu();
        }
    });

    // BFCache e navegao: se voltar a pgina com o boto voltar do navegador, nunca deixar preso aberto
    window.addEventListener("pageshow", closeMenu);
    window.addEventListener("pagehide", closeMenu);
    window.addEventListener("popstate", closeMenu);

    if (drawer) {
        drawer.querySelectorAll(".nav-link").forEach((link) => {
            link.addEventListener("click", () => {
                closeMenu();
            });
        });
    }
}

function setupModernValidation() {
    let activeTooltip = null;
    let hideTimer = null;

    function removeTooltip() {
        if (activeTooltip) {
            activeTooltip.classList.remove("show");
            const old = activeTooltip;
            activeTooltip = null;
            window.setTimeout(() => old.remove(), 160);
        }
        if (hideTimer) window.clearTimeout(hideTimer);
    }

    function messageFor(field) {
        if (field.validity.valueMissing) {
            return field.tagName === "SELECT" ? "Escolha uma opção para continuar." : "Preencha este campo para continuar.";
        }
        if (field.validity.typeMismatch) {
            if (field.type === "email") return "Digite um endereço de e-mail válido.";
            if (field.type === "url") return "Digite um endereço válido.";
            return "Confira o formato informado.";
        }
        if (field.validity.rangeUnderflow) return `Informe um valor igual ou maior que ${field.min}.`;
        if (field.validity.rangeOverflow) return `Informe um valor igual ou menor que ${field.max}.`;
        if (field.validity.stepMismatch) return "Use um valor válido para este campo.";
        if (field.validity.tooLong) return `Use no máximo ${field.maxLength} caracteres.`;
        if (field.validity.patternMismatch) return "Confira o formato e tente novamente.";
        return field.validationMessage || "Confira este campo e tente novamente.";
    }

    document.addEventListener("invalid", (event) => {
        const field = event.target;
        if (!(field instanceof HTMLElement) || !("validity" in field)) return;
        event.preventDefault();
        removeTooltip();

        const tooltip = document.createElement("div");
        tooltip.className = "modern-validation-tooltip";
        tooltip.setAttribute("role", "alert");
        tooltip.innerHTML = '<span class="validation-tooltip-icon" aria-hidden="true">!</span><span class="validation-tooltip-message"></span>';
        tooltip.querySelector(".validation-tooltip-message").textContent = messageFor(field);
        document.body.appendChild(tooltip);
        activeTooltip = tooltip;

        const rect = field.getBoundingClientRect();
        const tipRect = tooltip.getBoundingClientRect();
        const left = Math.min(Math.max(12, rect.left), window.innerWidth - tipRect.width - 12);
        let top = rect.bottom + 9;
        if (top + tipRect.height > window.innerHeight - 8) top = Math.max(8, rect.top - tipRect.height - 9);
        tooltip.style.left = `${left}px`;
        tooltip.style.top = `${top}px`;
        requestAnimationFrame(() => tooltip.classList.add("show"));

        field.setAttribute("aria-invalid", "true");
        field.addEventListener("input", () => {
            if (field.checkValidity()) {
                field.removeAttribute("aria-invalid");
                removeTooltip();
            }
        }, { once: true });
        field.addEventListener("change", () => {
            if (field.checkValidity()) {
                field.removeAttribute("aria-invalid");
                removeTooltip();
            }
        }, { once: true });
        field.addEventListener("focus", removeTooltip, { once: true });
        hideTimer = window.setTimeout(removeTooltip, 5000);
        field.focus({ preventScroll: true });
    }, true);

    document.addEventListener("pointerdown", (event) => {
        if (activeTooltip && !activeTooltip.contains(event.target)) removeTooltip();
    });
}

function init() {
    setupModernValidation();

    const monthInput = $("#dashboardMonth");
    if (monthInput) {
        monthInput.value = selectedDate();
    }

    const todayDateInput = $("#transactionDate");
    if (todayDateInput && !todayDateInput.value) {
        todayDateInput.value = todayISO();
    }

    const todayText = $("#todayText");
    if (todayText) {
        todayText.textContent = new Date().toLocaleDateString(
            "pt-BR",
            {
                weekday: "long",
                day: "numeric",
                month: "long",
                year: "numeric"
            }
        );
    }

    const currentYear = $("#currentYear");
    if (currentYear) {
        currentYear.textContent = new Date().getFullYear();
    }

    const transactionForm = $("#transactionForm");
    if (transactionForm) {
        transactionForm.addEventListener("submit", handleTransactionSubmit);
    }

    const settingsForm = $("#settingsForm");
    if (settingsForm) {
        settingsForm.addEventListener("submit", handleSalarySubmit);
    }

    const budgetForm = $("#budgetForm");
    if (budgetForm) {
        budgetForm.addEventListener("submit", handleBudgetSubmit);
    }

    const goalForm = $("#goalForm");
    if (goalForm) {
        goalForm.addEventListener("submit", handleGoalSubmit);
    }

    const searchInput = $("#searchTransactions");
    if (searchInput) {
        searchInput.addEventListener("input", renderTransactions);
    }

    const typeFilter = $("#typeFilter");
    if (typeFilter) {
        typeFilter.addEventListener("change", renderTransactions);
    }

    // Filtro customizado
    const filterControl = $("#typeFilterControl");
    const filterButton = $("#typeFilterButton");
    const filterLabel = $("#typeFilterLabel");

    if (filterControl && filterButton && typeFilter && filterLabel) {
        filterButton.addEventListener("click", () => {
            const isOpen = filterControl.classList.toggle("open");
            filterButton.setAttribute("aria-expanded", String(isOpen));
        });

        const filterOptions = $("#typeFilterOptions");
        if (filterOptions) {
            filterOptions.addEventListener("click", (event) => {
                const option = event.target.closest(".filter-select-option");
                if (!option) return;

                typeFilter.value = option.dataset.value;
                filterLabel.textContent = option.textContent.trim();
                filterOptions.querySelectorAll(".filter-select-option").forEach((item) => {
                    const selected = item === option;
                    item.classList.toggle("selected", selected);
                    item.setAttribute("aria-selected", String(selected));
                });

                filterControl.classList.remove("open");
                filterButton.setAttribute("aria-expanded", "false");
                typeFilter.dispatchEvent(new Event("change", { bubbles: true }));
            });
        }
    }

    // Seletor de Tipo no formulário
    const typeControl = $("#typeControl");
    const typeButton = $("#typeButton");
    const typeLabel = $("#typeLabel");
    const typeSelect = $("#type");

    if (typeControl && typeButton && typeSelect && typeLabel) {
        typeButton.addEventListener("click", () => {
            const isOpen = typeControl.classList.toggle("open");
            typeButton.setAttribute("aria-expanded", String(isOpen));
            if (isOpen && filterControl) {
                filterControl.classList.remove("open");
                if (filterButton) filterButton.setAttribute("aria-expanded", "false");
            }
        });

        const typeOptions = $("#typeOptions");
        if (typeOptions) {
            typeOptions.addEventListener("click", (event) => {
                const option = event.target.closest(".filter-select-option");
                if (!option) return;

                typeSelect.value = option.dataset.value;
                typeLabel.textContent = option.textContent.trim();
                typeOptions.querySelectorAll(".filter-select-option").forEach((item) => {
                    const selected = item === option;
                    item.classList.toggle("selected", selected);
                    item.setAttribute("aria-selected", String(selected));
                });

                typeControl.classList.remove("open");
                typeButton.setAttribute("aria-expanded", "false");
                typeSelect.dispatchEvent(new Event("change", { bubbles: true }));
            });
        }
    }

    document.addEventListener("click", (event) => {
        if (filterControl && !filterControl.contains(event.target)) {
            filterControl.classList.remove("open");
            if (filterButton) filterButton.setAttribute("aria-expanded", "false");
        }
        if (typeControl && !typeControl.contains(event.target)) {
            typeControl.classList.remove("open");
            if (typeButton) typeButton.setAttribute("aria-expanded", "false");
        }
    });

    document.addEventListener("keydown", (event) => {
        if (event.key === "Escape") {
            if (filterControl) {
                filterControl.classList.remove("open");
                if (filterButton) filterButton.setAttribute("aria-expanded", "false");
            }
            if (typeControl) {
                typeControl.classList.remove("open");
                if (typeButton) typeButton.setAttribute("aria-expanded", "false");
            }
        }
    });

    const transactionList = $("#transactionList");
    if (transactionList) {
        transactionList.addEventListener("click", (event) => {
            const button = event.target.closest("button[data-action]");

            if (!button) return;

            const { action, id } = button.dataset;

            if (action === "edit") {
                editTransaction(id);
            }

            if (action === "delete") {
                deleteTransaction(id);
            }
        });
    }

    const agendaDayList = $("#agendaDayList");
    if (agendaDayList) {
        agendaDayList.addEventListener("click", (event) => {
            const button = event.target.closest("button[data-action]");
            if (!button) return;
            const { action, id } = button.dataset;
            if (action === "edit") editTransaction(id);
            if (action === "delete") deleteTransaction(id);
        });
    }

    const cancelEditBtn = $("#cancelEditBtn");
    if (cancelEditBtn) {
        cancelEditBtn.addEventListener("click", () => {
            const urlParams = new URLSearchParams(window.location.search);
            if (urlParams.get("edit")) {
                window.location.href = "historico.html";
            } else {
                resetTransactionForm();
            }
        });
    }

    const showAllBtn = $("#showAllBtn");
    if (showAllBtn) {
        showAllBtn.addEventListener("click", () => {
            showAllTransactions = !showAllTransactions;
            renderTransactions();
        });
    }

    const exportBtn = $("#exportBtn");
    if (exportBtn) {
        exportBtn.addEventListener("click", exportBackup);
    }

    const exportCsvBtn = $("#exportCsvBtn");
    if (exportCsvBtn) {
        exportCsvBtn.addEventListener("click", exportCSV);
    }

    const importBtn = $("#importBtn");
    const importFile = $("#importFile");
    if (importBtn && importFile) {
        importBtn.addEventListener("click", () => {
            importFile.click();
        });

        importFile.addEventListener("change", (event) => {
            importBackup(event.target.files[0]);
        });
    }

    setupNavigation();
    setupMobileMenu();
    setupPrivacyMode();
    setupCategoryPicker();
    setupDatePicker();
    setupAgenda();
    setupHistoricalReports();
    setupRecurringBills();
    setupTransactionsPage();
    setupReports();
    setupWelcomeTutorial();
    renderAll();

    // Se a página de lançamentos recebeu um ID para edição via query string (?edit=...)
    const urlParams = new URLSearchParams(window.location.search);
    const editId = urlParams.get("edit");
    if (editId) {
        editTransaction(editId);
    }
}

function setupReports() {
    setupReportPeriodPicker();

    document.querySelectorAll(".report-filter-btn").forEach((btn) => {
        btn.addEventListener("click", () => {
            const filter = btn.dataset.reportFilter || "all";
            setReportFilter(filter);
        });
    });

    const topbarNewRecurringBtn = $("#topbarNewRecurringBtn");
    if (topbarNewRecurringBtn) {
        topbarNewRecurringBtn.addEventListener("click", () => {
            const form = $("#recurringForm");
            if (form) {
                form.classList.remove("hidden");
                const nameInput = $("#recurringName");
                if (nameInput) nameInput.focus();
            }
        });
    }
}

/* =========================================
   CONFIGURAÇÃO DAS CONTAS RECORRENTES
========================================= */

function setupRecurringCategoryPicker() {
    const picker = $("#recurringCategoryPicker");
    const button = $("#recurringCategoryPickerButton");
    const options = $("#recurringCategoryOptions");
    const select = $("#recurringCategory");
    const label = $("#recurringCategoryPickerLabel");
    const customInput = $("#recurringCustomCategory");

    if (!picker || !button || !options || !select || !label || !customInput) {
        return;
    }

    function closeDrawer() {
        picker.classList.remove("open");
        button.setAttribute("aria-expanded", "false");
    }

    function openDrawer() {
        picker.classList.add("open");
        button.setAttribute("aria-expanded", "true");
    }

    function sync(val) {
        const option = [...select.options].find((item) => item.value === val);
        if (option) {
            select.value = val;
            label.textContent = option.textContent;
        } else {
            select.value = "Outros";
            label.textContent = "📦 Outros";
            customInput.value = val || "";
        }

        options.querySelectorAll(".category-option").forEach((btn) => {
            const isSelected = btn.dataset.value === select.value;
            btn.classList.toggle("selected", isSelected);
            btn.setAttribute("aria-selected", String(isSelected));
        });
    }

    button.addEventListener("click", (e) => {
        e.stopPropagation();
        if (picker.classList.contains("open")) {
            closeDrawer();
        } else {
            openDrawer();
        }
    });

    options.addEventListener("click", (e) => {
        const optBtn = e.target.closest(".category-option");
        if (!optBtn) return;
        select.value = optBtn.dataset.value;
        customInput.value = "";
        sync(select.value);
        closeDrawer();
    });

    document.addEventListener("click", (e) => {
        if (!picker.contains(e.target)) {
            closeDrawer();
        }
    });

    document.addEventListener("keydown", (e) => {
        if (e.key === "Escape") closeDrawer();
    });

    customInput.addEventListener("input", () => {
        if (customInput.value.trim()) {
            closeDrawer();
        }
    });
}

let syncRecurringFrequencyPicker = null;

function setupRecurringFrequencyPicker() {
    const picker = $("#recurringFrequencyPicker");
    const button = $("#recurringFrequencyPickerButton");
    const options = $("#recurringFrequencyOptions");
    const select = $("#recurringFrequency");
    const label = $("#recurringFrequencyPickerLabel");

    if (!picker || !button || !options || !select || !label) {
        return;
    }

    function closeDrawer() {
        picker.classList.remove("open");
        button.setAttribute("aria-expanded", "false");
    }

    function openDrawer() {
        picker.classList.add("open");
        button.setAttribute("aria-expanded", "true");
    }

    function sync(val) {
        const targetVal = val || select.value || "monthly";
        const option = [...select.options].find((item) => item.value === targetVal);
        if (option) {
            select.value = targetVal;
            label.textContent = option.textContent;
        }

        options.querySelectorAll(".category-option").forEach((btn) => {
            const isSelected = btn.dataset.value === select.value;
            btn.classList.toggle("selected", isSelected);
            btn.setAttribute("aria-selected", String(isSelected));
        });
    }

    syncRecurringFrequencyPicker = sync;

    button.addEventListener("click", (e) => {
        e.stopPropagation();
        if (picker.classList.contains("open")) {
            closeDrawer();
        } else {
            openDrawer();
        }
    });

    options.addEventListener("click", (e) => {
        const optBtn = e.target.closest(".category-option");
        if (!optBtn) return;
        select.value = optBtn.dataset.value;
        sync(select.value);
        closeDrawer();
    });

    document.addEventListener("click", (e) => {
        if (!picker.contains(e.target)) {
            closeDrawer();
        }
    });

    document.addEventListener("keydown", (e) => {
        if (e.key === "Escape") closeDrawer();
    });

    sync(select.value || "monthly");
}

function setupTransactionsPage() {
    const btnToggle = $("#btnToggleNewTransaction");
    const form = $("#transactionForm");
    const btnCancel = $("#cancelEditBtn");

    if (btnToggle && form) {
        btnToggle.addEventListener("click", () => {
            const isHidden = form.classList.toggle("hidden");
            if (!isHidden) {
                const descInput = $("#description");
                if (descInput) descInput.focus();
                const dateInput = $("#transactionDate");
                if (dateInput && !dateInput.value) {
                    dateInput.value = todayISO();
                }
                syncDatePicker();
            }
        });
    }

    if (btnCancel && form) {
        btnCancel.addEventListener("click", () => {
            resetTransactionForm();
            form.classList.add("hidden");
        });
    }
}

function setupRecurringBills() {
    const btnToggle = $("#btnToggleNewRecurring");
    const form = $("#recurringForm");
    const btnCancel = $("#btnCancelRecurring");

    setupRecurringCategoryPicker();
    setupRecurringFrequencyPicker();

    if (btnToggle && form) {
        btnToggle.addEventListener("click", () => {
            const isHidden = form.classList.toggle("hidden");
            if (!isHidden) {
                const nameInput = $("#recurringName");
                if (nameInput) nameInput.focus();
                const dateInput = $("#recurringDate");
                if (dateInput && !dateInput.value) {
                    dateInput.value = todayISO();
                }
                syncDatePicker();
            }
        });
    }

    if (btnCancel && form) {
        btnCancel.addEventListener("click", () => {
            form.reset();
            syncDatePicker();
            if (syncRecurringFrequencyPicker) syncRecurringFrequencyPicker("monthly");
            form.classList.add("hidden");
        });
    }

    if (form) {
        form.addEventListener("submit", (e) => {
            e.preventDefault();
            const name = String($("#recurringName")?.value || "").trim();
            const rawAmount = String($("#recurringAmount")?.value || "").trim().replace("R$", "").trim();
            const normalized = rawAmount.includes(",") ? rawAmount.replace(/\./g, "").replace(",", ".") : rawAmount;
            const amount = Number(normalized);
            const startDate = String($("#recurringDate")?.value || "").trim();
            const frequency = String($("#recurringFrequency")?.value || "monthly");
            const customCategory = String($("#recurringCustomCategory")?.value || "").trim();
            const category = customCategory || String($("#recurringCategory")?.value || "Assinaturas");

            if (!name) {
                showToast("Informe o nome da conta ou assinatura.");
                return;
            }
            if (!Number.isFinite(amount) || amount <= 0) {
                showToast("Informe um valor válido.");
                return;
            }
            if (!startDate) {
                showToast("Informe a data de vencimento.");
                return;
            }

            const dueDay = parseInt(startDate.slice(8, 10), 10) || 1;

            if (!Array.isArray(data.recurringBills)) {
                data.recurringBills = [];
            }

            const newBill = {
                id: createId(),
                name,
                amount,
                startDate,
                dueDay,
                frequency,
                category,
                paidDates: [],
                paidMonths: []
            };

            data.recurringBills.push(newBill);
            saveData();

            form.reset();
            syncDatePicker();
            if (syncRecurringFrequencyPicker) syncRecurringFrequencyPicker("monthly");
            form.classList.add("hidden");
            showToast(`Conta "${name}" cadastrada com sucesso!`);
            renderAll();
        });
    }

    document.addEventListener("click", (e) => {
        const btn = e.target.closest("button[data-action]");
        if (!btn) return;
        const action = btn.dataset.action;
        const id = btn.dataset.id;
        const targetDate = btn.dataset.date;

        if (action === "pay-recurring") {
            payRecurringBill(id, targetDate);
        } else if (action === "unpay-recurring") {
            unpayRecurringBill(id, targetDate);
        } else if (action === "delete-recurring") {
            deleteRecurringBill(id);
        }
    });

    document.addEventListener("input", (e) => {
        if (e.target && (e.target.id === "searchRecurringRows" || e.target.classList.contains("search-recurring-input"))) {
            renderRecurringRowsList();
        }
    });
}

/* =========================================
   MINI TUTORIAL E GUIA DE INÍCIO RÁPIDO
========================================= */

function setupWelcomeTutorial() {
    const overlay = $("#welcomeTutorial");
    const app = $(".app");

    // Registra clique no "Como usar" em qualquer página para guardar a página de origem
    document.querySelectorAll(".nav-link-tutorial").forEach((btn) => {
        btn.addEventListener("click", (e) => {
            const currentPath = window.location.pathname.split("/").pop() || "index.html";
            const currentPage = (currentPath === "index.html" || currentPath === "index1.html")
                ? "index.html"
                : (currentPath + window.location.search);

            sessionStorage.setItem("meuFinanceiro.tutorialReturnUrl", currentPage);

            if (overlay) {
                // Se já estiver na página que tem o tutorial (index.html), abre in-place sem recarregar
                e.preventDefault();
                document.body.classList.remove("mobile-nav-open");
                const menuBtn = document.getElementById("mobileMenuBtn");
                if (menuBtn) menuBtn.setAttribute("aria-expanded", "false");
                openTutorial();
            }
            // Se estiver em outra página (agenda.html, etc.), deixa o link padrão navegar com returnUrl
        });
    });

    if (!overlay) return;

    const urlParams = new URLSearchParams(window.location.search);
    const forceTutorial = urlParams.get("tutorial") === "true" || urlParams.get("tutorial") === "1";
    const tutorialCompleted = localStorage.getItem("meuFinanceiro.tutorialCompleted") === "true";

    // O tutorial aparece automaticamente APENAS no primeiríssimo acesso
    // Nas próximas visitas, só abre se for requisitado explicitamente pelo menu "Como usar"
    const shouldShow = forceTutorial || !tutorialCompleted;

    // Se for o primeiríssimo acesso, já grava para nunca mais reabrir sozinho no futuro
    if (!tutorialCompleted) {
        localStorage.setItem("meuFinanceiro.tutorialCompleted", "true");
    }

    // Se abriu via parâmetro na URL, limpa a URL do navegador para que atualizar a página não reabra o tutorial
    if (forceTutorial && window.history && window.history.replaceState) {
        const cleanParams = new URLSearchParams(window.location.search);
        cleanParams.delete("tutorial");
        const remainingQuery = cleanParams.toString() ? `?${cleanParams.toString()}` : "";
        window.history.replaceState({}, document.title, window.location.pathname + remainingQuery);
    }

    if (!shouldShow) {
        overlay.classList.add("hidden");
        overlay.style.display = "none";
        if (app) {
            app.classList.remove("app-hidden-for-tutorial");
            app.style.display = "";
        }
    } else {
        // Esconde o app para mostrar o tutorial separado antes do site abrir
        if (app) {
            app.classList.add("app-hidden-for-tutorial");
            app.style.display = "none";
        }
        overlay.classList.remove("hidden");
        overlay.style.display = "flex";
    }

    let currentStep = 0;
    const slides = overlay.querySelectorAll(".tutorial-slide");
    const pills = overlay.querySelectorAll(".tutorial-nav-pill");
    const dots = overlay.querySelectorAll(".tutorial-dot");
    const prevBtn = $("#tutorialPrevBtn");
    const nextBtn = $("#tutorialNextBtn");
    const finishBtn = $("#tutorialFinishBtn");
    const skipBtn = $("#tutorialSkipBtn");

    function goToStep(index) {
        if (index < 0) index = 0;
        if (index >= slides.length) index = slides.length - 1;
        currentStep = index;

        slides.forEach((slide, i) => {
            const isActive = i === currentStep;
            slide.classList.toggle("active", isActive);
            slide.setAttribute("aria-hidden", String(!isActive));
        });

        pills.forEach((pill, i) => {
            const isActive = i === currentStep;
            pill.classList.toggle("active", isActive);
            pill.setAttribute("aria-selected", String(isActive));
        });

        dots.forEach((dot, i) => {
            const isActive = i === currentStep;
            dot.classList.toggle("active", isActive);
        });

        if (prevBtn) {
            prevBtn.disabled = currentStep === 0;
            prevBtn.classList.toggle("disabled", currentStep === 0);
        }

        const isLast = currentStep === slides.length - 1;
        if (nextBtn) {
            nextBtn.classList.toggle("hidden", isLast);
        }
        if (finishBtn) {
            finishBtn.classList.toggle("hidden", !isLast);
        }
    }

    function openTutorial() {
        if (app) {
            app.classList.add("app-hidden-for-tutorial");
            app.style.display = "none";
        }
        overlay.classList.remove("hidden");
        overlay.style.display = "flex";
        goToStep(0);
        window.scrollTo(0, 0);
    }

    function closeAndEnterApp() {
        localStorage.setItem("meuFinanceiro.tutorialCompleted", "true");

        const rawReturn = urlParams.get("returnUrl") || sessionStorage.getItem("meuFinanceiro.tutorialReturnUrl");
        sessionStorage.removeItem("meuFinanceiro.tutorialReturnUrl");

        const isAnotherPage = rawReturn &&
            rawReturn !== "index.html" &&
            rawReturn !== "index1.html" &&
            !rawReturn.endsWith("/index.html") &&
            rawReturn !== "/";

        if (isAnotherPage) {
            window.location.href = rawReturn;
            return;
        }

        overlay.classList.add("tutorial-exiting");

        setTimeout(() => {
            overlay.classList.remove("tutorial-exiting");
            overlay.classList.add("hidden");
            overlay.style.display = "none";

            if (app) {
                app.classList.remove("app-hidden-for-tutorial");
                app.style.display = ""; // NUNCA flex: herda display de bloco nativo
                if (window.history && window.history.replaceState) {
                    const cleanUrl = window.location.pathname;
                    window.history.replaceState({}, document.title, cleanUrl);
                }
                renderAll();
                window.scrollTo(0, 0);
            }
        }, 350);
    }

    if (prevBtn) prevBtn.addEventListener("click", () => goToStep(currentStep - 1));
    if (nextBtn) nextBtn.addEventListener("click", () => goToStep(currentStep + 1));
    if (finishBtn) finishBtn.addEventListener("click", closeAndEnterApp);
    if (skipBtn) skipBtn.addEventListener("click", closeAndEnterApp);

    pills.forEach((pill) => {
        pill.addEventListener("click", () => {
            const step = parseInt(pill.dataset.step, 10);
            if (!isNaN(step)) goToStep(step);
        });
    });

    dots.forEach((dot) => {
        dot.addEventListener("click", () => {
            const step = parseInt(dot.dataset.step, 10);
            if (!isNaN(step)) goToStep(step);
        });
    });

    document.addEventListener("keydown", (e) => {
        if (overlay.classList.contains("hidden") || overlay.style.display === "none") return;
        if (e.key === "ArrowRight") goToStep(currentStep + 1);
        if (e.key === "ArrowLeft") goToStep(currentStep - 1);
        if (e.key === "Escape") closeAndEnterApp();
    });

    if (shouldShow) {
        goToStep(0);
    }
}

document.addEventListener("DOMContentLoaded", init);
