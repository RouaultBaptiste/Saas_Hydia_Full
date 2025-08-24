import { supabase, supabaseAdmin } from '../config/supabase';
import { Formation, Quiz, QuizQuestion, QuizAnswer, UserProgress, UserQuizResult } from '../types/formation.types';

export class FormationService {
  // ==================== FORMATIONS ====================
  
  /**
   * Créer une nouvelle formation
   */
  static async createFormation(organizationId: string, formationData: Partial<Formation>, createdBy: string): Promise<Formation> {
    const { data, error } = await supabaseAdmin
      .from('formations')
      .insert({
        organization_id: organizationId,
        name: formationData.name,
        type: formationData.type,
        description: formationData.description,
        duration_minutes: formationData.duration_minutes || 0,
        status: formationData.status || 'draft',
        file_url: formationData.file_url,
        file_name: formationData.file_name,
        file_size: formationData.file_size,
        created_by: createdBy
      })
      .select()
      .single();

    if (error) {
      console.error('Erreur lors de la création de la formation:', error);
      throw new Error(`Erreur lors de la création de la formation: ${error.message}`);
    }

    return data;
  }

  /**
   * Récupérer toutes les formations d'une organisation
   */
  static async getFormations(organizationId: string, status?: string): Promise<Formation[]> {
    let query = supabaseAdmin
      .from('formations')
      .select(`
        *,
        created_by_profile:profiles!formations_created_by_fkey(id, first_name, last_name, email),
        quizzes(id, title, passing_score)
      `)
      .eq('organization_id', organizationId);

    if (status) {
      query = query.eq('status', status);
    }

    const { data, error } = await query.order('created_at', { ascending: false });

    if (error) {
      console.error('Erreur lors de la récupération des formations:', error);
      throw new Error(`Erreur lors de la récupération des formations: ${error.message}`);
    }

    return data || [];
  }

  /**
   * Récupérer une formation par ID
   */
  static async getFormationById(formationId: string): Promise<Formation | null> {
    const { data, error } = await supabaseAdmin
      .from('formations')
      .select(`
        *,
        created_by_profile:profiles!formations_created_by_fkey(id, first_name, last_name, email),
        quizzes(
          id, title, description, passing_score, max_attempts, time_limit_minutes,
          quiz_questions(
            id, question_text, question_type, points, order_index,
            quiz_answers(id, answer_text, is_correct, order_index)
          )
        )
      `)
      .eq('id', formationId)
      .single();

    if (error) {
      console.error('Erreur lors de la récupération de la formation:', error);
      return null;
    }

    return data;
  }

  /**
   * Mettre à jour une formation
   */
  static async updateFormation(formationId: string, updateData: Partial<Formation>): Promise<Formation> {
    const { data, error } = await supabaseAdmin
      .from('formations')
      .update({
        ...updateData,
        updated_at: new Date().toISOString()
      })
      .eq('id', formationId)
      .select()
      .single();

    if (error) {
      console.error('Erreur lors de la mise à jour de la formation:', error);
      throw new Error(`Erreur lors de la mise à jour de la formation: ${error.message}`);
    }

    return data;
  }

  /**
   * Supprimer une formation
   */
  static async deleteFormation(formationId: string): Promise<void> {
    const { error } = await supabaseAdmin
      .from('formations')
      .delete()
      .eq('id', formationId);

    if (error) {
      console.error('Erreur lors de la suppression de la formation:', error);
      throw new Error(`Erreur lors de la suppression de la formation: ${error.message}`);
    }
  }

  // ==================== QUIZ ====================

  /**
   * Créer un quiz pour une formation
   */
  static async createQuiz(formationId: string, quizData: Partial<Quiz>): Promise<Quiz> {
    const { data, error } = await supabaseAdmin
      .from('quizzes')
      .insert({
        formation_id: formationId,
        title: quizData.title,
        description: quizData.description,
        passing_score: quizData.passing_score || 70,
        max_attempts: quizData.max_attempts || 3,
        time_limit_minutes: quizData.time_limit_minutes
      })
      .select()
      .single();

    if (error) {
      console.error('Erreur lors de la création du quiz:', error);
      throw new Error(`Erreur lors de la création du quiz: ${error.message}`);
    }

    return data;
  }

  /**
   * Ajouter des questions à un quiz
   */
  static async addQuizQuestions(quizId: string, questions: Partial<QuizQuestion>[]): Promise<QuizQuestion[]> {
    const questionsToInsert = questions.map((q, index) => ({
      quiz_id: quizId,
      question_text: q.question_text,
      question_type: q.question_type || 'multiple_choice',
      points: q.points || 1,
      order_index: q.order_index || index
    }));

    const { data, error } = await supabaseAdmin
      .from('quiz_questions')
      .insert(questionsToInsert)
      .select();

    if (error) {
      console.error('Erreur lors de l\'ajout des questions:', error);
      throw new Error(`Erreur lors de l'ajout des questions: ${error.message}`);
    }

    return data || [];
  }

