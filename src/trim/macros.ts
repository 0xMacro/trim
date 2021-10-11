import { BytecodeAstNode, ExpNode, MacroDefs } from "../types";
import { keccak256 } from '@ethersproject/keccak256'

export const standardMacros: MacroDefs = {
  push(...vals) {
    return vals
  },
  'abi/function-id'(functionSig) {
    if (functionSig.type !== 'literal' || functionSig.subtype !== 'string') {
      throw new Error(`[trim] abi/function-id expects a string literal argument`)
    }
    const fnId = keccak256(Buffer.from(functionSig.value)).slice(2, 10)
    return [this.parseSexp(['push', `0x${fnId}`])]
  }
}
