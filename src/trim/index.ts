import { OpcodeDef, OpcodeMeta } from "../types"
import { standardMacros } from "./macros.js"
import { Pos } from "../util.js"
import { generateBytecodeAst, generateBytecode } from "./generate.js"
import { parseTrim } from "./parse.js"
import { standardOpcodes } from "../standard-opcodes.js"
import { standardOpcodesMetadata } from "../opcodes.js"


type CompileOptions = {
  opcodes?: OpcodeDef[]
  opcodesMetadata?: Record<string, OpcodeMeta>
}
export function compileTrim(source: string, options: CompileOptions = {}) {
  const opcodes = options.opcodes || standardOpcodes
  const opcodesMetadata = options.opcodesMetadata || standardOpcodesMetadata
  const macros = { ...standardMacros }
  const program = parseTrim(source, new Pos(), { topLevel: true })
  const ast = generateBytecodeAst(program, { opcodes, macros })
  return '0x' + generateBytecode(ast, { opcodes, macros, opcodesMetadata }).join('')
}
