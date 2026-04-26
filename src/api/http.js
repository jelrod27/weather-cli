import axios from 'axios';
import axiosRetry from 'axios-retry';
import { readFileSync } from 'fs';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
const packageJson = JSON.parse(readFileSync(join(__dirname, '..', '..', 'package.json'), 'utf8'));

const httpClient = axios.create({
  timeout: 5000,
  headers: {
    'User-Agent': `weather-cli/${packageJson.version}`
  }
});

// Add request interceptor to set unique request ID per request
httpClient.interceptors.request.use((config) => {
  config.headers['X-Request-ID'] = `req_${Date.now()}_${Math.random().toString(36).slice(2, 11)}`;
  return config;
});

// Configure retry logic
axiosRetry(httpClient, {
  retries: 3,
  retryDelay: axiosRetry.exponentialDelay,
  retryCondition: (error) => {
    // Retry on network errors
    if (axiosRetry.isNetworkError(error)) {
      return true;
    }

    // Retry on 5xx errors and 429 (rate limit)
    if (error.response) {
      const status = error.response.status;
      return status >= 500 || status === 429;
    }

    return false;
  },
  onRetry: (retryCount, error) => {
    console.log(`Retry attempt ${retryCount} after error: ${error.message}`);
  }
});

// Add response interceptor for rate limit handling
httpClient.interceptors.response.use(null, (error) => {
  if (error.response?.status === 429) {
    const retryAfter = error.response.headers['retry-after'];
    error.message = `Rate limit exceeded. ${retryAfter ? `Try again in ${retryAfter} seconds.` : 'Please wait before retrying.'}`;
  }
  return Promise.reject(error);
});

export default httpClient;
