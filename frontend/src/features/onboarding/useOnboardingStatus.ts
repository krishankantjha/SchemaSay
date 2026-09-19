import { useEffect, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { schemaApi } from "@/lib/api/endpoints";
import { useConnection } from "@/features/connections/ConnectionContext";
import {
  dismissOnboarding,
  isAskStepComplete,
  isExploreStepComplete,
  isOnboardingDismissed,
  isOnboardingSnoozed,
  ONBOARDING_CHANGE_EVENT,
  remindOnboardingLater,
} from "@/lib/onboarding";

export type OnboardingStep = "connect" | "explore" | "ask";

export type OnboardingSteps = Record<OnboardingStep, boolean>;

const STEP_ORDER: OnboardingStep[] = ["connect", "explore", "ask"];

export function useOnboardingStatus() {
  const { connections, activeConnectionId, isLoading: connectionsLoading } = useConnection();
  const [onboardingTick, setOnboardingTick] = useState(0);

  useEffect(() => {
    const onChange = () => setOnboardingTick((n) => n + 1);
    window.addEventListener(ONBOARDING_CHANGE_EVENT, onChange);
    return () => window.removeEventListener(ONBOARDING_CHANGE_EVENT, onChange);
  }, []);

  const { data: schemaTree, isLoading: schemaLoading } = useQuery({
    queryKey: ["schema-tree", activeConnectionId],
    queryFn: () => schemaApi.tree(activeConnectionId!),
    enabled: Boolean(activeConnectionId),
  });

  const hasSchema = (schemaTree?.tables.length ?? 0) > 0;
  void onboardingTick;

  const steps: OnboardingSteps = {
    connect: connections.length > 0,
    explore: hasSchema && isExploreStepComplete(),
    ask: isAskStepComplete(),
  };
  const allComplete = steps.connect && steps.explore && steps.ask;
  const dismissed = isOnboardingDismissed();
  const snoozed = isOnboardingSnoozed();
  const showBanner = !dismissed && !snoozed && !allComplete;

  const currentStep: OnboardingStep = !steps.connect
    ? "connect"
    : !steps.explore
      ? "explore"
      : "ask";

  const currentStepIndex = STEP_ORDER.indexOf(currentStep) + 1;

  const showCompactStatus = steps.connect && hasSchema && !showBanner;

  return {
    steps,
    currentStep,
    currentStepIndex,
    totalSteps: STEP_ORDER.length,
    showBanner,
    showCompactStatus,
    allComplete,
    hasSchema,
    tableCount: schemaTree?.tables.length ?? 0,
    columnCount: schemaTree?.tables.reduce((n, t) => n + t.columns.length, 0) ?? 0,
    isLoading: connectionsLoading || (Boolean(activeConnectionId) && schemaLoading),
    dismiss: dismissOnboarding,
    remindLater: remindOnboardingLater,
  };
}
