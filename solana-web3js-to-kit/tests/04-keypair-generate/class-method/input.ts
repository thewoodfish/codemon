class WalletService {
  public async createWallet() {
    const keypair = Keypair.generate();
    return keypair;
  }

  private syncMethod() {
    const keypair = Keypair.generate();
    return keypair;
  }
}
