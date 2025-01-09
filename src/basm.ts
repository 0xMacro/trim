import { standardOpcodes } from './standard-opcodes.js'
import { OpcodeDef } from './types'
import { getBackwardsFriendlyOpcodesByAsm, pad } from './util.js'

type Options = {
  opcodes?: OpcodeDef[]
}
export function compileBasm(input: string, options: Options = {}) {
  const opcodes = options.opcodes || standardOpcodes
  const opcodesByAsm = getBackwardsFriendlyOpcodesByAsm(opcodes)

  const code: string[] = []
  for (let line of input.split(/\s*[\n\r]+\s*/)) {
    if (!line) continue

    for (let token of line.split(/\s+/)) {
      if (!token) continue

      if (opcodesByAsm[token]) {
        code.push(opcodesByAsm[token].hex)
      }
      else if (token.match(/^0x[0-9a-f]+$/i)) {
        code.push(token.slice(2))
      }
      else {
        throw new Error(`[trim] Invalid token: '${token}'`)
      }
    }
  }
  return '0x' + code.join('')
}
