'use client';

interface ProfileCompletionModalProps {
  user?: {
    id: string;
    fullName?: string | null;
    phone?: string | null;
    profileCompleted?: boolean;
  } | null;
}

/**
 * ProfileCompletionModal — shown when a user's profile is not yet complete
 * (e.g. email-login users who haven't added their phone number).
 * Full implementation pending UX design for the completion flow.
 */
export function ProfileCompletionModal({ user: _user }: ProfileCompletionModalProps) {
  return null;
}
