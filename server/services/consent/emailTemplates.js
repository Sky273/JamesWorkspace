/**
 * Consent Email Templates
 * HTML email builders for consent request and reminder emails
 */

/**
 * Get the frontend URL for consent pages
 * @returns {string}
 */
export function getFrontendUrl() {
    return process.env.FRONTEND_URL || process.env.VITE_APP_URL || 'http://localhost:5173';
}

/**
 * Build HTML email for consent request
 * @param {Object} params
 * @returns {string} HTML content
 */
export function buildConsentRequestEmailHtml({ candidateName, firmName, consentUrl, expiryDays, dpoSettings = {} }) {
    const dpoEmail = dpoSettings.dpo_email || 'dpo@aptea.net';
    const firmAddress = dpoSettings.firm_address || '';
    const firmPhone = dpoSettings.firm_phone || '';
    const firmWebsite = dpoSettings.firm_website || 'https://www.aptea.net';
    const privacyPolicyUrl = dpoSettings.privacy_policy_url || `${getFrontendUrl()}/privacy`;
    
    return `
<!DOCTYPE html>
<html lang="fr">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
</head>
<body style="margin: 0; padding: 0; font-family: Arial, sans-serif; background-color: #f4f4f5;">
    <table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="max-width: 650px; margin: 0 auto; padding: 20px;">
        <tr>
            <td style="background-color: #ffffff; border-radius: 8px; padding: 40px; box-shadow: 0 2px 4px rgba(0,0,0,0.1);">
                <!-- Header -->
                <table role="presentation" width="100%" cellspacing="0" cellpadding="0">
                    <tr>
                        <td style="text-align: center; padding-bottom: 25px; border-bottom: 1px solid #e5e7eb;">
                            <h1 style="color: #1f2937; font-size: 22px; margin: 0;">Demande de consentement</h1>
                            <p style="color: #6b7280; font-size: 14px; margin: 8px 0 0 0;">Conservation et traitement de votre CV</p>
                        </td>
                    </tr>
                </table>

                <!-- Content -->
                <table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="padding-top: 25px;">
                    <tr>
                        <td>
                            <p style="color: #374151; font-size: 15px; line-height: 1.6; margin: 0 0 15px 0;">
                                Bonjour <strong>${candidateName}</strong>,
                            </p>
                            <p style="color: #374151; font-size: 15px; line-height: 1.6; margin: 0 0 15px 0;">
                                Le cabinet <strong>${firmName}</strong> souhaite conserver votre CV dans son vivier de talents afin de vous proposer des opportunités professionnelles correspondant à votre profil.
                            </p>
                            <p style="color: #374151; font-size: 15px; line-height: 1.6; margin: 0 0 20px 0;">
                                Pour cela, nous vous demandons votre consentement à la conservation de votre CV et à certains traitements automatisés (notamment via des outils d'analyse).
                            </p>
                            
                            <!-- Section: Pourquoi nous conservons -->
                            <div style="background-color: #f0f9ff; border-left: 4px solid #2563eb; padding: 15px 20px; margin: 20px 0;">
                                <p style="color: #1e40af; font-size: 14px; margin: 0 0 10px 0; font-weight: bold;">📋 Pourquoi nous conservons et traitons votre CV</p>
                                <p style="color: #374151; font-size: 14px; line-height: 1.5; margin: 0 0 10px 0;">Nous utilisons vos informations pour :</p>
                                <ul style="color: #4b5563; font-size: 14px; margin: 0; padding-left: 20px; line-height: 1.6;">
                                    <li style="margin-bottom: 5px;">Conserver votre CV dans notre vivier et vous recontacter</li>
                                    <li style="margin-bottom: 5px;">Analyser votre CV (extraction d'informations : compétences, expériences, mots-clés)</li>
                                    <li style="margin-bottom: 5px;">Améliorer / reformuler votre CV et, si besoin, l'adapter à une opportunité</li>
                                    <li>Évaluer l'adéquation entre votre profil et une opportunité (production d'un score)</li>
                                </ul>
                                <p style="color: #6b7280; font-size: 13px; font-style: italic; margin: 12px 0 0 0;">
                                    <strong>Important :</strong> ces traitements automatisés servent à identifier des opportunités adaptées. Ils ne produisent pas, à eux seuls, une décision automatique vous concernant. Une revue humaine peut intervenir.
                                </p>
                            </div>

                            <!-- Section: Données concernées -->
                            <div style="background-color: #f9fafb; border-radius: 6px; padding: 15px 20px; margin: 20px 0;">
                                <p style="color: #374151; font-size: 14px; margin: 0 0 10px 0; font-weight: bold;">📁 Quelles données sont concernées</p>
                                <ul style="color: #4b5563; font-size: 14px; margin: 0; padding-left: 20px; line-height: 1.6;">
                                    <li style="margin-bottom: 5px;">Votre CV et les informations qu'il contient (parcours, compétences, formations, etc.)</li>
                                    <li style="margin-bottom: 5px;">Vos coordonnées (email, téléphone) pour vous contacter</li>
                                    <li style="margin-bottom: 5px;">L'historique des opportunités proposées et des échanges associés</li>
                                    <li>Le cas échéant, des versions améliorées du CV générées dans le cadre du service</li>
                                </ul>
                            </div>

                            <!-- Section: Partage des données -->
                            <div style="background-color: #f9fafb; border-radius: 6px; padding: 15px 20px; margin: 20px 0;">
                                <p style="color: #374151; font-size: 14px; margin: 0 0 10px 0; font-weight: bold;">🔒 Avec qui ces données peuvent être partagées</p>
                                <p style="color: #4b5563; font-size: 14px; line-height: 1.5; margin: 0;">
                                    Vos données sont accessibles aux personnes habilitées chez ${firmName} et peuvent être traitées par nos prestataires techniques (hébergement, emailing, outils d'analyse/IA), uniquement pour fournir le service.
                                </p>
                                <p style="color: #6b7280; font-size: 13px; margin: 10px 0 0 0;">
                                    Pour plus de détails, consultez notre <a href="${privacyPolicyUrl}" style="color: #2563eb; text-decoration: underline;">politique de confidentialité</a>.
                                </p>
                            </div>

                            <!-- Section: Durée de conservation -->
                            <div style="background-color: #fef3c7; border-radius: 6px; padding: 15px 20px; margin: 20px 0;">
                                <p style="color: #92400e; font-size: 14px; margin: 0; font-weight: bold;">⏱️ Durée de conservation</p>
                                <p style="color: #78350f; font-size: 14px; line-height: 1.5; margin: 8px 0 0 0;">
                                    <strong>Durée maximale : 2 ans</strong> à compter de la date du recueil du consentement, sauf obligation légale contraire. À l'issue, vos données sont supprimées ou anonymisées.
                                </p>
                            </div>

                            <!-- Section: Vos droits -->
                            <div style="background-color: #f0fdf4; border-left: 4px solid #22c55e; padding: 15px 20px; margin: 20px 0;">
                                <p style="color: #166534; font-size: 14px; margin: 0 0 10px 0; font-weight: bold;">✅ Vos droits et retrait du consentement</p>
                                <p style="color: #374151; font-size: 14px; line-height: 1.5; margin: 0;">
                                    Vous pouvez <strong>retirer votre consentement à tout moment</strong>, et exercer vos droits (accès, rectification, suppression, limitation, opposition, portabilité) en nous contactant : <a href="mailto:${dpoEmail}" style="color: #2563eb; text-decoration: underline;">${dpoEmail}</a>
                                </p>
                                <p style="color: #6b7280; font-size: 13px; margin: 10px 0 0 0;">
                                    Vous pouvez également introduire une réclamation auprès de la <a href="https://www.cnil.fr" style="color: #2563eb; text-decoration: underline;">CNIL</a>.
                                </p>
                            </div>

                            <!-- CTA Button -->
                            <table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="margin: 30px 0;">
                                <tr>
                                    <td style="text-align: center;">
                                        <p style="color: #22c55e; font-size: 16px; font-weight: bold; margin: 0 0 15px 0;">✅ Pour répondre à cette demande, cliquez ci-dessous :</p>
                                        <a href="${consentUrl}" style="display: inline-block; background-color: #2563eb; color: #ffffff; text-decoration: none; font-size: 16px; font-weight: bold; padding: 16px 40px; border-radius: 8px; box-shadow: 0 2px 4px rgba(37, 99, 235, 0.3);">
                                            Répondre à la demande
                                        </a>
                                    </td>
                                </tr>
                            </table>

                            <p style="color: #f59e0b; font-size: 13px; text-align: center; margin: 0; font-weight: 500;">
                                ⏰ Ce lien expire dans ${expiryDays} jours.
                            </p>
                        </td>
                    </tr>
                </table>

                <!-- Footer / Signature -->
                <table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="padding-top: 30px; border-top: 1px solid #e5e7eb; margin-top: 30px;">
                    <tr>
                        <td>
                            <p style="color: #374151; font-size: 14px; margin: 0 0 5px 0;">Cordialement,</p>
                            <p style="color: #374151; font-size: 14px; margin: 0 0 15px 0; font-weight: bold;">Cabinet ${firmName}</p>
                            <p style="color: #6b7280; font-size: 13px; margin: 0; line-height: 1.6;">
                                ${firmAddress ? `${firmAddress}<br>` : ''}
                                ${firmPhone ? `${firmPhone}<br>` : ''}
                                ${firmWebsite ? `<a href="${firmWebsite}" style="color: #2563eb; text-decoration: none;">${firmWebsite}</a>` : ''}
                            </p>
                        </td>
                    </tr>
                </table>
            </td>
        </tr>
    </table>
</body>
</html>
    `.trim();
}

