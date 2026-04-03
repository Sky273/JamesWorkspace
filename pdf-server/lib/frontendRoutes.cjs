const express = require('express');

function registerFrontendRoutes({ app, fs, distDir, distIndexPath }) {
  if (fs.existsSync(distDir) && fs.existsSync(distIndexPath)) {
    app.use(express.static(distDir));
    app.get('/*splat', (_req, res) => {
      res.sendFile(distIndexPath);
    });
    return { enabled: true };
  }

  app.get('/*splat', (_req, res) => {
    res.status(404).json({ error: 'Not found' });
  });
  return { enabled: false };
}

module.exports = { registerFrontendRoutes };
