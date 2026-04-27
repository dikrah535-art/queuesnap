// Tracks whether the current Supabase session originated from a password
// recovery email link. While this flag is set, the app must NOT treat the
// session as a normal sign-in: the user must complete (or cancel) the reset.
//
// Supabase emits a PASSWORD_RECOVERY event when the user lands on the app
// from a recovery link. We persist a marker in sessionStorage so a refresh
// on /reset-password still keeps us in recovery mode.

const KEY = "qs:password-recovery";

export const isRecoveryMode = (): boolean => {
  try {
    return sessionStorage.getItem(KEY) === "1";
  } catch {
    return false;
  }
};

export const setRecoveryMode = (on: boolean) => {
  try {
    if (on) sessionStorage.setItem(KEY, "1");
    else sessionStorage.removeItem(KEY);
  } catch {
    /* ignore */
  }
};
