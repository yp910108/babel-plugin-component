const assert = require('assert')
const Plugin = require('./Plugin')

module.exports = function ({ types }) {
  let plugin = null

  global.__clearBabelPluginComponent = () => {
    plugin = null
  }

  function applyInstance(method, path, state) {
    if (plugin[method]) {
      plugin[method](path, state)
    }
  }

  const Program = {
    enter(path, state) {
      if (!plugin) {
        const { libraryName, style, stylePathElement, stylePath } = state.opts
        assert(libraryName, 'libraryName should be provided')
        plugin = new Plugin(libraryName, style, stylePathElement, stylePath, types)
      }
      applyInstance('ProgramEnter', path, state)
    },
    exit(path, state) {
      applyInstance('ProgramExit', path, state)
    }
  }

  const methods = [
    'ImportDeclaration',
    'CallExpression',
    'MemberExpression',
    'Property',
    'VariableDeclarator',
    'ArrayExpression',
    'LogicalExpression',
    'ConditionalExpression',
    'IfStatement',
    'ExpressionStatement',
    'ReturnStatement',
    'ExportDefaultDeclaration',
    'BinaryExpression',
    'NewExpression',
    'ClassDeclaration',
    'SwitchStatement',
    'SwitchCase'
  ]

  const ret = {
    visitor: { Program }
  }

  for (const method of methods) {
    ret.visitor[method] = function (path, state) {
      applyInstance(method, path, state)
    }
  }

  return ret
}
