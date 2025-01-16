#!/usr/bin/env node

import { readFileSync } from 'fs'
import { fileURLToPath } from 'url'
import path from 'path'
import { trim, debugDecompileToBasm } from './dist/index.js'
const __filename = fileURLToPath(import.meta.url)
const __dirname = path.dirname(__filename)

const args = process.argv.slice(2)
const options = { asm: false, decompile: false, version: false }

// Parse options
const fileArgs = args.filter(arg => {
  if (arg === '--version') {
    options.version = true
    return false
  }
  if (arg === '--asm') {
    options.asm = true
    return false
  }
  if (arg === '--decompile') {
    options.decompile = true
    return false
  }
  return true
})

// Check if we're receiving data from STDIN
const isStdin = !process.stdin.isTTY

if (options.version) {
  const pkg = readFileSync(path.join(__dirname, 'package.json'), 'utf8')
  console.log(JSON.parse(pkg).version)
  process.exit(0)
}
else if (isStdin) {
  let data = ''

  process.stdin.setEncoding('utf8')

  process.stdin.on('data', chunk => {
    data += chunk
  })

  process.stdin.on('end', () => {
    go(data)
  })
} else {
  // Handle file input

  if (fileArgs.length === 0) {
    console.error('Usage: trim [--asm] [--decompile] <filepath> or pipe content via STDIN')
    process.exit(1)
  }

  try {
    go(readFileSync(fileArgs[0], 'utf8'), options)
  } catch (error) {
    console.error(`Error reading file: ${error.message}`)
    process.exit(1)
  }
}

function go(source) {
  if (options.decompile) {
    console.log(debugDecompileToBasm(source).basm)
  } else {
    const bytecode = trim.compile(source)
    if (options.asm) {
      console.log(debugDecompileToBasm(bytecode).basm)
    }
    else {
      console.log(bytecode)
    }
  }
}
