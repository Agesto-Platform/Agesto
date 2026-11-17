/**
 * Anexos dos chamados (DEC-60): até 3 arquivos, imagens (PNG, JPG, WEBP) ou PDF,
 * de no máximo 5 MB depois da compressão. A API confere de novo pelo conteúdo.
 */
export const MAX_ANEXOS = 3
export const MAX_BYTES = 5 * 1024 * 1024
/** Foto de celular pode chegar grande: ela é reduzida antes de enviar. */
export const MAX_BYTES_IMAGEM_ORIGINAL = 25 * 1024 * 1024
export const ACEITOS = 'image/png,image/jpeg,image/webp,application/pdf'

const IMAGENS = ['image/png', 'image/jpeg', 'image/webp']
/** Lado maior da imagem depois de reduzida: um print de tela continua legível. */
const LADO_MAXIMO = 1920
const QUALIDADE = 0.8

export const ehImagem = (tipo: string) => IMAGENS.includes(tipo)

export function tamanhoLegivel(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`
  if (bytes < 1024 * 1024) return `${Math.round(bytes / 1024)} KB`
  return `${(bytes / (1024 * 1024)).toFixed(1).replace('.', ',')} MB`
}

/** Motivo para recusar o arquivo antes de comprimir, ou null se pode seguir. */
export function motivoRecusa(f: File): string | null {
  if (ehImagem(f.type)) return f.size > MAX_BYTES_IMAGEM_ORIGINAL ? `${f.name} é grande demais.` : null
  if (f.type === 'application/pdf') return f.size > MAX_BYTES ? `${f.name} passa de 5 MB.` : null
  return `${f.name} não é imagem (PNG, JPG, WEBP) nem PDF.`
}

function canvasParaBlob(canvas: HTMLCanvasElement, tipo: string): Promise<Blob | null> {
  return new Promise((resolve) => canvas.toBlob(resolve, tipo, QUALIDADE))
}

/**
 * Reduz a imagem para no máximo 1920 px no lado maior e regrava em WEBP (ou JPEG,
 * se o navegador não gerar WEBP). Fica com a versão menor; PDF e imagens que não
 * diminuem seguem como estão. Sem suporte no navegador, devolve o original.
 */
export async function comprimir(f: File): Promise<File> {
  if (!ehImagem(f.type) || typeof createImageBitmap === 'undefined') return f
  try {
    const bitmap = await createImageBitmap(f)
    const escala = Math.min(1, LADO_MAXIMO / Math.max(bitmap.width, bitmap.height))
    const canvas = document.createElement('canvas')
    canvas.width = Math.max(1, Math.round(bitmap.width * escala))
    canvas.height = Math.max(1, Math.round(bitmap.height * escala))
    const ctx = canvas.getContext('2d')
    if (!ctx) return f
    ctx.drawImage(bitmap, 0, 0, canvas.width, canvas.height)
    bitmap.close?.()

    let blob = await canvasParaBlob(canvas, 'image/webp')
    if (!blob || blob.type !== 'image/webp') blob = await canvasParaBlob(canvas, 'image/jpeg')
    if (!blob || blob.size >= f.size) return f
    const ext = blob.type === 'image/webp' ? 'webp' : 'jpg'
    const nome = `${f.name.replace(/\.[^.]+$/, '') || 'imagem'}.${ext}`
    return new File([blob], nome, { type: blob.type })
  } catch {
    return f
  }
}
