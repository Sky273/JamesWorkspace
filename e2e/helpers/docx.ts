import fs from 'fs/promises';
import path from 'path';
import JSZip from 'jszip';

const LONG_RESUME_FIXTURE_NAME = 'long-resume-e2e.docx';

function createDocumentXml(paragraphs: string[]): string {
  const xmlParagraphs = paragraphs.map((paragraph) => (
    `<w:p><w:r><w:t xml:space="preserve">${paragraph}</w:t></w:r></w:p>`
  )).join('');

  return `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<w:document xmlns:wpc="http://schemas.microsoft.com/office/word/2010/wordprocessingCanvas"
 xmlns:mc="http://schemas.openxmlformats.org/markup-compatibility/2006"
 xmlns:o="urn:schemas-microsoft-com:office:office"
 xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships"
 xmlns:m="http://schemas.openxmlformats.org/officeDocument/2006/math"
 xmlns:v="urn:schemas-microsoft-com:vml"
 xmlns:wp14="http://schemas.microsoft.com/office/word/2010/wordprocessingDrawing"
 xmlns:wp="http://schemas.openxmlformats.org/drawingml/2006/wordprocessingDrawing"
 xmlns:w10="urn:schemas-microsoft-com:office:word"
 xmlns:w="http://schemas.openxmlformats.org/wordprocessingml/2006/main"
 xmlns:w14="http://schemas.microsoft.com/office/word/2010/wordml"
 xmlns:w15="http://schemas.microsoft.com/office/word/2012/wordml"
 xmlns:wpg="http://schemas.microsoft.com/office/word/2010/wordprocessingGroup"
 xmlns:wpi="http://schemas.microsoft.com/office/word/2010/wordprocessingInk"
 xmlns:wne="http://schemas.microsoft.com/office/2006/wordml"
 xmlns:wps="http://schemas.microsoft.com/office/word/2010/wordprocessingShape"
 mc:Ignorable="w14 w15 wp14">
  <w:body>
    ${xmlParagraphs}
    <w:sectPr>
      <w:pgSz w:w="11906" w:h="16838"/>
      <w:pgMar w:top="1440" w:right="1440" w:bottom="1440" w:left="1440" w:header="708" w:footer="708" w:gutter="0"/>
      <w:cols w:space="708"/>
      <w:docGrid w:linePitch="360"/>
    </w:sectPr>
  </w:body>
</w:document>`;
}

export async function ensureLongResumeFixture(): Promise<string> {
  const fixtureDir = path.resolve('e2e', 'fixtures');
  const fixturePath = path.join(fixtureDir, LONG_RESUME_FIXTURE_NAME);

  try {
    await fs.access(fixturePath);
    return fixturePath;
  } catch {
    await fs.mkdir(fixtureDir, { recursive: true });
  }

  const paragraphs = [
    'Jean E2E Durand',
    'Consultant data senior specialise dans la transformation analytique, la structuration de portefeuilles projets et la coordination de parties prenantes metier et techniques.',
    'Experience recente: pilotage d un programme data RH, mise en place d indicateurs de performance, animation d ateliers de cadrage, production de supports executifs et accompagnement du changement.',
    'Competences: SQL, Python, Power BI, gouvernance de donnees, cartographie de processus, definition de KPI, priorisation de backlog, communication ecrite et orale en contexte client.',
    'Formation: master en systemes d information, certifications agiles, pratique quotidienne du francais et de l anglais dans des environnements multi-equipes.',
    'Resultats: reduction des delais de reporting, amelioration de la qualite de donnees, acceleration de la prise de decision et meilleure lisibilite des trajectoires de delivery.'
  ];

  const zip = new JSZip();
  zip.file(
    '[Content_Types].xml',
    `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types">
  <Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/>
  <Default Extension="xml" ContentType="application/xml"/>
  <Override PartName="/word/document.xml" ContentType="application/vnd.openxmlformats-officedocument.wordprocessingml.document.main+xml"/>
</Types>`
  );
  zip.folder('_rels')?.file(
    '.rels',
    `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">
  <Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/officeDocument" Target="word/document.xml"/>
</Relationships>`
  );
  zip.folder('word')?.file('document.xml', createDocumentXml(paragraphs));

  const buffer = await zip.generateAsync({ type: 'nodebuffer' });
  await fs.writeFile(fixturePath, buffer);
  return fixturePath;
}
