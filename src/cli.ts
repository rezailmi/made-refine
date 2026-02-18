import { program } from 'commander'
import prompts from 'prompts'
import pc from 'picocolors'
import fs from 'fs'
import path from 'path'
import { execSync } from 'child_process'
import { detectPackageManager, getInstallCommand } from './cli-package-manager'

type Framework = 'next' | 'vite' | 'tanstack'

function detectFramework(cwd: string): Framework | null {
  const pkgPath = path.join(cwd, 'package.json')
  if (!fs.existsSync(pkgPath)) return null

  const pkg = JSON.parse(fs.readFileSync(pkgPath, 'utf-8'))
  const deps = { ...pkg.dependencies, ...pkg.devDependencies }

  if (deps['@tanstack/start'] || deps['@tanstack/react-start']) return 'tanstack'
  if (deps['next']) return 'next'
  if (deps['vite']) return 'vite'
  return null
}

function findFile(cwd: string, ...candidates: string[]): string | null {
  for (const c of candidates) {
    const full = path.join(cwd, c)
    if (fs.existsSync(full)) return full
  }
  return null
}

function showDiff(filePath: string, original: string, modified: string) {
  const relPath = path.relative(process.cwd(), filePath)
  console.log()
  console.log(pc.bold(`  Changes to ${relPath}:`))
  console.log()

  const origLines = original.split('\n')
  const modLines = modified.split('\n')

  // Simple line-by-line diff
  let oi = 0
  let mi = 0
  while (oi < origLines.length || mi < modLines.length) {
    if (oi < origLines.length && mi < modLines.length && origLines[oi] === modLines[mi]) {
      oi++
      mi++
      continue
    }
    // Find next common line
    let foundOi = -1
    let foundMi = -1
    outer: for (let ahead = 1; ahead < 20; ahead++) {
      for (let a = 0; a <= ahead; a++) {
        const b = ahead - a
        if (
          oi + a < origLines.length &&
          mi + b < modLines.length &&
          origLines[oi + a] === modLines[mi + b]
        ) {
          foundOi = oi + a
          foundMi = mi + b
          break outer
        }
      }
    }

    if (foundOi === -1) {
      // No match found, print remaining
      while (oi < origLines.length) {
        console.log(pc.red(`  - ${origLines[oi]}`))
        oi++
      }
      while (mi < modLines.length) {
        console.log(pc.green(`  + ${modLines[mi]}`))
        mi++
      }
    } else {
      while (oi < foundOi) {
        console.log(pc.red(`  - ${origLines[oi]}`))
        oi++
      }
      while (mi < foundMi) {
        console.log(pc.green(`  + ${modLines[mi]}`))
        mi++
      }
    }
  }
  console.log()
}

async function transformFile(
  filePath: string,
  transform: (content: string) => string | null,
): Promise<boolean> {
  const original = fs.readFileSync(filePath, 'utf-8')
  const modified = transform(original)

  if (modified === null || modified === original) {
    console.log(pc.dim(`  ${path.relative(process.cwd(), filePath)} — no changes needed`))
    return false
  }

  showDiff(filePath, original, modified)

  const { confirm } = await prompts({
    type: 'confirm',
    name: 'confirm',
    message: 'Apply changes?',
    initial: true,
  })

  if (confirm) {
    fs.writeFileSync(filePath, modified, 'utf-8')
    console.log(pc.green(`  ✓ Updated ${path.relative(process.cwd(), filePath)}`))
    return true
  }

  console.log(pc.dim('  Skipped'))
  return false
}

function installPackage(cwd: string) {
  console.log(pc.bold('\nInstalling made-refine...'))

  const pm = detectPackageManager(cwd)
  const cmd = getInstallCommand(pm)

  console.log(pc.dim(`  $ ${cmd}`))
  try {
    execSync(cmd, { cwd, stdio: 'inherit' })
    console.log(pc.green('  ✓ Installed'))
  } catch {
    console.log(pc.yellow('  ⚠ Install failed — you may need to install manually:'))
    console.log(pc.dim(`    ${cmd}`))
  }
}

