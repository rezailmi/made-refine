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
  const cwd = mkdtempSync(path.join(os.tmpdir(), 'made-refine-cli-init-'))
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

function runInitAndReadInstallLog(projectDir: string): string[] {
  const binDir = path.join(projectDir, '.bin-stubs')
  const logPath = path.join(projectDir, '.pm.log')
  makeStubPmBins(binDir)

  const env = {
    ...process.env,
    PATH: `${binDir}:${process.env.PATH ?? ''}`,
    PM_LOG_FILE: logPath,
  }

  const result = spawnSync(process.execPath, [cliDistPath, 'init'], {
    cwd: projectDir,
    env,
    encoding: 'utf8',
  })

  if (result.status !== 0) {
    throw new Error(`CLI exited with ${result.status}\nstdout:\n${result.stdout}\nstderr:\n${result.stderr}`)
  }

  const log = readFileSync(logPath, 'utf-8').trim()
  return log ? log.split('\n') : []
}

describe('cli init install command integration', () => {
  beforeAll(() => {
    ensureDistCli()
  })

  it('uses packageManager from package.json during init', () => {
    withTempDir((cwd) => {
      writeFileSync(
        path.join(cwd, 'package.json'),
        JSON.stringify(
          {
            name: 'fixture',
            packageManager: 'bun@1.3.8',
            dependencies: { vite: '^7.0.0' },
          },
          null,
          2,
        ),
        'utf-8',
      )

      const commands = runInitAndReadInstallLog(cwd)
      expect(commands[0]).toBe('bun add -d made-refine@latest')
    })
  })

  it('uses parent lockfile when project has no packageManager/lockfile', () => {
    withTempDir((cwd) => {
      writeFileSync(path.join(cwd, 'pnpm-lock.yaml'), '', 'utf-8')

      const appDir = path.join(cwd, 'apps', 'web')
      mkdirSync(appDir, { recursive: true })
      writeFileSync(
        path.join(appDir, 'package.json'),
        JSON.stringify(
          {
            name: 'fixture',
            dependencies: { vite: '^7.0.0' },
          },
          null,
          2,
        ),
        'utf-8',
      )

      const commands = runInitAndReadInstallLog(appDir)
      expect(commands[0]).toBe('pnpm add -D made-refine@latest')
    })
  })
})
