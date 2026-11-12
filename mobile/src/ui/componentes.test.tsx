import { describe, it, expect, jest } from '@jest/globals'
import { fireEvent, render, screen, userEvent } from '@testing-library/react-native'
import { Stepper } from './Stepper'
import { ValorEditavel } from './ValorEditavel'

// Teste de componente (RNTL v14: render e eventos são assíncronos).
describe('Stepper', () => {
  it('soma um e não deixa descer abaixo do mínimo', async () => {
    const user = userEvent.setup()
    const onChange = jest.fn()
    await render(<Stepper value={1} min={1} onChange={onChange} />)

    expect(screen.getByText('1')).toBeOnTheScreen()
    expect(screen.getByRole('button', { name: 'Diminuir' })).toBeDisabled()

    await user.press(screen.getByRole('button', { name: 'Aumentar' }))
    expect(onChange).toHaveBeenCalledWith(2)
  })
})

describe('ValorEditavel', () => {
  it('mostra o valor do catálogo e, ao tocar, aceita um valor ajustado com vírgula', async () => {
    const user = userEvent.setup()
    const onChange = jest.fn()
    await render(<ValorEditavel catalogo={140} valor={undefined} rotulo="Manutenção" onChange={onChange} />)

    expect(screen.getByText('R$ 140')).toBeOnTheScreen()
    expect(screen.queryByText('ajustado')).not.toBeOnTheScreen()

    await user.press(screen.getByRole('button', { name: 'Ajustar valor de Manutenção' }))
    // Troca o texto todo de uma vez: o clear do userEvent tira o foco e fecharia o campo.
    const campo = screen.getByLabelText('Valor de Manutenção')
    expect(campo).toHaveDisplayValue('140')
    await fireEvent.changeText(campo, '150,5')
    await fireEvent(campo, 'submitEditing')

    expect(onChange).toHaveBeenCalledTimes(1)
    expect(onChange).toHaveBeenCalledWith(150.5)
    expect(screen.queryByLabelText('Valor de Manutenção')).not.toBeOnTheScreen()
  })

  it('valor igual ao do catálogo volta a seguir o catálogo', async () => {
    const user = userEvent.setup()
    const onChange = jest.fn()
    await render(<ValorEditavel catalogo={140} valor={160} rotulo="Manutenção" onChange={onChange} />)

    expect(screen.getByText('ajustado')).toBeOnTheScreen()

    await user.press(screen.getByRole('button', { name: 'Ajustar valor de Manutenção' }))
    const campo = screen.getByLabelText('Valor de Manutenção')
    expect(campo).toHaveDisplayValue('160')
    await fireEvent.changeText(campo, '140')
    await fireEvent(campo, 'submitEditing')

    expect(onChange).toHaveBeenCalledTimes(1)
    expect(onChange).toHaveBeenCalledWith(undefined)
  })
})
