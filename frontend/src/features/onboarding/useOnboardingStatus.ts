import { useQuery } from "@tanstack/react-query";
import { schemaApi } from "@/lib/api/endpoints";
import { useConnection } from "@/features/connections/ConnectionContext";
import {
  dismissOnboarding,
  isAskStepComplete,
  isOnboardingDismissed,
  isOnboardingSnoozed,
  remindOnboardingLater,
} from "@/lib/onboarding";

export type OnboardingStep = "connect" | "sync" | "ask";

export type OnboardingSteps = Record<OnboardingStep, boolean>;

const STEP_ORDER: OnboardingStep[] = ["connect", "sync", "ask"];

export function useOnboardingStatus() {
  const { connections, activeConnectionId, isLoading: connectionsLoading } = useConnection();

  const { data: schemaTree, isLoading: schemaLoading } = useQuery({
    queryKey: ["schema-tree", activeConnectionId],
    queryFn: () => schemaApi.tree(activeConnectionId!),
    enabled: Boolean(activeConnectionId),
  });

  const steps: OnboardingSteps = {
    connect: connections.length > 0,
    sync: (schemaTree?.tables.length ?? 0) > 0,
    ask: isAskStepComplete(),
  };

  const allComplete = steps.connect && steps.sync && steps.ask;
  const dismissed = isOnboardingDismissed();
  const snoozed = isOnboardingSnoozed();
  const showBanner = !dismissed && !snoozed && !allComplete;

  const currentStep: OnboardingStep = !steps.connect
    ? "connect"
    : !steps.sync
      ? "sync"
      : "ask";

  const currentStepIndex = STEP_ORDER.indexOf(currentStep) + 1;

  const showCompactStatus = steps.connect && steps.sync && !showBanner;

  return {
    steps,
    currentStep,
    currentStepIndex,
    totalSteps: STEP_ORDER.length,
    showBanner,
    showCompactStatus,
    allComplete,
    tableCount: schemaTree?.tables.length ?? 0,
    columnCount: schemaTree?.tables.reduce((n, t) => n + t.columns.length, 0) ?? 0,
    isLoading: connectionsLoading || (Boolean(activeConnectionId) && schemaLoading),
    dismiss: dismissOnboarding,
    remindLater: remindOnboardingLater,
  };
}
