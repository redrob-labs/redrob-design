/**
 * UI-slice stub for `@/app/settings/credentials/types`.
 *
 * The real module defines the credential-store status model. ModelsPanel only
 * reads the `CredentialStatus` union to label a connection, so the type is
 * reproduced here verbatim.
 */
export type CredentialStatus = 'configured' | 'missing' | 'unavailable' | 'locked'
