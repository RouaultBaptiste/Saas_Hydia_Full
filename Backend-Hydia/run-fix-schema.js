require('dotenv').config();
const { createClient } = require('@supabase/supabase-js');
const fs = require('fs');
const path = require('path');

// Création du client Supabase avec la clé service_role pour contourner RLS
const supabaseUrl = process.env.SUPABASE_URL;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!supabaseUrl || !supabaseServiceKey) {
  console.error('Variables d\'environnement SUPABASE_URL ou SUPABASE_SERVICE_ROLE_KEY manquantes');
  process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseServiceKey);

async function runFixScript() {
  try {
    console.log('Exécution du script de correction du schéma...');
    
    // Vérifier si la table formations existe
    const { data: formationsCheck, error: formationsCheckError } = await supabase
      .from('formations')
      .select('id')
      .limit(1);
    
    if (formationsCheckError) {
      console.log('La table formations n\'existe pas encore, création en cours...');
      
      // Créer la table formations
      const { error: createTableError } = await supabase.rpc('run_sql', {
        sql: `
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
        `
      });
      
      if (createTableError) {
        console.error('Erreur lors de la création de la table formations:', createTableError);
      } else {
        console.log('✅ Table formations créée avec succès');
      }
    } else {
      console.log('✅ La table formations existe déjà');
    }
    
    // Ajouter la contrainte de clé étrangère
    console.log('Ajout de la contrainte de clé étrangère formations_created_by_fkey...');
    
    const { error: addConstraintError } = await supabase.rpc('run_sql', {
      sql: `
        ALTER TABLE public.formations 
        DROP CONSTRAINT IF EXISTS formations_created_by_fkey;

        ALTER TABLE public.formations
        ADD CONSTRAINT formations_created_by_fkey 
        FOREIGN KEY (created_by) 
        REFERENCES public.profiles(id) 
        ON DELETE CASCADE;
      `
    });
    
    if (addConstraintError) {
      console.error('Erreur lors de l\'ajout de la contrainte:', addConstraintError);
    } else {
      console.log('✅ Contrainte formations_created_by_fkey ajoutée avec succès');
    }
    
    // Créer les tables quiz si elles n'existent pas
    console.log('Création des tables quiz...');
    
    const { error: createQuizTablesError } = await supabase.rpc('run_sql', {
      sql: `
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
      `
    });
    
    if (createQuizTablesError) {
      console.error('Erreur lors de la création des tables quiz:', createQuizTablesError);
    } else {
      console.log('✅ Tables quiz créées avec succès');
    }
    
    // Activer RLS sur les tables
    console.log('Activation de RLS sur les tables...');
    
    const { error: enableRlsError } = await supabase.rpc('run_sql', {
      sql: `
        ALTER TABLE public.formations ENABLE ROW LEVEL SECURITY;
        ALTER TABLE public.quizzes ENABLE ROW LEVEL SECURITY;
        ALTER TABLE public.quiz_questions ENABLE ROW LEVEL SECURITY;
        ALTER TABLE public.quiz_answers ENABLE ROW LEVEL SECURITY;
        ALTER TABLE public.user_progress ENABLE ROW LEVEL SECURITY;
        ALTER TABLE public.user_quiz_results ENABLE ROW LEVEL SECURITY;
      `
    });
    
    if (enableRlsError) {
      console.error('Erreur lors de l\'activation de RLS:', enableRlsError);
    } else {
      console.log('✅ RLS activé sur les tables');
    }
    
    // Créer les politiques RLS
    console.log('Création des politiques RLS...');
    
    const { error: createPoliciesError } = await supabase.rpc('run_sql', {
      sql: `
        -- Supprimer les politiques existantes pour éviter les erreurs
        DROP POLICY IF EXISTS "Formations visibles par les membres de l'organisation" ON public.formations;
        DROP POLICY IF EXISTS "Formations modifiables par les admins et créateurs" ON public.formations;
        
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
      `
    });
    
    if (createPoliciesError) {
      console.error('Erreur lors de la création des politiques RLS:', createPoliciesError);
    } else {
      console.log('✅ Politiques RLS créées avec succès');
    }
    
    console.log('Script de correction du schéma terminé avec succès!');
    
  } catch (error) {
    console.error('Erreur lors de l\'exécution du script:', error);
  }
}

// Exécuter le script
runFixScript();
