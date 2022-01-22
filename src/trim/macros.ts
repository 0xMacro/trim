import { BytecodeAstNode, ExpAtom, ExpNode, MacroDefs, MacroFn, SexpNode } from "../types";
import { keccak256 } from '@ethersproject/keccak256'
import { autoPad } from "../util.js";

export const standardMacros: MacroDefs = {
  push(...vals) {
    return vals
  },

  'abi/fn-selector'(functionSig) {
    if (functionSig.type !== 'literal' || functionSig.subtype !== 'string') {
      throw new Error(`[trim] abi/fn-selector expects a string literal argument`)
    }
    const fnId = keccak256(Buffer.from(functionSig.value)).slice(2, 10)
    return [this.parseSexp(['push', `0x${fnId}`])]
  },

  'hex/add'(...vals) {
    let sum = 0
    for (let val of vals) {
      if (val.type !== 'literal' || val.subtype !== 'hex') {
        throw new Error(`[trim] hex/add expects hex literal arguments`)
      }
      sum += parseInt(val.value, 16)
    }
    return [{ type: 'literal', subtype: 'hex', value: autoPad(sum.toString(16)) }]
  },

  // Empty definition for simplifying logic elsewhere
  def() { return [] },
}

export function defineMacro(name: string, params: string[], body: SexpNode[]): MacroFn {
  return function userMacro(...args) {
    const paramsToArg = {} as Record<string, BytecodeAstNode>
    for (let i=0; i < params.length; i++) {
      paramsToArg[params[i]] = args[i]
    }
    return walkReplace(body, paramsToArg).map(sexp => this.parseSexp(sexp))
  }
}


function walkReplace<T extends SexpNode>(exp: T, paramsToArg: Record<string, BytecodeAstNode>): T extends Array<any> ? SexpNode[] : SexpNode {
  if (Array.isArray(exp)) {
    return exp.map(node => walkReplace(node, paramsToArg))
  }
  else if (typeof exp === 'string') {
    return paramsToArg[exp] as any || exp
  }
  return exp as any
}
