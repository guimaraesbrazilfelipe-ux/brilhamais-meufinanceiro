-- ==============================================================================
-- MEU FINANCEIRO - ESQUEMA DE BANCO DE DADOS (SUPABASE / POSTGRESQL)
-- ==============================================================================
-- Este script cria a estrutura mínima e completa para persistir todos os dados
-- do Meu Financeiro com suporte a múltiplos usuários e Row Level Security (RLS).
-- ==============================================================================

-- 0. Extensões
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- ------------------------------------------------------------------------------
-- 1. TABELA: user_settings
-- Configurações de salário, preferências e onboarding do usuário (1:1 com auth.users)
-- ------------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.user_settings (
    user_id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
    salary_amount NUMERIC(12,2) DEFAULT 0 CHECK (salary_amount >= 0),
    gross_amount NUMERIC(12,2) DEFAULT 0 CHECK (gross_amount >= 0),
    benefits_amount NUMERIC(12,2) DEFAULT 0 CHECK (benefits_amount >= 0),
    start_date DATE,
    pay_day SMALLINT DEFAULT 5 CHECK (pay_day BETWEEN 1 AND 31),
    auto_deposit BOOLEAN DEFAULT TRUE,
    has_13th BOOLEAN DEFAULT FALSE,
    thirteenth_amount NUMERIC(12,2) DEFAULT 0 CHECK (thirteenth_amount >= 0),
    privacy_mode BOOLEAN DEFAULT FALSE,
    tutorial_completed BOOLEAN DEFAULT FALSE,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- ------------------------------------------------------------------------------
-- 2. TABELA: transactions
-- Lançamentos financeiros avulsos (receitas extras e despesas cotidianas)
-- ------------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.transactions (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    type TEXT NOT NULL CHECK (type IN ('receita', 'despesa')),
    description TEXT NOT NULL,
    amount NUMERIC(12,2) NOT NULL CHECK (amount > 0),
    category TEXT NOT NULL,
    date DATE NOT NULL,
    notes TEXT,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_transactions_user_date ON public.transactions(user_id, date DESC);

-- ------------------------------------------------------------------------------
-- 3. TABELA: recurring_bills
-- Cadastro de contas fixas e assinaturas recorrentes
-- ------------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.recurring_bills (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    name TEXT NOT NULL,
    amount NUMERIC(12,2) NOT NULL CHECK (amount > 0),
    start_date DATE NOT NULL,
    due_day SMALLINT NOT NULL CHECK (due_day BETWEEN 1 AND 31),
    subscription_time TIME DEFAULT '09:00:00',
    frequency TEXT NOT NULL DEFAULT 'monthly',
    category TEXT NOT NULL,
    is_variable BOOLEAN DEFAULT FALSE,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_recurring_bills_user ON public.recurring_bills(user_id);

-- ------------------------------------------------------------------------------
-- 4. TABELA: recurring_bill_records
-- Histórico mensal de pagamentos e valores específicos de contas variáveis
-- ------------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.recurring_bill_records (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    recurring_bill_id UUID NOT NULL REFERENCES public.recurring_bills(id) ON DELETE CASCADE,
    user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    month_year CHAR(7) NOT NULL, -- Formato 'YYYY-MM'
    amount NUMERIC(12,2) CHECK (amount IS NULL OR amount > 0),
    is_paid BOOLEAN NOT NULL DEFAULT FALSE,
    paid_date DATE,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    CONSTRAINT uq_bill_month UNIQUE (recurring_bill_id, month_year)
);

CREATE INDEX IF NOT EXISTS idx_recurring_records_user_month ON public.recurring_bill_records(user_id, month_year);

-- ------------------------------------------------------------------------------
-- 5. TABELA: monthly_plans
-- Planejamento mensal: limite de gastos, metas de economia e salários específicos
-- ------------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.monthly_plans (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    month_year CHAR(7) NOT NULL, -- Formato 'YYYY-MM'
    salary_override NUMERIC(12,2) CHECK (salary_override IS NULL OR salary_override >= 0),
    budget_limit NUMERIC(12,2) CHECK (budget_limit IS NULL OR budget_limit >= 0),
    savings_goal NUMERIC(12,2) CHECK (savings_goal IS NULL OR savings_goal >= 0),
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW(),
    CONSTRAINT uq_user_month_plan UNIQUE (user_id, month_year)
);

CREATE INDEX IF NOT EXISTS idx_monthly_plans_user_month ON public.monthly_plans(user_id, month_year);

-- ------------------------------------------------------------------------------
-- 6. HABILITAR ROW LEVEL SECURITY (RLS)
-- ------------------------------------------------------------------------------
ALTER TABLE public.user_settings ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.transactions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.recurring_bills ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.recurring_bill_records ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.monthly_plans ENABLE ROW LEVEL SECURITY;

-- ------------------------------------------------------------------------------
-- 7. POLÍTICAS DE ACESSO ISOLADO POR USUÁRIO (RLS POLICIES)
-- ------------------------------------------------------------------------------
DROP POLICY IF EXISTS "user_settings_policy" ON public.user_settings;
CREATE POLICY "user_settings_policy" ON public.user_settings
    FOR ALL
    USING (auth.uid() = user_id)
    WITH CHECK (auth.uid() = user_id);

DROP POLICY IF EXISTS "transactions_policy" ON public.transactions;
CREATE POLICY "transactions_policy" ON public.transactions
    FOR ALL
    USING (auth.uid() = user_id)
    WITH CHECK (auth.uid() = user_id);

DROP POLICY IF EXISTS "recurring_bills_policy" ON public.recurring_bills;
CREATE POLICY "recurring_bills_policy" ON public.recurring_bills
    FOR ALL
    USING (auth.uid() = user_id)
    WITH CHECK (auth.uid() = user_id);

DROP POLICY IF EXISTS "recurring_bill_records_policy" ON public.recurring_bill_records;
CREATE POLICY "recurring_bill_records_policy" ON public.recurring_bill_records
    FOR ALL
    USING (auth.uid() = user_id)
    WITH CHECK (auth.uid() = user_id);

DROP POLICY IF EXISTS "monthly_plans_policy" ON public.monthly_plans;
CREATE POLICY "monthly_plans_policy" ON public.monthly_plans
    FOR ALL
    USING (auth.uid() = user_id)
    WITH CHECK (auth.uid() = user_id);
