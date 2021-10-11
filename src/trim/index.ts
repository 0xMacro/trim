import { standardMacros } from "./macros"
import { OpcodeDef } from "../types"
import { Pos } from "../util"
import { generateBytecodeAst, generateBytecode } from "./generate"
import { parseTrim } from "./parse"


type CompileOptions = {
  opcodes: OpcodeDef[]
}
export function compileTrim(source: string, options: CompileOptions) {
  const macros = { ...standardMacros }
  const program = parseTrim(source, new Pos(), { topLevel: true })
  const ast = generateBytecodeAst(program, options.opcodes, macros)
  return '0x' + generateBytecode(ast, options.opcodes, macros).join('')
}
