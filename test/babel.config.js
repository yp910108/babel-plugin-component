module.exports = {
  plugins: [
    [
      '../src',
      {
        libraryName: 'components',
        style: true, // default is true
        stylePathElement: function (componentName) {
          return `@/styles/element/${componentName}.css`
        },
        stylePath: function (componentName) {
          return `@/styles/components/${componentName}.css`
        }
      }
    ]
  ]
}
