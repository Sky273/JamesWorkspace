import express from 'express';
import multer from 'multer';
import fs from 'fs/promises';
import { UPLOAD_DIR } from '../config/constants.js';
import { authenticateToken } from '../middleware/auth.middleware.js';
import { userRateLimit } from '../middleware/rateLimit.middleware.js';
import { validateParams, validateBody, updateResumeSchema } from '../utils/validation.js';
import { selectWithTimeout, updateWithTimeout, destroyWithTimeout } from '../utils/postgresHelpers.js';
import { safeLog } from '../utils/logger.backend.js';
import { query } from '../config/database.js';

// Import LLM handlers (PostgreSQL version)
import { analyzeHandler, analyzeTextHandler, improveHandler, improveByIdHandler, matchHandler, adaptHandler } from './resumes/llm.handlers.js';
import { aiModifyHandler } from './resumes/aiModify.handler.js';
import { processAnalysisTags } from '../utils/tagCleaner.js';
import { invalidateTagsCache } from './tags.routes.js';

// Import version management
import { createVersion, hasImprovedTextChanged } from '../services/resumeVersions.service.js';
import versionsRouter from './resumes/versions.routes.js';

const router = express.Router();

// Configure multer for file uploads
const upload = multer({ dest: UPLOAD_DIR });

// ============================================
// RESUMES ROUTES (PostgreSQL)
// ============================================

// GET /api/resumes - Get all resumes (with server-side pagination and filters)
router.get('/', authenticateToken, async (req, res) => {
    try {
        const userFirm = req.user.firm || req.user.customer;
        const isAdmin = req.user.role?.toLowerCase() === 'admin';
        const page = parseInt(req.query.page) || 1;
        const limit = parseInt(req.query.limit) || 50;
        const offset = (page - 1) * limit;
        
        // Extract filter parameters
        const { search, status, tags } = req.query;

        // Build WHERE clause
        const conditions = [];
        const params = [];
        let paramIndex = 1;
        
        // Firm filter (non-admin users)
        if (!isAdmin && userFirm) {
            conditions.push(`firm_name = $${paramIndex}`);
            params.push(userFirm);
            paramIndex++;
        }
        
        // Status filter
        if (status && status !== 'all') {
            conditions.push(`status = $${paramIndex}`);
            params.push(status.toLowerCase());
            paramIndex++;
        }
        
        // Search filter (searches in name, title, file_name)
        if (search) {
            conditions.push(`(LOWER(name) LIKE $${paramIndex} OR LOWER(title) LIKE $${paramIndex} OR LOWER(file_name) LIKE $${paramIndex})`);
            params.push(`%${search.toLowerCase()}%`);
            paramIndex++;
        }

        const whereClause = conditions.length > 0 ? conditions.join(' AND ') : '';

        // Get total count for pagination
        let countSql = 'SELECT COUNT(*) as total FROM resumes';
        if (whereClause) {
            countSql += ` WHERE ${whereClause}`;
        }
        const countResult = await query(countSql, params);
        const totalCount = parseInt(countResult.rows[0]?.total || '0', 10);

        // Fetch resumes with pagination using raw query to exclude resume_file_data (binary)
        // This avoids loading large binary data when listing resumes
        let rawSql = `SELECT id, name, title, file_name, resume_file_url, resume_file_size, resume_file_type,
            status, firm_id, firm_name, skills, industries, tools, soft_skills,
            skills_cleaned, industries_cleaned, tools_cleaned, soft_skills_cleaned,
            skills_esco, industries_esco, tools_esco, soft_skills_esco,
            key_improvements, summary, experience_years, education_level, certifications, languages,
            created_at, updated_at, analyzed_at, original_text, improved_text, original_name,
            global_rating, skills_score, experience_score, education_score, ats_score,
            executive_summary_score, hobbies_languages_score,
            improved_global_rating, improved_skills_score, improved_experience_score, improved_education_score,
            improved_ats_score, improved_executive_summary_score, improved_hobbies_languages_score,
            template_id, template_name, improvement_suggestions, analysis_details, improvement_date,
            trigram, improved_key_improvements, improved_skills, improved_industries, improved_tools, improved_soft_skills
            FROM resumes`;
        
        if (whereClause) {
            rawSql += ` WHERE ${whereClause}`;
        }
        rawSql += ` ORDER BY LOWER(name) ASC, created_at DESC LIMIT ${limit + 1} OFFSET ${offset}`;
        
        const resumes = await selectWithTimeout('resumes', {
            rawQuery: rawSql,
            rawParams: params
        });

        // Check if there are more records
        const hasMore = resumes.length > limit;
        if (hasMore) {
            resumes.pop();
        }

        // Map to frontend format
        const processedRecords = resumes.map(record => ({
            id: record.id,
            Name: record.name,
            Title: record.title,
            'File Name': record.file_name,
            'Resume File': record.resume_file_url ? [{
                id: record.id,
                filename: record.file_name,
                size: record.resume_file_size,
                type: record.resume_file_type,
                url: record.resume_file_url
            }] : [],
            Status: record.status,
            FirmName: record.firm_name,
            CustomerName: record.firm_name,
            // Analysis scores
            'Global Rating': record.global_rating,
            'Skills Score': record.skills_score,
            'Experience Score': record.experience_score,
            'Education Score': record.education_score,
            'ATS Score': record.ats_score,
            'Executive Summary Score': record.executive_summary_score,
            'Hobbies Languages Score': record.hobbies_languages_score,
            // Improved scores
            'Improved Global Rating': record.improved_global_rating,
            'Improved Skills Score': record.improved_skills_score,
            'Improved Experience Score': record.improved_experience_score,
            'Improved Education Score': record.improved_education_score,
            'Improved ATS Score': record.improved_ats_score,
            'Improved Executive Summary Score': record.improved_executive_summary_score,
            'Improved Hobbies Languages Score': record.improved_hobbies_languages_score,
            // Tags
            Skills: record.skills,
            Industries: record.industries,
            Tools: record.tools,
            'Soft Skills': record.soft_skills,
            'Skills_cleaned': record.skills_cleaned,
            'Industries_cleaned': record.industries_cleaned,
            'Tools_cleaned': record.tools_cleaned,
            'Soft Skills_cleaned': record.soft_skills_cleaned,
            'Skills_esco': record.skills_esco,
            'Industries_esco': record.industries_esco,
            'Tools_esco': record.tools_esco,
            'Soft Skills_esco': record.soft_skills_esco,
            // Improved tags
            'Improved Skills': record.improved_skills,
            'Improved Industries': record.improved_industries,
            'Improved Tools': record.improved_tools,
            'Improved Soft Skills': record.improved_soft_skills,
            'Key Improvements': record.key_improvements,
            'Improved Key Improvements': record.improved_key_improvements,
            Summary: record.summary,
            'Experience Years': record.experience_years,
            'Education Level': record.education_level,
            Certifications: record.certifications,
            Languages: record.languages,
            // Text fields
            'Original Text': record.original_text,
            'Improved Text': record.improved_text,
            'Original Name': record.original_name,
            // Dates
            'Created At': record.created_at,
            'Analyzed At': record.analyzed_at,
            'Updated At': record.updated_at
        }));

        const response = {
            data: processedRecords,
            pagination: {
                page,
                limit,
                totalCount,
                totalPages: Math.ceil(totalCount / limit),
                hasMore,
                nextPage: hasMore ? page + 1 : null
            }
        };

        return res.json(response);
    } catch (error) {
        safeLog('error', 'Error fetching resumes', { error: error.message });
        return res.status(500).json({ 
            error: 'Failed to fetch resumes',
            message: error.message 
        });
    }
});

