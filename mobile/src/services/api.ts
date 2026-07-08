export const API_BASE_URL = __DEV__
  ? 'http://localhost:3000'
  : 'https://your-production-url.com';

/**
 * WebSocket base URL derived from API_BASE_URL (http→ws, https→wss).
 * Used by the real-time voice-live client (Gemini Live proxy).
 */
export const WS_BASE_URL = API_BASE_URL.replace(/^http/, 'ws');

interface RequestOptions {
  method?: 'GET' | 'POST' | 'PUT' | 'DELETE';
  body?: Record<string, unknown>;
  headers?: Record<string, string>;
}

let authToken: string | null = null;

export const setAuthToken = (token: string | null) => {
  authToken = token;
};

/**
 * Optional token refresher, registered by the auth service. When a request
 * comes back 401 (expired/missing token), api() calls this to force-refresh
 * the Firebase ID token and retries the request once. Registered via a
 * callback to avoid a circular import between api.ts and auth.ts.
 */
type TokenRefresher = (forceRefresh: boolean) => Promise<string | null>;
let tokenRefresher: TokenRefresher | null = null;

export const registerTokenRefresher = (fn: TokenRefresher | null) => {
  tokenRefresher = fn;
};

export const api = async <T>(
  endpoint: string,
  options: RequestOptions = {}
): Promise<T> => {
  const { method = 'GET', body, headers = {} } = options;

  // Rebuilt per attempt so a refreshed authToken is picked up on retry.
  const buildConfig = (): RequestInit => ({
    method,
    headers: {
      'Content-Type': 'application/json',
      ...(authToken ? { Authorization: `Bearer ${authToken}` } : {}),
      ...headers,
    },
    ...(body ? { body: JSON.stringify(body) } : {}),
  });

  let response = await fetch(`${API_BASE_URL}${endpoint}`, buildConfig());

  // Token expired or missing — force-refresh once and retry before giving up.
  if (response.status === 401 && tokenRefresher) {
    const fresh = await tokenRefresher(true).catch(() => null);
    if (fresh) {
      authToken = fresh;
      response = await fetch(`${API_BASE_URL}${endpoint}`, buildConfig());
    }
  }

  if (!response.ok) {
    const error = await response.json().catch(() => ({ message: 'Request failed' }));
    throw new Error(error.message || `HTTP ${response.status}`);
  }

  return response.json();
};

/**
 * Upload an audio file (multipart/form-data) and return the JSON response.
 * Used for speech-to-text: POST /api/stt/transcribe with an "audio" field.
 *
 * Note: we deliberately do NOT set Content-Type — fetch adds the correct
 * multipart boundary automatically once the body is a FormData instance.
 */
export const apiUploadAudio = async <T>(
  endpoint: string,
  file: Blob | { uri: string; name: string; type: string }
): Promise<T> => {
  const form = new FormData();
  if (typeof Blob !== 'undefined' && file instanceof Blob) {
    // Web: append a real Blob/File so the browser builds a proper file part.
    const ext = ((file.type.split('/')[1] || 'webm').split(';')[0]) || 'webm';
    form.append('audio', file, `speech.${ext}`);
  } else {
    // Native: React Native's FormData accepts a { uri, name, type } object.
    form.append('audio', file as unknown as Blob);
  }

  const response = await fetch(`${API_BASE_URL}${endpoint}`, {
    method: 'POST',
    headers: {
      ...(authToken ? { Authorization: `Bearer ${authToken}` } : {}),
    },
    body: form,
  });

  if (!response.ok) {
    const error = await response.json().catch(() => ({ message: 'Upload failed' }));
    throw new Error(error.message || `HTTP ${response.status}`);
  }

  return response.json();
};

/**
 * Text-to-speech: POST /api/tts/stream and return the spoken audio as a
 * base64 data URI that expo-audio can play, or null if the service fell back
 * to text-only (in which case the caller just shows the text).
 */
export const apiFetchSpeech = async (
  text: string,
  voiceStyle?: string
): Promise<string | null> => {
  const response = await fetch(`${API_BASE_URL}/api/tts/stream`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      ...(authToken ? { Authorization: `Bearer ${authToken}` } : {}),
    },
    body: JSON.stringify(voiceStyle ? { text, voice_style: voiceStyle } : { text }),
  });

  if (!response.ok) return null;

  // On failure the backend returns JSON ({ fallback: true, ... }) instead of audio.
  const contentType = response.headers.get('content-type') || '';
  if (!contentType.includes('audio')) return null;

  const blob = await response.blob();
  return await new Promise<string | null>((resolve) => {
    const reader = new FileReader();
    reader.onloadend = () => resolve(typeof reader.result === 'string' ? reader.result : null);
    reader.onerror = () => resolve(null);
    reader.readAsDataURL(blob);
  });
};

// Convenience methods
export const apiGet = <T>(endpoint: string) => api<T>(endpoint);

export const apiPost = <T>(endpoint: string, body: Record<string, unknown>) =>
  api<T>(endpoint, { method: 'POST', body });

export const apiPut = <T>(endpoint: string, body: Record<string, unknown>) =>
  api<T>(endpoint, { method: 'PUT', body });