// --- Next.js setup ---

const BABEL_JSON_CONFIG_FILES = ['.babelrc', '.babelrc.json', 'babel.config.json'] as const
const BABEL_JS_CONFIG_FILES = [
  '.babelrc.js',
  '.babelrc.cjs',
  '.babelrc.mjs',
  'babel.config.js',
  'babel.config.cjs',
  'babel.config.mjs',
] as const

type BabelConfigFile = {
  absolutePath: string
  relativePath: string
  kind: 'json' | 'js' | 'package-json'
}

function findBabelConfigFile(cwd: string): BabelConfigFile | null {
  for (const file of BABEL_JSON_CONFIG_FILES) {
    const absolutePath = path.join(cwd, file)
    if (fs.existsSync(absolutePath)) {
      return {
        absolutePath,
        relativePath: file,
        kind: 'json',
      }
    }
  }

  for (const file of BABEL_JS_CONFIG_FILES) {
    const absolutePath = path.join(cwd, file)
    if (fs.existsSync(absolutePath)) {
      return {
        absolutePath,
        relativePath: file,
        kind: 'js',
      }
    }
  }

  const packageJsonPath = path.join(cwd, 'package.json')
  if (fs.existsSync(packageJsonPath)) {
    try {
      const packageJson = JSON.parse(fs.readFileSync(packageJsonPath, 'utf-8')) as {
        babel?: unknown
      }
      if (packageJson.babel !== undefined) {
        return {
          absolutePath: packageJsonPath,
          relativePath: 'package.json#babel',
          kind: 'package-json',
        }
      }
    } catch {
      // Ignore invalid package.json parse here; main init flow validates package.json earlier.
    }
  }

  return null
}

function isMadeRefinePlugin(plugin: unknown): boolean {
  if (typeof plugin === 'string') {
    return plugin === 'made-refine/babel'
  }
  if (Array.isArray(plugin) && typeof plugin[0] === 'string') {
    return plugin[0] === 'made-refine/babel'
  }
  return false
}

function hasMadeRefinePlugin(plugins: unknown): boolean {
  if (!Array.isArray(plugins)) return false
  return plugins.some((plugin) => isMadeRefinePlugin(plugin))
}

type BabelEnsureResult = 'already-configured' | 'updated' | 'unsupported-shape'

function ensureMadeRefineInDevelopmentEnv(config: Record<string, unknown>): BabelEnsureResult {
  if (hasMadeRefinePlugin(config.plugins)) {
    return 'already-configured'
  }

  const existingEnv = config.env
  if (existingEnv !== undefined && (typeof existingEnv !== 'object' || existingEnv === null || Array.isArray(existingEnv))) {
    return 'unsupported-shape'
  }

  if (!config.env) {
    config.env = {}
  }

  const env = config.env as Record<string, unknown>
  const existingDevelopment = env.development
  if (
    existingDevelopment !== undefined &&
    (typeof existingDevelopment !== 'object' || existingDevelopment === null || Array.isArray(existingDevelopment))
  ) {
    return 'unsupported-shape'
  }

  if (!env.development) {
    env.development = {}
  }

  const development = env.development as Record<string, unknown>
  if (hasMadeRefinePlugin(development.plugins)) {
    return 'already-configured'
  }

  if (development.plugins === undefined) {
    development.plugins = ['made-refine/babel']
    return 'updated'
  }

  if (!Array.isArray(development.plugins)) {
    return 'unsupported-shape'
  }

  development.plugins = [...development.plugins, 'made-refine/babel']
  return 'updated'
}

function printManualNextBabelInstructions() {
  console.log(
    pc.dim(
      "    env: { development: { plugins: ['made-refine/babel'] } }\n    (or add 'made-refine/babel' in your existing Babel plugin list)",
    ),
  )
}

