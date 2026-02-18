// @vitest-environment node

import { mkdtempSync, mkdirSync, rmSync, writeFileSync } from 'node:fs'
import os from 'node:os'
import path from 'node:path'
import { describe, expect, it } from 'vitest'
import { detectPackageManager, getInstallCommand } from './cli-package-manager'

function withTempDir(run: (cwd: string) => void) {
  const cwd = mkdtempSync(path.join(os.tmpdir(), 'made-refine-cli-pm-'))
  try {
    run(cwd)
  } finally {
    rmSync(cwd, { recursive: true, force: true })
  }
}

function writeProjectFile(cwd: string, relativePath: string, contents: string) {
  const filePath = path.join(cwd, relativePath)
  mkdirSync(path.dirname(filePath), { recursive: true })
  writeFileSync(filePath, contents, 'utf-8')
}

describe('cli package manager helpers', () => {
  it('prefers packageManager field when present', () => {
    withTempDir((cwd) => {
      writeProjectFile(cwd, 'package.json', JSON.stringify({ packageManager: 'bun@1.3.8' }))
      expect(detectPackageManager(cwd)).toBe('bun')
    })
  })

  it('uses packageManager field over conflicting lockfiles', () => {
    withTempDir((cwd) => {
      writeProjectFile(cwd, 'package.json', JSON.stringify({ packageManager: 'pnpm@10.0.0' }))
      writeProjectFile(cwd, 'package-lock.json', '')
      expect(detectPackageManager(cwd)).toBe('pnpm')
    })
  })

  it('detects lockfiles in the current directory', () => {
    withTempDir((cwd) => {
      writeProjectFile(cwd, 'yarn.lock', '')
      expect(detectPackageManager(cwd)).toBe('yarn')
    })
  })

  it('detects lockfiles from parent directories', () => {
    withTempDir((cwd) => {
      writeProjectFile(cwd, 'pnpm-lock.yaml', '')
      const child = path.join(cwd, 'apps', 'web')
      mkdirSync(child, { recursive: true })
      expect(detectPackageManager(child)).toBe('pnpm')
    })
  })

  it('falls back to npm when no signal is found', () => {
    withTempDir((cwd) => {
      writeProjectFile(cwd, 'package.json', JSON.stringify({ name: 'example' }))
      expect(detectPackageManager(cwd)).toBe('npm')
    })
  })

  it('maps npm to the correct install command', () => {
    expect(getInstallCommand('npm')).toBe('npm install --save-dev made-refine@latest')
  })
})
