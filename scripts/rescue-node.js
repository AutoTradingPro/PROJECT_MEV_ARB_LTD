const { ethers } = require("ethers");

async function main() {
  const provider = new ethers.JsonRpcProvider("http://bsc-dataseed1.binance.org:8544");
  
  // Masukkan private key asli dompet Anda di sini (Pastikan 1 baris penuh tanpa ada enter/baris baru di tengah string)
  const privateKey = "0xac0974bec39a17e36ba4a6b4d238ff944bacb478cbed5efcae784d7bf4f2ff80"; 
  
  if (!privateKey || privateKey.includes("MASUKKAN")) {
    console.error("Tolong masukkan private key dompet Anda dengan benar.");
    return;
  }

  const wallet = new ethers.Wallet(privateKey, provider);
  console.log("Menjalankan penarikan dari akun:", wallet.address);

  const contractAddress = "0x564abBC67F07C7621F86EABe25346eb5C5c81c7c";
  const balance = await provider.getBalance(contractAddress);
  console.log("Saldo BNB di dalam kontrak:", ethers.formatEther(balance), "BNB");

  if (balance === 0n) {
    console.log("Kontrak kosong, tidak ada dana yang bisa ditarik.");
    return;
  }

  const abi = [
    "function withdraw(uint256 amount) external",
    "function emergencyWithdraw(address token, address to) external"
  ];
  const contract = new ethers.Contract(contractAddress, abi, wallet);

  try {
    console.log("Mencoba tarik via fungsi withdraw standar...");
    const tx = await contract.withdraw(balance, { gasLimit: 100000 });
    console.log("Tx Hash:", tx.hash);
    await tx.wait();
    console.log("Sukses menarik dana kembali ke dompet!");
  } catch (err) {
    console.log("Withdraw standar gagal, mencoba emergencyWithdraw...", err.message);
    try {
      const txEm = await contract.emergencyWithdraw("0x0000000000000000000000000000000000000000", wallet.address, { gasLimit: 100000 });
      console.log("Tx Emergency Hash:", txEm.hash);
      await txEm.wait();
      console.log("Sukses menarik dana via emergencyWithdraw!");
    } catch (err2) {
      console.error("Gagal total:", err2.message);
    }
  }
}

main();
