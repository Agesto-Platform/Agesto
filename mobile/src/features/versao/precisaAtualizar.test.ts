import { describe, it, expect } from '@jest/globals'
import { precisaAtualizar } from './precisaAtualizar'

describe('precisaAtualizar', () => {
  it.each([
    ['1.0.0', '1.0.1'],
    ['1.0.0', '1.1.0'],
    ['1.9.0', '1.10.0'],
    ['1.0', '1.0.1'],
  ])('avisa quando %s < %s', (instalada, minima) => {
    expect(precisaAtualizar(instalada, minima)).toBe(true)
  })

  it.each([
    ['1.0.0', '1.0.0'],
    ['1.1.0', '1.0.9'],
    ['1.0.0', '1.0'],
    [' 2.0.0 ', '1.9.9'],
  ])('não avisa quando %s >= %s', (instalada, minima) => {
    expect(precisaAtualizar(instalada, minima)).toBe(false)
  })

  it.each([
    [null, '1.0.0'],
    ['1.0.0', null],
    ['1.0.0', ''],
    ['abc123', '1.0.0'],
    ['1.0.0', '1.0.0-beta'],
  ])('não avisa sem dado confiável (%s, %s)', (instalada, minima) => {
    expect(precisaAtualizar(instalada, minima)).toBe(false)
  })
})
