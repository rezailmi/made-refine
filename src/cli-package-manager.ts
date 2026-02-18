import fs from 'fs'
import path from 'path'

export type PackageManager = 'bun' | 'pnpm' | 'yarn' | 'npm'

function parsePackageManager(value: unknown): PackageManager | null {
  if (typeof value !== 'string') return null
  const normalized = value.trim().toLowerCase()

  if (normalized === 'bun' || normalized.startsWith('bun@')) return 'bun'
  if (normalized === 'pnpm' || normalized.startsWith('pnpm@')) return 'pnpm'
  if (normalized === 'yarn' || normalized.startsWith('yarn@')) return 'yarn'
  if (normalized === 'npm' || normalized.startsWith('npm@')) return 'npm'

  return null
}

function detectFromPackageJson(cwd: string): PackageManager | null {
  const packageJsonPath = path.join(cwd, 'package.json')
  if (!fs.existsSync(packageJsonPath)) return null

  try {
    const pkg = JSON.parse(fs.readFileSync(packageJsonPath, 'utf-8')) as { packageManager?: unknown }
    return parsePackageManager(pkg.packageManager)
  } catch {
    return null
  }
}

function detectFromLockfile(directory: string): PackageManager | null {
  if (fs.existsSync(path.join(directory, 'bun.lockb')) || fs.existsSync(path.join(directory, 'bun.lock'))) return 'bun'
  if (fs.existsSync(path.join(directory, 'pnpm-lock.yaml'))) return 'pnpm'
  if (fs.existsSync(path.join(directory, 'yarn.lock'))) return 'yarn'
  if (fs.existsSync(path.join(directory, 'package-lock.json')) || fs.existsSync(path.join(directory, 'npm-shrinkwrap.json'))) return 'npm'
  return null
}

export function detectPackageManager(cwd: string): PackageManager {
  const fromPackageJson = detectFromPackageJson(cwd)
  if (fromPackageJson) return fromPackageJson

  let current = path.resolve(cwd)
  while (true) {
    const fromLockfile = detectFromLockfile(current)
    if (fromLockfile) return fromLockfile

    const parent = path.dirname(current)
    if (parent === current) break
    current = parent
  }

  return 'npm'
}

export function getInstallCommand(pm: PackageManager): string {
  switch (pm) {
    case 'bun': return 'bun add -d made-refine@latest'
    case 'pnpm': return 'pnpm add -D made-refine@latest'
    case 'yarn': return 'yarn add -D made-refine@latest'
    case 'npm': return 'npm install --save-dev made-refine@latest'
  }
}
