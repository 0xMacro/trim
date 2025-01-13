# Trim VS Code Language Extension

VS Code extension for the [Trim EVM programming language](https://github.com/0xMacro/trim).

Includes syntax highlighting for `.trim` files, AND ALSO JavaScript and TypeScript files like this:

```js
import { trim } from 'trim-evm

// This will be syntax-highlighted in your editor
const bytecode = trim`
  (ADD 0x00 0x20)
`
```

## Developing

```
npm install -g @vscode/vsce
vsce package
vsce publish
```
