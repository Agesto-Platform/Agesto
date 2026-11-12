/**
 * Formato básico de email (algo@dominio.tld), só para evitar envio com erro de
 * digitação. A API continua sendo quem decide se o email tem conta.
 */
export function emailValido(email: string): boolean {
  const e = email.trim()
  return e.length <= 254 && /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(e)
}
