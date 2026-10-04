/**
 * ABI vault/executor — sinkron dengan `contracts/FlashArbTreasury.sol`, ditambah permukaan executor
 * BSC lama (`withdrawBNB()`, `withdrawToken(address)`, error Ownable). `withdrawToken` di-overload:
 * encode selalu dengan signature lengkap.
 */
export const VAULT_ABI = [
  "function owner() view returns (address)",
  "function deposit() payable",
  "function depositToken(address token, uint256 amount)",
  "function withdraw(uint256 amount)",
  "function withdrawToken(address token, uint256 amount)",
  "function withdrawToken(address token)",
  "function withdrawBNB()",
  "function emergencyWithdraw(address token, address to)",
  "function rescueFunds(address tokenAddress)",
  "function rescueFunds(address token, uint256 amount)",
  "function rescueETH()",
  "function DEPLOYER() view returns (address)",
  "error OwnableUnauthorizedAccount(address account)",
  "error NotOwner()",
  "error NativeTransferFailed()",
  "error InvalidCallback()",
  "error IsKilled()",
  "error Unauthorized()",
] as const;

export const ERC20_ABI = [
  "function balanceOf(address account) view returns (uint256)",
  "function decimals() view returns (uint8)",
  "function symbol() view returns (string)",
  "function allowance(address owner, address spender) view returns (uint256)",
  "function approve(address spender, uint256 amount) returns (bool)",
  "function transfer(address to, uint256 amount) returns (bool)",
] as const;

/**
 * USDT Ethereum Mainnet tidak mengembalikan `bool` pada approve/transfer.
 * ABI standar sering membuat estimateGas gagal (missing revert data / InvalidFEOpcode).
 */
export const ERC20_LEGACY_ABI = [
  "function balanceOf(address account) view returns (uint256)",
  "function decimals() view returns (uint8)",
  "function symbol() view returns (string)",
  "function allowance(address owner, address spender) view returns (uint256)",
  "function approve(address spender, uint256 amount)",
  "function transfer(address to, uint256 amount)",
  "function transferFrom(address from, address to, uint256 amount)",
] as const;
