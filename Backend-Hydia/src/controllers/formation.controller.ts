import { Request, Response } from 'express';
import { FormationService } from '../services/formation.service';
import { 
  CreateFormationDTO, 
  UpdateFormationDTO, 
  CreateQuizDTO, 
  UpdateProgressDTO, 
  SubmitQuizDTO 
} from '../types/formation.types';
import { z } from 'zod';
import multer from 'multer';
import { AuthenticatedRequest } from '../middleware/auth.middleware';

// Validation schemas
const createFormationSchema = z.object({
  name: z.string().min(1, 'Le nom est requis').max(255),
  type: z.enum(['video', 'ppt', 'pdf', 'article']),
  description: z.string().optional(),
  duration_minutes: z.number().min(0).optional().default(0),
  status: z.enum(['draft', 'active', 'inactive']).optional().default('draft')
});

const updateFormationSchema = createFormationSchema.partial();

const createQuizSchema = z.object({
  title: z.string().min(1, 'Le titre est requis').max(255),
  description: z.string().optional(),
  passing_score: z.number().min(0).max(100).optional().default(70),
  max_attempts: z.number().min(1).optional().default(3),
  time_limit_minutes: z.number().min(1).optional(),
  questions: z.array(z.object({
    question_text: z.string().min(1, 'Le texte de la question est requis'),
    question_type: z.enum(['multiple_choice', 'true_false', 'text']).optional().default('multiple_choice'),
    points: z.number().min(1).optional().default(1),
    order_index: z.number().min(0).optional(),
    answers: z.array(z.object({
      answer_text: z.string().min(1, 'Le texte de la réponse est requis'),
      is_correct: z.boolean(),
      order_index: z.number().min(0).optional()
    })).min(1, 'Au moins une réponse est requise')
  })).min(1, 'Au moins une question est requise')
});

const updateProgressSchema = z.object({
  progress_percentage: z.number().min(0).max(100),
  status: z.enum(['not_started', 'in_progress', 'completed']),
  started_at: z.string().optional(),
  completed_at: z.string().optional()
});

const submitQuizSchema = z.object({
  answers: z.array(z.object({
    questionId: z.string().uuid(),
    answerId: z.string().uuid().optional(),
    textAnswer: z.string().optional()
  })),
  timeSpent: z.number().min(0).optional()
});

// Configuration multer pour l'upload de fichiers
const upload = multer({
  storage: multer.memoryStorage(),
  limits: {
    fileSize: 100 * 1024 * 1024 // 100MB max
  },
  fileFilter: (req, file, cb) => {
    const allowedTypes = [
      'application/pdf',
      'application/vnd.ms-powerpoint',
      'application/vnd.openxmlformats-officedocument.presentationml.presentation',
      'video/mp4',
      'video/x-msvideo',
      'video/quicktime',
      'video/x-ms-wmv'
    ];
    
    if (allowedTypes.includes(file.mimetype)) {
      cb(null, true);
    } else {
      cb(new Error('Type de fichier non autorisé'));
    }
  }
});

export class FormationController {
  // ==================== FORMATIONS ====================

  /**
   * Créer une nouvelle formation
   */
  static async createFormation(req: AuthenticatedRequest, res: Response) {
    try {
      const { organizationId } = req.user!;
      const validatedData = createFormationSchema.parse(req.body);

      const formation = await FormationService.createFormation(
        organizationId,
        validatedData,
        req.user!.userId
      );

      res.status(201).json({
        success: true,
        data: formation,
        message: 'Formation créée avec succès'
      });
    } catch (error: any) {
      console.error('Erreur lors de la création de la formation:', error);
      
      if (error instanceof z.ZodError) {
        return res.status(400).json({
          success: false,
          message: 'Données invalides',
          errors: error.errors
        });
      }

      res.status(500).json({
        success: false,
        message: error.message || 'Erreur lors de la création de la formation'
      });
    }
  }

  /**
   * Récupérer toutes les formations
   */
  static async getFormations(req: AuthenticatedRequest, res: Response) {
    try {
      const { organizationId } = req.user!;
      const { status } = req.query;

      const formations = await FormationService.getFormations(
        organizationId,
        status as string
      );

      res.json({
        success: true,
        data: formations,
        message: 'Formations récupérées avec succès'
      });
    } catch (error: any) {
      console.error('Erreur lors de la récupération des formations:', error);
      res.status(500).json({
        success: false,
        message: error.message || 'Erreur lors de la récupération des formations'
      });
    }
  }

