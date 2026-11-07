// Tipos de local-config.mjs (para usarlo desde playwright.config.ts y las pruebas).
export declare const GATEWAY_PORT: number
export declare const GATEWAY_URL: string
export declare const JWT_SECRET: string
export declare const ANON_KEY: string
export declare function signJwt(claims: Record<string, unknown>): string
export declare function verifyJwt(token: string): Record<string, unknown> | null
