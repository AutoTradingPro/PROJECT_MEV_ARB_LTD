const { ethers } = require("hardhat");

async function main() {
  const [deployer] = await ethers.getSigners();
  console.log("Mengeksekusi penarikan dengan akun:", deployer.address);

  const contractAddress = "0x564abBC67F07C7621F86EABe25346eb5C5c81c7c";
  
  const abi = [
    "function withdraw(uint256 amount) external",
    "function emergencyWithdraw(address token, address to) external",
    "function owner() view returns (address)"
  ];

  const contract = await ethers.getContractAt(abi, contractAddress, deployer);
  const balance = await ethers.provider.getBalance(contractAddress);
  console.log("Saldo BNB di dalam kontrak:", ethers.formatEther(balance), "BNB");

  if (balance === 0n) {
    console.log("Kontrak kosong, tidak ada dana yang bisa ditarik.");
    return;
  }

  try {
    console.log("Mencoba memanggil fungsi withdraw standar...");
    const tx = await contract.withdraw(balance, { gasLimit: 100000 });
    console.log("Tx terkirim:", tx.hash);
    await tx.wait();
    console.log("Berhasil! Dana telah ditarik kembali ke wallet.");
  } catch (error) {
    console.log("Withdraw standar gagal, mencoba fungsi alternatif...", error.message);
    try {
      const txEmergency = await contract.emergencyWithdraw("0x0000000000000000000000000000000000000000", deployer.address, { gasLimit: 100000 });
      console.log("Tx emergency terkirim:", txEmergency.hash);
      await txEmergency.wait();
      console.log("Berhasil dengan emergencyWithdraw!");
    } catch (err2) {
      console.error("Semua metode penarikan otomatis tertolak:", err2.message);
    }
  }
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
