-- Vérifier si la table formations existe, sinon la créer
CREATE TABLE IF NOT EXISTS public.formations (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    name VARCHAR(255) NOT NULL,
    description TEXT,
    type VARCHAR(50) NOT NULL,
    duration_minutes INTEGER DEFAULT 0,
    status VARCHAR(50) DEFAULT 'draft',
    file_url TEXT,
    file_name TEXT,
    file_size INTEGER,
    organization_id UUID NOT NULL,
    created_by UUID NOT NULL,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Ajouter une contrainte de clé étrangère pour lier formations.created_by à profiles.id
ALTER TABLE public.formations 
DROP CONSTRAINT IF EXISTS formations_created_by_fkey;

ALTER TABLE public.formations
ADD CONSTRAINT formations_created_by_fkey 
FOREIGN KEY (created_by) 
REFERENCES public.profiles(id) 
ON DELETE CASCADE;

-- Créer la table quiz si elle n'existe pas
CREATE TABLE IF NOT EXISTS public.quizzes (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    formation_id UUID NOT NULL,
    title VARCHAR(255) NOT NULL,
    description TEXT,
    passing_score INTEGER DEFAULT 70,
    max_attempts INTEGER DEFAULT 3,
    time_limit_minutes INTEGER,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    FOREIGN KEY (formation_id) REFERENCES public.formations(id) ON DELETE CASCADE
);

-- Créer la table quiz_questions si elle n'existe pas
CREATE TABLE IF NOT EXISTS public.quiz_questions (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    quiz_id UUID NOT NULL,
    question_text TEXT NOT NULL,
    question_type VARCHAR(50) NOT NULL,
    points INTEGER DEFAULT 1,
    order_index INTEGER NOT NULL,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    FOREIGN KEY (quiz_id) REFERENCES public.quizzes(id) ON DELETE CASCADE
);

-- Créer la table quiz_answers si elle n'existe pas
CREATE TABLE IF NOT EXISTS public.quiz_answers (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    question_id UUID NOT NULL,
    answer_text TEXT NOT NULL,
    is_correct BOOLEAN DEFAULT FALSE,
    order_index INTEGER NOT NULL,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    FOREIGN KEY (question_id) REFERENCES public.quiz_questions(id) ON DELETE CASCADE
);

-- Créer la table user_progress si elle n'existe pas
CREATE TABLE IF NOT EXISTS public.user_progress (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id UUID NOT NULL,
    formation_id UUID NOT NULL,
    progress_percentage INTEGER DEFAULT 0,
    status VARCHAR(50) DEFAULT 'not_started',
    started_at TIMESTAMP WITH TIME ZONE,
    completed_at TIMESTAMP WITH TIME ZONE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    FOREIGN KEY (user_id) REFERENCES public.profiles(id) ON DELETE CASCADE,
    FOREIGN KEY (formation_id) REFERENCES public.formations(id) ON DELETE CASCADE
);

-- Créer la table user_quiz_results si elle n'existe pas
CREATE TABLE IF NOT EXISTS public.user_quiz_results (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id UUID NOT NULL,
    quiz_id UUID NOT NULL,
    score INTEGER NOT NULL,
    total_questions INTEGER NOT NULL,
    correct_answers INTEGER NOT NULL,
    time_taken_minutes INTEGER,
    passed BOOLEAN DEFAULT FALSE,
    attempt_number INTEGER DEFAULT 1,
    answers_data JSONB,
    completed_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    FOREIGN KEY (user_id) REFERENCES public.profiles(id) ON DELETE CASCADE,
    FOREIGN KEY (quiz_id) REFERENCES public.quizzes(id) ON DELETE CASCADE
);

-- Créer des fonctions pour inspecter le schéma
CREATE OR REPLACE FUNCTION public.get_table_definition(table_name text)
RETURNS TABLE (column_definition text)
LANGUAGE plpgsql
AS $$
BEGIN
    RETURN QUERY
    SELECT
        column_name || ' ' || data_type || 
        CASE WHEN character_maximum_length IS NOT NULL 
             THEN '(' || character_maximum_length::text || ')' 
             ELSE '' 
        END ||
        CASE WHEN is_nullable = 'NO' 
             THEN ' NOT NULL' 
             ELSE '' 
        END ||
        CASE WHEN column_default IS NOT NULL 
             THEN ' DEFAULT ' || column_default 
             ELSE '' 
        END
    FROM
        information_schema.columns
    WHERE
        table_schema = 'public'
        AND table_name = $1
    ORDER BY
        ordinal_position;
END;
$$;

CREATE OR REPLACE FUNCTION public.get_foreign_keys(schema_name text)
RETURNS TABLE (
    table_name text,
    column_name text,
    foreign_table_name text,
    foreign_column_name text
)
LANGUAGE plpgsql
AS $$
BEGIN
    RETURN QUERY
    SELECT
        tc.table_name,
        kcu.column_name,
        ccu.table_name AS foreign_table_name,
        ccu.column_name AS foreign_column_name
    FROM
        information_schema.table_constraints AS tc
        JOIN information_schema.key_column_usage AS kcu
          ON tc.constraint_name = kcu.constraint_name
          AND tc.table_schema = kcu.table_schema
        JOIN information_schema.constraint_column_usage AS ccu
          ON ccu.constraint_name = tc.constraint_name
          AND ccu.table_schema = tc.table_schema
    WHERE
        tc.constraint_type = 'FOREIGN KEY'
        AND tc.table_schema = schema_name;
END;
$$;

-- Ajouter des RLS (Row Level Security) pour les tables
ALTER TABLE public.formations ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.quizzes ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.quiz_questions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.quiz_answers ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.user_progress ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.user_quiz_results ENABLE ROW LEVEL SECURITY;

-- Créer des politiques RLS pour les formations
CREATE POLICY "Formations visibles par les membres de l'organisation" 
ON public.formations FOR SELECT
USING (
    organization_id IN (
        SELECT organization_id FROM public.profiles
        WHERE id = auth.uid()
    )
);

CREATE POLICY "Formations modifiables par les admins et créateurs" 
ON public.formations FOR ALL
USING (
    created_by = auth.uid() OR
    EXISTS (
        SELECT 1 FROM public.profiles
        WHERE id = auth.uid() AND role IN ('admin', 'owner')
    )
);

-- Créer des politiques RLS pour les quiz
CREATE POLICY "Quiz visibles par les membres de l'organisation" 
ON public.quizzes FOR SELECT
USING (
    formation_id IN (
        SELECT id FROM public.formations
        WHERE organization_id IN (
            SELECT organization_id FROM public.profiles
            WHERE id = auth.uid()
        )
    )
);

-- Créer des politiques RLS pour les progrès utilisateur
CREATE POLICY "Progrès visibles par l'utilisateur concerné et les admins" 
ON public.user_progress FOR SELECT
USING (
    user_id = auth.uid() OR
    EXISTS (
        SELECT 1 FROM public.profiles
        WHERE id = auth.uid() AND role IN ('admin', 'owner')
    )
);

CREATE POLICY "Progrès modifiables par l'utilisateur concerné" 
ON public.user_progress FOR ALL
USING (
    user_id = auth.uid()
);

-- Créer des politiques RLS pour les résultats de quiz
CREATE POLICY "Résultats visibles par l'utilisateur concerné et les admins" 
ON public.user_quiz_results FOR SELECT
USING (
    user_id = auth.uid() OR
    EXISTS (
        SELECT 1 FROM public.profiles
        WHERE id = auth.uid() AND role IN ('admin', 'owner')
    )
);

CREATE POLICY "Résultats modifiables par l'utilisateur concerné" 
ON public.user_quiz_results FOR ALL
USING (
    user_id = auth.uid()
);