function configureNextBabel(cwd: string) {
  const configFile = findBabelConfigFile(cwd)

  if (!configFile) {
    console.log(
      pc.yellow('  ⚠ No existing Babel config found — skipping Babel config to preserve SWC/Turbopack defaults.'),
    )
    console.log(pc.dim('    Source detection will use React fiber fallback (less precise than Babel attributes).'))
    return
  }

  if (configFile.kind === 'js') {
    console.log(pc.yellow(`  ⚠ Found ${configFile.relativePath} (JS Babel config) — verify/add plugin manually:`))
    printManualNextBabelInstructions()
    return
  }

  if (configFile.kind === 'package-json') {
    let packageJson: unknown
    try {
      packageJson = JSON.parse(fs.readFileSync(configFile.absolutePath, 'utf-8'))
    } catch {
      console.log(pc.yellow('  ⚠ Could not parse package.json — add plugin manually:'))
      printManualNextBabelInstructions()
      return
    }

    if (typeof packageJson !== 'object' || packageJson === null || Array.isArray(packageJson)) {
      console.log(pc.yellow('  ⚠ package.json has unsupported shape — add plugin manually:'))
      printManualNextBabelInstructions()
      return
    }

    const pkg = packageJson as Record<string, unknown>
    if (typeof pkg.babel !== 'object' || pkg.babel === null || Array.isArray(pkg.babel)) {
      console.log(pc.yellow('  ⚠ package.json#babel has unsupported shape — add plugin manually:'))
      printManualNextBabelInstructions()
      return
    }

    const result = ensureMadeRefineInDevelopmentEnv(pkg.babel as Record<string, unknown>)
    if (result === 'already-configured') {
      console.log(pc.dim('  package.json#babel — already configured'))
      return
    }

    if (result === 'unsupported-shape') {
      console.log(pc.yellow('  ⚠ package.json#babel has unsupported shape — add plugin manually:'))
      printManualNextBabelInstructions()
      return
    }

    fs.writeFileSync(configFile.absolutePath, `${JSON.stringify(pkg, null, 2)}\n`, 'utf-8')
    console.log(pc.green('  ✓ Updated package.json#babel (added "made-refine/babel" in development env)'))
    return
  }

  const content = fs.readFileSync(configFile.absolutePath, 'utf-8')

  let parsed: unknown
  try {
    parsed = JSON.parse(content)
  } catch {
    console.log(pc.yellow(`  ⚠ Could not parse ${configFile.relativePath} as JSON — add plugin manually:`))
    printManualNextBabelInstructions()
    return
  }

  if (typeof parsed !== 'object' || parsed === null || Array.isArray(parsed)) {
    console.log(pc.yellow(`  ⚠ ${configFile.relativePath} has unsupported shape — add plugin manually:`))
    printManualNextBabelInstructions()
    return
  }

  const result = ensureMadeRefineInDevelopmentEnv(parsed as Record<string, unknown>)
  if (result === 'already-configured') {
    console.log(pc.dim(`  ${configFile.relativePath} — already configured`))
    return
  }

  if (result === 'unsupported-shape') {
    console.log(pc.yellow(`  ⚠ ${configFile.relativePath} has unsupported shape — add plugin manually:`))
    printManualNextBabelInstructions()
    return
  }

  fs.writeFileSync(configFile.absolutePath, `${JSON.stringify(parsed, null, 2)}\n`, 'utf-8')
  console.log(pc.green(`  ✓ Updated ${configFile.relativePath} (added "made-refine/babel" in development env)`))
}

