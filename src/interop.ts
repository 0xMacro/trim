import Common from '@ethereumjs/common'
import { getOpcodesForHF, Opcode, OpcodeList } from '@ethereumjs/vm/dist/evm/opcodes'
import { OpcodeDef } from './types'
import { pad } from './util'

function getOpcodes(common: Common): OpcodeDef[] {
  return [...getOpcodesForHF(common).values()].map(op => ({
    hex: pad(op.code.toString(16), 2),
    asm: op.fullName,
  }))
}