  /**
   * Récupérer une formation par ID
   */
  static async getFormationById(req: AuthenticatedRequest, res: Response) {
    try {
      const { id } = req.params;
      const formation = await FormationService.getFormationById(id);

      if (!formation) {
        return res.status(404).json({
          success: false,
          message: 'Formation non trouvée'
        });
      }

      res.json({
        success: true,
        data: formation,
        message: 'Formation récupérée avec succès'
      });
    } catch (error: any) {
      console.error('Erreur lors de la récupération de la formation:', error);
      res.status(500).json({
        success: false,
        message: error.message || 'Erreur lors de la récupération de la formation'
      });
    }
  }

  /**
   * Mettre à jour une formation
   */
  static async updateFormation(req: AuthenticatedRequest, res: Response) {
    try {
      const { id } = req.params;
      const validatedData = updateFormationSchema.parse(req.body);

      const formation = await FormationService.updateFormation(id, validatedData);

      res.json({
        success: true,
        data: formation,
        message: 'Formation mise à jour avec succès'
      });
    } catch (error: any) {
      console.error('Erreur lors de la mise à jour de la formation:', error);
      
      if (error instanceof z.ZodError) {
        return res.status(400).json({
          success: false,
          message: 'Données invalides',
          errors: error.errors
        });
      }

      res.status(500).json({
        success: false,
        message: error.message || 'Erreur lors de la mise à jour de la formation'
      });
    }
  }

  /**
   * Supprimer une formation
   */
  static async deleteFormation(req: AuthenticatedRequest, res: Response) {
    try {
      const { id } = req.params;
      await FormationService.deleteFormation(id);

      res.json({
        success: true,
        message: 'Formation supprimée avec succès'
      });
    } catch (error: any) {
      console.error('Erreur lors de la suppression de la formation:', error);
      res.status(500).json({
        success: false,
        message: error.message || 'Erreur lors de la suppression de la formation'
      });
    }
  }

  /**
   * Upload d'un fichier de formation
   */
  static uploadFile = upload.single('file');

  static async uploadFormationFile(req: AuthenticatedRequest, res: Response) {
    try {
      const { id } = req.params;
      const { organizationId } = req.user!;

      if (!req.file) {
        return res.status(400).json({
          success: false,
          message: 'Aucun fichier fourni'
        });
      }

      const { url, path } = await FormationService.uploadFormationFile(
        req.file.buffer,
        req.file.originalname,
        organizationId,
        id
      );

      // Mettre à jour la formation avec les informations du fichier
      const formation = await FormationService.updateFormation(id, {
        file_url: url,
        file_name: req.file.originalname,
        file_size: req.file.size
      });

      res.json({
        success: true,
        data: {
          formation,
          file: { url, path }
        },
        message: 'Fichier uploadé avec succès'
      });
    } catch (error: any) {
      console.error('Erreur lors de l\'upload du fichier:', error);
      res.status(500).json({
        success: false,
        message: error.message || 'Erreur lors de l\'upload du fichier'
      });
    }
  }

  // ==================== QUIZ ====================

  /**
   * Créer un quiz pour une formation
   */
  static async createQuiz(req: AuthenticatedRequest, res: Response) {
    try {
      const { id } = req.params; // formation ID
      const validatedData = createQuizSchema.parse(req.body);

      // Créer le quiz
      const quiz = await FormationService.createQuiz(id, validatedData);

      // Ajouter les questions et réponses
      for (const questionData of validatedData.questions) {
        const questions = await FormationService.addQuizQuestions(quiz.id, [questionData]);
        const question = questions[0];

        if (question && questionData.answers) {
          await FormationService.addQuizAnswers(question.id, questionData.answers);
        }
      }

      // Récupérer le quiz complet
      const completeQuiz = await FormationService.getQuizById(quiz.id);

      res.status(201).json({
        success: true,
        data: completeQuiz,
        message: 'Quiz créé avec succès'
      });
    } catch (error: any) {
      console.error('Erreur lors de la création du quiz:', error);
      
      if (error instanceof z.ZodError) {
        return res.status(400).json({
          success: false,
          message: 'Données invalides',
          errors: error.errors
        });
      }

      res.status(500).json({
        success: false,
        message: error.message || 'Erreur lors de la création du quiz'
      });
    }
  }

