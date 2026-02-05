const path = require('path')

function isHostElement(name) {
  return /^[a-z]/.test(name)
}

module.exports = function directEditSourcePlugin({ types: t }) {
  return {
    name: 'direct-edit-source',
    visitor: {
      JSXOpeningElement(nodePath, state) {
        const { node } = nodePath
        if (!t.isJSXIdentifier(node.name)) return
        if (!isHostElement(node.name.name)) return

        const filename = state.file?.opts?.filename
        if (!filename) return

        const normalized = filename.replace(/\\/g, '/')
        if (normalized.includes('/node_modules/')) return
        if (normalized.includes('/node_modules/made-refine/')) return

        if (!node.loc?.start) return

        const hasAttribute = node.attributes.some((attr) => {
          return (
            t.isJSXAttribute(attr) &&
            t.isJSXIdentifier(attr.name, { name: 'data-direct-edit-source' })
          )
        })
        if (hasAttribute) return

        const relative = path.relative(process.cwd(), filename).replace(/\\/g, '/')
        const file = `/[project]/${relative}`
        const line = node.loc.start.line
        const column = node.loc.start.column + 1
        const value = `${file}:${line}:${column}`

        node.attributes.push(
          t.jsxAttribute(t.jsxIdentifier('data-direct-edit-source'), t.stringLiteral(value))
        )
      },
    },
  }
}
