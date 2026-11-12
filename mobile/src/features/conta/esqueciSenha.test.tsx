import { describe, it, expect, jest, beforeEach } from '@jest/globals'
import { render, screen, fireEvent } from '@testing-library/react-native'
import NetInfo from '@react-native-community/netinfo'
import EsqueciSenha from '@/app/esqueci-senha'
import { api } from '@/lib/api'
import { ApiError } from '@/lib/errors'

const mockRouter = { back: jest.fn(), replace: jest.fn(), canGoBack: jest.fn(() => true) }
let mockParams: { email?: string } = {}

jest.mock('expo-router', () => ({
  useRouter: () => mockRouter,
  useLocalSearchParams: () => mockParams,
}))
// Mocks prontos das próprias libs (o módulo nativo não existe no jest).
jest.mock('@react-native-community/netinfo', () =>
  jest.requireActual('@react-native-community/netinfo/jest/netinfo-mock.js'),
)
jest.mock(
  'react-native-safe-area-context',
  () => (jest.requireActual('react-native-safe-area-context/jest/mock') as { default: unknown }).default,
)

const CONFIRMACAO = /Se este e-mail tiver acesso ao Agesto, enviamos um link para criar uma senha nova/

describe('Esqueci a senha', () => {
  beforeEach(() => {
    jest.clearAllMocks()
    jest.restoreAllMocks()
    mockParams = {}
  })

  it('envia o email sem espaços e mostra a confirmação neutra', async () => {
    // Resposta imediata (a do mock tem atraso e cai fora do act); o handler é testado em api.test.
    const post = jest.spyOn(api, 'post').mockResolvedValueOnce(null)
    await render(<EsqueciSenha />)

    await fireEvent.changeText(screen.getByLabelText('Email'), '  agente@agesto.app  ')
    await fireEvent.press(screen.getByText('Enviar link'))

    expect(await screen.findByText(CONFIRMACAO)).toBeTruthy()
    expect(post).toHaveBeenCalledTimes(1)
    expect(post).toHaveBeenCalledWith('/api/auth/esqueci-senha', { email: 'agente@agesto.app' })

    await fireEvent.press(screen.getByText('Voltar para entrar'))
    expect(mockRouter.back).toHaveBeenCalled()
  })

  it('preenche o email vindo do login', async () => {
    mockParams = { email: 'agente@agesto.app' }
    await render(<EsqueciSenha />)
    expect(screen.getByLabelText('Email').props.value).toBe('agente@agesto.app')
  })

  it('email inválido não é enviado', async () => {
    const post = jest.spyOn(api, 'post')
    await render(<EsqueciSenha />)

    await fireEvent.changeText(screen.getByLabelText('Email'), 'agente@')
    await fireEvent.press(screen.getByText('Enviar link'))

    expect(await screen.findByText('Informe um email válido.')).toBeTruthy()
    expect(post).not.toHaveBeenCalled()
  })

  it('sem internet avisa e não chama a API', async () => {
    jest.mocked(NetInfo.fetch).mockResolvedValueOnce({ isConnected: false } as never)
    const post = jest.spyOn(api, 'post')
    await render(<EsqueciSenha />)

    await fireEvent.changeText(screen.getByLabelText('Email'), 'agente@agesto.app')
    await fireEvent.press(screen.getByText('Enviar link'))

    expect(await screen.findByText(/Sem conexão com a internet/)).toBeTruthy()
    expect(post).not.toHaveBeenCalled()
  })

  it('mostra a mensagem da API quando ela recusa (ex.: limite de tentativas)', async () => {
    jest
      .spyOn(api, 'post')
      .mockRejectedValueOnce(new ApiError(429, 'Muitas tentativas. Aguarde alguns minutos e tente novamente.'))
    await render(<EsqueciSenha />)

    await fireEvent.changeText(screen.getByLabelText('Email'), 'agente@agesto.app')
    await fireEvent.press(screen.getByText('Enviar link'))

    expect(await screen.findByText('Muitas tentativas. Aguarde alguns minutos e tente novamente.')).toBeTruthy()
    expect(screen.queryByText(CONFIRMACAO)).toBeNull()
  })
})
