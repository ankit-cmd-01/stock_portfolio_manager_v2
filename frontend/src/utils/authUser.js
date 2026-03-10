export const AUTH_STORAGE_KEY = "spm_user";

export function normalizeAuthUser(user) {
  if (!user || typeof user !== "object") {
    return null;
  }

  const rawEmail =
    typeof user.email === "string"
      ? user.email
      : typeof user.username === "string"
        ? user.username
        : "";
  const email = rawEmail.trim().toLowerCase();

  if (!email || !email.includes("@")) {
    return null;
  }

  const rawName = typeof user.name === "string" ? user.name.trim() : "";

  return {
    id: user.id ?? email,
    name: rawName || email.split("@")[0],
    email,
  };
}

export function readStoredAuthUser() {
  if (typeof window === "undefined") {
    return null;
  }

  const raw = window.localStorage.getItem(AUTH_STORAGE_KEY);
  if (!raw) {
    return null;
  }

  try {
    return normalizeAuthUser(JSON.parse(raw));
  } catch {
    return null;
  }
}

export function buildAuthUser({ email, name }) {
  return normalizeAuthUser({
    id: Date.now(),
    name,
    email,
  });
}
