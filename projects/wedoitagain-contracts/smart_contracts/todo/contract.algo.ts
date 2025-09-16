import { Contract, GlobalState, uint64 } from '@algorandfoundation/algorand-typescript'

export class Attendance extends Contract {
  present = GlobalState<uint64>({  initialValue: 0 })

  markPresent(): uint64 {
    this.present.value = this.present.value + 1
    return this.present.value
  }
}