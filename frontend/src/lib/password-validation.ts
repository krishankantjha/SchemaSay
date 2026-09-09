export type PasswordRule = {
  id: string;
  label: string;
  test: (password: string) => boolean;
};

export const PASSWORD_RULES: PasswordRule[] = [
  { id: "length", label: "8+ characters", test: (p) => p.length >= 8 },
  { id: "upper", label: "Uppercase letter", test: (p) => /[A-Z]/.test(p) },
  { id: "lower", label: "Lowercase letter", test: (p) => /[a-z]/.test(p) },
  { id: "digit", label: "Number", test: (p) => /\d/.test(p) },
  {
    id: "special",
    label: "Special character",
    test: (p) => /[!@#$%^&*(),.?":{}|<>]/.test(p),
  },
];

export const PASSWORD_REGEX =
  /^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)(?=.*[!@#$%^&*(),.?":{}|<>]).{8,}$/;

export function scorePassword(password: string): number {
  if (!password) return 0;
  const passed = PASSWORD_RULES.filter((r) => r.test(password)).length;
  return Math.round((passed / PASSWORD_RULES.length) * 100);
}

export function passwordStrengthLabel(score: number): string {
  if (score === 0) return "";
  if (score < 40) return "Weak";
  if (score < 80) return "Fair";
  if (score < 100) return "Good";
  return "Strong";
}

export function isValidEmail(email: string): boolean {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email.trim());
}

export function mapRegisterError(detail: string): string {
  const lower = detail.toLowerCase();
  if (lower.includes("already exists") || lower.includes("409")) {
    return "An account with this email already exists. Try signing in.";
  }
  if (lower.includes("email")) return detail;
  if (lower.includes("password")) return detail;
  return detail;
}
