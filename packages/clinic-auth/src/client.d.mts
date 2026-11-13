/** Type-only contract for use from a React + TypeScript application. */
export declare class ClinicAuthError extends Error {
  readonly code: string;
  readonly status: number;
  constructor(message: string, code?: string, status?: number);
}
export type ClinicUser = {
  id: string;
  email?: string;
  email_confirmed_at?: string | null;
  is_anonymous?: boolean;
  user_metadata?: Record<string, unknown>;
};
export type ClinicOwner = {
  id: string;
  user_id: string;
  first_name: string;
  last_name: string;
  phone: string | null;
  address: string | null;
};
export type ClinicSession = { access_token: string; refresh_token: string };
export type AuthConfig = {
  url: string;
  publishableKey: string;
  fetchImpl?: typeof fetch;
};
export type RegistrationInput = {
  email: string;
  password: string;
  firstName: string;
  lastName: string;
};
export type Credentials = { email: string; password: string };
export type OwnerDetails = {
  firstName?: string;
  lastName?: string;
  phone?: string;
  address?: string;
};
export declare function createClinicAuth(options: AuthConfig): Readonly<{
  signUp(input: RegistrationInput): Promise<{
    status: "signed_in" | "verification_required";
    userId: string | null;
  }>;
  resendVerification(email: string): Promise<{ status: "submitted" }>;
  verifyEmailCode(input: { email: string; token: string }): Promise<ClinicUser>;
  signIn(input: Credentials): Promise<{ user: ClinicUser; session: ClinicSession }>;
  refreshSession(): Promise<ClinicUser>;
  signOut(): Promise<void>;
  getCurrentUser(): Promise<ClinicUser | null>;
  getOwnProfile(): Promise<ClinicOwner | null>;
  ensureOwnerProfile(details?: OwnerDetails): Promise<ClinicOwner>;
  accessToken(): string | null;
}>>;
