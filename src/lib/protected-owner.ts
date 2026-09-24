export const PROTECTED_OWNER_EMAIL = "sehaslochana@gmail.com";

export function isProtectedOwnerEmail(email: string | null | undefined) {
  return email?.trim().toLowerCase() === PROTECTED_OWNER_EMAIL;
}
