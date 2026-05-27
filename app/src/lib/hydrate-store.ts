import { auth, profiles, tracking } from '@/lib/api'
import { useDummyData } from '@/lib/config'
import { hasCompletedOnboarding } from '@/lib/post-auth'
import { useAppStore } from '@/lib/store'

/** Load user, profiles, and period logs from the API into the Zustand store (real mode only). */
export async function hydrateFromApi(): Promise<void> {
  if (useDummyData) return

  const store = useAppStore.getState()
  store.setHydrating(true)

  try {
    const { user } = await auth.getStatus()
    const profileList = await profiles.list()

    const [periodLogs, symptomLogs, profilesWithPredictions] = await Promise.all([
      Promise.all(profileList.map((p) => tracking.listPeriodLogs(p.id))).then((arr) => arr.flat()),
      Promise.all(profileList.map((p) => tracking.listSymptoms(p.id))).then((arr) => arr.flat()),
      Promise.all(
        profileList.map(async (summary) => {
          const detail = await profiles.get(summary.id)
          return detail
        }),
      ),
    ])

    useAppStore.setState({
      user,
      profiles: profilesWithPredictions.map(({ prediction: _p, ...profile }) => profile),
      periodLogs,
      symptomLogs,
      activeProfileId: profilesWithPredictions[0]?.id ?? '',
      isAuthenticated: true,
      isHydrated: true,
      isHydrating: false,
      dataMode: 'real',
      onboardingComplete: hasCompletedOnboarding(profilesWithPredictions.length),
    })
  } catch (error) {
    useAppStore.setState({ isHydrating: false })
    throw error
  }
}