async function setupNextJs(cwd: string) {
  console.log(pc.bold('\nConfiguring for Next.js...\n'))

  // 1. Use existing Babel config (if present)
  configureNextBabel(cwd)

  // 2. Copy preload script
  const preloadSrc = path.join(cwd, 'node_modules/made-refine/dist/preload/preload.js')
  const publicDir = path.join(cwd, 'public')
  const preloadDest = path.join(publicDir, 'made-refine-preload.js')

  if (!fs.existsSync(publicDir)) {
    fs.mkdirSync(publicDir, { recursive: true })
  }

  if (fs.existsSync(preloadSrc)) {
    fs.copyFileSync(preloadSrc, preloadDest)
    console.log(pc.green('  ✓ Copied preload script to public/made-refine-preload.js'))
  } else {
    console.log(pc.yellow('  ⚠ Preload script not found. After install, run:'))
    console.log(pc.dim('    cp node_modules/made-refine/dist/preload/preload.js public/made-refine-preload.js'))
  }

  // 3. Transform layout file
  const layoutFile = findFile(cwd, 'app/layout.tsx', 'app/layout.jsx', 'src/app/layout.tsx', 'src/app/layout.jsx')

  if (!layoutFile) {
    console.log(pc.yellow('\n  Could not find app/layout.tsx — add manually:'))
    printNextLayoutInstructions()
    return
  }

  const content = fs.readFileSync(layoutFile, 'utf-8')
  if (content.includes('made-refine')) {
    console.log(pc.dim(`  ${path.relative(cwd, layoutFile)} — already configured`))
    return
  }

  const transformed = await transformFile(layoutFile, (src) => {
    let result = src

    // Add imports
    const importLines: string[] = []
    if (!result.includes("from 'next/script'") && !result.includes('from "next/script"')) {
      importLines.push(`import Script from 'next/script'`)
    }
    importLines.push(`import { DirectEdit } from 'made-refine'`)

    if (importLines.length > 0) {
      // Insert after last import
      const lastImportIdx = result.lastIndexOf('\nimport ')
      if (lastImportIdx !== -1) {
        const endOfLine = result.indexOf('\n', lastImportIdx + 1)
        result = result.slice(0, endOfLine + 1) + importLines.join('\n') + '\n' + result.slice(endOfLine + 1)
      } else {
        result = importLines.join('\n') + '\n' + result
      }
    }

    // Insert Script in <head>
    const selfClosingHead = result.match(/<head(?:\s[^>]*)?\/>/)
    if (selfClosingHead) {
      // Convert <head /> to <head>...<Script />...</head>
      const headIdx = result.indexOf(selfClosingHead[0])
      const replacement = `<head>\n        {process.env.NODE_ENV === 'development' && (\n          <Script src="/made-refine-preload.js" strategy="beforeInteractive" />\n        )}\n      </head>`
      result = result.slice(0, headIdx) + replacement + result.slice(headIdx + selfClosingHead[0].length)
    } else {
      const headMatch = result.match(/<head(?:\s[^>]*)?>/)
      if (headMatch) {
        const headIdx = result.indexOf(headMatch[0]) + headMatch[0].length
        const scriptTag = `\n        {process.env.NODE_ENV === 'development' && (\n          <Script src="/made-refine-preload.js" strategy="beforeInteractive" />\n        )}`
        result = result.slice(0, headIdx) + scriptTag + result.slice(headIdx)
      }
    }

    // Insert DirectEdit before </body>
    const bodyCloseIdx = result.lastIndexOf('</body>')
    if (bodyCloseIdx !== -1) {
      const lineStart = result.lastIndexOf('\n', bodyCloseIdx) + 1
      const lineContent = result.slice(lineStart, bodyCloseIdx)
      // Check if </body> is on the same line as other content (e.g., <body>{children}</body>)
      if (lineContent.trim().length > 0 && lineContent.includes('<body')) {
        // Split into separate lines
        const indent = lineContent.match(/^(\s*)/)?.[1] ?? '      '
        const bodyOpenMatch = lineContent.match(/<body[^>]*>/)
        if (bodyOpenMatch) {
          const bodyOpenEnd = lineContent.indexOf(bodyOpenMatch[0]) + bodyOpenMatch[0].length
          const bodyContent = lineContent.slice(bodyOpenEnd)
          const replacement =
            `${indent}${bodyOpenMatch[0]}\n` +
            `${indent}  ${bodyContent.trim()}\n` +
            `${indent}  {process.env.NODE_ENV === 'development' && <DirectEdit />}\n` +
            `${indent}`
          result = result.slice(0, lineStart) + replacement + result.slice(bodyCloseIdx)
        }
      } else {
        const indent = lineContent.match(/^(\s*)/)?.[1] ?? '      '
        const directEdit = `${indent}  {process.env.NODE_ENV === 'development' && <DirectEdit />}\n`
        result = result.slice(0, lineStart) + directEdit + result.slice(lineStart)
      }
    }

    return result === src ? null : result
  })

  if (!transformed) {
    console.log(pc.yellow('\n  Could not auto-modify layout. Add manually:'))
    printNextLayoutInstructions()
  }
}

