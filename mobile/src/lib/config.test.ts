import { describe, it, expect } from '@jest/globals'
import { resolveConfig } from './config'

describe('resolveConfig', () => {
  it('dev: mock só liga com "true" explícito', () => {
    expect(resolveConfig({}, true).useMocks).toBe(false)
    expect(resolveConfig({ useMocks: 'false' }, true).useMocks).toBe(false)
    expect(resolveConfig({ useMocks: '1' }, true).useMocks).toBe(false)
    expect(resolveConfig({ useMocks: 'true' }, true).useMocks).toBe(true)
  })

  it('dev: sem URL cai no localhost', () => {
    expect(resolveConfig({}, true).apiBaseUrl).toBe('http://localhost:5000')
  })

  it('release: nunca usa mock, mesmo com a env ligada', () => {
    const c = resolveConfig({ apiBaseUrl: 'https://api.exemplo.com', useMocks: 'true' }, false)
    expect(c).toEqual({ apiBaseUrl: 'https://api.exemplo.com', useMocks: false })
  })

  it('release: exige URL https (sem fallback pro localhost)', () => {
    expect(() => resolveConfig({}, false)).toThrow()
    expect(() => resolveConfig({ apiBaseUrl: 'http://192.168.0.10:5216' }, false)).toThrow()
  })
})
