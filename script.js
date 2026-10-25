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
        goals: {}
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
            transactions: data.transactions,
            salaries: data.salaries || {},
            budgets: data.budgets || {},
            goals: data.goals || {}
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
        sessionStorage.setItem("meuFinanceiro.month", monthInput.value);
        return monthInput.value;
    }
    return sessionStorage.getItem("meuFinanceiro.month") || currentMonth();
}

function transactionsForMonth(month) {
    return data.transactions.filter(
        (transaction) => transaction.date.startsWith(month)
    );
}

function sumTransactions(transactions, type) {
    return transactions
        .filter((transaction) => transaction.type === type)
        .reduce((total, transaction) => total + transaction.amount, 0);
}

function getMonthlySummary(month) {
    const transactions = transactionsForMonth(month);
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
    const expenses = sumTransactions(transactions, "despesa");
    const balance = income - expenses;

    return {
        salary: effectiveSalary,
        extraIncome,
        income,
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

    if (!balanceElement || !incomeElement || !expensesElement || !savingsElement) return;

    const summary = getMonthlySummary(selectedMonth());

    balanceElement.textContent = money(summary.balance);
    incomeElement.textContent = money(summary.income);
    expensesElement.textContent = money(summary.expenses);

    balanceElement.style.color =
        summary.balance < 0 ? "var(--red)" : "var(--text)";

    savingsElement.textContent =
        `${summary.savingsRate.toLocaleString("pt-BR", {
            maximumFractionDigits: 1
        })}%`;
}

function renderMonthlyChart() {
    const canvas = $("#monthlyChart");
    if (!canvas) return;

    const labels = [];
    const incomeValues = [];
    const expenseValues = [];

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

function renderCategoryChart() {
    const canvas = $("#categoryChart");
    const legend = $("#categoryLegend");
    if (!canvas) return;

    const expenses = transactionsForMonth(selectedMonth())
        .filter((transaction) => transaction.type === "despesa");

    const totals = {};

    expenses.forEach((transaction) => {
        totals[transaction.category] =
            (totals[transaction.category] || 0) + transaction.amount;
    });

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

function renderAll() {
    renderSummary();
    renderMonthlyChart();
    renderCategoryChart();
    renderTransactions();
    renderPlanning();
    renderSettings();
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
   SELETOR DE DATAS MODERNO (DIA, MÊS E ANO)
========================================= */

const DP_MONTH_NAMES = [
    "Janeiro", "Fevereiro", "Março", "Abril", "Maio", "Junho",
    "Julho", "Agosto", "Setembro", "Outubro", "Novembro", "Dezembro"
];

const DP_MONTH_NAMES_SHORT = [
    "Jan", "Fev", "Mar", "Abr", "Mai", "Jun",
    "Jul", "Ago", "Set", "Out", "Nov", "Dez"
];

let dpCurrentYear = new Date().getFullYear();
let dpCurrentMonth = new Date().getMonth();
let dpViewMode = "days";

function syncDatePicker() {
    const input = $("#transactionDate");
    const label = $("#datePickerText");
    if (!input || !label) return;

    const val = input.value || todayISO();
    const parts = val.split("-");
    if (parts.length !== 3) return;

    const year = parseInt(parts[0], 10);
    const month = parseInt(parts[1], 10) - 1;
    const day = parseInt(parts[2], 10);

    const todayStr = todayISO();
    const d = new Date();
    d.setDate(d.getDate() - 1);
    const yesterdayStr = d.toISOString().split("T")[0];

    let suffix = "";
    if (val === todayStr) suffix = " (Hoje)";
    else if (val === yesterdayStr) suffix = " (Ontem)";

    label.textContent = `${day} de ${DP_MONTH_NAMES[month]} de ${year}${suffix}`;

    renderDatePickerDays();
}

function renderDatePickerDays() {
    const grid = $("#dpGrid");
    const headerTitle = $("#dpCurrentMonthYear");
    const input = $("#transactionDate");
    if (!grid || !headerTitle) return;

    headerTitle.textContent = `${DP_MONTH_NAMES[dpCurrentMonth]} de ${dpCurrentYear}`;

    const selectedVal = (input && input.value) ? input.value : todayISO();
    const todayStr = todayISO();

    const firstDayIndex = new Date(dpCurrentYear, dpCurrentMonth, 1).getDay();
    const daysInMonth = new Date(dpCurrentYear, dpCurrentMonth + 1, 0).getDate();
    const daysInPrevMonth = new Date(dpCurrentYear, dpCurrentMonth, 0).getDate();

    grid.innerHTML = "";

    // Dias do mês anterior
    for (let i = firstDayIndex - 1; i >= 0; i--) {
        const dayNum = daysInPrevMonth - i;
        const prevMonth = dpCurrentMonth === 0 ? 11 : dpCurrentMonth - 1;
        const prevYear = dpCurrentMonth === 0 ? dpCurrentYear - 1 : dpCurrentYear;
        const iso = `${prevYear}-${String(prevMonth + 1).padStart(2, "0")}-${String(dayNum).padStart(2, "0")}`;

        const btn = document.createElement("button");
        btn.type = "button";
        btn.className = "dp-day other-month";
        btn.textContent = String(dayNum);
        btn.addEventListener("click", () => {
            selectDate(iso);
        });
        grid.appendChild(btn);
    }

    // Dias do mês atual
    for (let dayNum = 1; dayNum <= daysInMonth; dayNum++) {
        const iso = `${dpCurrentYear}-${String(dpCurrentMonth + 1).padStart(2, "0")}-${String(dayNum).padStart(2, "0")}`;

        const btn = document.createElement("button");
        btn.type = "button";
        btn.className = "dp-day";
        btn.textContent = String(dayNum);

        if (iso === todayStr) {
            btn.classList.add("today");
        }
        if (iso === selectedVal) {
            btn.classList.add("selected");
        }

        btn.addEventListener("click", () => {
            selectDate(iso);
        });
        grid.appendChild(btn);
    }

    // Dias do próximo mês para completar a grade
    const currentSlots = firstDayIndex + daysInMonth;
    const totalSlots = currentSlots > 35 ? 42 : 35;
    const remainingSlots = totalSlots - currentSlots;
    for (let dayNum = 1; dayNum <= remainingSlots; dayNum++) {
        const nextMonth = dpCurrentMonth === 11 ? 0 : dpCurrentMonth + 1;
        const nextYear = dpCurrentMonth === 11 ? dpCurrentYear + 1 : dpCurrentYear;
        const iso = `${nextYear}-${String(nextMonth + 1).padStart(2, "0")}-${String(dayNum).padStart(2, "0")}`;

        const btn = document.createElement("button");
        btn.type = "button";
        btn.className = "dp-day other-month";
        btn.textContent = String(dayNum);
        btn.addEventListener("click", () => {
            selectDate(iso);
        });
        grid.appendChild(btn);
    }
}

function renderDatePickerMonths() {
    const grid = $("#dpMonthsGrid");
    const yearDisplay = $("#dpSelectedYear");
    if (!grid || !yearDisplay) return;

    yearDisplay.textContent = String(dpCurrentYear);
    grid.innerHTML = "";

    DP_MONTH_NAMES_SHORT.forEach((name, idx) => {
        const btn = document.createElement("button");
        btn.type = "button";
        btn.className = "dp-month-btn";
        if (idx === dpCurrentMonth) {
            btn.classList.add("selected");
        }
        btn.textContent = name;
        btn.addEventListener("click", () => {
            dpCurrentMonth = idx;
            switchDatePickerView("days");
            renderDatePickerDays();
        });
        grid.appendChild(btn);
    });
}

function switchDatePickerView(mode) {
    dpViewMode = mode;
    const daysView = $("#dpDaysView");
    const monthsView = $("#dpMonthsView");
    const viewBtnChevron = $(".dp-view-chevron");

    if (mode === "months") {
        if (daysView) daysView.classList.add("hidden");
        if (monthsView) monthsView.classList.remove("hidden");
        if (viewBtnChevron) viewBtnChevron.textContent = "▴";
        renderDatePickerMonths();
    } else {
        if (monthsView) monthsView.classList.add("hidden");
        if (daysView) daysView.classList.remove("hidden");
        if (viewBtnChevron) viewBtnChevron.textContent = "▾";
        renderDatePickerDays();
    }
}

function selectDate(isoString) {
    const input = $("#transactionDate");
    if (input) {
        input.value = isoString;
        input.dispatchEvent(new Event("change", { bubbles: true }));
    }
    const parts = isoString.split("-");
    if (parts.length === 3) {
        dpCurrentYear = parseInt(parts[0], 10);
        dpCurrentMonth = parseInt(parts[1], 10) - 1;
    }

    syncDatePicker();
    closeDatePicker();
}

function openDatePicker() {
    const container = $("#customDatePicker");
    const trigger = $("#datePickerTrigger");
    if (!container || !trigger) return;

    switchDatePickerView("days");

    const input = $("#transactionDate");
    const val = (input && input.value) ? input.value : todayISO();
    const parts = val.split("-");
    if (parts.length === 3) {
        dpCurrentYear = parseInt(parts[0], 10);
        dpCurrentMonth = parseInt(parts[1], 10) - 1;
    }

    renderDatePickerDays();

    container.classList.add("open");
    trigger.setAttribute("aria-expanded", "true");
}

function closeDatePicker() {
    const container = $("#customDatePicker");
    const trigger = $("#datePickerTrigger");
    if (!container) return;

    container.classList.remove("open");
    if (trigger) trigger.setAttribute("aria-expanded", "false");
}

function setupDatePicker() {
    const container = $("#customDatePicker");
    const trigger = $("#datePickerTrigger");
    const input = $("#transactionDate");
    const backdrop = $("#datePickerBackdrop");
    const closeBtn = $("#dpCloseBtn");
    const prevBtn = $("#dpPrevBtn");
    const nextBtn = $("#dpNextBtn");
    const viewBtn = $("#dpViewBtn");
    const todayBtn = $("#dpTodayBtn");
    const yesterdayBtn = $("#dpYesterdayBtn");
    const prevYearBtn = $("#dpPrevYearBtn");
    const nextYearBtn = $("#dpNextYearBtn");

    if (!container || !trigger || !input) return;

    trigger.addEventListener("click", (e) => {
        e.stopPropagation();
        if (container.classList.contains("open")) {
            closeDatePicker();
        } else {
            openDatePicker();
        }
    });

    if (backdrop) {
        backdrop.addEventListener("click", closeDatePicker);
    }

    if (closeBtn) {
        closeBtn.addEventListener("click", closeDatePicker);
    }

    if (prevBtn) {
        prevBtn.addEventListener("click", (e) => {
            e.stopPropagation();
            if (dpCurrentMonth === 0) {
                dpCurrentMonth = 11;
                dpCurrentYear--;
            } else {
                dpCurrentMonth--;
            }
            renderDatePickerDays();
        });
    }

    if (nextBtn) {
        nextBtn.addEventListener("click", (e) => {
            e.stopPropagation();
            if (dpCurrentMonth === 11) {
                dpCurrentMonth = 0;
                dpCurrentYear++;
            } else {
                dpCurrentMonth++;
            }
            renderDatePickerDays();
        });
    }

    if (viewBtn) {
        viewBtn.addEventListener("click", (e) => {
            e.stopPropagation();
            switchDatePickerView(dpViewMode === "days" ? "months" : "days");
        });
    }

    if (prevYearBtn) {
        prevYearBtn.addEventListener("click", (e) => {
            e.stopPropagation();
            dpCurrentYear--;
            renderDatePickerMonths();
        });
    }

    if (nextYearBtn) {
        nextYearBtn.addEventListener("click", (e) => {
            e.stopPropagation();
            dpCurrentYear++;
            renderDatePickerMonths();
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
            const d = new Date();
            d.setDate(d.getDate() - 1);
            selectDate(d.toISOString().split("T")[0]);
        });
    }

    document.addEventListener("click", (e) => {
        if (!container.contains(e.target)) {
            closeDatePicker();
        }
    });

    document.addEventListener("keydown", (e) => {
        if (e.key === "Escape" && container.classList.contains("open")) {
            closeDatePicker();
        }
    });

    input.addEventListener("change", syncDatePicker);

    // Initial sync
    syncDatePicker();
}

/* =========================================
   SELETOR DE MÊS E ANO MODERNO (DASHBOARD/RELATÓRIOS/ETC)
========================================= */

let mpCurrentYear = new Date().getFullYear();

function syncMonthPicker() {
    const input = $("#dashboardMonth");
    const label = $("#monthPickerText");
    if (!input || !label) return;

    const val = input.value || selectedMonth();
    const parts = val.split("-");
    if (parts.length !== 2) return;

    const year = parseInt(parts[0], 10);
    const month = parseInt(parts[1], 10) - 1;

    label.textContent = `${DP_MONTH_NAMES[month]} de ${year}`;
    mpCurrentYear = year;

    renderMonthPickerMonths();
}

function renderMonthPickerMonths() {
    const grid = $("#mpMonthsGrid");
    const yearDisplay = $("#mpYearDisplay");
    const input = $("#dashboardMonth");
    if (!grid || !yearDisplay) return;

    yearDisplay.textContent = String(mpCurrentYear);
    grid.innerHTML = "";

    const selectedVal = (input && input.value) ? input.value : selectedMonth();
    const currentCalMonth = currentMonth();

    DP_MONTH_NAMES.forEach((name, idx) => {
        const monthStr = String(idx + 1).padStart(2, "0");
        const iso = `${mpCurrentYear}-${monthStr}`;

        const btn = document.createElement("button");
        btn.type = "button";
        btn.className = "mp-month-btn";
        btn.textContent = name;

        if (iso === currentCalMonth) {
            btn.classList.add("current");
        }
        if (iso === selectedVal) {
            btn.classList.add("selected");
        }

        btn.addEventListener("click", () => {
            selectMonth(iso);
        });
        grid.appendChild(btn);
    });
}

function selectMonth(isoString) {
    const input = $("#dashboardMonth");
    if (input) {
        input.value = isoString;
        sessionStorage.setItem("meuFinanceiro.month", isoString);
        input.dispatchEvent(new Event("change", { bubbles: true }));
    }
    const parts = isoString.split("-");
    if (parts.length === 2) {
        mpCurrentYear = parseInt(parts[0], 10);
    }
    syncMonthPicker();
    closeMonthPicker();
}

function openMonthPicker() {
    const container = $("#customMonthPicker");
    const trigger = $("#monthPickerTrigger");
    if (!container || !trigger) return;

    const input = $("#dashboardMonth");
    const val = (input && input.value) ? input.value : selectedMonth();
    const parts = val.split("-");
    if (parts.length === 2) {
        mpCurrentYear = parseInt(parts[0], 10);
    }

    renderMonthPickerMonths();

    container.classList.add("open");
    trigger.setAttribute("aria-expanded", "true");
}

function closeMonthPicker() {
    const container = $("#customMonthPicker");
    const trigger = $("#monthPickerTrigger");
    if (!container) return;

    container.classList.remove("open");
    if (trigger) trigger.setAttribute("aria-expanded", "false");
}

function setupMonthPicker() {
    const container = $("#customMonthPicker");
    const trigger = $("#monthPickerTrigger");
    const input = $("#dashboardMonth");
    const backdrop = $("#monthPickerBackdrop");
    const closeBtn = $("#mpCloseBtn");
    const prevYearBtn = $("#mpPrevYearBtn");
    const nextYearBtn = $("#mpNextYearBtn");
    const currentMonthBtn = $("#mpCurrentMonthBtn");
    const prevMonthBtn = $("#mpPrevMonthBtn");
    const nextMonthBtn = $("#mpNextMonthBtn");

    if (!container || !trigger || !input) return;

    trigger.addEventListener("click", (e) => {
        e.stopPropagation();
        if (container.classList.contains("open")) {
            closeMonthPicker();
        } else {
            openMonthPicker();
        }
    });

    if (backdrop) {
        backdrop.addEventListener("click", closeMonthPicker);
    }

    if (closeBtn) {
        closeBtn.addEventListener("click", closeMonthPicker);
    }

    if (prevYearBtn) {
        prevYearBtn.addEventListener("click", (e) => {
            e.stopPropagation();
            mpCurrentYear--;
            renderMonthPickerMonths();
        });
    }

    if (nextYearBtn) {
        nextYearBtn.addEventListener("click", (e) => {
            e.stopPropagation();
            mpCurrentYear++;
            renderMonthPickerMonths();
        });
    }

    if (currentMonthBtn) {
        currentMonthBtn.addEventListener("click", (e) => {
            e.stopPropagation();
            selectMonth(currentMonth());
        });
    }

    if (prevMonthBtn) {
        prevMonthBtn.addEventListener("click", (e) => {
            e.stopPropagation();
            const curr = input.value || selectedMonth();
            const parts = curr.split("-");
            let y = parseInt(parts[0], 10);
            let m = parseInt(parts[1], 10) - 1;
            if (m === 0) {
                m = 12;
                y--;
            }
            selectMonth(`${y}-${String(m).padStart(2, "0")}`);
        });
    }

    if (nextMonthBtn) {
        nextMonthBtn.addEventListener("click", (e) => {
            e.stopPropagation();
            const curr = input.value || selectedMonth();
            const parts = curr.split("-");
            let y = parseInt(parts[0], 10);
            let m = parseInt(parts[1], 10) + 1;
            if (m === 13) {
                m = 1;
                y++;
            }
            selectMonth(`${y}-${String(m).padStart(2, "0")}`);
        });
    }

    document.addEventListener("click", (e) => {
        if (!container.contains(e.target)) {
            closeMonthPicker();
        }
    });

    document.addEventListener("keydown", (e) => {
        if (e.key === "Escape" && container.classList.contains("open")) {
            closeMonthPicker();
        }
    });

    input.addEventListener("change", syncMonthPicker);

    syncMonthPicker();
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
    if (cancelBtn) cancelBtn.classList.add("hidden");
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

    $("#editId").value = transaction.id;
    $("#type").value = transaction.type;

    const typeLabel = $("#typeLabel");
    if (typeLabel) {
        typeLabel.textContent = transaction.type === "receita" ? "Receita extra" : "Despesa";
    }
    document.querySelectorAll("#typeOptions .filter-select-option").forEach((opt) => {
        const match = opt.dataset.value === transaction.type;
        opt.classList.toggle("selected", match);
        opt.setAttribute("aria-selected", String(match));
    });

    $("#description").value = transaction.description;
    $("#amount").value = transaction.amount;

    const isBuiltInCategory =
        CATEGORY_OPTIONS.includes(transaction.category);

    $("#customCategory").value =
        isBuiltInCategory ? "" : transaction.category;

    renderCategoryOptions(
        transaction.type,
        isBuiltInCategory ? transaction.category : "Outros"
    );

    closeCategoryDrawer();

    $("#transactionDate").value = transaction.date;
    syncDatePicker();
    $("#notes").value = transaction.notes || "";

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

    return new Promise((resolve) => {
        const finish = (result) => {
            dialog.classList.remove("is-open");
            dialog.setAttribute("aria-hidden", "true");
            document.body.classList.remove("dialog-open");
            confirmButton.removeEventListener("click", onConfirm);
            $("#confirmDialogCancel").removeEventListener("click", onCancel);
            $("#confirmDialogClose").removeEventListener("click", onCancel);
            dialog.removeEventListener("click", onBackdrop);
            document.removeEventListener("keydown", onEscape);
            resolve(result);
        };
        const onConfirm = () => finish(true);
        const onCancel = () => finish(false);
        const onBackdrop = (event) => { if (event.target === dialog) onCancel(); };
        const onEscape = (event) => { if (event.key === "Escape") onCancel(); };

        confirmButton.addEventListener("click", onConfirm);
        $("#confirmDialogCancel").addEventListener("click", onCancel);
        $("#confirmDialogClose").addEventListener("click", onCancel);
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

    sessionStorage.setItem("meuFinanceiro.month", date.slice(0, 7));
    if ($("#dashboardMonth")) {
        $("#dashboardMonth").value = date.slice(0, 7);
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
        const icon = btn.querySelector(".privacy-icon");
        const text = btn.querySelector(".privacy-text");
        if (icon) icon.textContent = isPrivate ? "🙈" : "👁️";
        if (text) text.textContent = isPrivate ? "Exibir" : "Ocultar";
        btn.setAttribute("title", isPrivate ? "Exibir valores na tela" : "Ocultar valores na tela");
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
            goals: importedData.goals
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
        monthInput.value = selectedMonth();
        monthInput.addEventListener("change", (e) => {
            sessionStorage.setItem("meuFinanceiro.month", e.target.value);
            renderAll();
        });
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
    setupMonthPicker();
    renderAll();

    // Se a página de lançamentos recebeu um ID para edição via query string (?edit=...)
    const urlParams = new URLSearchParams(window.location.search);
    const editId = urlParams.get("edit");
    if (editId) {
        editTransaction(editId);
    }
}

document.addEventListener("DOMContentLoaded", init);