  /**
   * Ajouter des réponses à une question
   */
  static async addQuizAnswers(questionId: string, answers: Partial<QuizAnswer>[]): Promise<QuizAnswer[]> {
    const answersToInsert = answers.map((a, index) => ({
      question_id: questionId,
      answer_text: a.answer_text,
      is_correct: a.is_correct || false,
      order_index: a.order_index || index
    }));

    const { data, error } = await supabaseAdmin
      .from('quiz_answers')
      .insert(answersToInsert)
      .select();

    if (error) {
      console.error('Erreur lors de l\'ajout des réponses:', error);
      throw new Error(`Erreur lors de l'ajout des réponses: ${error.message}`);
    }

    return data || [];
  }

  /**
   * Récupérer un quiz complet avec questions et réponses
   */
  static async getQuizById(quizId: string): Promise<Quiz | null> {
    const { data, error } = await supabaseAdmin
      .from('quizzes')
      .select(`
        *,
        formation:formations(id, name, organization_id),
        quiz_questions(
          id, question_text, question_type, points, order_index,
          quiz_answers(id, answer_text, is_correct, order_index)
        )
      `)
      .eq('id', quizId)
      .single();

    if (error) {
      console.error('Erreur lors de la récupération du quiz:', error);
      return null;
    }

    return data;
  }

  // ==================== PROGRESSION UTILISATEUR ====================

  /**
   * Initialiser ou mettre à jour la progression d'un utilisateur
   */
  static async updateUserProgress(
    userId: string, 
    formationId: string, 
    progressData: Partial<UserProgress>
  ): Promise<UserProgress> {
    const { data, error } = await supabaseAdmin
      .from('user_progress')
      .upsert({
        user_id: userId,
        formation_id: formationId,
        progress_percentage: progressData.progress_percentage,
        status: progressData.status,
        started_at: progressData.started_at,
        completed_at: progressData.completed_at,
        last_accessed_at: new Date().toISOString(),
        updated_at: new Date().toISOString()
      })
      .select()
      .single();

    if (error) {
      console.error('Erreur lors de la mise à jour de la progression:', error);
      throw new Error(`Erreur lors de la mise à jour de la progression: ${error.message}`);
    }

    return data;
  }

  /**
   * Récupérer la progression d'un utilisateur pour toutes ses formations
   */
  static async getUserProgress(userId: string, organizationId?: string): Promise<UserProgress[]> {
    let query = supabaseAdmin
      .from('user_progress')
      .select(`
        *,
        formation:formations(id, name, type, duration_minutes, organization_id)
      `)
      .eq('user_id', userId);

    if (organizationId) {
      query = query.eq('formation.organization_id', organizationId);
    }

    const { data, error } = await query.order('last_accessed_at', { ascending: false });

    if (error) {
      console.error('Erreur lors de la récupération de la progression:', error);
      throw new Error(`Erreur lors de la récupération de la progression: ${error.message}`);
    }

    return data || [];
  }

  /**
   * Récupérer la progression de tous les utilisateurs pour une formation
   */
  static async getFormationProgress(formationId: string): Promise<UserProgress[]> {
    const { data, error } = await supabaseAdmin
      .from('user_progress')
      .select(`
        *,
        user:profiles(id, first_name, last_name, email)
      `)
      .eq('formation_id', formationId)
      .order('progress_percentage', { ascending: false });

    if (error) {
      console.error('Erreur lors de la récupération de la progression de la formation:', error);
      throw new Error(`Erreur lors de la récupération de la progression: ${error.message}`);
    }

    return data || [];
  }

  // ==================== RÉSULTATS QUIZ ====================

