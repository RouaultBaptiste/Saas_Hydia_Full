-- Migration pour les tables de formations
-- Date: 2024-08-20

-- Table des formations
CREATE TABLE IF NOT EXISTS formations (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    organization_id UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
    name VARCHAR(255) NOT NULL,
    type VARCHAR(50) NOT NULL CHECK (type IN ('video', 'ppt', 'pdf', 'article')),
    description TEXT,
    duration_minutes INTEGER DEFAULT 0,
    status VARCHAR(20) DEFAULT 'draft' CHECK (status IN ('draft', 'active', 'inactive')),
    file_url TEXT, -- URL du fichier dans Supabase Storage
    file_name VARCHAR(255),
    file_size BIGINT,
    created_by UUID NOT NULL REFERENCES profiles(id),
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Table des quiz
CREATE TABLE IF NOT EXISTS quizzes (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    formation_id UUID NOT NULL REFERENCES formations(id) ON DELETE CASCADE,
    title VARCHAR(255) NOT NULL,
    description TEXT,
    passing_score INTEGER DEFAULT 70, -- Score minimum pour valider (en %)
    max_attempts INTEGER DEFAULT 3, -- Nombre max de tentatives
    time_limit_minutes INTEGER, -- Limite de temps (optionnel)
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Table des questions de quiz
CREATE TABLE IF NOT EXISTS quiz_questions (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    quiz_id UUID NOT NULL REFERENCES quizzes(id) ON DELETE CASCADE,
    question_text TEXT NOT NULL,
    question_type VARCHAR(20) DEFAULT 'multiple_choice' CHECK (question_type IN ('multiple_choice', 'true_false', 'text')),
    points INTEGER DEFAULT 1,
    order_index INTEGER NOT NULL,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Table des réponses possibles pour les questions
CREATE TABLE IF NOT EXISTS quiz_answers (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    question_id UUID NOT NULL REFERENCES quiz_questions(id) ON DELETE CASCADE,
    answer_text TEXT NOT NULL,
    is_correct BOOLEAN DEFAULT FALSE,
    order_index INTEGER NOT NULL,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Table de progression des utilisateurs
CREATE TABLE IF NOT EXISTS user_progress (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    user_id UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
    formation_id UUID NOT NULL REFERENCES formations(id) ON DELETE CASCADE,
    progress_percentage DECIMAL(5,2) DEFAULT 0.00 CHECK (progress_percentage >= 0 AND progress_percentage <= 100),
    status VARCHAR(20) DEFAULT 'not_started' CHECK (status IN ('not_started', 'in_progress', 'completed')),
    started_at TIMESTAMP WITH TIME ZONE,
    completed_at TIMESTAMP WITH TIME ZONE,
    last_accessed_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    UNIQUE(user_id, formation_id)
);

-- Table des résultats de quiz
CREATE TABLE IF NOT EXISTS user_quiz_results (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    user_id UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
    quiz_id UUID NOT NULL REFERENCES quizzes(id) ON DELETE CASCADE,
    score DECIMAL(5,2) NOT NULL, -- Score en pourcentage
    total_questions INTEGER NOT NULL,
    correct_answers INTEGER NOT NULL,
    time_taken_minutes INTEGER,
    passed BOOLEAN NOT NULL,
    attempt_number INTEGER DEFAULT 1,
    answers_data JSONB, -- Stockage des réponses données
    completed_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Index pour optimiser les performances
CREATE INDEX IF NOT EXISTS idx_formations_organization_id ON formations(organization_id);
CREATE INDEX IF NOT EXISTS idx_formations_status ON formations(status);
CREATE INDEX IF NOT EXISTS idx_formations_created_by ON formations(created_by);
CREATE INDEX IF NOT EXISTS idx_quizzes_formation_id ON quizzes(formation_id);
CREATE INDEX IF NOT EXISTS idx_quiz_questions_quiz_id ON quiz_questions(quiz_id);
CREATE INDEX IF NOT EXISTS idx_quiz_answers_question_id ON quiz_answers(question_id);
CREATE INDEX IF NOT EXISTS idx_user_progress_user_id ON user_progress(user_id);
CREATE INDEX IF NOT EXISTS idx_user_progress_formation_id ON user_progress(formation_id);
CREATE INDEX IF NOT EXISTS idx_user_quiz_results_user_id ON user_quiz_results(user_id);
CREATE INDEX IF NOT EXISTS idx_user_quiz_results_quiz_id ON user_quiz_results(quiz_id);

-- Trigger pour mettre à jour updated_at automatiquement
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ language 'plpgsql';

CREATE TRIGGER update_formations_updated_at BEFORE UPDATE ON formations FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
CREATE TRIGGER update_quizzes_updated_at BEFORE UPDATE ON quizzes FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
CREATE TRIGGER update_user_progress_updated_at BEFORE UPDATE ON user_progress FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- RLS (Row Level Security) pour sécuriser l'accès aux données
ALTER TABLE formations ENABLE ROW LEVEL SECURITY;
ALTER TABLE quizzes ENABLE ROW LEVEL SECURITY;
ALTER TABLE quiz_questions ENABLE ROW LEVEL SECURITY;
ALTER TABLE quiz_answers ENABLE ROW LEVEL SECURITY;
ALTER TABLE user_progress ENABLE ROW LEVEL SECURITY;
ALTER TABLE user_quiz_results ENABLE ROW LEVEL SECURITY;

-- Politiques RLS pour formations
CREATE POLICY "Users can view active formations in their organization" ON formations
    FOR SELECT USING (
        organization_id IN (
            SELECT organization_id FROM organization_members 
            WHERE user_id = auth.uid()
        ) AND status = 'active'
    );

CREATE POLICY "Admins can manage formations in their organization" ON formations
    FOR ALL USING (
        organization_id IN (
            SELECT organization_id FROM organization_members 
            WHERE user_id = auth.uid() AND role IN ('admin', 'owner')
        )
    );

-- Politiques RLS pour quizzes
CREATE POLICY "Users can view quizzes for accessible formations" ON quizzes
    FOR SELECT USING (
        formation_id IN (
            SELECT id FROM formations WHERE organization_id IN (
                SELECT organization_id FROM organization_members 
                WHERE user_id = auth.uid()
            )
        )
    );

CREATE POLICY "Admins can manage quizzes" ON quizzes
    FOR ALL USING (
        formation_id IN (
            SELECT id FROM formations WHERE organization_id IN (
                SELECT organization_id FROM organization_members 
                WHERE user_id = auth.uid() AND role IN ('admin', 'owner')
            )
        )
    );

-- Politiques RLS pour quiz_questions
CREATE POLICY "Users can view questions for accessible quizzes" ON quiz_questions
    FOR SELECT USING (
        quiz_id IN (
            SELECT q.id FROM quizzes q
            JOIN formations f ON f.id = q.formation_id
            WHERE f.organization_id IN (
                SELECT organization_id FROM organization_members 
                WHERE user_id = auth.uid()
            )
        )
    );

CREATE POLICY "Admins can manage questions" ON quiz_questions
    FOR ALL USING (
        quiz_id IN (
            SELECT q.id FROM quizzes q
            JOIN formations f ON f.id = q.formation_id
            WHERE f.organization_id IN (
                SELECT organization_id FROM organization_members 
                WHERE user_id = auth.uid() AND role IN ('admin', 'owner')
            )
        )
    );

-- Politiques RLS pour quiz_answers
CREATE POLICY "Users can view answers for accessible questions" ON quiz_answers
    FOR SELECT USING (
        question_id IN (
            SELECT qq.id FROM quiz_questions qq
            JOIN quizzes q ON q.id = qq.quiz_id
            JOIN formations f ON f.id = q.formation_id
            WHERE f.organization_id IN (
                SELECT organization_id FROM organization_members 
                WHERE user_id = auth.uid()
            )
        )
    );

CREATE POLICY "Admins can manage answers" ON quiz_answers
    FOR ALL USING (
        question_id IN (
            SELECT qq.id FROM quiz_questions qq
            JOIN quizzes q ON q.id = qq.quiz_id
            JOIN formations f ON f.id = q.formation_id
            WHERE f.organization_id IN (
                SELECT organization_id FROM organization_members 
                WHERE user_id = auth.uid() AND role IN ('admin', 'owner')
            )
        )
    );

-- Politiques RLS pour user_progress
CREATE POLICY "Users can view their own progress" ON user_progress
    FOR SELECT USING (user_id = auth.uid());

CREATE POLICY "Users can insert their own progress" ON user_progress
    FOR INSERT WITH CHECK (user_id = auth.uid());

CREATE POLICY "Users can update their own progress" ON user_progress
    FOR UPDATE USING (user_id = auth.uid());

CREATE POLICY "Admins can view all progress in their organization" ON user_progress
    FOR SELECT USING (
        formation_id IN (
            SELECT id FROM formations WHERE organization_id IN (
                SELECT organization_id FROM organization_members 
                WHERE user_id = auth.uid() AND role IN ('admin', 'owner')
            )
        )
    );

-- Politiques RLS pour user_quiz_results
CREATE POLICY "Users can view their own quiz results" ON user_quiz_results
    FOR SELECT USING (user_id = auth.uid());

CREATE POLICY "Users can insert their own quiz results" ON user_quiz_results
    FOR INSERT WITH CHECK (user_id = auth.uid());

CREATE POLICY "Admins can view all quiz results in their organization" ON user_quiz_results
    FOR SELECT USING (
        quiz_id IN (
            SELECT q.id FROM quizzes q
            JOIN formations f ON f.id = q.formation_id
            WHERE f.organization_id IN (
                SELECT organization_id FROM organization_members 
                WHERE user_id = auth.uid() AND role IN ('admin', 'owner')
            )
        )
    );

-- Commentaires pour documentation
COMMENT ON TABLE formations IS 'Table des formations créées par les admins';
COMMENT ON TABLE quizzes IS 'Table des quiz associés aux formations';
COMMENT ON TABLE quiz_questions IS 'Table des questions des quiz';
COMMENT ON TABLE quiz_answers IS 'Table des réponses possibles aux questions';
COMMENT ON TABLE user_progress IS 'Table de suivi de progression des utilisateurs';
COMMENT ON TABLE user_quiz_results IS 'Table des résultats des quiz passés par les utilisateurs';