// GET /api/resumes/stats - Get statistics for dashboard KPIs
router.get('/stats', authenticateToken, async (req, res) => {
    try {
        const userFirm = req.user.firm || req.user.customer;
        const isAdmin = req.user.role?.toLowerCase() === 'admin';

        // Build WHERE clause based on user role
        let whereClause = '';
        const params = [];
        if (!isAdmin && userFirm) {
            whereClause = 'WHERE r.firm_name = $1';
            params.push(userFirm);
        }

        // Calculate date ranges
        const today = new Date();
        today.setHours(0, 0, 0, 0);
        const thisWeek = new Date(today);
        thisWeek.setDate(thisWeek.getDate() - 7);
        const thisMonth = new Date(today);
        thisMonth.setMonth(thisMonth.getMonth() - 1);

        // Fetch resume stats
        // Note: averageOriginal is calculated only from ANALYZED CVs (those with global_rating > 0)
        // averageImproved is calculated only from IMPROVED CVs (those with improved_global_rating > 0)
        const resumeStatsQuery = `
            SELECT 
                COUNT(*) as total,
                COUNT(CASE WHEN analyzed_at IS NOT NULL THEN 1 END) as analyzed,
                COUNT(CASE WHEN status = 'Improved' OR improved_global_rating > 0 THEN 1 END) as improved,
                COUNT(CASE WHEN created_at >= $${params.length + 1} THEN 1 END) as today,
                COUNT(CASE WHEN created_at >= $${params.length + 2} THEN 1 END) as this_week,
                COUNT(CASE WHEN created_at >= $${params.length + 3} THEN 1 END) as this_month,
                COALESCE(AVG(CASE WHEN global_rating > 0 THEN global_rating END), 0) as avg_original_score,
                COALESCE(AVG(CASE WHEN improved_global_rating > 0 THEN improved_global_rating END), 0) as avg_improved_score
            FROM resumes r
            ${whereClause}
        `;
        
        const resumeStatsResult = await query(resumeStatsQuery, [...params, today, thisWeek, thisMonth]);
        const resumeStats = resumeStatsResult.rows[0];

        // Fetch mission stats
        let missionWhereClause = '';
        if (!isAdmin && userFirm) {
            missionWhereClause = 'WHERE firm = $1';
        }
        
        const missionStatsQuery = `
            SELECT 
                COUNT(*) as total,
                COUNT(CASE WHEN status = 'active' THEN 1 END) as active
            FROM missions
            ${missionWhereClause}
        `;
        
        const missionStatsResult = await query(missionStatsQuery, !isAdmin && userFirm ? [userFirm] : []);
        const missionStats = missionStatsResult.rows[0];

        // Fetch adaptation stats
        let adaptationWhereClause = '';
        if (!isAdmin && userFirm) {
            adaptationWhereClause = 'WHERE firm = $1';
        }
        
        const adaptationStatsQuery = `
            SELECT COUNT(*) as total
            FROM resume_adaptations
            ${adaptationWhereClause}
        `;
        
        const adaptationStatsResult = await query(adaptationStatsQuery, !isAdmin && userFirm ? [userFirm] : []);
        const adaptationStats = adaptationStatsResult.rows[0];

        const avgOriginal = parseFloat(resumeStats.avg_original_score) || 0;
        const avgImproved = parseFloat(resumeStats.avg_improved_score) || 0;
        
        const stats = {
            resumes: {
                total: parseInt(resumeStats.total) || 0,
                analyzed: parseInt(resumeStats.analyzed) || 0,
                improved: parseInt(resumeStats.improved) || 0,
                today: parseInt(resumeStats.today) || 0,
                thisWeek: parseInt(resumeStats.this_week) || 0,
                thisMonth: parseInt(resumeStats.this_month) || 0
            },
            missions: {
                total: parseInt(missionStats.total) || 0,
                active: parseInt(missionStats.active) || 0
            },
            adaptations: {
                total: parseInt(adaptationStats.total) || 0
            },
            scores: {
                averageOriginal: Math.round(avgOriginal),
                averageImproved: Math.round(avgImproved),
                improvement: avgOriginal > 0 ? Math.round(((avgImproved - avgOriginal) / avgOriginal) * 100) : 0
            },
            customer: isAdmin ? null : userFirm
        };

        res.json(stats);
    } catch (error) {
        safeLog('error', 'Error fetching resume stats', { 
            error: error.message,
            stack: error.stack
        });
        res.status(500).json({ error: 'Failed to fetch statistics' });
    }
});

