import { OpcodeList } from '@ethereumjs/evm/src/opcodes'
import { OpcodeDef } from './types'
import { pad } from './util.js'

export function getOpcodesForTrim(opcodeList: OpcodeList): OpcodeDef[] {
  return [...opcodeList.values()].map(op => ({
    hex: pad(op.code.toString(16), 2),
    asm: op.fullName,
  }))
}
