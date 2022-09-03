# babel-plugin-component

## Install

```shell
npm i @yp910108/babel-plugin-component -D
```

## Usage

Via `.babelrc` or `babel.config.js`.

```javascript
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
```

## Example

```javascript
import { Button, Select } from 'components'

Vue.use(Button)
Vue.use(Select)

      ↓ ↓ ↓ ↓ ↓ ↓

import '@/styles/element/base.css'

import '@/styles/element/select.css'
import ElSelect from 'element-ui/lib/select.js'
import '@/styles/components/select.css'
import Select from 'components/lib/select.js'

import '@/styles/element/button.css'
import ElButton from 'element-ui/lib/button.js'
import '@/styles/components/button.css'
import Button from 'components/lib/button.js'

Vue.use(ElSelect)
Vue.use(Select)

Vue.use(ElButton)
Vue.use(Button)
```
