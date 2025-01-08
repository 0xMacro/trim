import o from 'ospec'
import { compileTrim, getOpcodesForTrim } from '../dist/index.js'
import { getOpcodesForHF } from '@ethereumjs/evm'
import { Common, Chain, Hardfork } from '@ethereumjs/common'


o.spec('interop smoke tests', function () {

  o('Mainnets', function () {
    const forks = [Hardfork.Berlin, Hardfork.Cancun]
    for (let fork of forks) {
      const common = new Common({ chain: Chain.Mainnet, hardfork: fork })
      const opcodes = getOpcodesForTrim(getOpcodesForHF(common).opcodes)

      compileTrim('(ADD 0x00 0x01)', { opcodes })
    }
  })
})