// GET /api/resumes/:id/download - Download original CV file
// IMPORTANT: This route must be defined BEFORE /:id to avoid route conflict
router.get('/:id/download', authenticateToken, validateParams('id'), async (req, res) => {
    try {
        const { id } = req.params;
        const userFirm = req.user.firm || req.user.customer;
        const isAdmin = req.user.role?.toLowerCase() === 'admin';

        // Fetch resume with file data
        const result = await query(
            `SELECT id, file_name, resume_file_data, resume_file_type, resume_file_size, firm_name
             FROM resumes WHERE id = $1`,
            [id]
        );

        if (result.rows.length === 0) {
            return res.status(404).json({ error: 'Resume not found' });
        }

        const resume = result.rows[0];

        // Check access rights (non-admin can only access their customer's resumes)
        if (!isAdmin && userFirm && resume.firm_name !== userFirm) {
            return res.status(403).json({ error: 'Access denied' });
        }

        // Check if file data exists
        if (!resume.resume_file_data) {
            return res.status(404).json({ error: 'File not found in database' });
        }

        // Set response headers for file download
        res.setHeader('Content-Type', resume.resume_file_type || 'application/octet-stream');
        res.setHeader('Content-Disposition', `attachment; filename="${encodeURIComponent(resume.file_name)}"`);
        res.setHeader('Content-Length', resume.resume_file_size || resume.resume_file_data.length);

        // Send file data
        res.send(resume.resume_file_data);
    } catch (error) {
        safeLog('error', 'Error downloading resume file', { id: req.params.id, error: error.message });
        res.status(500).json({ error: 'Failed to download file' });
    }
});

