class WalletService {
  public async createWallet() {
    const keypair = await generateKeyPairSigner();
    return keypair;
  }

  private syncMethod() {
    const keypair = Keypair.generate();
    return keypair;
  }
}
