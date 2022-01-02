export type ToplevelSexp = SexpNode[]

export type SexpNode =
  | string
  | BytecodeAstNode
  | SexpNode[]

export type OpcodeDef = {
  hex: string
  asm: string
}

export type OpcodesByAsm = Record<string, OpcodeDef>

export type BytecodeAstNode =
  | { type: 'op', bytes: string, push: boolean, pushBytes?: string }
  | { type: 'top' }
  | { type: 'literal', subtype: 'hex' | 'string', value: string }
  | { type: 'label', name: string }
  | { type: 'macro', name: string }
  | ExpAtom
  | ExpNode

export type ExpAtom = { type: 'atom', name: string }

export type ExpNode = {
  type: 'exp'
  nodes: BytecodeAstNode[]
}

export type MacroDefs = Record<string,MacroFn>

export type MacroFn = (this: MacroCtx, ...args: BytecodeAstNode[]) => BytecodeAstNode[]

export type MacroCtx = {
  parseSexp: (sexp: SexpNode) => BytecodeAstNode
}