// GET /api/resumes/:id - Get resume by ID
router.get('/:id', authenticateToken, validateParams('id'), async (req, res) => {
    try {
        const { id } = req.params;
        // Use raw query to exclude resume_file_data (binary) - select all other columns
        const result = await query(
            `SELECT id, name, title, file_name, resume_file_url, resume_file_size, resume_file_type,
                status, firm_id, firm_name, skills, industries, tools, soft_skills,
                skills_cleaned, industries_cleaned, tools_cleaned, soft_skills_cleaned,
                skills_esco, industries_esco, tools_esco, soft_skills_esco,
                key_improvements, summary, experience_years, education_level, certifications, languages,
                created_at, updated_at, analyzed_at, original_text, improved_text, original_name,
                global_rating, skills_score, experience_score, education_score, ats_score,
                executive_summary_score, hobbies_languages_score,
                improved_global_rating, improved_skills_score, improved_experience_score, improved_education_score,
                improved_ats_score, improved_executive_summary_score, improved_hobbies_languages_score,
                template_id, template_name, improvement_suggestions, analysis_details, improvement_date,
                trigram, improved_key_improvements, improved_skills, improved_industries, improved_tools, improved_soft_skills
            FROM resumes WHERE id = $1`,
            [id]
        );
        
        if (result.rows.length === 0) {
            return res.status(404).json({ error: 'Resume not found' });
        }
        
        const resume = result.rows[0];
        
        const userRole = (req.user?.role || '').toLowerCase();
        const isAdmin = userRole === 'admin';
        const userFirm = req.user?.firm || req.user?.customer;
        
        if (!isAdmin && resume.firm_name !== userFirm) {
            return res.status(403).json({ error: 'Access denied: You can only view resumes from your firm' });
        }
        
        // Map to frontend format
        res.json({
            id: resume.id,
            Name: resume.name,
            Title: resume.title,
            'File Name': resume.file_name,
            'Resume File': resume.resume_file_url ? [{
                id: resume.id,
                filename: resume.file_name,
                size: resume.resume_file_size,
                type: resume.resume_file_type,
                url: resume.resume_file_url
            }] : [],
            Status: resume.status,
            FirmName: resume.firm_name,
            CustomerName: resume.firm_name,
            // Analysis scores
            'Global Rating': resume.global_rating,
            'Skills Score': resume.skills_score,
            'Experience Score': resume.experience_score,
            'Education Score': resume.education_score,
            'ATS Score': resume.ats_score,
            'Executive Summary Score': resume.executive_summary_score,
            'Hobbies Languages Score': resume.hobbies_languages_score,
            // Improved scores
            'Improved Global Rating': resume.improved_global_rating,
            'Improved Skills Score': resume.improved_skills_score,
            'Improved Experience Score': resume.improved_experience_score,
            'Improved Education Score': resume.improved_education_score,
            'Improved ATS Score': resume.improved_ats_score,
            'Improved Executive Summary Score': resume.improved_executive_summary_score,
            'Improved Hobbies Languages Score': resume.improved_hobbies_languages_score,
            // Tags
            Skills: resume.skills,
            Industries: resume.industries,
            Tools: resume.tools,
            'Soft Skills': resume.soft_skills,
            'Skills_cleaned': resume.skills_cleaned,
            'Industries_cleaned': resume.industries_cleaned,
            'Tools_cleaned': resume.tools_cleaned,
            'Soft Skills_cleaned': resume.soft_skills_cleaned,
            'Skills_esco': resume.skills_esco,
            'Industries_esco': resume.industries_esco,
            'Tools_esco': resume.tools_esco,
            'Soft Skills_esco': resume.soft_skills_esco,
            // Improved tags
            'Improved Skills': resume.improved_skills,
            'Improved Industries': resume.improved_industries,
            'Improved Tools': resume.improved_tools,
            'Improved Soft Skills': resume.improved_soft_skills,
            'Key Improvements': resume.key_improvements,
            'Improved Key Improvements': resume.improved_key_improvements,
            Summary: resume.summary,
            'Experience Years': resume.experience_years,
            'Education Level': resume.education_level,
            Certifications: resume.certifications,
            Languages: resume.languages,
            // Text fields
            'Original Text': resume.original_text,
            'Improved Text': resume.improved_text,
            'Original Name': resume.original_name,
            // Dates
            'Created At': resume.created_at,
            'Analyzed At': resume.analyzed_at,
            'Updated At': resume.updated_at
        });
    } catch (error) {
        if (error.statusCode === 404) {
            return res.status(404).json({ error: 'Resume not found' });
        }
        safeLog('error', 'Error fetching resume', { error: error.message, resumeId: req.params.id });
        return res.status(500).json({ 
            error: 'Failed to fetch resume',
            message: error.message 
        });
    }
});

