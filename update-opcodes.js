/**
 * Generates a file of opcodes so end devs don't have to install these deps themselves.
 */
import { writeFileSync } from 'fs'
import { getOpcodesForHF } from '@ethereumjs/evm'
import { Common, Chain, Hardfork } from '@ethereumjs/common'
import { getOpcodesForTrim } from './dist/index.js'

const common = new Common({ chain: Chain.Mainnet, hardfork: Hardfork.Cancun })
const opcodes = getOpcodesForTrim(getOpcodesForHF(common).opcodes)

// Write to file in this directory
writeFileSync('src/opcodes.ts', `export const standardOpcodes = ${JSON.stringify(opcodes, null, 2)}\n`)

console.log('Wrote src/opcodes.ts')
