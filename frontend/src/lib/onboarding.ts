const DISMISSED_KEY = "schemasay_onboarding_dismissed";
const REMIND_KEY = "schemasay_onboarding_remind_at";
const ASK_DONE_KEY = "schemasay_onboarding_ask_done";
const EXPLORE_DONE_KEY = "schemasay_onboarding_explore_done";

export const ONBOARDING_CHANGE_EVENT = "schemasay-onboarding-change";

function notifyOnboardingChange() {
  window.dispatchEvent(new Event(ONBOARDING_CHANGE_EVENT));
}

export function isOnboardingDismissed(): boolean {
  return localStorage.getItem(DISMISSED_KEY) === "1";
}

export function dismissOnboarding(): void {
  localStorage.setItem(DISMISSED_KEY, "1");
  localStorage.removeItem(REMIND_KEY);
  notifyOnboardingChange();
}

/** Hide onboarding for 24 hours without permanent dismiss */
export function remindOnboardingLater(): void {
  const remindAt = Date.now() + 24 * 60 * 60 * 1000;
  localStorage.setItem(REMIND_KEY, String(remindAt));
  notifyOnboardingChange();
}

export function isOnboardingSnoozed(): boolean {
  const raw = localStorage.getItem(REMIND_KEY);
  if (!raw) return false;
  const remindAt = Number(raw);
  if (!Number.isFinite(remindAt) || Date.now() >= remindAt) {
    localStorage.removeItem(REMIND_KEY);
    return false;
  }
  return true;
}

export function markAskStepComplete(): void {
  localStorage.setItem(ASK_DONE_KEY, "1");
  notifyOnboardingChange();
}

export function isAskStepComplete(): boolean {
  return localStorage.getItem(ASK_DONE_KEY) === "1";
}

export function markExploreStepComplete(): void {
  localStorage.setItem(EXPLORE_DONE_KEY, "1");
  notifyOnboardingChange();
}

export function isExploreStepComplete(): boolean {
  return localStorage.getItem(EXPLORE_DONE_KEY) === "1";
}

export function resetOnboardingProgress(): void {
  localStorage.removeItem(DISMISSED_KEY);
  localStorage.removeItem(REMIND_KEY);
  localStorage.removeItem(ASK_DONE_KEY);
  localStorage.removeItem(EXPLORE_DONE_KEY);
  notifyOnboardingChange();
}
