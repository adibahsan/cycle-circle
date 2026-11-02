import { cookies } from 'next/headers'
import { setUserLanguage } from '@vesta/shared/server/services'
import { logger } from '@vesta/shared/server/log'
import { LANG_COOKIE } from '@/lib/language'

/**
 * Copies the `vesta_lang` cookie to the User at login, so a language picked before
 * logging in reaches reminders and emails (#254). No cookie means no choice was made:
 * the saved language stays. A failed save never fails the login.
 *
 * `linkLanguage` is a language saved with the login itself (a magic link's requesting page,
 * #258); it wins over the cookie of whichever browser finishes the login.
 */
export async function saveLoginLanguage(userId: string, linkLanguage?: 'EN' | 'BN' | null): Promise<void> {
  const lang = linkLanguage ? (linkLanguage === 'BN' ? 'bn' : 'en') : (await cookies()).get(LANG_COOKIE)?.value
  if (lang !== 'en' && lang !== 'bn') return
  try {
    await setUserLanguage(userId, lang)
  } catch (err) {
    logger.error('auth.login.language_save_failed', err, { userId })
  }
}
