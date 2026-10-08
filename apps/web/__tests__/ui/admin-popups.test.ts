import { describe, it, expect } from 'vitest'
import fs from 'node:fs'
import path from 'node:path'
import { placePopover } from '@vesta/shared/utils/popup-core'

const ADMIN = path.resolve(__dirname, '../../../admin/src')
const read = (p: string) => fs.readFileSync(path.join(ADMIN, p), 'utf8')

describe('placePopover (picker is never clipped)', () => {
  const vp = { width: 1000, height: 800 }
  const size = { width: 320, height: 380 }

  it('opens below the anchor when there is room', () => {
    const p = placePopover({ left: 100, top: 100, bottom: 140, width: 300 }, size, vp)
    expect(p.top).toBe(146)
    expect(p.left).toBe(100)
  })

  it('flips above when there is no room below', () => {
    const p = placePopover({ left: 100, top: 600, bottom: 640, width: 300 }, size, vp)
    expect(p.top).toBe(600 - 6 - 380)
  })

  it('clamps horizontally inside the viewport', () => {
    const p = placePopover({ left: 900, top: 100, bottom: 140, width: 80 }, size, vp)
    expect(p.left + size.width).toBeLessThanOrEqual(vp.width - 8)
    const q = placePopover({ left: -50, top: 100, bottom: 140, width: 80 }, size, vp)
    expect(q.left).toBe(8)
  })

  it('stays on screen when neither side fits', () => {
    const p = placePopover({ left: 0, top: 200, bottom: 240, width: 100 }, size, { width: 500, height: 450 })
    expect(p.top).toBeGreaterThanOrEqual(8)
  })
})

describe('admin pop-ups use the shell', () => {
  const hand = ['components/ui/ConfirmModal.tsx', 'app/(admin)/sms/SmsClient.tsx', 'app/(admin)/content/ContentClient.tsx', 'app/(admin)/layout.tsx']
  for (const f of hand) {
    it(`${f} has no hand-rolled overlay`, () => {
      const src = read(f)
      expect(src).not.toMatch(/fixed inset-0/)
      expect(src).not.toMatch(/aria-modal/)
      expect(src).not.toMatch(/key === 'Escape'[\s\S]{0,40}onClose/)
    })
  }

  it('the shell owns the behaviours', () => {
    const modal = read('components/ui/Modal.tsx')
    for (const s of ['createPortal', 'aria-modal', 'overscroll', 'Z_CLASS', 'usePopupBehavior'])
      expect(modal).toContain(s)
    const hook = read('components/ui/usePopupBehavior.ts')
    for (const s of ['inert', 'lock()', 'Escape', 'nextTrapIndex', 'focus()'])
      expect(hook).toContain(s)
  })

  it('the confirm modal and the pop-ups are on Modal', () => {
    expect(read('components/ui/ConfirmModal.tsx')).toContain("from './Modal'")
    expect(read('app/(admin)/sms/SmsClient.tsx')).toContain('<Modal')
    expect(read('app/(admin)/content/ContentClient.tsx')).toContain('<Modal')
  })

  it('the drawer is a labelled, focus-visible shell consumer', () => {
    const d = read('components/ui/Drawer.tsx')
    expect(d).toContain('usePopupBehavior')
    expect(d).toContain('Close navigation menu')
    expect(d).toContain('focus-visible:ring-2')
    expect(read('app/(admin)/layout.tsx')).toContain('<Drawer')
  })

  it('the date picker joins the ESC stack and portals into the pop-up root', () => {
    const src = read('components/ui/DateTimePicker.tsx')
    expect(src).toContain('popupStack')
    expect(src).toContain('placePopover')
    expect(src).toContain('createPortal')
    expect(src).toContain('data-popup-root')
  })

  it('the category rename input swallows its own ESC', () => {
    expect(read('app/(admin)/content/ContentClient.tsx')).toMatch(/Escape'\) \{\s*e\.stopPropagation\(\)/)
  })
})
