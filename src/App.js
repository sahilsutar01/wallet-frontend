import React, { useState, useEffect, useRef } from "react";
import axios from "axios";
import { QRCodeCanvas } from "qrcode.react";
import {
  FiCreditCard, FiSend, FiCheckCircle, FiPlusCircle, FiSearch, FiKey,
  FiFileText, FiArrowUpRight, FiArrowDownLeft, FiXCircle, FiCopy, FiPocket, FiLink2, FiClock
} from 'react-icons/fi';

// Injects the necessary keyframes for the background, loader spin, and loader effects.
const GlobalStyles = () => (
  <style>{`
    @keyframes spin {
      0% { transform: rotate(0deg); }
      100% { transform: rotate(360deg); }
    }
    @keyframes glow {
      0% { filter: drop-shadow(0 0 5px #3b82f6); }
      50% { filter: drop-shadow(0 0 20px #f43f5e); }
      100% { filter: drop-shadow(0 0 5px #3b82f6); }
    }
    @keyframes fadeIn {
      from { opacity: 0; }
      to { opacity: 1; }
    }
    @keyframes zoomIn {
      from { transform: scale(0.8); opacity: 0; }
      to { transform: scale(1); opacity: 1; }
    }
    @keyframes gradient {
      0% { background-position: 0% 50%; }
      50% { background-position: 100% 50%; }
      100% { background-position: 0% 50%; }
    }
    body {
      font-family: 'Inter', sans-serif;
    }
  `}</style>
);

// --- THIS IS THE ONLY LINE YOU NEED TO EDIT TO CHANGE THE SERVER URL ---
const API_URL = "https://wallet-backend-b7nh.onrender.com";