// POST /api/resumes/upload - Upload resume file
router.post('/upload', authenticateToken, upload.single('file'), async (req, res) => {
    try {
        if (!req.file) {
            return res.status(400).json({ error: 'No file uploaded' });
        }

        const userFirm = req.user.firm || req.user.customer;
        const { name, title } = req.body;

        // Read file content from temp location
        const fileBuffer = await fs.readFile(req.file.path);

        // Find firm by name to get ID
        let firmId = null;
        let firmName = userFirm;
        
        if (userFirm) {
            const firms = await selectWithTimeout('firms', {
                where: 'name = $1',
                params: [userFirm],
                limit: 1
            });
            
            if (firms.length > 0) {
                firmId = firms[0].id;
                firmName = firms[0].name;
            }
        }

        // Insert resume with file data stored in database
        const result = await query(
            `INSERT INTO resumes (name, title, file_name, resume_file_data, resume_file_size, resume_file_type, resume_file_url, status, firm_id, firm_name)
             VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10)
             RETURNING *`,
            [
                name || req.file.originalname,
                title || '',
                req.file.originalname,
                fileBuffer,
                req.file.size,
                req.file.mimetype,
                `/api/resumes/${null}/download`, // Will be updated after insert
                'active',
                firmId,
                firmName
            ]
        );

        const newResume = result.rows[0];

        // Update the resume_file_url with the correct ID
        await query(
            `UPDATE resumes SET resume_file_url = $1 WHERE id = $2`,
            [`/api/resumes/${newResume.id}/download`, newResume.id]
        );
        newResume.resume_file_url = `/api/resumes/${newResume.id}/download`;

        // Delete temp file from uploads directory
        try {
            await fs.unlink(req.file.path);
        } catch (unlinkError) {
            safeLog('warn', 'Failed to delete temp file', { path: req.file.path, error: unlinkError.message });
        }

        res.status(201).json({
            id: newResume.id,
            Name: newResume.name,
            Title: newResume.title,
            'File Name': newResume.file_name,
            'Resume File': [{
                id: newResume.id,
                filename: newResume.file_name,
                size: newResume.resume_file_size,
                type: newResume.resume_file_type,
                url: newResume.resume_file_url
            }],
            Status: 'Active',
            FirmName: newResume.firm_name,
            CustomerName: newResume.firm_name
        });
    } catch (error) {
        safeLog('error', 'Error uploading resume', { error: error.message });
        // Clean up temp file on error
        if (req.file?.path) {
            try {
                await fs.unlink(req.file.path);
            } catch { /* ignore */ }
        }
        res.status(500).json({ error: 'Failed to upload resume' });
    }
});

// Helper function to parse score values (handles "75%", 75, "75")
function parseScore(value) {
    if (value === undefined || value === null) return undefined;
    if (typeof value === 'number') return value;
    if (typeof value === 'string') {
        // Remove % and parse as integer
        const cleaned = value.replace('%', '').trim();
        const parsed = parseInt(cleaned, 10);
        return isNaN(parsed) ? undefined : parsed;
    }
    return undefined;
}

