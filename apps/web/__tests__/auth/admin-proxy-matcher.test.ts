import { describe, it, expect } from 'vitest'
import { config } from '../../../admin/src/proxy'

// Next anchors each matcher pattern as ^...$ against the request pathname.
const re = new RegExp(`^${config.matcher[0]}$`)
const runsProxy = (path: string) => re.test(path)

describe('admin proxy matcher (#186)', () => {
  it('gates the API docs files that live in public/', () => {
    expect(runsProxy('/openapi.yaml')).toBe(true)
    expect(runsProxy('/swagger-ui/swagger-ui-bundle.js')).toBe(true)
    expect(runsProxy('/swagger-ui/swagger-ui.css')).toBe(true)
    expect(runsProxy('/swagger-ui/VERSION.txt')).toBe(true)
  })

  it('gates ordinary pages and dotted lookalikes', () => {
    expect(runsProxy('/')).toBe(true)
    expect(runsProxy('/users')).toBe(true)
    expect(runsProxy('/api-docs')).toBe(true)
    expect(runsProxy('/uploads/photo.png')).toBe(true)
    expect(runsProxy('/icon.png.evil')).toBe(true)
    expect(runsProxy('/brandx/secret.txt')).toBe(true)
  })

  it('skips assets the unauthenticated pages need', () => {
    expect(runsProxy('/_next/static/chunks/app.js')).toBe(false)
    expect(runsProxy('/_next/image')).toBe(false)
    expect(runsProxy('/favicon.ico')).toBe(false)
    expect(runsProxy('/icon.png')).toBe(false)
    expect(runsProxy('/apple-icon.png')).toBe(false)
    expect(runsProxy('/brand/cycle-circle-logo.svg')).toBe(false)
  })
})