function printNextLayoutInstructions() {
  console.log(pc.dim(`
    import Script from 'next/script'
    import { DirectEdit } from 'made-refine'

    // In <head>:
    {process.env.NODE_ENV === 'development' && (
      <Script src="/made-refine-preload.js" strategy="beforeInteractive" />
    )}

    // Before </body>:
    {process.env.NODE_ENV === 'development' && <DirectEdit />}
  `))
}

// --- Vite setup ---

async function setupVite(cwd: string) {
  console.log(pc.bold('\nConfiguring for Vite...\n'))

  // 1. Transform vite.config
  const viteConfig = findFile(cwd, 'vite.config.ts', 'vite.config.js', 'vite.config.mts', 'vite.config.mjs')

  if (!viteConfig) {
    console.log(pc.yellow('  Could not find vite.config — add manually:'))
    printViteConfigInstructions()
    return
  }

  const viteContent = fs.readFileSync(viteConfig, 'utf-8')
  if (viteContent.includes('made-refine')) {
    console.log(pc.dim(`  ${path.relative(cwd, viteConfig)} — already configured`))
  } else {
    await transformFile(viteConfig, (src) => transformViteConfig(src))
  }

  // 2. Transform root component
  const appFile = findFile(
    cwd,
    'src/App.tsx',
    'src/App.jsx',
    'src/app.tsx',
    'src/app.jsx',
    'src/main.tsx',
    'src/main.jsx',
    'app/App.tsx',
    'app/App.jsx',
  )

  if (!appFile) {
    console.log(pc.yellow('\n  Could not find root component — add manually:'))
    printViteComponentInstructions()
    return
  }

  const appContent = fs.readFileSync(appFile, 'utf-8')
  if (appContent.includes('made-refine')) {
    console.log(pc.dim(`  ${path.relative(cwd, appFile)} — already configured`))
    return
  }

  const transformed = await transformFile(appFile, (src) => {
    let result = src

    // Add import
    const lastImportIdx = result.lastIndexOf('\nimport ')
    if (lastImportIdx !== -1) {
      const endOfLine = result.indexOf('\n', lastImportIdx + 1)
      result =
        result.slice(0, endOfLine + 1) +
        `import { DirectEdit } from 'made-refine'\n` +
        result.slice(endOfLine + 1)
    } else {
      result = `import { DirectEdit } from 'made-refine'\n` + result
    }

    // Try to insert before closing fragment, div, or similar
    const closingPatterns = ['</>', '</div>', '</main>', '</App>']
    for (const pattern of closingPatterns) {
      const lastIdx = result.lastIndexOf(pattern)
      if (lastIdx !== -1) {
        const lineStart = result.lastIndexOf('\n', lastIdx) + 1
        const lineIndent = result.slice(lineStart, lastIdx).match(/^(\s*)/)?.[1] ?? ''
        const childIndent = lineIndent + '  '
        result =
          result.slice(0, lineStart) +
          `${childIndent}{import.meta.env.DEV && <DirectEdit />}\n` +
          result.slice(lineStart)
        return result
      }
    }

    return null
  })

  if (!transformed) {
    console.log(pc.yellow('\n  Could not auto-modify root component. Add manually:'))
    printViteComponentInstructions()
  }
}

