/// <reference types="vite/client" />

interface ImportMetaEnv {
  readonly VITE_GOOGLE_CLIENT_ID: string
  readonly VITE_DEV_BYPASS_AUTH: string
}

interface ImportMeta {
  readonly env: ImportMetaEnv
}

interface GoogleIdConfiguration {
  client_id: string
  callback: (response: { credential: string }) => void
  auto_select?: boolean
  ux_mode?: 'popup' | 'redirect'
}

interface GoogleButtonOptions {
  theme?: 'outline' | 'filled_blue' | 'filled_black'
  size?: 'large' | 'medium' | 'small'
  text?: 'signin_with' | 'signup_with' | 'continue_with' | 'signin'
  shape?: 'rectangular' | 'pill' | 'circle' | 'square'
  width?: number
  locale?: string
}

interface GoogleAccountsId {
  initialize: (config: GoogleIdConfiguration) => void
  renderButton: (parent: HTMLElement, options: GoogleButtonOptions) => void
  prompt: () => void
}

interface GoogleTokenResponse {
  access_token?: string
  expires_in?: number
  token_type?: string
  scope?: string
  error?: string
  error_description?: string
}

interface GoogleTokenClient {
  requestAccessToken: (override?: { prompt?: '' | 'consent' }) => void
}

interface GoogleOauth2 {
  initTokenClient: (config: {
    client_id: string
    scope: string
    callback: (response: GoogleTokenResponse) => void
    error_callback?: (error: { type?: string; message?: string }) => void
  }) => GoogleTokenClient
  revoke: (token: string, done?: () => void) => void
}

interface Window {
  google?: {
    accounts: {
      id: GoogleAccountsId
      oauth2: GoogleOauth2
    }
  }
}
