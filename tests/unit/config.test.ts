import {describe, it, expect, beforeEach, afterEach, vi} from 'vitest'
import {mkdtemp, writeFile, rm} from 'node:fs/promises'
import {tmpdir} from 'node:os'
import {join} from 'node:path'
import {loadConfig} from '../../src/config.js'

const KNOWN = new Set([
  'missing-alt-text',
  'vague-alt-text',
  'filename-alt-text',
  'placeholder-alt-text',
  'repeated-alt-text',
])

describe('loadConfig', () => {
  let dir: string
  let configPath: string

  beforeEach(async () => {
    dir = await mkdtemp(join(tmpdir(), 'alt-text-scan-cfg-'))
    configPath = join(dir, 'config.json')
  })

  afterEach(async () => {
    await rm(dir, {recursive: true, force: true})
  })

  it('returns empty disabledRules when the file is missing', async () => {
    const cfg = await loadConfig(configPath, KNOWN)
    expect(cfg.disabledRules.size).toBe(0)
  })

  it('returns empty disabledRules when the file is an empty object', async () => {
    await writeFile(configPath, '{}')
    const cfg = await loadConfig(configPath, KNOWN)
    expect(cfg.disabledRules.size).toBe(0)
  })

  it('returns empty disabledRules when disabledRules is an empty array', async () => {
    await writeFile(configPath, JSON.stringify({disabledRules: []}))
    const cfg = await loadConfig(configPath, KNOWN)
    expect(cfg.disabledRules.size).toBe(0)
  })

  it('returns the disabled rule ids when valid', async () => {
    await writeFile(configPath, JSON.stringify({disabledRules: ['repeated-alt-text', 'placeholder-alt-text']}))
    const cfg = await loadConfig(configPath, KNOWN)
    expect([...cfg.disabledRules].sort()).toEqual(['placeholder-alt-text', 'repeated-alt-text'])
  })

  it('warns and ignores unknown rule ids', async () => {
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => {})
    await writeFile(configPath, JSON.stringify({disabledRules: ['repeated-alt-text', 'no-such-rule']}))
    const cfg = await loadConfig(configPath, KNOWN)
    expect([...cfg.disabledRules]).toEqual(['repeated-alt-text'])
    expect(warn).toHaveBeenCalledWith(expect.stringContaining('no-such-rule'))
    warn.mockRestore()
  })

  it('falls back to empty when JSON is malformed and logs an error', async () => {
    const err = vi.spyOn(console, 'error').mockImplementation(() => {})
    await writeFile(configPath, '{ this is not json')
    const cfg = await loadConfig(configPath, KNOWN)
    expect(cfg.disabledRules.size).toBe(0)
    expect(err).toHaveBeenCalled()
    err.mockRestore()
  })

  it('ignores non-string entries in disabledRules', async () => {
    await writeFile(configPath, JSON.stringify({disabledRules: ['vague-alt-text', 123, null, {}]}))
    const cfg = await loadConfig(configPath, KNOWN)
    expect([...cfg.disabledRules]).toEqual(['vague-alt-text'])
  })

  it('ignores disabledRules when it is not an array', async () => {
    await writeFile(configPath, JSON.stringify({disabledRules: 'repeated-alt-text'}))
    const cfg = await loadConfig(configPath, KNOWN)
    expect(cfg.disabledRules.size).toBe(0)
  })

  it('ignores top-level non-object JSON', async () => {
    await writeFile(configPath, JSON.stringify(['repeated-alt-text']))
    const cfg = await loadConfig(configPath, KNOWN)
    expect(cfg.disabledRules.size).toBe(0)
  })
})