// PUT /api/resumes/:id - Update resume
router.put('/:id', authenticateToken, validateParams('id'), validateBody(updateResumeSchema), async (req, res) => {
    try {
        const { id } = req.params;
        safeLog('info', 'PUT /api/resumes/:id called', { 
            resumeId: id, 
            bodyKeys: Object.keys(req.body),
            hasImprovedGlobalRating: req.body['Improved Global Rating'] !== undefined,
            improvedGlobalRatingValue: req.body['Improved Global Rating'],
            improvedSkillsScoreValue: req.body['Improved Skills Score'],
            improvedExperienceScoreValue: req.body['Improved Experience Score']
        });
        const updateData = {};

        // Map frontend fields to PostgreSQL columns
        if (req.body.Name !== undefined) updateData.name = req.body.Name;
        if (req.body.Title !== undefined) updateData.title = req.body.Title;
        if (req.body.Status !== undefined) updateData.status = req.body.Status.toLowerCase();
        if (req.body['Original Text'] !== undefined) updateData.original_text = req.body['Original Text'];
        if (req.body['Improved Text'] !== undefined) updateData.improved_text = req.body['Improved Text'];
        
        // Parse scores - handle "75%", 75, "75" formats
        if (req.body['Global Rating'] !== undefined) updateData.global_rating = parseScore(req.body['Global Rating']);
        if (req.body['Skills Score'] !== undefined) updateData.skills_score = parseScore(req.body['Skills Score']);
        if (req.body['Experience Score'] !== undefined) updateData.experience_score = parseScore(req.body['Experience Score']);
        if (req.body['Education Score'] !== undefined) updateData.education_score = parseScore(req.body['Education Score']);
        if (req.body['ATS Score'] !== undefined) updateData.ats_score = parseScore(req.body['ATS Score']);
        if (req.body['Executive Summary Score'] !== undefined) updateData.executive_summary_score = parseScore(req.body['Executive Summary Score']);
        if (req.body['Hobbies Languages Score'] !== undefined) updateData.hobbies_languages_score = parseScore(req.body['Hobbies Languages Score']);
        
        // Improved scores (post-improvement)
        if (req.body['Improved Global Rating'] !== undefined) updateData.improved_global_rating = parseScore(req.body['Improved Global Rating']);
        if (req.body['Improved Skills Score'] !== undefined) updateData.improved_skills_score = parseScore(req.body['Improved Skills Score']);
        if (req.body['Improved Experience Score'] !== undefined) updateData.improved_experience_score = parseScore(req.body['Improved Experience Score']);
        if (req.body['Improved Education Score'] !== undefined) updateData.improved_education_score = parseScore(req.body['Improved Education Score']);
        if (req.body['Improved ATS Score'] !== undefined) updateData.improved_ats_score = parseScore(req.body['Improved ATS Score']);
        if (req.body['Improved Executive Summary Score'] !== undefined) updateData.improved_executive_summary_score = parseScore(req.body['Improved Executive Summary Score']);
        if (req.body['Improved Hobbies Languages Score'] !== undefined) updateData.improved_hobbies_languages_score = parseScore(req.body['Improved Hobbies Languages Score']);
        
        // JSONB fields - ensure they are properly formatted for PostgreSQL
        // Handle both array and already-stringified JSON
        const stringifyIfNeeded = (value) => {
            if (typeof value === 'string') {
                // Already a string, check if it's valid JSON
                try {
                    JSON.parse(value);
                    return value; // Already valid JSON string
                } catch {
                    return JSON.stringify([value]); // Single string, wrap in array
                }
            }
            return JSON.stringify(value || []);
        };
        
        if (req.body.Skills !== undefined) updateData.skills = stringifyIfNeeded(req.body.Skills);
        if (req.body.Industries !== undefined) updateData.industries = stringifyIfNeeded(req.body.Industries);
        if (req.body.Tools !== undefined) updateData.tools = stringifyIfNeeded(req.body.Tools);
        if (req.body['Soft Skills'] !== undefined) updateData.soft_skills = stringifyIfNeeded(req.body['Soft Skills']);
        if (req.body.Skills_cleaned !== undefined) updateData.skills_cleaned = stringifyIfNeeded(req.body.Skills_cleaned);
        if (req.body.Industries_cleaned !== undefined) updateData.industries_cleaned = stringifyIfNeeded(req.body.Industries_cleaned);
        if (req.body.Tools_cleaned !== undefined) updateData.tools_cleaned = stringifyIfNeeded(req.body.Tools_cleaned);
        if (req.body['Soft Skills_cleaned'] !== undefined) updateData.soft_skills_cleaned = stringifyIfNeeded(req.body['Soft Skills_cleaned']);
        if (req.body.Skills_esco !== undefined) updateData.skills_esco = stringifyIfNeeded(req.body.Skills_esco);
        if (req.body.Industries_esco !== undefined) updateData.industries_esco = stringifyIfNeeded(req.body.Industries_esco);
        if (req.body.Tools_esco !== undefined) updateData.tools_esco = stringifyIfNeeded(req.body.Tools_esco);
        if (req.body['Soft Skills_esco'] !== undefined) updateData.soft_skills_esco = stringifyIfNeeded(req.body['Soft Skills_esco']);
        
        // Improved tags (after LLM improvement)
        if (req.body['Improved Skills'] !== undefined) updateData.improved_skills = stringifyIfNeeded(req.body['Improved Skills']);
        if (req.body['Improved Industries'] !== undefined) updateData.improved_industries = stringifyIfNeeded(req.body['Improved Industries']);
        if (req.body['Improved Tools'] !== undefined) updateData.improved_tools = stringifyIfNeeded(req.body['Improved Tools']);
        if (req.body['Improved Soft Skills'] !== undefined) updateData.improved_soft_skills = stringifyIfNeeded(req.body['Improved Soft Skills']);
        
        if (req.body['Key Improvements'] !== undefined) {
            // Key Improvements can be a string or object
            const keyImprovements = req.body['Key Improvements'];
            updateData.key_improvements = typeof keyImprovements === 'string' ? keyImprovements : JSON.stringify(keyImprovements);
        }
        if (req.body['Improved Key Improvements'] !== undefined) {
            const improvedKeyImprovements = req.body['Improved Key Improvements'];
            updateData.improved_key_improvements = typeof improvedKeyImprovements === 'string' ? improvedKeyImprovements : JSON.stringify(improvedKeyImprovements);
        }
        if (req.body.Summary !== undefined) updateData.summary = req.body.Summary;
        if (req.body['Experience Years'] !== undefined) updateData.experience_years = req.body['Experience Years'];
        if (req.body['Education Level'] !== undefined) updateData.education_level = req.body['Education Level'];
        if (req.body.Certifications !== undefined) updateData.certifications = req.body.Certifications;
        if (req.body.Languages !== undefined) updateData.languages = req.body.Languages;
        if (req.body['Original Name'] !== undefined) updateData.original_name = req.body['Original Name'];
        if (req.body['Analysis Date'] !== undefined) updateData.analyzed_at = new Date(req.body['Analysis Date']);

        // Set analyzed_at if analysis data is being updated
        if (req.body.Skills || req.body.Industries || req.body.Tools || req.body['Soft Skills']) {
            updateData.analyzed_at = new Date();
            
            // Automatically calculate cleaned tags when raw tags are provided
            const rawTags = {
                skills: Array.isArray(req.body.Skills) ? req.body.Skills : [],
                industries: Array.isArray(req.body.Industries) ? req.body.Industries : [],
                tools: Array.isArray(req.body.Tools) ? req.body.Tools : [],
                softSkills: Array.isArray(req.body['Soft Skills']) ? req.body['Soft Skills'] : []
            };
            
            const { cleanedTags } = processAnalysisTags({ tags: rawTags });
            
            // Add cleaned tags to update data
            if (cleanedTags.skills.length > 0) {
                updateData.skills_cleaned = JSON.stringify(cleanedTags.skills);
            }
            if (cleanedTags.industries.length > 0) {
                updateData.industries_cleaned = JSON.stringify(cleanedTags.industries);
            }
            if (cleanedTags.tools.length > 0) {
                updateData.tools_cleaned = JSON.stringify(cleanedTags.tools);
            }
            if (cleanedTags.softSkills.length > 0) {
                updateData.soft_skills_cleaned = JSON.stringify(cleanedTags.softSkills);
            }
            
            safeLog('info', 'Auto-calculated cleaned tags', {
                resumeId: id,
                rawSkills: rawTags.skills.length,
                cleanedSkills: cleanedTags.skills.length,
                rawIndustries: rawTags.industries.length,
                cleanedIndustries: cleanedTags.industries.length
            });
        }

        // Only update if there are fields to update
        if (Object.keys(updateData).length === 0) {
            return res.status(400).json({ error: 'No fields to update' });
        }

        safeLog('info', 'PUT /api/resumes/:id - updateData prepared', { 
            resumeId: id,
            fieldsToUpdate: Object.keys(updateData),
            hasGlobalRating: updateData.global_rating !== undefined,
            globalRatingMapped: updateData.global_rating
        });

        // Check if improved_text is being updated and has changed
        const isImprovedTextUpdate = updateData.improved_text !== undefined;
        let shouldCreateVersion = false;
        let changeReason = 'manual_edit';

        if (isImprovedTextUpdate) {
            // Determine change reason based on status or other indicators
            if (req.body.Status === 'Improved' || req.body['Last Improved']) {
                changeReason = 'initial_improvement';
            }
            
            // Check if the text has actually changed
            shouldCreateVersion = await hasImprovedTextChanged(id, updateData.improved_text);
            
            safeLog('info', 'Improved text update detected', {
                resumeId: id,
                shouldCreateVersion,
                changeReason,
                textLength: updateData.improved_text?.length || 0
            });
        }

        const records = await updateWithTimeout('resumes', [{
            id: id,
            fields: updateData
        }]);

        const updatedResume = records[0];

        // Create a new version if improved text was changed
        if (shouldCreateVersion && updateData.improved_text) {
            try {
                const versionData = await createVersion({
                    resumeId: id,
                    improvedText: updateData.improved_text,
                    scores: {
                        improvedGlobalRating: updateData.improved_global_rating,
                        improvedSkillsScore: updateData.improved_skills_score,
                        improvedExperienceScore: updateData.improved_experience_score,
                        improvedEducationScore: updateData.improved_education_score,
                        improvedAtsScore: updateData.improved_ats_score,
                        improvedExecutiveSummaryScore: updateData.improved_executive_summary_score,
                        improvedHobbiesLanguagesScore: updateData.improved_hobbies_languages_score
                    },
                    tags: {
                        improvedSkills: updateData.improved_skills ? JSON.parse(updateData.improved_skills) : [],
                        improvedIndustries: updateData.improved_industries ? JSON.parse(updateData.improved_industries) : [],
                        improvedTools: updateData.improved_tools ? JSON.parse(updateData.improved_tools) : [],
                        improvedSoftSkills: updateData.improved_soft_skills ? JSON.parse(updateData.improved_soft_skills) : []
                    },
                    keyImprovements: updateData.improved_key_improvements,
                    userId: req.user?.id,
                    changeReason
                });
                
                // Update the current_version in the response
                updatedResume.current_version = versionData.versionNumber;
                
                safeLog('info', 'Resume version created', {
                    resumeId: id,
                    versionNumber: versionData.versionNumber
                });
            } catch (versionError) {
                // Log error but don't fail the update
                safeLog('error', 'Failed to create resume version', {
                    error: versionError.message,
                    resumeId: id
                });
            }
        }
        
        // Invalidate tags cache if tags were updated
        if (updateData.skills_cleaned || updateData.industries_cleaned || 
            updateData.tools_cleaned || updateData.soft_skills_cleaned) {
            invalidateTagsCache();
        }

        // Return complete resume data with all analysis fields
        res.json({
            id: updatedResume.id,
            Name: updatedResume.name,
            Title: updatedResume.title,
            Status: updatedResume.status,
            FirmName: updatedResume.firm_name,
            CustomerName: updatedResume.firm_name,
            'Original Text': updatedResume.original_text,
            'Improved Text': updatedResume.improved_text,
            'Original Name': updatedResume.original_name,
            'Global Rating': updatedResume.global_rating,
            'Skills Score': updatedResume.skills_score,
            'Experience Score': updatedResume.experience_score,
            'Education Score': updatedResume.education_score,
            'ATS Score': updatedResume.ats_score,
            'Executive Summary Score': updatedResume.executive_summary_score,
            'Hobbies Languages Score': updatedResume.hobbies_languages_score,
            // Improved scores
            'Improved Global Rating': updatedResume.improved_global_rating,
            'Improved Skills Score': updatedResume.improved_skills_score,
            'Improved Experience Score': updatedResume.improved_experience_score,
            'Improved Education Score': updatedResume.improved_education_score,
            'Improved ATS Score': updatedResume.improved_ats_score,
            'Improved Executive Summary Score': updatedResume.improved_executive_summary_score,
            'Improved Hobbies Languages Score': updatedResume.improved_hobbies_languages_score,
            // Tags
            Skills: updatedResume.skills,
            Industries: updatedResume.industries,
            Tools: updatedResume.tools,
            'Soft Skills': updatedResume.soft_skills,
            // Improved tags
            'Improved Skills': updatedResume.improved_skills,
            'Improved Industries': updatedResume.improved_industries,
            'Improved Tools': updatedResume.improved_tools,
            'Improved Soft Skills': updatedResume.improved_soft_skills,
            'Key Improvements': updatedResume.key_improvements,
            'Improved Key Improvements': updatedResume.improved_key_improvements,
            'Analyzed At': updatedResume.analyzed_at,
            'Current Version': updatedResume.current_version || 0,
            'Resume File': updatedResume.resume_file_url ? [{
                url: updatedResume.resume_file_url,
                filename: updatedResume.file_name,
                size: updatedResume.resume_file_size,
                type: updatedResume.resume_file_type
            }] : [],
            'Created At': updatedResume.created_at,
            'Updated At': updatedResume.updated_at
        });
    } catch (error) {
        if (error.statusCode === 404) {
            return res.status(404).json({ error: 'Resume not found' });
        }
        safeLog('error', 'Error updating resume', { error: error.message, resumeId: req.params.id });
        res.status(500).json({ error: 'Failed to update resume' });
    }
});

