const fs = require('fs');
const path = require('path');

function apply(spec) {
  const fullPath = path.join(process.cwd(), spec.file);
  let content = fs.readFileSync(fullPath, 'utf8');
  if (spec.addImport && !content.includes(spec.addImport.trim())) {
    if (!content.includes(spec.importAfter)) throw new Error(`Import anchor not found in ${spec.file}`);
    content = content.replace(spec.importAfter, spec.importAfter + spec.addImport);
  }
  for (const replacement of spec.replace) {
    if (!content.includes(replacement.from)) throw new Error(`Expected block not found in ${spec.file}`);
    content = content.replace(replacement.from, replacement.to);
  }
  fs.writeFileSync(fullPath, content);
}

const specs = JSON.parse(fs.readFileSync(path.join(process.cwd(), 'tmp-schema-refactor.json'), 'utf8'));
for (const spec of specs) apply(spec);