function transformViteConfig(src: string): string | null {
  let result = src

  // Add import
  const lastImportIdx = result.lastIndexOf('\nimport ')
  if (lastImportIdx !== -1) {
    const endOfLine = result.indexOf('\n', lastImportIdx + 1)
    result =
      result.slice(0, endOfLine + 1) +
      `import { madeRefine } from 'made-refine/vite'\n` +
      result.slice(endOfLine + 1)
  } else {
    result = `import { madeRefine } from 'made-refine/vite'\n` + result
  }

  // Add babel config to react() if it has no args
  const reactNoArgs = /react\(\s*\)/
  if (reactNoArgs.test(result)) {
    result = result.replace(
      reactNoArgs,
      `react({\n      babel: {\n        plugins: ['made-refine/babel'],\n      },\n    })`,
    )
  } else if (result.includes('react(')) {
    // react() already has config — warn user
    console.log(
      pc.yellow("  ⚠ react() plugin already has config — add babel plugin manually:\n    babel: { plugins: ['made-refine/babel'] }"),
    )
  }

  // Add madeRefine() to plugins array — find the matching ] by counting bracket depth
  const pluginsMatch = result.match(/plugins\s*:\s*\[/)
  if (pluginsMatch) {
    const pluginsIdx = result.indexOf(pluginsMatch[0])
    const openBracket = pluginsIdx + pluginsMatch[0].length - 1
    let depth = 1
    let closingIdx = -1
    for (let i = openBracket + 1; i < result.length; i++) {
      if (result[i] === '[') depth++
      else if (result[i] === ']') {
        depth--
        if (depth === 0) {
          closingIdx = i
          break
        }
      }
    }
    if (closingIdx !== -1) {
      // Find the last non-whitespace char before the closing ]
      let insertAt = closingIdx
      while (insertAt > 0 && /\s/.test(result[insertAt - 1])) insertAt--
      const lastChar = result[insertAt - 1]
      const needsComma = lastChar !== '[' && lastChar !== ','
      result =
        result.slice(0, insertAt) +
        (needsComma ? ',' : '') +
        '\n    madeRefine(),\n  ' +
        result.slice(closingIdx)
    }
  }

  return result === src ? null : result
}

function printViteConfigInstructions() {
  console.log(pc.dim(`
    import { madeRefine } from 'made-refine/vite'

    // In plugins array:
    react({ babel: { plugins: ['made-refine/babel'] } }),
    madeRefine(),
  `))
}

function printViteComponentInstructions() {
  console.log(pc.dim(`
    import { DirectEdit } from 'made-refine'

    // In your root component JSX:
    {import.meta.env.DEV && <DirectEdit />}
  `))
}

// --- TanStack Start setup ---

async function setupTanStack(cwd: string) {
  console.log(pc.bold('\nConfiguring for TanStack Start...\n'))

  // 1. Transform vite.config (same as Vite SPA)
  const viteConfig = findFile(cwd, 'vite.config.ts', 'vite.config.js', 'vite.config.mts', 'vite.config.mjs')

  if (!viteConfig) {
    console.log(pc.yellow('  Could not find vite.config — add manually:'))
    printViteConfigInstructions()
  } else {
    const viteContent = fs.readFileSync(viteConfig, 'utf-8')
    if (viteContent.includes('made-refine')) {
      console.log(pc.dim(`  ${path.relative(cwd, viteConfig)} — already configured`))
    } else {
      await transformFile(viteConfig, (src) => transformViteConfig(src))
    }
  }

  // 2. Transform root layout
  const rootFile = findFile(
    cwd,
    'src/routes/__root.tsx',
    'src/routes/__root.jsx',
    'app/routes/__root.tsx',
    'app/routes/__root.jsx',
  )

  if (!rootFile) {
    console.log(pc.yellow('\n  Could not find root layout — add manually:'))
    printTanStackInstructions()
    return
  }

  const rootContent = fs.readFileSync(rootFile, 'utf-8')
  if (rootContent.includes('made-refine')) {
    console.log(pc.dim(`  ${path.relative(cwd, rootFile)} — already configured`))
    return
  }

  const transformed = await transformFile(rootFile, (src) => {
    let result = src

    // Add lazy import + Suspense import
    const lastImportIdx = result.lastIndexOf('\nimport ')
    const lazyImport = `import { lazy, Suspense } from 'react'\n\nconst DirectEdit = lazy(() =>\n  import('made-refine').then((m) => ({ default: m.DirectEdit }))\n)`

    if (lastImportIdx !== -1) {
      const endOfLine = result.indexOf('\n', lastImportIdx + 1)
      result = result.slice(0, endOfLine + 1) + lazyImport + '\n' + result.slice(endOfLine + 1)
    } else {
      result = lazyImport + '\n' + result
    }

    // Check if lazy/Suspense already imported from react
    if (src.includes("from 'react'") || src.includes('from "react"')) {
      // Already has react import — might need to merge
      // For simplicity, add separately and let user clean up if needed
    }

    // Insert before </body>
    const bodyCloseIdx = result.lastIndexOf('</body>')
    if (bodyCloseIdx !== -1) {
      const bodyLineStart = result.lastIndexOf('\n', bodyCloseIdx) + 1
      const bodyIndent = result.slice(bodyLineStart, bodyCloseIdx).match(/^(\s*)/)?.[1] ?? ''
      const childIndent = bodyIndent + '  '
      const innerIndent = childIndent + '  '
      const directEdit =
        `${childIndent}{import.meta.env.DEV && typeof window !== 'undefined' && (\n` +
        `${innerIndent}<Suspense>\n` +
        `${innerIndent}  <DirectEdit />\n` +
        `${innerIndent}</Suspense>\n` +
        `${childIndent})}\n`
      result = result.slice(0, bodyLineStart) + directEdit + result.slice(bodyLineStart)
    } else {
      // Try closing Outlet pattern
      return null
    }

    return result === src ? null : result
  })

  if (!transformed) {
    console.log(pc.yellow('\n  Could not auto-modify root layout. Add manually:'))
    printTanStackInstructions()
  }
}

function printTanStackInstructions() {
  console.log(pc.dim(`
    import { lazy, Suspense } from 'react'

    const DirectEdit = lazy(() =>
      import('made-refine').then((m) => ({ default: m.DirectEdit }))
    )

    // Before </body>:
    {import.meta.env.DEV && typeof window !== 'undefined' && (
      <Suspense>
        <DirectEdit />
      </Suspense>
    )}
  `))
}

// --- Helpers ---

function getIndent(text: string, offset: number): string {
  const lineStart = text.lastIndexOf('\n', offset) + 1
  const line = text.slice(lineStart, offset)
  const match = line.match(/^(\s*)/)
  return match ? match[1] + '  ' : '  '
}

// --- Main ---

async function init() {
  const cwd = process.cwd()

  console.log(pc.bold('\nmade-refine init\n'))

  // Check for package.json
  if (!fs.existsSync(path.join(cwd, 'package.json'))) {
    console.log(pc.red('No package.json found. Run this command from your project root.'))
    process.exit(1)
  }

  // Detect framework
  let framework = detectFramework(cwd)

  if (framework) {
    const frameworkNames: Record<Framework, string> = {
      next: 'Next.js',
      vite: 'Vite',
      tanstack: 'TanStack Start',
    }
    console.log(pc.green(`  Detected: ${frameworkNames[framework]}`))
  } else {
    const { selected } = await prompts({
      type: 'select',
      name: 'selected',
      message: 'Which framework are you using?',
      choices: [
        { title: 'Next.js', value: 'next' },
        { title: 'Vite', value: 'vite' },
        { title: 'TanStack Start', value: 'tanstack' },
      ],
    })

    if (!selected) {
      console.log(pc.dim('Cancelled'))
      process.exit(0)
    }

    framework = selected as Framework
  }

  // Install package
  await installPackage(cwd)

  // Framework-specific setup
  switch (framework) {
    case 'next':
      await setupNextJs(cwd)
      break
    case 'vite':
      await setupVite(cwd)
      break
    case 'tanstack':
      await setupTanStack(cwd)
      break
  }

  console.log(pc.bold(pc.green('\n✓ Setup complete!')))
  console.log(pc.dim('  Start your dev server and press Cmd+. (Ctrl+.) to toggle the editor.\n'))
}

program
  .name('made-refine')
  .description('Visual CSS editor for React')
  .version('0.1.0')

program
  .command('init')
  .description('Set up made-refine in your project')
  .action(init)

program.parse()
