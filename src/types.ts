export type ToplevelSexp = SexpNode[]

export type SexpNode =
  | string
  | BytecodeAstNode
  | SexpNode[]

export type OpcodeDef = {
  hex: string
  asm: string
}

export type OpcodeMeta = {
  pops: number
  pushes: number
}

export type OpcodesByAsm = Record<string, OpcodeDef>

export type BytecodeAstNode =
  | { type: 'op', bytes: string, push: boolean, pushBytes?: string }
  | { type: 'top' }
  | { type: 'literal', subtype: 'hex' | 'string', value: string }
  | { type: 'label', name: string }
  | { type: 'scope', nodes: BytecodeAstNode[] }
  | ExpAtom
  | ExpNode

export type ExpAtom = { type: 'atom', name: string }

export type ExpNode = {
  type: 'exp'
  nodes: BytecodeAstNode[]
}

export type MacroDefs = Record<string,MacroFn>

export type MacroFn = (this: MacroCtx, ...args: SexpNode[]) => SexpNode[]

export type MacroCtx = {
  level: number
  parseSexp: (sexp: SexpNode) => BytecodeAstNode[]
}

export type GenerateFeatures = {
  /** Unless false, generates PUSH0 instead of PUSH1 0x00 */
  push0?: boolean
}

//
// ABI types
// Pulled from @ethersproject/abi
//
export interface AbiJsonFragmentType {
  readonly name?: string
  readonly indexed?: boolean
  readonly type?: string
  readonly internalType?: any // @TODO: in v6 reduce type
  readonly components?: ReadonlyArray<AbiJsonFragmentType>
}

export interface AbiJsonFragment {
  readonly name?: string
  readonly type?: string

  readonly anonymous?: boolean

  readonly payable?: boolean
  readonly constant?: boolean
  readonly stateMutability?: string

  readonly inputs?: ReadonlyArray<AbiJsonFragmentType>
  readonly outputs?: ReadonlyArray<AbiJsonFragmentType>

  readonly gas?: string
}
