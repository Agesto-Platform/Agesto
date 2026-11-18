import { Alert, Platform } from 'react-native'

/** Pede confirmação de uma ação destrutiva. No web o Alert do RN não tem botões: usa o confirm. */
export function confirmar(
  titulo: string,
  mensagem: string,
  onSim: () => void,
  { acao = 'Excluir', voltar = 'Cancelar' }: { acao?: string; voltar?: string } = {},
) {
  if (Platform.OS === 'web') {
    if (globalThis.confirm?.(`${titulo}\n\n${mensagem}`)) onSim()
    return
  }
  Alert.alert(titulo, mensagem, [
    { text: voltar, style: 'cancel' },
    { text: acao, style: 'destructive', onPress: onSim },
  ])
}

/** Aviso simples, com um botão de OK. */
export function avisar(titulo: string, mensagem: string) {
  if (Platform.OS === 'web') {
    globalThis.alert?.(`${titulo}\n\n${mensagem}`)
    return
  }
  Alert.alert(titulo, mensagem)
}
