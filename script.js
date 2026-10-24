
"use strict";

const $ = (selector) => document.querySelector(selector);

const STORAGE_KEY = "meuFinanceiro.v1";

const COLORS = [
    "#9475ff", "#45d6a0", "#61a5ff", "#ff7485",
    "#f7bd62", "#46c7d9", "#ed86d1", "#a4c66b",
    "#b4a0ff", "#e99b70", "#6ca4ec", "#9ca9bd"
];

const CATEGORY_ICONS = {
    "Alimentação": "🍽️",
    "Moradia": "🏠",
    "Água e luz": "💡",
    "Transporte": "🚗",
    "Saúde": "💊",
    "Educação": "📚",
    "Lazer": "🎮",
    "Compras": "🛍️",
    "Assinaturas": "📱",
    "Salário": "💼",
    "Investimentos": "📈",
    "Outros": "📦"
};

const CATEGORY_OPTIONS = [
    "Alimentação", "Moradia", "Água e luz", "Transporte",
    "Saúde", "Educação", "Lazer", "Compras",
    "Assinaturas", "Salário", "Investimentos", "Outros"
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
    return $("#dashboardMonth").value || currentMonth();
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
    const salary = Number(data.salaries[month] || 0);
    const extraIncome = sumTransactions(transactions, "receita");
    const expenses = sumTransactions(transactions, "despesa");
    const income = salary + extraIncome;
    const balance = income - expenses;

    return {
        salary,
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

    toast.textContent = message;
    toast.classList.add("show");

    clearTimeout(toastTimeout);

    toastTimeout = setTimeout(() => {
        toast.classList.remove("show");
    }, 3000);
}

function renderSummary() {
    const summary = getMonthlySummary(selectedMonth());

    $("#monthBalance").textContent = money(summary.balance);
    $("#monthIncome").textContent = money(summary.income);
    $("#monthExpenses").textContent = money(summary.expenses);

    const balanceElement = $("#monthBalance");

    balanceElement.style.color =
        summary.balance < 0 ? "var(--red)" : "var(--text)";

    $("#savingsRate").textContent =
        `${summary.savingsRate.toLocaleString("pt-BR", {
            maximumFractionDigits: 1
        })}%`;
}

function renderMonthlyChart() {
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

    monthlyChart = new Chart($("#monthlyChart"), {
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

    categoryChart = new Chart($("#categoryChart"), {
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

    const legend = $("#categoryLegend");

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
    const [year, month, day] = dateString.split("-").map(Number);

    return new Date(year, month - 1, day, 12)
        .toLocaleDateString("pt-BR");
}

function renderTransactions() {
    const search = $("#searchTransactions").value
        .trim()
        .toLocaleLowerCase("pt-BR");

    const type = $("#typeFilter").value;

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

    const visible = showAllTransactions
        ? filtered
        : filtered.slice(0, 6);

    const list = $("#transactionList");

    if (!visible.length) {
        list.innerHTML = `
            <div class="empty-state">
                <div style="font-size:30px;margin-bottom:8px">🧾</div>
                <p>Nenhum lançamento encontrado.</p>
                <p>Adicione uma movimentação ou altere sua busca.</p>
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

    $("#transactionCount").textContent =
        `${filtered.length} lançamento${filtered.length === 1 ? "" : "s"}`;

    $("#showAllBtn").textContent = showAllTransactions
        ? "Mostrar menos"
        : "Ver todos";

    $("#showAllBtn").classList.toggle("hidden", filtered.length <= 6);
}

function renderPlanning() {
    const month = selectedMonth();
    const summary = getMonthlySummary(month);

    const budget = Number(data.budgets[month] || 0);
    const spent = summary.expenses;

    $("#budget").value = budget || "";

    const budgetPercent = budget > 0 ? spent / budget * 100 : 0;

    $("#budgetProgress").style.width =
        `${Math.min(100, budgetPercent)}%`;

    $("#budgetProgress").style.background =
        budget > 0 && spent > budget ? "var(--red)" : "var(--purple)";

    if (!budget) {
        $("#budgetStatus").textContent = "Nenhum limite definido.";
    } else if (spent > budget) {
        $("#budgetStatus").textContent =
            `Você ultrapassou o limite em ${money(spent - budget)}.`;
    } else {
        $("#budgetStatus").textContent =
            `${money(budget - spent)} disponíveis de ${money(budget)} (${budgetPercent.toLocaleString("pt-BR", {
                maximumFractionDigits: 1
            })}% utilizado).`;
    }

    const goal = Number(data.goals[month] || 0);

    $("#goal").value = goal || "";

    // A meta considera a economia positiva do mês.
    const saved = Math.max(0, summary.balance);
    const goalPercent = goal > 0 ? saved / goal * 100 : 0;

    $("#goalProgress").style.width =
        `${Math.min(100, goalPercent)}%`;

    if (!goal) {
        $("#goalStatus").textContent = "Nenhuma meta definida.";
    } else if (saved >= goal) {
        $("#goalStatus").textContent =
            `Parabéns! Sua meta de ${money(goal)} foi alcançada.`;
    } else {
        $("#goalStatus").textContent =
            `Faltam ${money(goal - saved)} para sua meta de ${money(goal)}.`;
    }
}

function renderSettings() {
    $("#salary").value =
        data.salaries[selectedMonth()] || "";
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

    if (!picker || !button) return;

    picker.classList.remove("open");
    button.setAttribute("aria-expanded", "false");
}

function openCategoryDrawer() {
    const picker = $("#categoryPicker");
    const button = $("#categoryPickerButton");

    if (!picker || !button) return;

    picker.classList.add("open");
    button.setAttribute("aria-expanded", "true");
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

function setupCategoryPicker() {
    const picker = $("#categoryPicker");
    const button = $("#categoryPickerButton");
    const options = $("#categoryOptions");
    const select = $("#category");
    const customInput = $("#customCategory");

    if (!picker || !button || !options || !select || !customInput) {
        return;
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

    /*
     * A gaveta não fecha ao mover o mouse para fora do seletor.
     * Ela fecha quando uma categoria é escolhida,
     * ao clicar fora ou ao pressionar Escape.
     */

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

    syncCategoryPicker(select.value);
}

/* ==============================
   FORMULÁRIO DE LANÇAMENTOS
================================ */

function resetTransactionForm() {
    $("#transactionForm").reset();

    $("#editId").value = "";
    $("#transactionDate").value = todayISO();
    $("#type").value = "despesa";
    $("#category").value = "Alimentação";
    $("#customCategory").value = "";

    syncCategoryPicker("Alimentação");
    closeCategoryDrawer();

    $("#formTitle").textContent = "Novo lançamento";
    $("#saveBtn").textContent = "Salvar lançamento";

    $("#cancelEditBtn").classList.add("hidden");
}

function editTransaction(id) {
    const transaction = data.transactions.find(
        (item) => item.id === id
    );

    if (!transaction) return;

    $("#editId").value = transaction.id;
    $("#type").value = transaction.type;
    $("#description").value = transaction.description;
    $("#amount").value = transaction.amount;

    const isBuiltInCategory =
        CATEGORY_OPTIONS.includes(transaction.category);

    $("#customCategory").value =
        isBuiltInCategory ? "" : transaction.category;

    syncCategoryPicker(
        isBuiltInCategory ? transaction.category : "Outros"
    );

    closeCategoryDrawer();

    $("#transactionDate").value = transaction.date;
    $("#notes").value = transaction.notes || "";

    $("#formTitle").textContent = "Editar lançamento";
    $("#saveBtn").textContent = "Salvar alterações";

    $("#cancelEditBtn").classList.remove("hidden");

    $("#lancamentos").scrollIntoView({
        behavior: "smooth"
    });
}

function showConfirmDialog({ title, message, confirmLabel = "Excluir", danger = true }) {
    const dialog = $("#confirmDialog");
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

    if ($("#editId").value === id) {
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
    const amount = Number($("#amount").value);
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

    // A tela acompanha automaticamente o mês do lançamento.
    $("#dashboardMonth").value = date.slice(0, 7);

    resetTransactionForm();
    renderAll();

    showToast(
        id
            ? "Lançamento atualizado com sucesso!"
            : "Lançamento salvo com sucesso!"
    );
}

/* ==============================
   SALÁRIO, LIMITE E META
================================ */

function handleSalarySubmit(event) {
    event.preventDefault();

    const salary = Number($("#salary").value);
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

    const budget = Number($("#budget").value);
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

    const goal = Number($("#goal").value);
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
        $("#importFile").value = "";
    }
}

/* ==============================
   NAVEGAÇÃO E INICIALIZAÇÃO
================================ */

function setupNavigation() {
    document.querySelectorAll(".nav-link").forEach((link) => {
        link.addEventListener("click", () => {
            document.querySelectorAll(".nav-link").forEach((item) => {
                item.classList.remove("active");
            });

            link.classList.add("active");
        });
    });
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
    const today = todayISO();

    $("#transactionDate").value = today;
    $("#dashboardMonth").value = currentMonth();

    $("#todayText").textContent = new Date().toLocaleDateString(
        "pt-BR",
        {
            weekday: "long",
            day: "numeric",
            month: "long",
            year: "numeric"
        }
    );

    $("#currentYear").textContent = new Date().getFullYear();

    $("#transactionForm").addEventListener(
        "submit",
        handleTransactionSubmit
    );

    $("#settingsForm").addEventListener(
        "submit",
        handleSalarySubmit
    );

    $("#budgetForm").addEventListener(
        "submit",
        handleBudgetSubmit
    );

    $("#goalForm").addEventListener(
        "submit",
        handleGoalSubmit
    );

    $("#dashboardMonth").addEventListener("change", renderAll);

    $("#searchTransactions").addEventListener(
        "input",
        renderTransactions
    );

    $("#typeFilter").addEventListener(
        "change",
        renderTransactions
    );

    // Filtro customizado: mantém o select original como fonte do valor filtrado.
    const filterControl = $("#typeFilterControl");
    const filterButton = $("#typeFilterButton");
    const filterLabel = $("#typeFilterLabel");
    const filterSelect = $("#typeFilter");

    filterButton.addEventListener("click", () => {
        const isOpen = filterControl.classList.toggle("open");
        filterButton.setAttribute("aria-expanded", String(isOpen));
    });

    $("#typeFilterOptions").addEventListener("click", (event) => {
        const option = event.target.closest(".filter-select-option");
        if (!option) return;

        filterSelect.value = option.dataset.value;
        filterLabel.textContent = option.textContent.trim();
        $("#typeFilterOptions").querySelectorAll(".filter-select-option").forEach((item) => {
            const selected = item === option;
            item.classList.toggle("selected", selected);
            item.setAttribute("aria-selected", String(selected));
        });

        filterControl.classList.remove("open");
        filterButton.setAttribute("aria-expanded", "false");
        filterSelect.dispatchEvent(new Event("change", { bubbles: true }));
    });

    // Seletor personalizado de tipo de lançamento, com o mesmo visual do filtro "Todos".
    const typeControl = $("#typeControl");
    const typeButton = $("#typeButton");
    const typeLabel = $("#typeLabel");
    const typeSelect = $("#type");

    typeButton.addEventListener("click", () => {
        const isOpen = typeControl.classList.toggle("open");
        typeButton.setAttribute("aria-expanded", String(isOpen));
        if (isOpen) {
            filterControl.classList.remove("open");
            filterButton.setAttribute("aria-expanded", "false");
        }
    });

    $("#typeOptions").addEventListener("click", (event) => {
        const option = event.target.closest(".filter-select-option");
        if (!option) return;

        typeSelect.value = option.dataset.value;
        typeLabel.textContent = option.textContent.trim();
        $("#typeOptions").querySelectorAll(".filter-select-option").forEach((item) => {
            const selected = item === option;
            item.classList.toggle("selected", selected);
            item.setAttribute("aria-selected", String(selected));
        });

        typeControl.classList.remove("open");
        typeButton.setAttribute("aria-expanded", "false");
        typeSelect.dispatchEvent(new Event("change", { bubbles: true }));
    });

    document.addEventListener("click", (event) => {
        if (!filterControl.contains(event.target)) {
            filterControl.classList.remove("open");
            filterButton.setAttribute("aria-expanded", "false");
        }
        if (!typeControl.contains(event.target)) {
            typeControl.classList.remove("open");
            typeButton.setAttribute("aria-expanded", "false");
        }
    });

    document.addEventListener("keydown", (event) => {
        if (event.key === "Escape") {
            filterControl.classList.remove("open");
            filterButton.setAttribute("aria-expanded", "false");
            typeControl.classList.remove("open");
            typeButton.setAttribute("aria-expanded", "false");
        }
    });

    $("#transactionList").addEventListener("click", (event) => {
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

    $("#newTransactionBtn").addEventListener("click", () => {
        resetTransactionForm();

        $("#lancamentos").scrollIntoView({
            behavior: "smooth"
        });

        $("#description").focus({
            preventScroll: true
        });
    });

    $("#cancelEditBtn").addEventListener(
        "click",
        resetTransactionForm
    );

    $("#showAllBtn").addEventListener("click", () => {
        showAllTransactions = !showAllTransactions;
        renderTransactions();
    });

    $("#exportBtn").addEventListener("click", exportBackup);

    $("#importBtn").addEventListener("click", () => {
        $("#importFile").click();
    });

    $("#importFile").addEventListener("change", (event) => {
        importBackup(event.target.files[0]);
    });

    setupNavigation();
    setupCategoryPicker();
    renderAll();
}

document.addEventListener("DOMContentLoaded", init);