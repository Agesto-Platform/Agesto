/** Regras da troca de senha (espelham o backend). Devolve a mensagem do primeiro problema. */
export function validarNovaSenha(atual: string, nova: string, confirma: string): string | null {
  if (!atual) return 'Informe a senha provisória.'
  if (nova.length < 8) return 'A nova senha deve ter no mínimo 8 caracteres.'
  if (nova.length > 128) return 'A nova senha deve ter no máximo 128 caracteres.'
  if (nova !== confirma) return 'A confirmação não confere com a nova senha.'
  if (nova === atual) return 'A nova senha deve ser diferente da provisória.'
  return null
}
