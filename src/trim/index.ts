import { OpcodeDef } from "../types"
import { standardMacros } from "./macros.js"
import { Pos } from "../util.js"
import { generateBytecodeAst, generateBytecode } from "./generate.js"
import { parseTrim } from "./parse.js"
import { standardOpcodes } from "../opcodes.js"


type CompileOptions = {
  opcodes?: OpcodeDef[]
}
export function compileTrim(source: string, options: CompileOptions = {}) {
  const opcodes = options.opcodes || standardOpcodes
  const macros = { ...standardMacros }
  const program = parseTrim(source, new Pos(), { topLevel: true })
  const ast = generateBytecodeAst(program, opcodes, macros)
  return '0x' + generateBytecode(ast, opcodes, macros).join('')
}
