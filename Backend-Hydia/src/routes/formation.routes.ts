import { Router } from 'express';
import { FormationController } from '../controllers/formation.controller';
import { authenticateToken } from '../middleware/auth.middleware';
import { checkPermissions } from '../middleware/permissions.middleware';

const router = Router();

// Toutes les routes nécessitent une authentification
router.use(authenticateToken);

// ==================== FORMATIONS ====================

/**
 * @swagger
 * /api/v1/formations:
 *   post:
 *     summary: Créer une nouvelle formation
 *     tags: [Formations]
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - name
 *               - type
 *             properties:
 *               name:
 *                 type: string
 *                 description: Nom de la formation
 *               type:
 *                 type: string
 *                 enum: [video, ppt, pdf, article]
 *                 description: Type de formation
 *               description:
 *                 type: string
 *                 description: Description de la formation
 *               duration_minutes:
 *                 type: integer
 *                 description: Durée en minutes
 *               status:
 *                 type: string
 *                 enum: [draft, active, inactive]
 *                 description: Statut de la formation
 *     responses:
 *       201:
 *         description: Formation créée avec succès
 *       400:
 *         description: Données invalides
 *       403:
 *         description: Permissions insuffisantes
 */
router.post('/', checkPermissions(['admin', 'owner']), FormationController.createFormation);

/**
 * @swagger
 * /api/v1/formations:
 *   get:
 *     summary: Récupérer toutes les formations
 *     tags: [Formations]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: query
 *         name: status
 *         schema:
 *           type: string
 *           enum: [draft, active, inactive]
 *         description: Filtrer par statut
 *     responses:
 *       200:
 *         description: Liste des formations
 */
router.get('/', FormationController.getFormations);

/**
 * @swagger
 * /api/v1/formations/{id}:
 *   get:
 *     summary: Récupérer une formation par ID
 *     tags: [Formations]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 *         description: ID de la formation
 *     responses:
 *       200:
 *         description: Détails de la formation
 *       404:
 *         description: Formation non trouvée
 */
router.get('/:id', FormationController.getFormationById);

/**
 * @swagger
 * /api/v1/formations/{id}:
 *   put:
 *     summary: Mettre à jour une formation
 *     tags: [Formations]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 *         description: ID de la formation
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               name:
 *                 type: string
 *               type:
 *                 type: string
 *                 enum: [video, ppt, pdf, article]
 *               description:
 *                 type: string
 *               duration_minutes:
 *                 type: integer
 *               status:
 *                 type: string
 *                 enum: [draft, active, inactive]
 *     responses:
 *       200:
 *         description: Formation mise à jour avec succès
 *       400:
 *         description: Données invalides
 *       403:
 *         description: Permissions insuffisantes
 *       404:
 *         description: Formation non trouvée
 */
router.put('/:id', checkPermissions(['admin', 'owner']), FormationController.updateFormation);

/**
 * @swagger
 * /api/v1/formations/{id}:
 *   delete:
 *     summary: Supprimer une formation
 *     tags: [Formations]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 *         description: ID de la formation
 *     responses:
 *       200:
 *         description: Formation supprimée avec succès
 *       403:
 *         description: Permissions insuffisantes
 *       404:
 *         description: Formation non trouvée
 */
router.delete('/:id', checkPermissions(['admin', 'owner']), FormationController.deleteFormation);

/**
 * @swagger
 * /api/v1/formations/{id}/upload:
 *   post:
 *     summary: Upload d'un fichier de formation
 *     tags: [Formations]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 *         description: ID de la formation
 *     requestBody:
 *       required: true
 *       content:
 *         multipart/form-data:
 *           schema:
 *             type: object
 *             properties:
 *               file:
 *                 type: string
 *                 format: binary
 *                 description: Fichier à uploader (PDF, PPT, vidéo)
 *     responses:
 *       200:
 *         description: Fichier uploadé avec succès
 *       400:
 *         description: Aucun fichier fourni ou type non autorisé
 *       403:
 *         description: Permissions insuffisantes
 */
router.post('/:id/upload', 
  checkPermissions(['admin', 'owner']), 
  FormationController.uploadFile,
  FormationController.uploadFormationFile
);

// ==================== QUIZ ====================

