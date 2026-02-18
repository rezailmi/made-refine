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

describe('cli init next babel setup integration', () => {
  beforeAll(() => {
    ensureDistCli()
  })

  it('does not create .babelrc when no Babel config exists', () => {
    withTempDir((cwd) => {
      writeNextPackageJson(cwd)

      const result = runInit(cwd)
      expect(result.status).toBe(0)
      expect(existsSync(path.join(cwd, '.babelrc'))).toBe(false)
      expect(result.stdout).toContain('No existing Babel config found')
    })
  })

  it('updates existing JSON .babelrc with made-refine/babel in development env', () => {
    withTempDir((cwd) => {
      writeNextPackageJson(cwd)
      writeFileSync(
        path.join(cwd, '.babelrc'),
        JSON.stringify(
          {
            presets: ['next/babel'],
          },
          null,
          2,
        ),
        'utf-8',
      )

      const result = runInit(cwd)
      expect(result.status).toBe(0)

      const babelConfig = JSON.parse(readFileSync(path.join(cwd, '.babelrc'), 'utf-8')) as {
        env?: { development?: { plugins?: Array<string | [string, unknown]> } }
      }

      expect(babelConfig.env?.development?.plugins).toBeDefined()
      expect(
        babelConfig.env?.development?.plugins?.some((plugin) =>
          typeof plugin === 'string' ? plugin === 'made-refine/babel' : plugin[0] === 'made-refine/babel'
        ),
      ).toBe(true)
    })
  })

  it('does not duplicate plugin when .babelrc already includes made-refine/babel', () => {
    withTempDir((cwd) => {
      writeNextPackageJson(cwd)
      writeFileSync(
        path.join(cwd, '.babelrc'),
        JSON.stringify(
          {
            presets: ['next/babel'],
            env: {
              development: {
                plugins: ['made-refine/babel'],
              },
            },
          },
          null,
          2,
        ),
        'utf-8',
      )

      const result = runInit(cwd)
      expect(result.status).toBe(0)

      const babelConfig = JSON.parse(readFileSync(path.join(cwd, '.babelrc'), 'utf-8')) as {
        env?: { development?: { plugins?: Array<string | [string, unknown]> } }
      }
      const count =
        babelConfig.env?.development?.plugins?.filter((plugin) =>
          typeof plugin === 'string' ? plugin === 'made-refine/babel' : plugin[0] === 'made-refine/babel'
        ).length ?? 0

      expect(count).toBe(1)
      expect(result.stdout).toContain('.babelrc — already configured')
    })
  })

  it('updates package.json#babel when project Babel config is stored there', () => {
    withTempDir((cwd) => {
      writeNextPackageJson(cwd, {
        babel: {
          presets: ['next/babel'],
        },
      })

      const result = runInit(cwd)
      expect(result.status).toBe(0)
      expect(result.stdout).toContain('Updated package.json#babel')

      const packageJson = JSON.parse(readFileSync(path.join(cwd, 'package.json'), 'utf-8')) as {
        babel?: { env?: { development?: { plugins?: Array<string | [string, unknown]> } } }
      }

      expect(packageJson.babel?.env?.development?.plugins).toBeDefined()
      expect(
        packageJson.babel?.env?.development?.plugins?.some((plugin) =>
          typeof plugin === 'string' ? plugin === 'made-refine/babel' : plugin[0] === 'made-refine/babel'
        ),
      ).toBe(true)
      expect(existsSync(path.join(cwd, '.babelrc'))).toBe(false)
    })
  })

  it('does not trust string matching for JS Babel config and asks for manual verification', () => {
    withTempDir((cwd) => {
      writeNextPackageJson(cwd)
      writeFileSync(
        path.join(cwd, '.babelrc.js'),
        `module.exports = {
  comments: ['made-refine/babel'],
}
`,
        'utf-8',
      )

      const result = runInit(cwd)
      expect(result.status).toBe(0)
      expect(result.stdout).toContain('.babelrc.js (JS Babel config) — verify/add plugin manually')
      expect(result.stdout).not.toContain('.babelrc.js — already configured')
    })
  })
})