function App() {
  const [name, setName] = useState("");
  const [walletData, setWalletData] = useState(null);
  const [recipient, setRecipient] = useState("");
  const [amount, setAmount] = useState("");
  const [token, setToken] = useState("bnb");
  const [txHash, setTxHash] = useState("");
  const [verifyData, setVerifyData] = useState(null);
  const [loading, setLoading] = useState(false);
  const [balances, setBalances] = useState(null);
  const [showQRCode, setShowQRCode] = useState(false);
  const [transactionHistory, setTransactionHistory] = useState([]);
  const [showHistory, setShowHistory] = useState(false);

  const pollingIntervals = useRef({});

  // Standalone function to reliably fetch the latest balances from the blockchain.
  const fetchBalances = async (address) => {
    try {
      const balRes = await axios.post(`${API_URL}/api/balance`, { address });
      setBalances(balRes.data);
    } catch (err) {
      console.error("Could not refresh balances:", err);
    }
  };

  // This useEffect hook is the core of the state synchronization.
  useEffect(() => {
    const checkStatus = async (hash) => {
      try {
        const res = await axios.post(`${API_URL}/api/verify`, { txHash: hash });
        
        if (res.data.status && res.data.status !== "Pending") {
          clearInterval(pollingIntervals.current[hash]);
          delete pollingIntervals.current[hash];
          
          if (walletData?.address) {
            fetchHistory(walletData.address, true);
            fetchBalances(walletData.address); 
          }
        }
      } catch (error) {
        clearInterval(pollingIntervals.current[hash]);
        delete pollingIntervals.current[hash];
      }
    };

    transactionHistory.forEach(tx => {
      if (tx.status === "Pending" && !pollingIntervals.current[tx.txHash]) {
        pollingIntervals.current[tx.txHash] = setInterval(() => checkStatus(tx.txHash), 5000);
      }
    });

    return () => {
      Object.values(pollingIntervals.current).forEach(clearInterval);
      pollingIntervals.current = {};
    };
  }, [transactionHistory, walletData?.address]);

  const createWallet = async () => {
    if (!name) return alert("Please enter a name to create a wallet.");
    try {
      setLoading(true);
      const res = await axios.post(`${API_URL}/api/create`, { name });
      setWalletData(res.data);
      alert("✅ Wallet Created");
    } catch (err) {
      // --- MODIFICATION: Specifically check for the 409 status from the server ---
      if (err.response && err.response.status === 409) {
        alert("❌ Wallet name already exists. Please choose a different name.");
      } else {
        alert(`❌ Error creating wallet: ${err.response?.data?.error || err.message}`);
      }
    } finally { setLoading(false); }
  };

  const fetchWallet = async () => {
    if (!name) return alert("Please enter a name to fetch a wallet.");
    try {
      setLoading(true);
      setShowQRCode(false);
      setShowHistory(false);
      setTransactionHistory([]);
      const res = await axios.get(`${API_URL}/api/fetch/${name}`);
      setWalletData(res.data);
      await fetchBalances(res.data.address);
    } catch (err) {
      alert(`❌ Wallet not found or error fetching balance: ${err.response?.data?.error || err.message}`);
    } finally { setLoading(false); }
  };

  const sendTokens = async () => {
    if (!walletData?.privateKey) return alert("❌ Wallet not loaded");
    if (!recipient || !amount) return alert("Please fill in a valid recipient and amount.");
    try {
      setLoading(true);
      const res = await axios.post(`${API_URL}/api/send`, { privateKey: walletData.privateKey, to: recipient, amount, token });
      setTxHash(res.data.txHash);
      alert(`✅ Transaction Submitted!\nIt will show as 'Pending' until confirmed.`);
      fetchHistory(walletData.address, true);
      setShowHistory(true);
    } catch (err) {
      alert(`❌ Error sending tokens: ${err.response?.data?.error || err.message}`);
    } finally { setLoading(false); }
  };

  const verifyTx = async () => {
    if (!txHash) return alert("Please enter a transaction hash to verify.");
    try {
      setLoading(true);
      const res = await axios.post(`${API_URL}/api/verify`, { txHash });
      setVerifyData(res.data);
      if (walletData?.address) {
        fetchHistory(walletData.address, true);
        fetchBalances(walletData.address);
      }
    } catch (err) {
      alert(`❌ Invalid TX hash: ${err.response?.data?.error || err.message}`);
    } finally { setLoading(false); }
  };

  const fetchHistory = async (address, isRefresh = false) => {
    if (!isRefresh) setLoading(true);
    try {
      const res = await axios.get(`${API_URL}/api/history/${address}`);
      setTransactionHistory(res.data);
      if (!isRefresh) setShowHistory(true);
    } catch (err) {
      alert(`❌ Could not fetch transaction history: ${err.response?.data?.error || err.message}`);
    } finally { if (!isRefresh) setLoading(false); }
  };

  const cancelTransaction = async (hash) => {
    try {
      await axios.post(`${API_URL}/api/cancel`, { txHash: hash });
      alert("Transaction cancellation requested! The interface will update once the transaction is finalized on the blockchain.");
    } catch (err) {
      alert(`❌ Error canceling tx: ${err.response?.data?.error || err.message}`);
    }
  };

  const copyToClipboard = (text) => {
    navigator.clipboard.writeText(text);
    alert("Copied to clipboard!");
  };

  return (
    <>
      <GlobalStyles />
      <div style={styles.background}>
        {loading && (
          <div style={styles.loaderOverlay}>
            <div style={styles.spinnerContainer}>
              <div style={styles.spinner}></div>
              <p style={styles.loadingText}>Processing...</p>
            </div>
          </div>
        )}

        <div style={styles.container}>
          <header style={styles.header}>
            <h1 style={styles.title}><FiPocket /> Wallet Manager Pro</h1>
            <p style={styles.subtitle}>A professional interface for the BSC testnet.</p>
          </header>

          <div style={styles.card}>
            <h2 style={styles.sectionHeader}><FiSearch /> Find or Create a Wallet</h2>
            <div style={styles.inputGroup}>
              <input placeholder="Enter Wallet Name" value={name} onChange={(e) => setName(e.target.value)} style={styles.input} />
              <button onClick={createWallet} disabled={loading || !name} style={styles.button}><FiPlusCircle /> Create</button>
              <button onClick={fetchWallet} disabled={loading || !name} style={styles.button}><FiSearch /> Fetch</button>
            </div>
          </div>

          {/* --- MODIFICATION: Main dashboard is now conditionally rendered --- */}
          {walletData ? (
            <div style={styles.mainGrid}>
              {/* Left Column (Send/Verify) */}
              <div style={styles.column}>
                <div style={styles.card}>
                  <h2 style={styles.sectionHeader}><FiSend /> Send Tokens</h2>
                  <input placeholder="Recipient Address" value={recipient} onChange={(e) => setRecipient(e.target.value)} style={styles.input} />
                  <div style={styles.inputGroup}>
                    <input placeholder="Amount" value={amount} onChange={(e) => setAmount(e.target.value)} style={{ ...styles.input, flex: '2' }} />
                    <select value={token} onChange={(e) => setToken(e.target.value)} style={styles.input}><option value="bnb">BNB</option><option value="usdt">USDT</option><option value="usdc">USDC</option></select>
                  </div>
                  <button onClick={sendTokens} disabled={loading} style={{ ...styles.button, width: '100%', marginTop: '10px' }}>Send Transaction</button>
                </div>

                <div style={styles.card}>
                  <h2 style={styles.sectionHeader}><FiCheckCircle /> Verify Transaction</h2>
                  <div style={styles.inputGroup}>
                    <input placeholder="Paste Transaction Hash" value={txHash} onChange={(e) => setTxHash(e.target.value)} style={styles.input} />
                    <button onClick={verifyTx} disabled={loading || !txHash} style={styles.button}>Verify</button>
                  </div>
                  {verifyData && (
                    <div style={styles.verifyContainer}>
                      <p style={styles.detailText}><strong>From:</strong> {verifyData.from?.substring(0, 12)}...</p>
                      <p style={styles.detailText}><strong>To:</strong> {verifyData.to?.substring(0, 12)}...</p>
                      <p style={styles.detailText}><strong>Amount:</strong> {verifyData.value} {verifyData.token?.toUpperCase()}</p>
                      <p style={styles.detailText}><strong>Status:</strong> <span style={styles.statusBadge(verifyData.status)}>{verifyData.status}</span></p>
                      <p style={styles.detailText}><strong>Explorer:</strong> <a href={`https://testnet.bscscan.com/tx/${txHash}`} target="_blank" rel="noopener noreferrer" style={styles.link}>View on BscScan <FiLink2 size={12} /></a></p>
                    </div>
                  )}
                </div>
              </div>
              
              {/* Right Column (Wallet Info/History) */}
              <div style={styles.column}>
                  <div style={styles.card}>
                    <h2 style={styles.sectionHeader}><FiCreditCard /> Wallet Information</h2>
                    <DetailRow icon={<FiCreditCard />} label="Address" value={walletData.address} onCopy={() => copyToClipboard(walletData.address)} />
                    <DetailRow icon={<FiKey />} label="Private Key" value={`${walletData.privateKey.substring(0, 8)}...`} onCopy={() => copyToClipboard(walletData.privateKey)} />
                    <DetailRow icon={<FiFileText />} label="Mnemonic" value={`${walletData.mnemonic.substring(0, 12)}...`} onCopy={() => copyToClipboard(walletData.mnemonic)} />
                    <div style={{ ...styles.inputGroup, marginTop: '20px' }}>
                      <button onClick={() => setShowQRCode(!showQRCode)} style={styles.button}>{showQRCode ? "Hide QR" : "Show QR"}</button>
                      <button onClick={() => showHistory ? setShowHistory(false) : fetchHistory(walletData.address)} style={styles.button}>{showHistory ? "Hide History" : "Show History"}</button>
                    </div>
                    {showQRCode && (
                      <div style={{ marginTop: 20, textAlign: 'center', background: '#fff', padding: '10px', borderRadius: '8px' }}>
                        <QRCodeCanvas value={walletData.address} size={128} bgColor="#ffffff" fgColor="#111827" />
                      </div>
                    )}
                    {balances && (
                      <div style={styles.balancesContainer}>
                        <div style={styles.balanceRow}><span>BNB:</span><span>{balances.bnb}</span></div>
                        <div style={styles.balanceRow}><span>USDT:</span><span>{balances.usdt}</span></div>
                        <div style={styles.balanceRow}><span>USDC:</span><span>{balances.usdc}</span></div>
                      </div>
                    )}
                  </div>

                  {showHistory && (
                    <div style={styles.card}>
                      <h2 style={styles.sectionHeader}>📜 Transaction History</h2>
                      {transactionHistory.length > 0 ? (
                        <div style={styles.historyWrapper}>
                          {transactionHistory.map((tx) => {
                            const isSent = tx.from.toLowerCase() === walletData.address.toLowerCase();
                            return (
                              <div key={tx._id} style={styles.historyCard}>
                                <div style={styles.historyIcon(tx.status, isSent)}>
                                  {tx.status === 'Pending' ? <FiClock /> : (isSent ? <FiArrowUpRight /> : <FiArrowDownLeft />)}
                                </div>
                                <div style={styles.historyDetails}>
                                  <div style={styles.historyRow}>
                                    <span style={styles.historyType(isSent)}>{isSent ? "SENT" : "RECEIVED"}</span>
                                    <span style={styles.historyAmount}>{tx.value} {tx.token.toUpperCase()}</span>
                                  </div>
                                  <p style={styles.historyText}><strong>{isSent ? "To:" : "From:"}</strong> {isSent ? tx.to : tx.from}</p>
                                  <p style={styles.historyText}><strong>Status:</strong> <span style={styles.statusBadge(tx.status)}>{tx.status}</span></p>
                                  <p style={styles.historyText}>{new Date(tx.createdAt).toLocaleString()}</p>
                                  {tx.status === "Pending" && (
                                    <button onClick={() => cancelTransaction(tx.txHash)} style={styles.cancelButton}>
                                      <FiXCircle size={14}/> Cancel
                                    </button>
                                  )}
                                </div>
                                <a href={`https://testnet.bscscan.com/tx/${tx.txHash}`} target="_blank" rel="noopener noreferrer" style={styles.link}><FiLink2 size={14} /></a>
                              </div>
                            );
                          })}
                        </div>
                      ) : (<p style={{ textAlign: "center", padding: "20px 0" }}>No transaction history found.</p>)}
                    </div>
                  )}
              </div>
            </div>
          ) : (
            <div style={{ ...styles.card, textAlign: 'center', marginTop: '40px', maxWidth: '600px', margin: '40px auto' }}>
                <h2 style={styles.sectionHeader}>No Wallet Loaded</h2>
                <p>Please create a new wallet or fetch an existing one to begin.</p>
            </div>
          )}
        </div>
      </div>
    </>
  );
}

