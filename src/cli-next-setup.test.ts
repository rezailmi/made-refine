// @vitest-environment node

import { execSync, spawnSync } from 'node:child_process'
import { chmodSync, existsSync, mkdtempSync, mkdirSync, readFileSync, rmSync, writeFileSync } from 'node:fs'
import os from 'node:os'
import path from 'node:path'
import { beforeAll, describe, expect, it } from 'vitest'

const root = process.cwd()
const cliDistPath = path.join(root, 'dist/cli.cjs')

function ensureDistCli() {
  if (existsSync(cliDistPath)) return
  execSync('npm run -s build', { cwd: root, stdio: 'pipe' })
}

function withTempDir(run: (cwd: string) => void) {
  const cwd = mkdtempSync(path.join(os.tmpdir(), 'made-refine-cli-next-'))
  try {
    run(cwd)
  } finally {
    rmSync(cwd, { recursive: true, force: true })
  }
}

function makeStubPmBins(binDir: string) {
  mkdirSync(binDir, { recursive: true })

  const stub = `#!/bin/sh
echo "$(basename "$0") $@" >> "$PM_LOG_FILE"
exit 0
`

  for (const name of ['bun', 'pnpm', 'yarn', 'npm']) {
    const scriptPath = path.join(binDir, name)
    writeFileSync(scriptPath, stub, 'utf-8')
    chmodSync(scriptPath, 0o755)
  }
}

function writeNextPackageJson(cwd: string, overrides?: Record<string, unknown>) {
  writeFileSync(
    path.join(cwd, 'package.json'),
    JSON.stringify(
      {
        name: 'fixture-next',
        version: '0.0.0',
        dependencies: {
          next: '^15.0.0',
        },
        ...overrides,
      },
      null,
      2,
    ),
    'utf-8',
  )
}

function runInit(projectDir: string) {
  const binDir = path.join(projectDir, '.bin-stubs')
  const logPath = path.join(projectDir, '.pm.log')
  makeStubPmBins(binDir)

  return spawnSync(process.execPath, [cliDistPath, 'init'], {
    cwd: projectDir,
    env: {
      ...process.env,
      PATH: `${binDir}:${process.env.PATH ?? ''}`,
      PM_LOG_FILE: logPath,
    },
    encoding: 'utf8',
  })
}

describe('cli init next setup integration', () => {
  beforeAll(() => {
    ensureDistCli()
  })

  it('does not touch or mention .babelrc', () => {
    withTempDir((cwd) => {
      writeNextPackageJson(cwd)
      writeFileSync(path.join(cwd, '.babelrc'), JSON.stringify({ presets: ['next/babel'] }, null, 2), 'utf-8')

      const result = runInit(cwd)
      expect(result.status).toBe(0)
      expect(result.stdout).not.toContain('babel')
      expect(result.stdout).not.toContain('Babel')
      // .babelrc should be left untouched
      const babelConfig = JSON.parse(readFileSync(path.join(cwd, '.babelrc'), 'utf-8'))
      expect(babelConfig).toEqual({ presets: ['next/babel'] })
    })
  })

  it('detects Next.js and runs setup', () => {
    withTempDir((cwd) => {
      writeNextPackageJson(cwd)

      const result = runInit(cwd)
      expect(result.status).toBe(0)
      expect(result.stdout).toContain('Detected: Next.js')
      expect(result.stdout).toContain('Configuring for Next.js')
      expect(existsSync(path.join(cwd, '.babelrc'))).toBe(false)
    })
  })
})