  /**
   * Soumettre les résultats d'un quiz
   */
  static async submitQuizResult(
    userId: string,
    quizId: string,
    answers: any[],
    timeSpent?: number
  ): Promise<UserQuizResult> {
    // Récupérer le quiz avec les bonnes réponses
    const quiz = await this.getQuizById(quizId);
    if (!quiz) {
      throw new Error('Quiz non trouvé');
    }

    // Calculer le score
    let correctAnswers = 0;
    const totalQuestions = quiz.quiz_questions?.length || 0;

    quiz.quiz_questions?.forEach((question) => {
      const userAnswer = answers.find(a => a.questionId === question.id);
      if (userAnswer && question.quiz_answers) {
        const correctAnswer = question.quiz_answers.find(a => a.is_correct);
        if (correctAnswer && userAnswer.answerId === correctAnswer.id) {
          correctAnswers++;
        }
      }
    });

    const score = totalQuestions > 0 ? (correctAnswers / totalQuestions) * 100 : 0;
    const passed = score >= (quiz.passing_score || 70);

    // Compter les tentatives précédentes
    const { data: previousAttempts } = await supabaseAdmin
      .from('user_quiz_results')
      .select('attempt_number')
      .eq('user_id', userId)
      .eq('quiz_id', quizId)
      .order('attempt_number', { ascending: false })
      .limit(1);

    const attemptNumber = previousAttempts && previousAttempts.length > 0 
      ? previousAttempts[0].attempt_number + 1 
      : 1;

    // Insérer le résultat
    const { data, error } = await supabaseAdmin
      .from('user_quiz_results')
      .insert({
        user_id: userId,
        quiz_id: quizId,
        score,
        total_questions: totalQuestions,
        correct_answers: correctAnswers,
        time_taken_minutes: timeSpent,
        passed,
        attempt_number: attemptNumber,
        answers_data: answers
      })
      .select()
      .single();

    if (error) {
      console.error('Erreur lors de la soumission du quiz:', error);
      throw new Error(`Erreur lors de la soumission du quiz: ${error.message}`);
    }

    return data;
  }

  /**
   * Récupérer les résultats d'un utilisateur pour un quiz
   */
  static async getUserQuizResults(userId: string, quizId: string): Promise<UserQuizResult[]> {
    const { data, error } = await supabaseAdmin
      .from('user_quiz_results')
      .select('*')
      .eq('user_id', userId)
      .eq('quiz_id', quizId)
      .order('completed_at', { ascending: false });

    if (error) {
      console.error('Erreur lors de la récupération des résultats:', error);
      throw new Error(`Erreur lors de la récupération des résultats: ${error.message}`);
    }

    return data || [];
  }

  /**
   * Récupérer tous les résultats d'un quiz (pour les admins)
   */
  static async getQuizResults(quizId: string): Promise<UserQuizResult[]> {
    const { data, error } = await supabaseAdmin
      .from('user_quiz_results')
      .select(`
        *,
        user:profiles(id, first_name, last_name, email)
      `)
      .eq('quiz_id', quizId)
      .order('completed_at', { ascending: false });

    if (error) {
      console.error('Erreur lors de la récupération des résultats du quiz:', error);
      throw new Error(`Erreur lors de la récupération des résultats: ${error.message}`);
    }

    return data || [];
  }

  // ==================== UPLOAD DE FICHIERS ====================

  /**
   * Upload d'un fichier de formation vers Supabase Storage
   */
  static async uploadFormationFile(
    file: Buffer,
    fileName: string,
    organizationId: string,
    formationId: string
  ): Promise<{ url: string; path: string }> {
    const fileExtension = fileName.split('.').pop();
    const sanitizedFileName = fileName.replace(/[^a-zA-Z0-9.-]/g, '_');
    const filePath = `formations/${organizationId}/${formationId}/${Date.now()}_${sanitizedFileName}`;

    const { data, error } = await supabaseAdmin.storage
      .from('formations')
      .upload(filePath, file, {
        contentType: this.getContentType(fileExtension || ''),
        upsert: false
      });

    if (error) {
      console.error('Erreur lors de l\'upload du fichier:', error);
      throw new Error(`Erreur lors de l'upload du fichier: ${error.message}`);
    }

    // Générer l'URL publique
    const { data: publicUrlData } = supabaseAdmin.storage
      .from('formations')
      .getPublicUrl(filePath);

    return {
      url: publicUrlData.publicUrl,
      path: filePath
    };
  }

  /**
   * Supprimer un fichier de formation
   */
  static async deleteFormationFile(filePath: string): Promise<void> {
    const { error } = await supabaseAdmin.storage
      .from('formations')
      .remove([filePath]);

    if (error) {
      console.error('Erreur lors de la suppression du fichier:', error);
      throw new Error(`Erreur lors de la suppression du fichier: ${error.message}`);
    }
  }

  /**
   * Déterminer le type MIME d'un fichier
   */
  private static getContentType(extension: string): string {
    const contentTypes: { [key: string]: string } = {
      'pdf': 'application/pdf',
      'ppt': 'application/vnd.ms-powerpoint',
      'pptx': 'application/vnd.openxmlformats-officedocument.presentationml.presentation',
      'mp4': 'video/mp4',
      'avi': 'video/x-msvideo',
      'mov': 'video/quicktime',
      'wmv': 'video/x-ms-wmv',
      'jpg': 'image/jpeg',
      'jpeg': 'image/jpeg',
      'png': 'image/png',
      'gif': 'image/gif'
    };

    return contentTypes[extension.toLowerCase()] || 'application/octet-stream';
  }
}