const DetailRow = ({ icon, label, value, onCopy }) => (
  <div style={styles.detailRow}>
    <div style={styles.detailLabel}>{icon}<span>{label}</span></div>
    <div style={styles.detailValue}><span>{value}</span><button onClick={onCopy} style={styles.copyButton}><FiCopy /></button></div>
  </div>
);

// Styles
const styles = {
  background: { minHeight: "100vh", padding: '40px 20px', background: "linear-gradient(-45deg, #6ee7b7, #3b82f6, #9333ea, #f43f5e)", backgroundSize: "400% 400%", animation: "gradient 15s ease infinite" },
  container: { maxWidth: '1200px', margin: "auto", color: '#1F2937' },
  header: { textAlign: 'center', marginBottom: '40px' },
  title: { display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '15px', fontSize: '2.5rem', fontWeight: '700', color: '#fff', textShadow: '0 2px 10px rgba(0, 0, 0, 0.2)' },
  subtitle: { fontSize: '1.1rem', color: 'rgba(255, 255, 255, 0.9)', marginTop: '5px' },
  card: { background: "rgba(255, 255, 255, 0.7)", padding: '25px', borderRadius: '16px', marginBottom: '25px', boxShadow: "0 8px 32px rgba(31, 38, 135, 0.2)", border: '1px solid rgba(255, 255, 255, 0.18)', backdropFilter: 'blur(12px)', WebkitBackdropFilter: 'blur(12px)' },
  sectionHeader: { display: 'flex', alignItems: 'center', gap: '10px', fontSize: '1.25rem', fontWeight: '600', marginBottom: '20px', borderBottom: '1px solid #E5E7EB', paddingBottom: '10px' },
  mainGrid: { display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(400px, 1fr))', gap: '2rem', marginTop: '25px' },
  column: { display: 'flex', flexDirection: 'column', gap: '25px' },
  inputGroup: { display: 'flex', gap: '10px', alignItems: 'center' },
  input: { flex: 1, padding: '12px 15px', borderRadius: '8px', border: '1px solid #D1D5DB', fontSize: '1rem', outline: 'none', transition: 'border-color 0.2s, box-shadow 0.2s', backgroundColor: '#F9FAFB' },
  button: { display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '8px', background: "linear-gradient(90deg, #10b981, #06b6d4)", color: "white", padding: '12px 20px', border: 'none', borderRadius: '8px', cursor: 'pointer', fontWeight: '600', fontSize: '1rem', transition: 'transform 0.2s, box-shadow 0.2s', boxShadow: '0 4px 15px rgba(0, 0, 0, 0.1)' },
  cancelButton: { display: 'flex', alignItems: 'center', gap: '6px', background: '#fee2e2', color: '#ef4444', border: '1px solid #fecaca', borderRadius: '6px', padding: '4px 8px', marginTop: '8px', fontSize: '0.85rem', fontWeight: '600', cursor: 'pointer' },
  detailRow: { display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '10px 0', borderBottom: '1px solid #E5E7EB' },
  detailLabel: { display: 'flex', alignItems: 'center', gap: '8px', fontWeight: '500' },
  detailValue: { display: 'flex', alignItems: 'center', gap: '8px', fontFamily: 'monospace', fontSize: '0.95rem' },
  copyButton: { background: '#E5E7EB', border: 'none', borderRadius: '6px', padding: '4px', cursor: 'pointer', transition: 'background 0.2s' },
  verifyContainer: { marginTop: '20px', padding: '15px', background: '#F3F4F6', borderRadius: '10px', border: '1px solid #E5E7EB' },
  detailText: { margin: '5px 0', fontSize: '0.95rem' },
  link: { color: '#3b82f6', textDecoration: 'none', fontWeight: '500', marginLeft: '10px' },
  balancesContainer: { marginTop: '20px', background: '#F3F4F6', borderRadius: '8px', padding: '10px', fontSize: '0.95rem' },
  balanceRow: { display: 'flex', justifyContent: 'space-between', padding: '5px 0' },
  historyWrapper: { display: 'flex', flexDirection: 'column', gap: '15px', maxHeight: '450px', overflowY: 'auto', paddingRight: '10px' },
  historyCard: { display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '15px', borderRadius: '12px', background: '#fff', boxShadow: '0 4px 15px rgba(0,0,0,0.05)', transition: 'transform 0.2s, box-shadow 0.2s' },
  historyIcon: (status, isSent) => ({ display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0, width: '40px', height: '40px', borderRadius: '50%', color: '#fff', background: status === 'Pending' ? '#F59E0B' : (isSent ? "#EF4444" : "#10B981") }),
  historyDetails: { flex: 1, marginLeft: '15px' },
  historyRow: { display: 'flex', justifyContent: 'space-between', marginBottom: '5px' },
  historyType: (isSent) => ({ fontWeight: '600', color: isSent ? '#EF4444' : '#10B981' }),
  historyAmount: { fontWeight: '600', fontSize: '1.1rem' },
  historyText: { fontSize: '0.9rem', color: '#374151', margin: '3px 0', wordBreak: 'break-word' },
  statusBadge: (status) => ({ fontWeight: '600', padding: '3px 8px', borderRadius: '12px', fontSize: '0.8rem', color: status === 'Success' ? '#065f46' : (status === 'Pending' ? '#92400e' : (status === 'Cancelled' ? '#991b1b' : '#991b1b')), background: status === 'Success' ? '#d1fae5' : (status === 'Pending' ? '#fef3c7' : (status === 'Cancelled' ? '#fee2e2' : '#fee2e2')) }),

  // --- FILLED, COLOURED LOADER STYLES ---
  loaderOverlay: { position: 'fixed', top: 0, left: 0, width: '100%', height: '100%', background: 'rgba(255, 255, 255, 0.2)', backdropFilter: 'blur(10px)', WebkitBackdropFilter: 'blur(10px)', display: 'flex', justifyContent: 'center', alignItems: 'center', zIndex: 9999, animation: 'fadeIn 0.3s ease-in-out' },
  spinnerContainer: { textAlign: 'center', animation: 'zoomIn 0.4s ease-in-out' },
  spinner: {
    width: '80px',
    height: '80px',
    borderRadius: '50%',
    background: 'conic-gradient(#3b82f6, #9333ea, #f43f5e, #10b981, #3b82f6)',
    animation: 'spin 1.2s linear infinite, glow 2s ease-in-out infinite alternate'
  },
  loadingText: { marginTop: '15px', color: '#1f2937', fontWeight: 'bold', fontSize: '1.1rem' },
};

export default App;