/** Where to send the user immediately after sign-in. */
export function getPostAuthPath(profileCount: number): '/dashboard' | '/onboarding' {
  return profileCount > 0 ? '/dashboard' : '/onboarding'
}

/** True when the user has at least one profile and does not need onboarding. */
export function hasCompletedOnboarding(profileCount: number): boolean {
  return profileCount > 0
}
