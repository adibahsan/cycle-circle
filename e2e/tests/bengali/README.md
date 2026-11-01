# Bengali pass (`web-bengali`)

Issue **#133**. Playwright project `web-bengali` (`E2E_SUITE=full`, manual Actions run).

Specs here set `vesta_lang=bn` (and the Zustand language) on a throwaway user, visit every
web page and open every pop-up the flows reach, then scan visible text/accessible attributes
for leftover Latin letters (`support/latin-scan.ts`). Brand names, numbers, units, and
documented third-party identifiers are allow-listed.

Admin is English-only and out of scope. Each real leftover is a `needs-triage` GitHub issue
plus `test.fail()` on that page/area.
