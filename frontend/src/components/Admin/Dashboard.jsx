import React, { useState, useEffect } from 'react';
import { 
  LineChart, Line, BarChart, Bar, XAxis, YAxis, CartesianGrid, 
  Tooltip, Legend, ResponsiveContainer, PieChart, Pie, Cell 
} from 'recharts';
import { FaShoppingCart, FaUsers, FaMoneyBillWave, FaExclamationTriangle } from 'react-icons/fa';
import api from '../../services/api';
import Layout from '../Layout/Layout';

const Dashboard = () => {
  const [stats, setStats] = useState({
    total_sales: 0,
    total_profit: 0,
    total_customers: 0,
    total_commission: 0,
    low_stock_alerts: 0
  });
  const [dailySales, setDailySales] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchDashboardData();
  }, []);

  const fetchDashboardData = async () => {
    try {
      const [statsRes, salesRes] = await Promise.all([
        api.get('/reports/dashboard'),
        api.get('/reports/daily-sales')
      ]);
      setStats(statsRes.data);
      setDailySales(salesRes.data);
    } catch (error) {
      console.error('Error fetching dashboard data:', error);
    } finally {
      setLoading(false);
    }
  };

  const StatCard = ({ title, value, icon, color }) => (
    <div className="bg-white rounded-lg shadow p-6">
      <div className="flex items-center justify-between">
        <div>
          <p className="text-gray-500 text-sm">{title}</p>
          <p className="text-2xl font-bold mt-2">₹{value.toLocaleString()}</p>
        </div>
        <div className={`text-${color}-500 text-3xl`}>{icon}</div>
      </div>
    </div>
  );

  if (loading) return <div className="flex justify-center items-center h-screen">Loading...</div>;

  return (
    <Layout>
      <div className="p-6">
        <h1 className="text-2xl font-bold mb-6">Dashboard</h1>
        
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-5 gap-6 mb-8">
          <StatCard title="Total Sales" value={stats.total_sales} icon={<FaMoneyBillWave />} color="green" />
          <StatCard title="Total Profit" value={stats.total_profit} icon={<FaMoneyBillWave />} color="blue" />
          <StatCard title="Total Customers" value={stats.total_customers} icon={<FaUsers />} color="purple" />
          <StatCard title="Commission Paid" value={stats.total_commission} icon={<FaMoneyBillWave />} color="orange" />
          <StatCard title="Low Stock Alerts" value={stats.low_stock_alerts} icon={<FaExclamationTriangle />} color="red" />
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          <div className="bg-white rounded-lg shadow p-6">
            <h2 className="text-lg font-semibold mb-4">Daily Sales (Last 30 Days)</h2>
            <ResponsiveContainer width="100%" height={300}>
              <LineChart data={dailySales}>
                <CartesianGrid strokeDasharray="3 3" />
                <XAxis dataKey="date" />
                <YAxis />
                <Tooltip />
                <Legend />
                <Line type="monotone" dataKey="total_sales" stroke="#8884d8" />
                <Line type="monotone" dataKey="bill_count" stroke="#82ca9d" />
              </LineChart>
            </ResponsiveContainer>
          </div>

          <div className="bg-white rounded-lg shadow p-6">
            <h2 className="text-lg font-semibold mb-4">Top Products</h2>
            {/* Add top products chart here */}
          </div>
        </div>
      </div>
    </Layout>
  );
};

export default Dashboard;