/**
 * Build HTML email for consent reminder
 * @param {Object} params
 * @returns {string} HTML content
 */
export function buildConsentReminderEmailHtml({ candidateName, firmName, consentUrl, daysRemaining }) {
    return `
<!DOCTYPE html>
<html lang="fr">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
</head>
<body style="margin: 0; padding: 0; font-family: Arial, sans-serif; background-color: #f4f4f5;">
    <table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="max-width: 600px; margin: 0 auto; padding: 20px;">
        <tr>
            <td style="background-color: #ffffff; border-radius: 8px; padding: 40px; box-shadow: 0 2px 4px rgba(0,0,0,0.1);">
                <!-- Header -->
                <table role="presentation" width="100%" cellspacing="0" cellpadding="0">
                    <tr>
                        <td style="text-align: center; padding-bottom: 30px; border-bottom: 1px solid #e5e7eb;">
                            <h1 style="color: #1f2937; font-size: 24px; margin: 0;">Rappel : Demande de consentement</h1>
                            <p style="color: #f59e0b; font-size: 14px; margin: 10px 0 0 0; font-weight: bold;">
                                ⏰ Plus que ${daysRemaining} jours pour répondre
                            </p>
                        </td>
                    </tr>
                </table>

                <!-- Content -->
                <table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="padding-top: 30px;">
                    <tr>
                        <td>
                            <p style="color: #374151; font-size: 16px; line-height: 1.6; margin: 0 0 20px 0;">
                                Bonjour <strong>${candidateName}</strong>,
                            </p>
                            <p style="color: #374151; font-size: 16px; line-height: 1.6; margin: 0 0 20px 0;">
                                Nous vous avons récemment envoyé une demande de consentement pour la conservation de votre CV par <strong>${firmName}</strong>.
                            </p>
                            <p style="color: #374151; font-size: 16px; line-height: 1.6; margin: 0 0 30px 0;">
                                Sans réponse de votre part dans les ${daysRemaining} prochains jours, votre CV sera automatiquement supprimé de notre base de données.
                            </p>

                            <!-- CTA Button -->
                            <table role="presentation" width="100%" cellspacing="0" cellpadding="0">
                                <tr>
                                    <td style="text-align: center;">
                                        <a href="${consentUrl}" style="display: inline-block; background-color: #2563eb; color: #ffffff; text-decoration: none; font-size: 16px; font-weight: bold; padding: 14px 32px; border-radius: 6px;">
                                            Répondre maintenant
                                        </a>
                                    </td>
                                </tr>
                            </table>
                        </td>
                    </tr>
                </table>

                <!-- Footer -->
                <table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="padding-top: 30px; border-top: 1px solid #e5e7eb; margin-top: 30px;">
                    <tr>
                        <td style="text-align: center;">
                            <p style="color: #9ca3af; font-size: 12px; margin: 0;">
                                Ce message est conforme au RGPD.
                            </p>
                        </td>
                    </tr>
                </table>
            </td>
        </tr>
    </table>
</body>
</html>
    `.trim();
}
