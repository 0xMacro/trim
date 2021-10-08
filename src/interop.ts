import Common from '@ethereumjs/common'
import { Opcode, OpcodeList } from '@ethereumjs/vm/dist/evm/opcodes'
import { OpcodeDef } from './types'
import { pad } from './util'

export function getOpcodesForTrim(opcodeList: OpcodeList): OpcodeDef[] {
  return [...opcodeList.values()].map(op => ({
    hex: pad(op.code.toString(16), 2),
    asm: op.fullName,
  }))
}
