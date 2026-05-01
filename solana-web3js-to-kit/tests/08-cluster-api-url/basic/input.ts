const conn = new Connection(clusterApiUrl('devnet'));
const conn2 = new Connection(clusterApiUrl('mainnet-beta'), 'confirmed');
const unknown = clusterApiUrl('localnet');
