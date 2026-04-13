import { sendEmail } from './mail/gdprMailService.js';

function getSignInUrl() {
    const baseUrl = String(process.env.FRONTEND_URL || 'https://resumeconverter.net').replace(/\/+$/, '');
    return `${baseUrl}/signin`;
}

function buildRegistrationConfirmationHtml(name) {
    const signInUrl = getSignInUrl();

    return `
<!DOCTYPE html>
<html lang="fr">
<head><meta charset="UTF-8"></head>
<body style="margin:0;padding:0;background-color:#f3f4f6;font-family:Arial,sans-serif;">
  <div style="max-width:600px;margin:40px auto;background:#ffffff;border-radius:12px;overflow:hidden;box-shadow:0 4px 6px rgba(0,0,0,0.1);">
    <div style="background:linear-gradient(135deg,#4f46e5,#6366f1);padding:32px 24px;text-align:center;">
      <h1 style="color:#ffffff;margin:0;font-size:24px;">ResumeConverter</h1>
    </div>
    <div style="padding:32px 24px;">
      <p style="color:#374151;font-size:16px;margin-top:0;">Bonjour <strong>${name}</strong>,</p>
      <p style="color:#374151;font-size:16px;">Votre compte de test est maintenant actif et vous pouvez commencer à utiliser l'application.</p>
      <div style="margin:28px 0;text-align:center;">
        <a href="${signInUrl}" style="display:inline-block;background:#4f46e5;color:#ffffff;text-decoration:none;font-weight:700;padding:14px 24px;border-radius:12px;">Se connecter</a>
      </div>
      <p style="color:#6b7280;font-size:14px;">Ou copiez ce lien dans votre navigateur : <a href="${signInUrl}" style="color:#4f46e5;">${signInUrl}</a></p>
      <p style="color:#374151;font-size:16px;">N'hésitez pas à contacter Aptea si vous souhaitez plus d'informations ou un accompagnement sur vos usages.</p>
      <p style="color:#6b7280;font-size:14px;margin-top:24px;">L'équipe Aptea</p>
    </div>
    <div style="background:#f9fafb;padding:16px 24px;text-align:center;">
      <p style="color:#9ca3af;font-size:12px;margin:0;">ResumeConverter - Gestion intelligente de CVthèque</p>
    </div>
  </div>
</body>
</html>`;
}

function buildRegistrationConfirmationText(name) {
    const signInUrl = getSignInUrl();

    return `Bonjour ${name},

Votre compte de test est maintenant actif et vous pouvez commencer à utiliser l'application.

Connectez-vous ici : ${signInUrl}

N'hésitez pas à contacter Aptea si vous souhaitez plus d'informations ou un accompagnement sur vos usages.

L'équipe Aptea`;
}

export async function sendRegistrationConfirmationEmail({ to, name }) {
    const safeName = String(name || to || 'Utilisateur');
    return sendEmail({
        to,
        subject: 'Votre compte test ResumeConverter est actif',
        html: buildRegistrationConfirmationHtml(safeName),
        text: buildRegistrationConfirmationText(safeName)
    });
}
