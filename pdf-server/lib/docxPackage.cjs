async function loadDocxZip(getJSZip, docxBuffer) {
  const JSZipClass = await getJSZip();
  return JSZipClass.loadAsync(docxBuffer);
}

function buildImageRelationshipsXml(images) {
  let relsXml = '<?xml version="1.0" encoding="UTF-8" standalone="yes"?>\n<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">';
  for (const img of images) {
    relsXml += `\n  <Relationship Id="${img.rId}" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/image" Target="media/${img.filename}"/>`;
  }
  relsXml += '\n</Relationships>';
  return relsXml;
}

function registerEmbeddedImages(zip, images, relsPath) {
  if (!images.length) {
    return;
  }

  for (const img of images) {
    zip.file(`word/media/${img.filename}`, img.data);
  }

  zip.file(relsPath, buildImageRelationshipsXml(images));
}

async function updateContentTypes(zip, { partName, contentType, images }) {
  let contentTypesXml = await zip.file('[Content_Types].xml').async('string');

  if (!contentTypesXml.includes(partName)) {
    contentTypesXml = contentTypesXml.replace(
      '</Types>',
      `<Override PartName="${partName}" ContentType="${contentType}"/></Types>`
    );
  }

  if (images.length) {
    const extensions = [...new Set(images.map((img) => img.ext))];
    for (const ext of extensions) {
      if (!contentTypesXml.includes(`Extension="${ext}"`)) {
        const mime = ext === 'jpg' || ext === 'jpeg' ? 'image/jpeg' : `image/${ext}`;
        contentTypesXml = contentTypesXml.replace(
          '</Types>',
          `<Default Extension="${ext}" ContentType="${mime}"/></Types>`
        );
      }
    }
  }

  zip.file('[Content_Types].xml', contentTypesXml);
}

function getNextRelationshipId(relsXml) {
  const rIdMatches = relsXml.match(/rId(\d+)/g) || [];
  const maxRId = rIdMatches.reduce((max, id) => {
    const num = parseInt(id.replace('rId', ''));
    return num > max ? num : max;
  }, 0);

  return `rId${maxRId + 1}`;
}

function buildSectPrWithReference(referenceXml) {
  return `<w:sectPr>${referenceXml}<w:pgSz w:w="11906" w:h="16838"/><w:pgMar w:top="1440" w:right="1440" w:bottom="1440" w:left="1440" w:header="720" w:footer="720"/></w:sectPr>`;
}

function injectSectionReference(documentXml, referenceXml, marginAttr) {
  const defaultSectPr = buildSectPrWithReference(referenceXml);

  if (/<w:sectPr\s*\/>/.test(documentXml)) {
    return documentXml.replace(/<w:sectPr\s*\/>/, defaultSectPr);
  }

  if (/<w:sectPr[^/]*>/.test(documentXml)) {
    let updated = documentXml.replace(
      /<w:sectPr([^/][^>]*)>/,
      `<w:sectPr$1>${referenceXml}`
    );

    if (!new RegExp(`<w:pgMar[^>]*${marginAttr}`).test(updated)) {
      updated = updated.replace(
        /<w:pgMar([^/]*)\/?>/,
        `<w:pgMar$1 ${marginAttr}="720"/>`
      );
    }

    return updated;
  }

  return documentXml.replace('</w:body>', `${defaultSectPr}</w:body>`);
}

async function attachDocumentPart(zip, {
  partFileName,
  relationshipType,
  referenceXml,
  marginAttr
}) {
  let relsXml = await zip.file('word/_rels/document.xml.rels').async('string');
  if (relsXml.includes(partFileName)) {
    return false;
  }

  const relationshipId = getNextRelationshipId(relsXml);
  relsXml = relsXml.replace(
    '</Relationships>',
    `<Relationship Id="${relationshipId}" Type="${relationshipType}" Target="${partFileName}"/></Relationships>`
  );
  zip.file('word/_rels/document.xml.rels', relsXml);

  let documentXml = await zip.file('word/document.xml').async('string');
  documentXml = injectSectionReference(
    documentXml,
    referenceXml.replace('__RID__', relationshipId),
    marginAttr
  );
  zip.file('word/document.xml', documentXml);
  return true;
}

module.exports = {
  attachDocumentPart,
  buildSectPrWithReference,
  loadDocxZip,
  registerEmbeddedImages,
  updateContentTypes
};