  /**
   * Récupérer un quiz
   */
  static async getQuiz(req: AuthenticatedRequest, res: Response) {
    try {
      const { quizId } = req.params;
      const quiz = await FormationService.getQuizById(quizId);

      if (!quiz) {
        return res.status(404).json({
          success: false,
          message: 'Quiz non trouvé'
        });
      }

      res.json({
        success: true,
        data: quiz,
        message: 'Quiz récupéré avec succès'
      });
    } catch (error: any) {
      console.error('Erreur lors de la récupération du quiz:', error);
      res.status(500).json({
        success: false,
        message: error.message || 'Erreur lors de la récupération du quiz'
      });
    }
  }

  /**
   * Soumettre les réponses d'un quiz
   */
  static async submitQuiz(req: AuthenticatedRequest, res: Response) {
    try {
      const { quizId } = req.params;
      const { userId } = req.user!;
      const validatedData = submitQuizSchema.parse(req.body);

      const result = await FormationService.submitQuizResult(
        userId,
        quizId,
        validatedData.answers,
        validatedData.timeSpent
      );

      res.json({
        success: true,
        data: result,
        message: 'Quiz soumis avec succès'
      });
    } catch (error: any) {
      console.error('Erreur lors de la soumission du quiz:', error);
      
      if (error instanceof z.ZodError) {
        return res.status(400).json({
          success: false,
          message: 'Données invalides',
          errors: error.errors
        });
      }

      res.status(500).json({
        success: false,
        message: error.message || 'Erreur lors de la soumission du quiz'
      });
    }
  }

  // ==================== PROGRESSION ====================

  /**
   * Mettre à jour la progression d'un utilisateur
   */
  static async updateProgress(req: AuthenticatedRequest, res: Response) {
    try {
      const { formationId } = req.params;
      const { userId } = req.user!;
      const validatedData = updateProgressSchema.parse(req.body);

      const progress = await FormationService.updateUserProgress(
        userId,
        formationId,
        validatedData
      );

      res.json({
        success: true,
        data: progress,
        message: 'Progression mise à jour avec succès'
      });
    } catch (error: any) {
      console.error('Erreur lors de la mise à jour de la progression:', error);
      
      if (error instanceof z.ZodError) {
        return res.status(400).json({
          success: false,
          message: 'Données invalides',
          errors: error.errors
        });
      }

      res.status(500).json({
        success: false,
        message: error.message || 'Erreur lors de la mise à jour de la progression'
      });
    }
  }

  /**
   * Récupérer la progression d'un utilisateur
   */
  static async getUserProgress(req: AuthenticatedRequest, res: Response) {
    try {
      const { userId } = req.user!;
      const { organizationId } = req.user!;

      const progress = await FormationService.getUserProgress(userId, organizationId);

      res.json({
        success: true,
        data: progress,
        message: 'Progression récupérée avec succès'
      });
    } catch (error: any) {
      console.error('Erreur lors de la récupération de la progression:', error);
      res.status(500).json({
        success: false,
        message: error.message || 'Erreur lors de la récupération de la progression'
      });
    }
  }

  /**
   * Récupérer la progression de tous les utilisateurs pour une formation (Admin)
   */
  static async getFormationProgress(req: AuthenticatedRequest, res: Response) {
    try {
      const { formationId } = req.params;
      const progress = await FormationService.getFormationProgress(formationId);

      res.json({
        success: true,
        data: progress,
        message: 'Progression de la formation récupérée avec succès'
      });
    } catch (error: any) {
      console.error('Erreur lors de la récupération de la progression:', error);
      res.status(500).json({
        success: false,
        message: error.message || 'Erreur lors de la récupération de la progression'
      });
    }
  }

  /**
   * Récupérer les résultats d'un quiz (Admin)
   */
  static async getQuizResults(req: AuthenticatedRequest, res: Response) {
    try {
      const { quizId } = req.params;
      const results = await FormationService.getQuizResults(quizId);

      res.json({
        success: true,
        data: results,
        message: 'Résultats du quiz récupérés avec succès'
      });
    } catch (error: any) {
      console.error('Erreur lors de la récupération des résultats:', error);
      res.status(500).json({
        success: false,
        message: error.message || 'Erreur lors de la récupération des résultats'
      });
    }
  }
}