/**
 * @swagger
 * /api/v1/formations/{id}/quiz:
 *   post:
 *     summary: Créer un quiz pour une formation
 *     tags: [Quiz]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 *         description: ID de la formation
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - title
 *               - questions
 *             properties:
 *               title:
 *                 type: string
 *                 description: Titre du quiz
 *               description:
 *                 type: string
 *                 description: Description du quiz
 *               passing_score:
 *                 type: integer
 *                 minimum: 0
 *                 maximum: 100
 *                 description: Score minimum pour réussir (%)
 *               max_attempts:
 *                 type: integer
 *                 minimum: 1
 *                 description: Nombre maximum de tentatives
 *               time_limit_minutes:
 *                 type: integer
 *                 minimum: 1
 *                 description: Limite de temps en minutes
 *               questions:
 *                 type: array
 *                 items:
 *                   type: object
 *                   required:
 *                     - question_text
 *                     - answers
 *                   properties:
 *                     question_text:
 *                       type: string
 *                       description: Texte de la question
 *                     question_type:
 *                       type: string
 *                       enum: [multiple_choice, true_false, text]
 *                       description: Type de question
 *                     points:
 *                       type: integer
 *                       minimum: 1
 *                       description: Points attribués à la question
 *                     answers:
 *                       type: array
 *                       items:
 *                         type: object
 *                         required:
 *                           - answer_text
 *                           - is_correct
 *                         properties:
 *                           answer_text:
 *                             type: string
 *                             description: Texte de la réponse
 *                           is_correct:
 *                             type: boolean
 *                             description: Si cette réponse est correcte
 *     responses:
 *       201:
 *         description: Quiz créé avec succès
 *       400:
 *         description: Données invalides
 *       403:
 *         description: Permissions insuffisantes
 */
router.post('/:id/quiz', checkPermissions(['admin', 'owner']), FormationController.createQuiz);

/**
 * @swagger
 * /api/v1/quiz/{quizId}:
 *   get:
 *     summary: Récupérer un quiz
 *     tags: [Quiz]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: quizId
 *         required: true
 *         schema:
 *           type: string
 *         description: ID du quiz
 *     responses:
 *       200:
 *         description: Détails du quiz
 *       404:
 *         description: Quiz non trouvé
 */
router.get('/quiz/:quizId', FormationController.getQuiz);

/**
 * @swagger
 * /api/v1/quiz/{quizId}/submit:
 *   post:
 *     summary: Soumettre les réponses d'un quiz
 *     tags: [Quiz]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: quizId
 *         required: true
 *         schema:
 *           type: string
 *         description: ID du quiz
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - answers
 *             properties:
 *               answers:
 *                 type: array
 *                 items:
 *                   type: object
 *                   required:
 *                     - questionId
 *                   properties:
 *                     questionId:
 *                       type: string
 *                       description: ID de la question
 *                     answerId:
 *                       type: string
 *                       description: ID de la réponse choisie (pour QCM)
 *                     textAnswer:
 *                       type: string
 *                       description: Réponse textuelle (pour questions ouvertes)
 *               timeSpent:
 *                 type: integer
 *                 description: Temps passé en minutes
 *     responses:
 *       200:
 *         description: Quiz soumis avec succès
 *       400:
 *         description: Données invalides
 */
router.post('/quiz/:quizId/submit', FormationController.submitQuiz);

/**
 * @swagger
 * /api/v1/quiz/{quizId}/results:
 *   get:
 *     summary: Récupérer les résultats d'un quiz (Admin)
 *     tags: [Quiz]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: quizId
 *         required: true
 *         schema:
 *           type: string
 *         description: ID du quiz
 *     responses:
 *       200:
 *         description: Résultats du quiz
 *       403:
 *         description: Permissions insuffisantes
 */
router.get('/quiz/:quizId/results', checkPermissions(['admin', 'owner']), FormationController.getQuizResults);

// ==================== PROGRESSION ====================

/**
 * @swagger
 * /api/v1/formations/{formationId}/progress:
 *   post:
 *     summary: Mettre à jour la progression d'un utilisateur
 *     tags: [Progression]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: formationId
 *         required: true
 *         schema:
 *           type: string
 *         description: ID de la formation
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - progress_percentage
 *               - status
 *             properties:
 *               progress_percentage:
 *                 type: number
 *                 minimum: 0
 *                 maximum: 100
 *                 description: Pourcentage de progression
 *               status:
 *                 type: string
 *                 enum: [not_started, in_progress, completed]
 *                 description: Statut de la progression
 *               started_at:
 *                 type: string
 *                 format: date-time
 *                 description: Date de début
 *               completed_at:
 *                 type: string
 *                 format: date-time
 *                 description: Date de fin
 *     responses:
 *       200:
 *         description: Progression mise à jour avec succès
 *       400:
 *         description: Données invalides
 */
router.post('/:formationId/progress', FormationController.updateProgress);

/**
 * @swagger
 * /api/v1/progress:
 *   get:
 *     summary: Récupérer la progression de l'utilisateur connecté
 *     tags: [Progression]
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: Progression de l'utilisateur
 */
router.get('/progress', FormationController.getUserProgress);

/**
 * @swagger
 * /api/v1/formations/{formationId}/progress:
 *   get:
 *     summary: Récupérer la progression de tous les utilisateurs pour une formation (Admin)
 *     tags: [Progression]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: formationId
 *         required: true
 *         schema:
 *           type: string
 *         description: ID de la formation
 *     responses:
 *       200:
 *         description: Progression de la formation
 *       403:
 *         description: Permissions insuffisantes
 */
router.get('/:formationId/progress', checkPermissions(['admin', 'owner']), FormationController.getFormationProgress);

export default router;
