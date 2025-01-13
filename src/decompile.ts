import { standardOpcodes } from './standard-opcodes.js'
import { OpcodeDef } from './types'

type Options = {
  opcodes?: OpcodeDef[]
}

export function debugDecompileToBasm(bytecode: string, options: Options = {}) {
  const opcodes = options.opcodes || standardOpcodes
  const opcodesByHex = new Map(opcodes.map((o) => [o.hex, o]))

  bytecode = bytecode.replace(/^[\s\r\n]*0x/, '').replace(/[^0-9a-f]/ig, '')
  if (bytecode.length % 2 === 1) bytecode = '0' + bytecode


  const lines = []

  for (let i=0; i < bytecode.length; i += 2) {
    let byte = bytecode.slice(i, i+2)
    // console.log("BYTE", parseInt(byte, 16), byte)
    let op = opcodesByHex.get(byte)
    if (op) {
      let words = []
      // console.log("->", op)
      // lines.push((i === 0 ? '' : '\n') + op.fullName)
      words.push(op.asm)
      if (op.asm.match(/^PUSH/) && op.asm !== 'PUSH0') {
        let pushLen = +op.asm.replace('PUSH', '')
        words.push('0x' + bytecode.slice(i+2, i+2+pushLen*2))
        i += pushLen*2
      }
      lines.push(words)
    }
    else {
      lines.push([`<<unknown opcode: ${byte}>>`])
    }
  }
  return {
    lines,
    basm: lines.map((l) => l.join(' ')).join('\n'),
  }
}
