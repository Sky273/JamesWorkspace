-- Fix UTF-8 charset in default email template
-- Run this script to update the existing template with proper charset

UPDATE email_templates 
SET mjml_content = '<mjml>
  <mj-head>
    <mj-title>Email Template</mj-title>
    <mj-attributes>
      <mj-all font-family="Arial, sans-serif" />
      <mj-text font-size="14px" line-height="1.6" color="#333333" />
    </mj-attributes>
    <mj-raw>
      <meta charset="UTF-8" />
    </mj-raw>
  </mj-head>
  <mj-body background-color="#f4f4f4">
    <mj-section background-color="#ffffff" padding="20px">
      <mj-column>
        <mj-text align="center" font-size="24px" font-weight="bold" color="#1f2937">
          {{firm.name}}
        </mj-text>
      </mj-column>
    </mj-section>
    <mj-section background-color="#ffffff" padding="30px 20px">
      <mj-column>
        <mj-text>Bonjour {{contact.firstName}},</mj-text>
        <mj-text padding-top="20px">Je me permets de vous adresser le profil de <strong>{{resume.name}}</strong>, <strong>{{resume.title}}</strong>, qui pourrait correspondre aux besoins de <strong>{{client.name}}</strong>.</mj-text>
        <mj-text padding-top="20px">Vous trouverez son CV en pièce jointe (version {{resume.version}}).</mj-text>
        <mj-text padding-top="20px">Je reste à votre entière disposition pour organiser un échange ou vous fournir des informations complémentaires.</mj-text>
        <mj-text padding-top="30px">Cordialement,</mj-text>
        <mj-text padding-top="10px" font-weight="bold">{{user.name}}</mj-text>
        <mj-text color="#6b7280">{{firm.name}}</mj-text>
      </mj-column>
    </mj-section>
    <mj-section background-color="#f9fafb" padding="20px">
      <mj-column>
        <mj-text align="center" font-size="12px" color="#9ca3af">{{date.todayLong}}</mj-text>
      </mj-column>
    </mj-section>
  </mj-body>
</mjml>',
html_content = NULL
WHERE id = '00000000-0000-0000-0000-000000000001';
