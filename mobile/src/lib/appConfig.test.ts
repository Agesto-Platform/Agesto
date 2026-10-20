import { describe, it, expect } from '@jest/globals'
import { getConfig, saveConfig, DEFAULT_CONFIG } from './appConfig'
import { createMemoryDb } from '@/db/memoryDb'

describe('appConfig', () => {
  it('sem meta gravada devolve o default seguro', async () => {
    const db = createMemoryDb()
    expect(await getConfig(db)).toEqual(DEFAULT_CONFIG)
  })

  it('JSON corrompido cai no default', async () => {
    const db = createMemoryDb()
    await db.setMeta('config', '{ nao é json }')
    expect(await getConfig(db)).toEqual(DEFAULT_CONFIG)
  })

  it('mescla patch parcial sobre o default', async () => {
    const db = createMemoryDb()
    await db.setMeta('config', JSON.stringify({ modoAgendaAgente: 'Fixa' }))
    const config = await getConfig(db)
    expect(config.modoAgendaAgente).toBe('Fixa')
    expect(config.controlaEstoque).toBe(true) // veio do default
    expect(config.tipoOperacao).toBe(DEFAULT_CONFIG.tipoOperacao)
  })

  it('saveConfig persiste e getConfig lê de volta', async () => {
    const db = createMemoryDb()
    await saveConfig(db, { tipoOperacao: 'Hibrido', modoAgendaAgente: 'Fixa', controlaEstoque: false, agenteCadastraServico: false })
    expect(await getConfig(db)).toEqual({
      tipoOperacao: 'Hibrido',
      modoAgendaAgente: 'Fixa',
      controlaEstoque: false,
      agenteCadastraServico: false,
    })
  })

  it('servidor antigo sem agenteCadastraServico mantém o cadastro de serviço ligado', async () => {
    const db = createMemoryDb()
    await saveConfig(db, { tipoOperacao: 'Servico', modoAgendaAgente: 'Flexivel', controlaEstoque: true })
    expect((await getConfig(db)).agenteCadastraServico).toBe(true)
  })
})
