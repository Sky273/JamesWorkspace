import axios from 'axios';
import http from 'http';
import https from 'https';

// Configure HTTP agents with connection pooling to prevent socket leaks
export const httpAgent = new http.Agent({
    keepAlive: true,
    keepAliveMsecs: 30000,
    maxSockets: 50,
    maxFreeSockets: 10,
    timeout: 600000 // 10 minutes
});

export const httpsAgent = new https.Agent({
    keepAlive: true,
    keepAliveMsecs: 30000,
    maxSockets: 50,
    maxFreeSockets: 10,
    timeout: 600000 // 10 minutes
});

// Configure axios defaults to prevent memory leaks
axios.defaults.timeout = 600000; // 10 minutes timeout
axios.defaults.httpAgent = httpAgent;
axios.defaults.httpsAgent = httpsAgent;
axios.defaults.maxContentLength = 100 * 1024 * 1024; // 100MB max response size
axios.defaults.maxBodyLength = 100 * 1024 * 1024; // 100MB max request size

// Add response interceptor to help with memory cleanup
axios.interceptors.response.use(
    response => {
        // Successful response - no action needed
        return response;
    },
    error => {
        // Clean up large objects from error to prevent memory retention
        if (error.response) {
            // Clear large response data
            error.response.data = null;
            error.response.request = null;
        }
        if (error.config) {
            // Clear request data and transform functions
            error.config.data = null;
            error.config.transformRequest = null;
            error.config.transformResponse = null;
        }
        if (error.request) {
            // Keep only minimal request info for debugging
            const minimalRequest = {
                method: error.request.method,
                path: error.request.path,
                status: error.request.status
            };
            error.request = minimalRequest;
        }
        return Promise.reject(error);
    }
);

// Function to configure axios (already configured above, but exported for consistency)
export const configureAxios = () => {
    // Configuration is done at module load time above
    // This function exists for compatibility with imports
};

export default axios;
