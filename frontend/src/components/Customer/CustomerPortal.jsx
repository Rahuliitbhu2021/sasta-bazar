import React, { useState, useEffect } from 'react';
import { useAuth } from '../../contexts/AuthContext';
import { FaWallet, FaHistory, FaUsers, FaShoppingBag } from 'react-icons/fa';
import api from '../../services/api';

const CustomerPortal = () => {
  const [activeTab, setActiveTab] = useState('profile');
  const [profile, setProfile] = useState(null);
  const [walletBalance, setWalletBalance] = useState(0);
  const [transactions, setTransactions] = useState([]);
  const [commissions, setCommissions] = useState([]);
  const [purchases, setPurchases] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchCustomerData();
  }, []);

  const fetchCustomerData = async () => {
    try {
      const [profileRes, walletRes, transactionsRes, commissionsRes] = await Promise.all([
        api.get('/customers/profile'),
        api.get('/wallet/balance'),
        api.get('/wallet/transactions'),
        api.get('/wallet/commissions')
      ]);
      setProfile(profileRes.data);
      setWalletBalance(walletRes.data.balance);
      setTransactions(transactionsRes.data);
      setCommissions(commissionsRes.data);
    } catch (error) {
      console.error('Error fetching customer data:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleRedeem = async () => {
    const amount = prompt('Enter amount to redeem:', '100');
    if (amount && !isNaN(amount) && amount > 0) {
      try {
        await api.post('/wallet/redeem', { amount: parseFloat(amount) });
        alert('Redeemed successfully!');
        fetchCustomerData();
      } catch (error) {
        alert(error.response?.data?.error || 'Redemption failed');
      }
    }
  };

  if (loading) return <div className="flex justify-center items-center h-screen">Loading...</div>;

  return (
    <div className="min-h-screen bg-gray-100">
      <div className="bg-blue-600 text-white p-6">
        <div className="container mx-auto">
          <h1 className="text-2xl font-bold">Customer Portal</h1>
          <p className="mt-2">Welcome, {profile?.name}</p>
        </div>
      </div>

      <div className="container mx-auto px-4 py-8">
        <div className="flex flex-wrap gap-4 mb-8">
          <button
            onClick={() => setActiveTab('profile')}
            className={`px-6 py-3 rounded-lg ${activeTab === 'profile' ? 'bg-blue-600 text-white' : 'bg-white'}`}
          >
            Profile
          </button>
          <button
            onClick={() => setActiveTab('wallet')}
            className={`px-6 py-3 rounded-lg ${activeTab === 'wallet' ? 'bg-blue-600 text-white' : 'bg-white'}`}
          >
            <FaWallet className="inline mr-2" /> Wallet
          </button>
          <button
            onClick={() => setActiveTab('commissions')}
            className={`px-6 py-3 rounded-lg ${activeTab === 'commissions' ? 'bg-blue-600 text-white' : 'bg-white'}`}
          >
            <FaUsers className="inline mr-2" /> Commissions
          </button>
          <button
            onClick={() => setActiveTab('purchases')}
            className={`px-6 py-3 rounded-lg ${activeTab === 'purchases' ? 'bg-blue-600 text-white' : 'bg-white'}`}
          >
            <FaShoppingBag className="inline mr-2" /> Purchases
          </button>
        </div>

        {activeTab === 'profile' && (
          <div className="bg-white rounded-lg shadow p-6">
            <h2 className="text-xl font-bold mb-4">Profile Information</h2>
            <div className="space-y-3">
              <p><strong>Customer ID:</strong> {profile?.customer_id}</p>
              <p><strong>Name:</strong> {profile?.name}</p>
              <p><strong>Mobile:</strong> {profile?.mobile}</p>
              <p><strong>Address:</strong> {profile?.address || 'Not provided'}</p>
              <p><strong>Referral Code:</strong> <code className="bg-gray-100 px-2 py-1 rounded">{profile?.referral_code}</code></p>
              <p><strong>Total Purchases:</strong> ₹{profile?.total_purchases}</p>
            </div>
          </div>
        )}

        {activeTab === 'wallet' && (
          <div className="bg-white rounded-lg shadow p-6">
            <div className="flex justify-between items-center mb-6">
              <h2 className="text-xl font-bold">Wallet Balance</h2>
              <button
                onClick={handleRedeem}
                className="bg-green-500 text-white px-4 py-2 rounded-lg hover:bg-green-600"
              >
                Redeem
              </button>
            </div>
            <div className="text-3xl font-bold text-blue-600 mb-6">₹{walletBalance}</div>
            
            <h3 className="font-semibold mb-3">Transaction History</h3>
            <div className="space-y-2">
              {transactions.map((tx) => (
                <div key={tx.id} className="flex justify-between items-center border-b py-2">
                  <div>
                    <p className="font-medium">{tx.transaction_type}</p>
                    <p className="text-sm text-gray-500">{new Date(tx.created_at).toLocaleDateString()}</p>
                  </div>
                  <div className={`font-bold ${tx.transaction_type === 'CREDIT' ? 'text-green-600' : 'text-red-600'}`}>
                    {tx.transaction_type === 'CREDIT' ? '+' : '-'}₹{tx.amount}
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {activeTab === 'commissions' && (
          <div className="bg-white rounded-lg shadow p-6">
            <h2 className="text-xl font-bold mb-4">Commission Earnings</h2>
            <div className="space-y-3">
              {commissions.map((comm) => (
                <div key={comm.id} className="border-b py-3">
                  <p><strong>Amount:</strong> ₹{comm.amount}</p>
                  <p><strong>From Customer:</strong> {comm.referred_customer_name}</p>
                  <p><strong>Bill:</strong> {comm.bill_number}</p>
                  <p><strong>Date:</strong> {new Date(comm.created_at).toLocaleDateString()}</p>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>
    </div>
  );
};

export default CustomerPortal;