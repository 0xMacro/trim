
export type OpcodeDef = {
  hex: string
  asm: string
}

export type OpcodesByAsm = Record<string, OpcodeDef>

export type BytecodeAstNode =
  | { type: 'op', bytes: string, push: boolean, pushBytes?: string }
  | { type: 'top' }
  | { type: 'literal', bytes: string }
  | { type: 'label', name: string }
  | ExpNode

export type ExpNode = {
  type: 'exp'
  nodes: BytecodeAstNode[]
}
