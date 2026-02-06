/**
 * OpenAPI 3.0 Documentation
 * API documentation for ResumeConverter
 */

export const openApiSpec = {
    openapi: '3.0.3',
    info: {
        title: 'ResumeConverter API',
        version: '1.5.1',
        description: 'API pour la gestion et l\'amélioration de CV assistée par IA',
        contact: {
            name: 'Support',
            email: 'support@resumeconverter.app'
        }
    },
    servers: [
        {
            url: '/api',
            description: 'API Server'
        }
    ],
    tags: [
        { name: 'Auth', description: 'Authentification et gestion des sessions' },
        { name: 'Resumes', description: 'Gestion des CV' },
        { name: 'Missions', description: 'Gestion des offres d\'emploi' },
        { name: 'Adaptations', description: 'CV adaptés aux missions' },
        { name: 'Templates', description: 'Modèles de CV' },
        { name: 'LLM', description: 'Proxy vers les APIs LLM (OpenAI, Anthropic)' },
        { name: 'Health', description: 'État de santé de l\'application' },
        { name: 'Admin', description: 'Administration (admin uniquement)' }
    ],
    components: {
        securitySchemes: {
            cookieAuth: {
                type: 'apiKey',
                in: 'cookie',
                name: 'accessToken',
                description: 'JWT token dans un cookie httpOnly'
            }
        },
        schemas: {
            Error: {
                type: 'object',
                properties: {
                    success: { type: 'boolean', example: false },
                    error: { type: 'string' },
                    statusCode: { type: 'integer' }
                }
            },
            Pagination: {
                type: 'object',
                properties: {
                    page: { type: 'integer', example: 1 },
                    pageSize: { type: 'integer', example: 20 },
                    total: { type: 'integer', example: 100 },
                    totalPages: { type: 'integer', example: 5 },
                    hasMore: { type: 'boolean', example: true }
                }
            },
            Resume: {
                type: 'object',
                properties: {
                    id: { type: 'string', format: 'uuid' },
                    'Original Name': { type: 'string' },
                    'Candidate Name': { type: 'string' },
                    'Professional Title': { type: 'string' },
                    'Status': { type: 'string', enum: ['Pending', 'Processing', 'Analyzed', 'Improved', 'Error'] },
                    'Global Rating': { type: 'string' },
                    'Skills': { type: 'array', items: { type: 'string' } },
                    'Industries': { type: 'array', items: { type: 'string' } },
                    'Created At': { type: 'string', format: 'date-time' }
                }
            },
            Mission: {
                type: 'object',
                properties: {
                    id: { type: 'string', format: 'uuid' },
                    Title: { type: 'string' },
                    Content: { type: 'string' },
                    Status: { type: 'string', enum: ['Active', 'Closed', 'Draft'] },
                    'Created At': { type: 'string', format: 'date-time' }
                }
            },
            Template: {
                type: 'object',
                properties: {
                    id: { type: 'string', format: 'uuid' },
                    name: { type: 'string' },
                    description: { type: 'string' },
                    popular: { type: 'boolean' },
                    status: { type: 'string', enum: ['active', 'inactive'] },
                    tags: { type: 'array', items: { type: 'string' } }
                }
            },
            HealthCheck: {
                type: 'object',
                properties: {
                    status: { type: 'string', enum: ['healthy', 'degraded', 'unhealthy'] },
                    timestamp: { type: 'string', format: 'date-time' },
                    responseTime: { type: 'string' },
                    checks: {
                        type: 'object',
                        properties: {
                            server: { type: 'object' },
                            database: { type: 'object' },
                            memory: { type: 'object' },
                            cache: { type: 'object' }
                        }
                    }
                }
            },
            SignInRequest: {
                type: 'object',
                required: ['email', 'password'],
                properties: {
                    email: { type: 'string', format: 'email' },
                    password: { type: 'string', minLength: 8 }
                }
            },
            LLMRequest: {
                type: 'object',
                required: ['messages'],
                properties: {
                    model: { type: 'string', example: 'gpt-4o' },
                    messages: {
                        type: 'array',
                        items: {
                            type: 'object',
                            properties: {
                                role: { type: 'string', enum: ['system', 'user', 'assistant'] },
                                content: { type: 'string' }
                            }
                        }
                    },
                    temperature: { type: 'number', minimum: 0, maximum: 2 },
                    max_tokens: { type: 'integer', minimum: 1 }
                }
            }
        }
    },
    paths: {
        '/health': {
            get: {
                tags: ['Health'],
                summary: 'Vérifier l\'état de santé de l\'application',
                description: 'Retourne l\'état du serveur, de la base de données, de la mémoire et des caches',
                responses: {
                    '200': {
                        description: 'Application en bonne santé',
                        content: {
                            'application/json': {
                                schema: { $ref: '#/components/schemas/HealthCheck' }
                            }
                        }
                    },
                    '503': {
                        description: 'Application en mauvaise santé'
                    }
                }
            }
        },
        '/auth/signin': {
            post: {
                tags: ['Auth'],
                summary: 'Connexion utilisateur',
                requestBody: {
                    required: true,
                    content: {
                        'application/json': {
                            schema: { $ref: '#/components/schemas/SignInRequest' }
                        }
                    }
                },
                responses: {
                    '200': {
                        description: 'Connexion réussie',
                        headers: {
                            'Set-Cookie': {
                                description: 'Cookies accessToken et refreshToken'
                            }
                        }
                    },
                    '401': { description: 'Identifiants invalides' },
                    '403': { description: 'Compte inactif' }
                }
            }
        },
        '/auth/signout': {
            post: {
                tags: ['Auth'],
                summary: 'Déconnexion',
                security: [{ cookieAuth: [] }],
                responses: {
                    '200': { description: 'Déconnexion réussie' }
                }
            }
        },
        '/auth/refresh': {
            post: {
                tags: ['Auth'],
                summary: 'Rafraîchir le token d\'accès',
                responses: {
                    '200': { description: 'Token rafraîchi' },
                    '401': { description: 'Refresh token invalide' }
                }
            }
        },
        '/resumes': {
            get: {
                tags: ['Resumes'],
                summary: 'Lister les CV',
                security: [{ cookieAuth: [] }],
                parameters: [
                    { name: 'page', in: 'query', schema: { type: 'integer', default: 1 } },
                    { name: 'limit', in: 'query', schema: { type: 'integer', default: 20, maximum: 100 } },
                    { name: 'search', in: 'query', schema: { type: 'string' } },
                    { name: 'status', in: 'query', schema: { type: 'string' } }
                ],
                responses: {
                    '200': {
                        description: 'Liste des CV',
                        content: {
                            'application/json': {
                                schema: {
                                    type: 'object',
                                    properties: {
                                        data: { type: 'array', items: { $ref: '#/components/schemas/Resume' } },
                                        pagination: { $ref: '#/components/schemas/Pagination' }
                                    }
                                }
                            }
                        }
                    }
                }
            },
            post: {
                tags: ['Resumes'],
                summary: 'Uploader un nouveau CV',
                security: [{ cookieAuth: [] }],
                requestBody: {
                    required: true,
                    content: {
                        'multipart/form-data': {
                            schema: {
                                type: 'object',
                                properties: {
                                    file: { type: 'string', format: 'binary' }
                                }
                            }
                        }
                    }
                },
                responses: {
                    '201': { description: 'CV créé' },
                    '400': { description: 'Fichier invalide' }
                }
            }
        },
        '/resumes/{id}': {
            get: {
                tags: ['Resumes'],
                summary: 'Obtenir un CV par ID',
                security: [{ cookieAuth: [] }],
                parameters: [
                    { name: 'id', in: 'path', required: true, schema: { type: 'string', format: 'uuid' } }
                ],
                responses: {
                    '200': { description: 'CV trouvé' },
                    '404': { description: 'CV non trouvé' }
                }
            },
            put: {
                tags: ['Resumes'],
                summary: 'Mettre à jour un CV',
                security: [{ cookieAuth: [] }],
                parameters: [
                    { name: 'id', in: 'path', required: true, schema: { type: 'string', format: 'uuid' } }
                ],
                responses: {
                    '200': { description: 'CV mis à jour' },
                    '404': { description: 'CV non trouvé' }
                }
            },
            delete: {
                tags: ['Resumes'],
                summary: 'Supprimer un CV',
                security: [{ cookieAuth: [] }],
                parameters: [
                    { name: 'id', in: 'path', required: true, schema: { type: 'string', format: 'uuid' } }
                ],
                responses: {
                    '200': { description: 'CV supprimé' },
                    '404': { description: 'CV non trouvé' }
                }
            }
        },
        '/resumes/stats': {
            get: {
                tags: ['Resumes'],
                summary: 'Obtenir les statistiques des CV',
                security: [{ cookieAuth: [] }],
                responses: {
                    '200': {
                        description: 'Statistiques',
                        content: {
                            'application/json': {
                                schema: {
                                    type: 'object',
                                    properties: {
                                        resumes: {
                                            type: 'object',
                                            properties: {
                                                total: { type: 'integer' },
                                                analyzed: { type: 'integer' },
                                                improved: { type: 'integer' }
                                            }
                                        },
                                        scores: {
                                            type: 'object',
                                            properties: {
                                                averageOriginal: { type: 'integer' },
                                                averageImproved: { type: 'integer' },
                                                improvement: { type: 'integer' }
                                            }
                                        }
                                    }
                                }
                            }
                        }
                    }
                }
            }
        },
        '/missions': {
            get: {
                tags: ['Missions'],
                summary: 'Lister les missions',
                security: [{ cookieAuth: [] }],
                parameters: [
                    { name: 'page', in: 'query', schema: { type: 'integer', default: 1 } },
                    { name: 'limit', in: 'query', schema: { type: 'integer', default: 20 } },
                    { name: 'status', in: 'query', schema: { type: 'string' } }
                ],
                responses: {
                    '200': { description: 'Liste des missions' }
                }
            },
            post: {
                tags: ['Missions'],
                summary: 'Créer une mission',
                security: [{ cookieAuth: [] }],
                requestBody: {
                    required: true,
                    content: {
                        'application/json': {
                            schema: { $ref: '#/components/schemas/Mission' }
                        }
                    }
                },
                responses: {
                    '201': { description: 'Mission créée' }
                }
            }
        },
        '/templates': {
            get: {
                tags: ['Templates'],
                summary: 'Lister les modèles de CV',
                security: [{ cookieAuth: [] }],
                parameters: [
                    { name: 'status', in: 'query', schema: { type: 'string', enum: ['active', 'inactive'] } }
                ],
                responses: {
                    '200': {
                        description: 'Liste des modèles',
                        content: {
                            'application/json': {
                                schema: {
                                    type: 'object',
                                    properties: {
                                        data: { type: 'array', items: { $ref: '#/components/schemas/Template' } }
                                    }
                                }
                            }
                        }
                    }
                }
            }
        },
        '/llm/openai': {
            post: {
                tags: ['LLM'],
                summary: 'Proxy vers OpenAI API',
                security: [{ cookieAuth: [] }],
                requestBody: {
                    required: true,
                    content: {
                        'application/json': {
                            schema: { $ref: '#/components/schemas/LLMRequest' }
                        }
                    }
                },
                responses: {
                    '200': { description: 'Réponse LLM' },
                    '429': { description: 'Rate limit atteint' },
                    '500': { description: 'Erreur API' }
                }
            }
        },
        '/llm/anthropic': {
            post: {
                tags: ['LLM'],
                summary: 'Proxy vers Anthropic API',
                security: [{ cookieAuth: [] }],
                requestBody: {
                    required: true,
                    content: {
                        'application/json': {
                            schema: { $ref: '#/components/schemas/LLMRequest' }
                        }
                    }
                },
                responses: {
                    '200': { description: 'Réponse LLM' },
                    '429': { description: 'Rate limit atteint' }
                }
            }
        },
        '/chatbot/message': {
            post: {
                tags: ['LLM'],
                summary: 'Envoyer un message au chatbot',
                security: [{ cookieAuth: [] }],
                requestBody: {
                    required: true,
                    content: {
                        'application/json': {
                            schema: {
                                type: 'object',
                                required: ['message'],
                                properties: {
                                    message: { type: 'string', maxLength: 10000 },
                                    conversationHistory: {
                                        type: 'array',
                                        items: {
                                            type: 'object',
                                            properties: {
                                                role: { type: 'string', enum: ['user', 'assistant'] },
                                                content: { type: 'string' }
                                            }
                                        }
                                    }
                                }
                            }
                        }
                    }
                },
                responses: {
                    '200': {
                        description: 'Réponse du chatbot',
                        content: {
                            'application/json': {
                                schema: {
                                    type: 'object',
                                    properties: {
                                        response: { type: 'string' },
                                        metadata: { type: 'object' }
                                    }
                                }
                            }
                        }
                    }
                }
            }
        }
    }
};

export default openApiSpec;
