import {describe, it, expect, beforeEach, afterEach, vi} from 'vitest'
import {mkdtemp, writeFile, rm} from 'node:fs/promises'
import {tmpdir} from 'node:os'
import {join} from 'node:path'
import {loadConfig} from '../../src/config.js'
import {allRules} from '../../src/rules/index.js'

const KNOWN = new Set(allRules.map(r => r.id))

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

  it('returns empty overrides when the file is missing', async () => {
    const cfg = await loadConfig(configPath, KNOWN)
    expect(cfg.ruleOverrides.size).toBe(0)
  })

  it('logs an error and returns empty when read fails for a non-ENOENT reason', async () => {
    const err = vi.spyOn(console, 'error').mockImplementation(() => {})
    // Pointing at a directory makes readFile fail with EISDIR rather than ENOENT.
    const cfg = await loadConfig(dir, KNOWN)
    expect(cfg.ruleOverrides.size).toBe(0)
    expect(err).toHaveBeenCalled()
    err.mockRestore()
  })

  it('returns empty overrides when the file is an empty object', async () => {
    await writeFile(configPath, '{}')
    const cfg = await loadConfig(configPath, KNOWN)
    expect(cfg.ruleOverrides.size).toBe(0)
  })

  it('returns empty overrides when rules is an empty object', async () => {
    await writeFile(configPath, JSON.stringify({rules: {}}))
    const cfg = await loadConfig(configPath, KNOWN)
    expect(cfg.ruleOverrides.size).toBe(0)
  })

  it('returns the overrides when valid', async () => {
    await writeFile(
      configPath,
      JSON.stringify({rules: {'repeated-alt-text': false, 'placeholder-alt-text': false, 'vague-alt-text': true}}),
    )
    const cfg = await loadConfig(configPath, KNOWN)
    expect(cfg.ruleOverrides.get('repeated-alt-text')).toBe(false)
    expect(cfg.ruleOverrides.get('placeholder-alt-text')).toBe(false)
    expect(cfg.ruleOverrides.get('vague-alt-text')).toBe(true)
    expect(cfg.ruleOverrides.size).toBe(3)
  })

  it('warns and ignores unknown rule ids', async () => {
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => {})
    await writeFile(configPath, JSON.stringify({rules: {'repeated-alt-text': false, 'no-such-rule': false}}))
    const cfg = await loadConfig(configPath, KNOWN)
    expect([...cfg.ruleOverrides.keys()]).toEqual(['repeated-alt-text'])
    expect(warn).toHaveBeenCalledWith(expect.stringContaining('no-such-rule'))
    warn.mockRestore()
  })

  it('warns and ignores non-boolean values', async () => {
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => {})
    await writeFile(
      configPath,
      JSON.stringify({rules: {'vague-alt-text': false, 'repeated-alt-text': 'off', 'placeholder-alt-text': 1}}),
    )
    const cfg = await loadConfig(configPath, KNOWN)
    expect([...cfg.ruleOverrides.keys()]).toEqual(['vague-alt-text'])
    expect(cfg.ruleOverrides.get('vague-alt-text')).toBe(false)
    expect(warn).toHaveBeenCalledTimes(2)
    warn.mockRestore()
  })

  it('falls back to empty when JSON is malformed and logs an error', async () => {
    const err = vi.spyOn(console, 'error').mockImplementation(() => {})
    await writeFile(configPath, '{ this is not json')
    const cfg = await loadConfig(configPath, KNOWN)
    expect(cfg.ruleOverrides.size).toBe(0)
    expect(err).toHaveBeenCalled()
    err.mockRestore()
  })

  it('ignores rules when it is not a plain object', async () => {
    await writeFile(configPath, JSON.stringify({rules: ['repeated-alt-text']}))
    const cfg = await loadConfig(configPath, KNOWN)
    expect(cfg.ruleOverrides.size).toBe(0)
  })

  it('ignores rules when it is a string', async () => {
    await writeFile(configPath, JSON.stringify({rules: 'repeated-alt-text'}))
    const cfg = await loadConfig(configPath, KNOWN)
    expect(cfg.ruleOverrides.size).toBe(0)
  })

  it('ignores top-level non-object JSON', async () => {
    await writeFile(configPath, JSON.stringify(['repeated-alt-text']))
    const cfg = await loadConfig(configPath, KNOWN)
    expect(cfg.ruleOverrides.size).toBe(0)
  })

  it('ignores top-level keys other than rules', async () => {
    await writeFile(configPath, JSON.stringify({somethingElse: {'vague-alt-text': false}}))
    const cfg = await loadConfig(configPath, KNOWN)
    expect(cfg.ruleOverrides.size).toBe(0)
  })
})
