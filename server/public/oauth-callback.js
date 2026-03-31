/**
 * Generic OAuth Callback Script
 * Externalized from inline <script> for CSP compliance
 * Used by: calendar OAuth, GDPR mail OAuth, mail OAuth
 * 
 * Reads callback type and optional error from data attributes on <body>,
 * sends a postMessage to the opener window, then closes the popup.
 */
(function () {
    var type = document.body.getAttribute('data-callback-type') || 'oauth-callback';
    var error = document.body.getAttribute('data-callback-error') || null;
    var targetOrigin = document.body.getAttribute('data-target-origin') || '';

    var message = { type: type };
    if (error) {
        message.error = error;
    }

    if (window.opener && targetOrigin) {
        window.opener.postMessage(message, targetOrigin);
    }
    window.close();
})();
