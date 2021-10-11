import o from 'ospec'
import { compileTrim, getOpcodesForTrim } from '../dist/index.js'
import { getOpcodesForHF } from '@ethereumjs/vm/dist/evm/opcodes/index.js'
import Common, { Chain, Hardfork } from '@ethereumjs/common'


o.spec('interop smoke tests', function () {

  o('Mainnet Berlin', function () {
    const common = new Common.default({ chain: Chain.Mainnet, hardfork: Hardfork.Berlin })
    const opcodes = getOpcodesForTrim(getOpcodesForHF(common))

    compileTrim('(ADD 0x00 0x01)', { opcodes })
  })
})
