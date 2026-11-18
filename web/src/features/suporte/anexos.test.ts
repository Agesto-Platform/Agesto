import { describe, it, expect } from 'vitest'
import { comprimir, motivoRecusa, tamanhoLegivel, MAX_BYTES } from './anexos'

const arquivo = (nome: string, tipo: string, bytes: number) => {
  const f = new File(['x'], nome, { type: tipo })
  Object.defineProperty(f, 'size', { value: bytes })
  return f
}

// Anexos dos chamados (DEC-60).
describe('anexos', () => {
  it('aceita imagem grande (vai ser reduzida) e PDF de até 5 MB; recusa outros tipos', () => {
    expect(motivoRecusa(arquivo('foto.jpg', 'image/jpeg', 12 * 1024 * 1024))).toBeNull()
    expect(motivoRecusa(arquivo('boleto.pdf', 'application/pdf', MAX_BYTES))).toBeNull()
    expect(motivoRecusa(arquivo('boleto.pdf', 'application/pdf', MAX_BYTES + 1))).toMatch(/5 MB/)
    expect(motivoRecusa(arquivo('planilha.xlsx', 'application/vnd.ms-excel', 10))).toMatch(/não é imagem/)
    expect(motivoRecusa(arquivo('enorme.png', 'image/png', 40 * 1024 * 1024))).toMatch(/grande demais/)
  })

  it('PDF segue como está e, sem suporte do navegador, a imagem também', async () => {
    const pdf = arquivo('b.pdf', 'application/pdf', 100)
    expect(await comprimir(pdf)).toBe(pdf)
    const png = arquivo('p.png', 'image/png', 100)
    expect(await comprimir(png)).toBe(png)
  })

  it('mostra o tamanho de um jeito legível', () => {
    expect(tamanhoLegivel(900)).toBe('900 B')
    expect(tamanhoLegivel(204800)).toBe('200 KB')
    expect(tamanhoLegivel(3.5 * 1024 * 1024)).toBe('3,5 MB')
  })
})
