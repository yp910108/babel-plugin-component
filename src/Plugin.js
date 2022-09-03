const { join } = require('path')
const { addSideEffect, addDefault } = require('@babel/helper-module-imports')

function transCamel(_str, symbol) {
  const str = _str[0].toLowerCase() + _str.substr(1)
  return str.replace(/([A-Z])/g, ($1) => `${symbol}${$1.toLowerCase()}`)
}

function winPath(path) {
  return path.replace(/\\/g, '/')
}

module.exports = class Plugin {
  constructor(libraryName, style, stylePathElement, stylePath, types) {
    this.libraryName = libraryName
    this.style = typeof style === 'undefined' ? true : !!style
    this.stylePathElement = stylePathElement
    this.stylePath = stylePath
    this.types = types
    this.state = {
      specified: Object.create(null),
      libraryObjs: Object.create(null),
      selectedMethods: Object.create(null),
      pathsToRemove: []
    }
  }

  importMethodElement(methodName, file) {
    const transformedMethodName = transCamel(methodName, '-')
    if (
      ![
        'Loading',
        'Message',
        'MessageBox',
        'Notification',
        'ProTable',
        'TreeSelect',
        'ListSelect',
        'ListSelectPane'
      ].includes(methodName)
    ) {
      const path = winPath(join('element-ui', 'lib', `${transformedMethodName}.js`))
      const identifier = addDefault(file.path, path, {
        nameHint: methodName
      })
      const { body } = file.path.node || {}
      if (!!body && !!body.length) {
        for (let i = body.length - 1; i >= 0; i--) {
          if (body[i].type === 'ImportDeclaration') {
            return body.splice(
              i + 1,
              0,
              this.types.expressionStatement(
                this.types.callExpression(
                  this.types.memberExpression(this.types.identifier('Vue'), this.types.identifier('use')),
                  [identifier]
                )
              )
            )
          }
        }
      }
    }
    if (!['ProTable', 'TreeSelect', 'ListSelect', 'ListSelectPane'].includes(methodName)) {
      if (this.style) {
        const stylePath = winPath(
          this.stylePathElement && typeof this.stylePathElement === 'function'
            ? this.stylePathElement(transformedMethodName)
            : join('element-ui', 'lib/theme-chalk', `${transformedMethodName}.css`)
        )
        addSideEffect(file.path, `${stylePath}`)
      }
    }
  }

  importMethod(methodName, file) {
    if (!this.state.selectedMethods[methodName]) {
      const transformedMethodName = transCamel(methodName, '-')
      const path = winPath(join(this.libraryName, 'lib', `${transformedMethodName}.js`))
      this.state.selectedMethods[methodName] = addDefault(file.path, path, {
        nameHint: methodName
      })
      if (this.style) {
        const stylePath = winPath(
          this.style && typeof this.stylePath === 'function'
            ? this.stylePath(transformedMethodName)
            : join(this.libraryName, 'lib/theme', `${transformedMethodName}.css`)
        )
        addSideEffect(file.path, `${stylePath}`)
      }
      this.importMethodElement(methodName, file)
    }
    return { ...this.state.selectedMethods[methodName] }
  }

  buildExpressionHandler(node, props, path, state) {
    const file = (path && path.hub && path.hub.file) || (state && state.file)
    const { types } = this
    props.forEach((prop) => {
      if (!types.isIdentifier(node[prop])) return
      if (
        this.state.specified[node[prop].name] &&
        types.isImportSpecifier(path.scope.getBinding(node[prop].name).path)
      ) {
        node[prop] = this.importMethod(this.state.specified[node[prop].name], file)
      }
    })
  }

  buildDeclaratorHandler(node, prop, path, state) {
    const file = (path && path.hub && path.hub.file) || (state && state.file)
    const { types } = this
    const checkScope = (targetNode) =>
      this.state.specified[targetNode.name] &&
      path.scope.hasBinding(targetNode.name) &&
      path.scope.getBinding(targetNode.name).path.type === 'ImportSpecifier'
    if (types.isIdentifier(node[prop]) && checkScope(node[prop])) {
      node[prop] = this.importMethod(this.state.specified[node[prop].name], file)
    } else if (types.isSequenceExpression(node[prop])) {
      node[prop].expressions.forEach((expressionNode, index) => {
        if (types.isIdentifier(expressionNode) && checkScope(expressionNode)) {
          node[prop].expressions[index] = this.importMethod(this.state.specified[expressionNode.name], file)
        }
      })
    }
  }

  ProgramEnter() {
    this.state = {
      specified: Object.create(null),
      libraryObjs: Object.create(null),
      selectedMethods: Object.create(null),
      pathsToRemove: []
    }
  }

  ProgramExit(path, state) {
    if (this.style) {
      const file = (path && path.hub && path.hub.file) || (state && state.file)
      const stylePathBase = winPath(
        this.stylePathElement && typeof this.stylePathElement === 'function'
          ? this.stylePathElement('base')
          : join('element-ui', 'lib/theme-chalk', 'base.css')
      )
      addSideEffect(file.path, `${stylePathBase}`)
    }
    this.state.pathsToRemove.forEach((p) => !p.removed && p.remove())
  }

  ImportDeclaration(path) {
    const { node } = path
    if (!node) return
    const { value } = node.source
    const { libraryName } = this
    const { types } = this
    if (value === libraryName) {
      node.specifiers.forEach((spec) => {
        if (types.isImportSpecifier(spec)) {
          this.state.specified[spec.local.name] = spec.imported.name
        } else {
          this.state.libraryObjs[spec.local.name] = true
        }
      })
      this.state.pathsToRemove.push(path)
    }
  }

  CallExpression(path, state) {
    const { node } = path
    const file = (path && path.hub && path.hub.file) || (state && state.file)
    const { name } = node.callee
    const { types } = this
    if (types.isIdentifier(node.callee)) {
      if (this.state.specified[name]) {
        node.callee = this.importMethod(this.state.specified[name], file)
      }
    }
    node.arguments = node.arguments.map((arg) => {
      const { name: argName } = arg
      if (
        this.state.specified[argName] &&
        path.scope.hasBinding(argName) &&
        path.scope.getBinding(argName).path.type === 'ImportSpecifier'
      ) {
        return this.importMethod(this.state.specified[argName], file)
      }
      return arg
    })
  }

  MemberExpression(path, state) {
    const { node } = path
    const file = (path && path.hub && path.hub.file) || (state && state.file)
    if (!node.object || !node.object.name) return
    if (this.state.libraryObjs[node.object.name]) {
      path.replaceWith(this.importMethod(node.property.name, file))
    } else if (this.state.specified[node.object.name] && path.scope.hasBinding(node.object.name)) {
      const { scope } = path.scope.getBinding(node.object.name)
      if (scope.path.parent.type === 'File') {
        node.object = this.importMethod(this.state.specified[node.object.name], file)
      }
    }
  }

  Property(path, state) {
    const { node } = path
    this.buildDeclaratorHandler(node, 'value', path, state)
  }

  VariableDeclarator(path, state) {
    const { node } = path
    this.buildDeclaratorHandler(node, 'init', path, state)
  }

  ArrayExpression(path, state) {
    const { node } = path
    const props = node.elements.map((_, index) => index)
    this.buildExpressionHandler(node.elements, props, path, state)
  }

  LogicalExpression(path, state) {
    const { node } = path
    this.buildExpressionHandler(node, ['left', 'right'], path, state)
  }

  ConditionalExpression(path, state) {
    const { node } = path
    this.buildExpressionHandler(node, ['test', 'consequent', 'alternate'], path, state)
  }

  IfStatement(path, state) {
    const { node } = path
    this.buildExpressionHandler(node, ['test'], path, state)
    this.buildExpressionHandler(node.test, ['left', 'right'], path, state)
  }

  ExpressionStatement(path, state) {
    const { node } = path
    const { types } = this
    if (types.isAssignmentExpression(node.expression)) {
      this.buildExpressionHandler(node.expression, ['right'], path, state)
    }
  }

  ReturnStatement(path, state) {
    const { node } = path
    this.buildExpressionHandler(node, ['argument'], path, state)
  }

  ExportDefaultDeclaration(path, state) {
    const { node } = path
    this.buildExpressionHandler(node, ['declaration'], path, state)
  }

  BinaryExpression(path, state) {
    const { node } = path
    this.buildExpressionHandler(node, ['left', 'right'], path, state)
  }

  NewExpression(path, state) {
    const { node } = path
    this.buildExpressionHandler(node, ['callee'], path, state)

    const argumentsProps = node.arguments.map((_, index) => index)
    this.buildExpressionHandler(node.arguments, argumentsProps, path, state)
  }

  SwitchStatement(path, state) {
    const { node } = path
    this.buildExpressionHandler(node, ['discriminant'], path, state)
  }

  SwitchCase(path, state) {
    const { node } = path
    this.buildExpressionHandler(node, ['test'], path, state)
  }

  ClassDeclaration(path, state) {
    const { node } = path
    this.buildExpressionHandler(node, ['superClass'], path, state)
  }
}
