
export type OpcodeDef = {
  hex: string
  asm: string
}

export type OpcodesByAsm = Record<string, OpcodeDef>
