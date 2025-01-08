#!/usr/bin/env node

import { readFileSync } from 'fs'
import { compileTrim, getOpcodesForTrim } from './dist/index.js'
import { getOpcodesForHF } from '@ethereumjs/evm'
import { Common, Chain, Hardfork } from '@ethereumjs/common'

// Check if we're receiving data from STDIN
const isStdin = !process.stdin.isTTY

if (isStdin) {
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
  const args = process.argv.slice(2)
  if (args.length === 0) {
    console.error('Usage: trim <filepath> or pipe content via STDIN')
    process.exit(1)
  }

  try {
    go(readFileSync(args[0], 'utf8'))
  } catch (error) {
    console.error(`Error reading file: ${error.message}`)
    process.exit(1)
  }
}

function go(source) {
  const common = new Common({ chain: Chain.Mainnet, hardfork: Hardfork.Cancun })
  const opcodes = getOpcodesForTrim(getOpcodesForHF(common).opcodes)

  console.log(compileTrim(source, { opcodes }))
}