// DELETE /api/resumes/:id - Delete resume
router.delete('/:id', authenticateToken, validateParams('id'), async (req, res) => {
    try {
        const { id } = req.params;
        
        await destroyWithTimeout('resumes', [id]);
        
        res.json({ message: 'Resume deleted successfully' });
    } catch (error) {
        if (error.statusCode === 404) {
            return res.status(404).json({ error: 'Resume not found' });
        }
        safeLog('error', 'Error deleting resume', { error: error.message, resumeId: req.params.id });
        res.status(500).json({ error: 'Failed to delete resume' });
    }
});

// ============================================
// LLM ROUTES (delegated to handlers)
// ============================================

// POST /api/resumes/analyze - Analyze resume text
router.post('/analyze', authenticateToken, userRateLimit(), analyzeHandler);

// POST /api/resumes/analyze-text - Analyze raw text
router.post('/analyze-text', authenticateToken, userRateLimit(), analyzeTextHandler);

// POST /api/resumes/improve - Improve resume text
router.post('/improve', authenticateToken, userRateLimit(), improveHandler);

// POST /api/resumes/:id/improve - Improve resume by ID
router.post('/:id/improve', authenticateToken, validateParams('id'), userRateLimit(), improveByIdHandler);

// POST /api/resumes/:id/match - Match resume with mission
router.post('/:id/match', authenticateToken, validateParams('id'), userRateLimit(), matchHandler);

// POST /api/resumes/:id/adapt - Adapt resume for mission
router.post('/:id/adapt', authenticateToken, validateParams('id'), userRateLimit(), adaptHandler);

// POST /api/resumes/:id/ai-modify - AI-powered resume modification
router.post('/:id/ai-modify', authenticateToken, validateParams('id'), userRateLimit(), aiModifyHandler);

// ============================================
// VERSION ROUTES
// ============================================
router.use('/', versionsRouter);

export default router;
