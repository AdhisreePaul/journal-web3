import {
  Contract,
  uint64,
  Uint64,
  GlobalState,
  assert,
  Txn,
  Global,
  itxn,
  Asset,
  bytes
} from '@algorandfoundation/algorand-typescript'

export class TokenVesting extends Contract {
  // ----------------------------
  // 📦 Global State
  // ----------------------------
  employerAddress = GlobalState<bytes>()   // employer address as bytes
  employeeAddress = GlobalState<bytes>()   // employee address as bytes
  tokenASA = GlobalState<uint64>()         // ASA ID of vested token
  totalTokens = GlobalState<uint64>()      // total tokens locked for employee
  startTime = GlobalState<uint64>()        // vesting start timestamp
  cliffTime = GlobalState<uint64>()        // cliff timestamp
  duration = GlobalState<uint64>()         // total vesting duration (sec)
  claimedTokens = GlobalState<uint64>()    // how many tokens claimed so far

  // ----------------------------
  // 🎯 Setup Vesting
  // ----------------------------
  createVesting(
    employeeAddr: bytes,
    token: uint64,
    total: uint64,
    start: uint64,
    cliff: uint64,
    vestingDuration: uint64
  ): void {
    // Only creator (employer) can set up vesting
    assert(Txn.sender === Global.creatorAddress, 'Only creator can setup vesting');

    // Basic validation checks
    assert(total > 0, 'Must vest some tokens');
    assert(vestingDuration > 0, 'Duration must be greater than 0');
    assert(cliff >= start, 'Cliff must be after or at start');
    assert(token > 0, 'Invalid token ASA ID');

    // Store state
    this.employerAddress.value = Global.creatorAddress.bytes;
    this.employeeAddress.value = employeeAddr;
    this.tokenASA.value = token;
    this.totalTokens.value = total;
    this.startTime.value = start;
    this.cliffTime.value = cliff;
    this.duration.value = vestingDuration;
    this.claimedTokens.value = 0;
  }

  // ----------------------------
  // 🎁 Claim vested tokens
  // ----------------------------
  claim(): void {
    // Only employee can claim
    assert(Txn.sender.bytes === this.employeeAddress.value, 'Only employee can claim');

    const now = Global.latestTimestamp;

    // Cliff check - must wait until cliff time
    assert(now >= this.cliffTime.value, 'Cliff period not reached yet');

    // Calculate vested amount
    let vested: uint64;
    const endTime: uint64 = Uint64(this.startTime.value + this.duration.value);
    
    if (now >= endTime) {
      // Fully vested - all tokens available
      vested = this.totalTokens.value;
    } else {
      // Linear vesting based on time elapsed since start
      const elapsed = Uint64(now - this.startTime.value);
      vested = Uint64((this.totalTokens.value * elapsed) / this.duration.value);
    }

    // Calculate claimable tokens (vested minus already claimed)
    const claimable = Uint64(vested - this.claimedTokens.value);
    assert(claimable > 0, 'No tokens available to claim');

    // Update claimed tokens counter
    this.claimedTokens.value += claimable;

    // Transfer ASA tokens to employee
    itxn.assetTransfer({
      assetReceiver: Txn.sender,
      xferAsset: Asset(this.tokenASA.value),
      assetAmount: claimable
    }).submit();
  }

  // ----------------------------
  // 📊 Calculate vested amount (read-only)
  // ----------------------------
  calculateVested(): uint64 {
    const now = Global.latestTimestamp;
    
    // Before cliff - nothing vested
    if (now < this.cliffTime.value) {
      return 0;
    }
    
    // After full duration - everything vested
    const endTime: uint64 = Uint64(this.startTime.value + this.duration.value);
    if (now >= endTime) {
      return this.totalTokens.value;
    }
    
    // During vesting period - linear vesting
    const elapsed = Uint64(now - this.startTime.value);
    return Uint64((this.totalTokens.value * elapsed) / this.duration.value);
  }

  // ----------------------------
  // 🔍 Get Vesting Info
  // ----------------------------
  getVestingInfo(): [bytes, bytes, uint64, uint64, uint64, uint64, uint64, uint64, uint64, uint64] {
    const now = Global.latestTimestamp;
    const vested = this.calculateVested();
    const claimable = Uint64(vested - this.claimedTokens.value);
    const timeRemaining = Uint64(now < this.startTime.value + this.duration.value 
      ? (this.startTime.value + this.duration.value) - now 
      : 0);

    return [
      this.employerAddress.value,    // employer address bytes
      this.employeeAddress.value,    // employee address bytes  
      this.tokenASA.value,          // token ASA ID
      this.totalTokens.value,       // total tokens in vesting
      this.startTime.value,         // start timestamp
      this.cliffTime.value,         // cliff timestamp
      this.duration.value,          // total vesting duration
      this.claimedTokens.value,     // tokens already claimed
      vested,                       // currently vested tokens
      claimable                     // tokens available to claim now
    ];
  }

  // ----------------------------
  // 📈 Get user-specific info
  // ----------------------------
  getUserVestingStatus(): [uint64, uint64, uint64, boolean, boolean, uint64] {
    const now = Global.latestTimestamp;
    const vested = this.calculateVested();
    const claimable = Uint64(vested - this.claimedTokens.value);
    const isEmployee = Txn.sender.bytes === this.employeeAddress.value;
    const cliffReached = now >= this.cliffTime.value;
    const fullyVested = now >= this.startTime.value + this.duration.value;

    return [
      vested,                       // currently vested tokens
      claimable,                    // tokens available to claim
      this.claimedTokens.value,     // tokens already claimed
      isEmployee,                   // is caller the employee
      cliffReached,                 // has cliff period passed
      fullyVested ? 0 : ((this.startTime.value + this.duration.value) - now) // time remaining
    ];
  }

  // ----------------------------
  // 🚨 Emergency: Revoke vesting (employer only)
  // ----------------------------
  revokeVesting(): void {
    // Only employer can revoke
    assert(Txn.sender.bytes === this.employerAddress.value, 'Only employer can revoke vesting');
    
    // Calculate what employee has already earned
    const vested = this.calculateVested();
    const unvestedTokens = Uint64(this.totalTokens.value - vested);
    
    assert(unvestedTokens > 0, 'No unvested tokens to revoke');
    
    // Update total tokens to only include vested amount
    this.totalTokens.value = vested;
    
    // Return unvested tokens to employer
    if (unvestedTokens > 0) {
      itxn.assetTransfer({
        assetReceiver: Global.creatorAddress,
        xferAsset: Asset(this.tokenASA.value),
        assetAmount: unvestedTokens
      }).submit();
    }
  }
}