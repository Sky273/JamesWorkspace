/**
 * Swagger UI Initialization Script
 * Externalized from inline <script> to comply with strict CSP (no unsafe-inline)
 */
window.onload = function () {
    try {
        window.ui = SwaggerUIBundle({
            url: window.location.origin + '/api/docs',
            dom_id: '#swagger-ui',
            deepLinking: true,
            presets: [
                SwaggerUIBundle.presets.apis,
                SwaggerUIStandalonePreset
            ],
            plugins: [
                SwaggerUIBundle.plugins.DownloadUrl
            ],
            layout: 'StandaloneLayout',
            docExpansion: 'list',
            filter: true,
            showExtensions: true,
            showCommonExtensions: true,
            syntaxHighlight: {
                activate: true,
                theme: 'monokai'
            },
            requestInterceptor: function (req) {
                req.credentials = 'include';
                return req;
            },
            onComplete: function () {
                console.log('Swagger UI loaded successfully');
            },
            onFailure: function (err) {
                console.error('Swagger UI failed to load:', err);
                document.getElementById('swagger-ui').innerHTML =
                    '<div class="loading-container" style="color: #f93e3e;">' +
                    '<span>Failed to load API documentation. Please refresh the page.</span></div>';
            }
        });
    } catch (err) {
        console.error('Error initializing Swagger UI:', err);
        document.getElementById('swagger-ui').innerHTML =
            '<div class="loading-container" style="color: #f93e3e;">' +
            '<span>Error loading API documentation: ' + err.message + '</span></div>';
    }
};
