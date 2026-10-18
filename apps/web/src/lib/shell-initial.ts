import type { ProfileCompletionStatus } from '@/lib/profile-completion';

/** What the (main) layout streams to the shell: the same data /api/auth/status, /api/tracking/logging-status and /api/profile/completion return. */
export type ShellInitial = {
  user: {
    id: string;
    createdAt: string | null;
    onboardingTourCompletedAt: string | null;
    authMethod: string | null;
    subscriptionStatus: string | null;
    emailTrialExpiresAt: string | null;
  } | null;
  logging: {
    profileId: string | null;
    goal: string | null;
    loggedToday: boolean;
    isPeriodLate: boolean;
    daysLate: number;
  };
  completion: ProfileCompletionStatus | null;
  activeProfile: { id: string; name: string } | null;
};
