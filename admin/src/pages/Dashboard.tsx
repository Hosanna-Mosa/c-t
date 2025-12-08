import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import api from '@/lib/api'
import { StatCardSkeleton, TableSkeleton, Skeleton } from '@/components/Skeleton'
import {
  AreaChart,
  Area,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  PieChart,
  Pie,
  Cell,
  Legend
} from 'recharts'

const COLORS = ['#4f46e5', '#10b981', '#f59e0b', '#ef4444']

interface DashboardStats {
  users: number;
  products: number;
  orders: number;
  revenue: number;
  revenueData: Array<{ name: string; revenue: number; orders: number }>;
  categoryData: Array<{ name: string; value: number }>;
  recentOrders: Array<{
    id: string;
    user: { name: string; email: string };
    product: string;
    amount: number;
    status: string;
    date: string;
  }>;
}

export function Dashboard() {
  const navigate = useNavigate()
  const [stats, setStats] = useState<DashboardStats | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    let mounted = true
    api.getStats()
      .then((res) => {
        if (mounted) {
          setStats(res.data)
          setLoading(false)
        }
      })
      .catch((e) => {
        if (mounted) {
          setError(e.message)
          setLoading(false)
        }
      })
    return () => { mounted = false }
  }, [])

  if (loading) {
    return (
      <section className="dashboard">
        <div className="section-header">
          <div>
            <Skeleton width="250px" height="32px" style={{ marginBottom: '8px' }} />
            <Skeleton width="400px" height="16px" />
          </div>
        </div>

        {/* Stats Grid Skeleton */}
        <div className="grid">
          <StatCardSkeleton />
          <StatCardSkeleton />
          <StatCardSkeleton />
          <StatCardSkeleton />
        </div>

        {/* Charts Skeleton */}
        <div className="charts-grid">
          <div className="card chart-card">
            <h3><Skeleton width="180px" height="24px" style={{ marginBottom: '20px' }} /></h3>
            <Skeleton height="300px" />
          </div>
          <div className="card chart-card">
            <h3><Skeleton width="180px" height="24px" style={{ marginBottom: '20px' }} /></h3>
            <Skeleton height="300px" />
          </div>
        </div>

        {/* Table Skeleton */}
        <div className="card" style={{ marginTop: 24 }}>
          <div className="card-header" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 20 }}>
            <h3><Skeleton width="150px" height="24px" /></h3>
          </div>
          <TableSkeleton rows={5} columns={6} />
        </div>
      </section>
    )
  }

  return (
    <section className="dashboard">
      <div className="section-header">
        <div>
          <h2>Dashboard Overview</h2>
          <p style={{ color: 'var(--text-secondary)', marginTop: 4 }}>Welcome back! Here's what's happening with your store.</p>
        </div>
        <div className="date-filter">
          <select style={{ width: 'auto' }}>
            <option>Last 7 Months</option>
          </select>
        </div>
      </div>

      {error && <div className="error">{error}</div>}

      {/* Stats Grid */}
      <div className="grid">
        <div className="stat-card clickable" onClick={() => navigate('/orders')}>
          <div className="stat-icon" style={{ background: 'var(--primary-light)', color: 'var(--primary)' }}>
            🛍️
          </div>
          <div className="stat-content">
            <div className="stat-label">Total Orders</div>
            <div className="stat-value">{stats ? stats.orders : '—'}</div>
            <div className="stat-trend positive">
              <span>All time</span>
            </div>
          </div>
        </div>

        <div className="stat-card clickable" onClick={() => navigate('/products')}>
          <div className="stat-icon" style={{ background: 'var(--success-light)', color: 'var(--success)' }}>
            👕
          </div>
          <div className="stat-content">
            <div className="stat-label">Total Products</div>
            <div className="stat-value">{stats ? stats.products : '—'}</div>
            <div className="stat-trend positive">
              <span>Active</span>
            </div>
          </div>
        </div>

        <div className="stat-card clickable" onClick={() => navigate('/users')}>
          <div className="stat-icon" style={{ background: 'var(--warning-light)', color: 'var(--warning)' }}>
            👥
          </div>
          <div className="stat-content">
            <div className="stat-label">Total Users</div>
            <div className="stat-value">{stats ? stats.users : '—'}</div>
            <div className="stat-trend positive">
              <span>Registered</span>
            </div>
          </div>
        </div>

        <div className="stat-card">
          <div className="stat-icon" style={{ background: '#fee2e2', color: '#ef4444' }}>
            💰
          </div>
          <div className="stat-content">
            <div className="stat-label">Total Revenue</div>
            <div className="stat-value">${stats ? stats.revenue.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 }) : '0.00'}</div>
            <div className="stat-trend positive">
              <span>Delivered orders</span>
            </div>
          </div>
        </div>
      </div>

      {/* Charts Section */}
      <div className="charts-grid">
        {/* Revenue Chart */}
        <div className="card chart-card">
          <h3>Revenue Overview</h3>
          <div style={{ height: 300, marginTop: 20 }}>
            <ResponsiveContainer width="100%" height="100%">
              <AreaChart data={stats?.revenueData || []} margin={{ top: 10, right: 30, left: 0, bottom: 0 }}>
                <defs>
                  <linearGradient id="colorRevenue" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="#4f46e5" stopOpacity={0.8} />
                    <stop offset="95%" stopColor="#4f46e5" stopOpacity={0} />
                  </linearGradient>
                </defs>
                <XAxis dataKey="name" stroke="var(--text-tertiary)" fontSize={12} tickLine={false} axisLine={false} />
                <YAxis stroke="var(--text-tertiary)" fontSize={12} tickLine={false} axisLine={false} tickFormatter={(value) => `$${value}`} />
                <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="var(--border)" />
                <Tooltip
                  contentStyle={{ background: 'var(--panel)', border: '1px solid var(--border)', borderRadius: 8, boxShadow: 'var(--shadow)' }}
                  itemStyle={{ color: 'var(--text)' }}
                  formatter={(value: number) => [`$${value.toFixed(2)}`, 'Revenue']}
                />
                <Area type="monotone" dataKey="revenue" stroke="#4f46e5" fillOpacity={1} fill="url(#colorRevenue)" strokeWidth={2} />
              </AreaChart>
            </ResponsiveContainer>
          </div>
        </div>

        {/* Category Distribution */}
        <div className="card chart-card">
          <h3>Sales by Category</h3>
          <div style={{ height: 300, marginTop: 20 }}>
            <ResponsiveContainer width="100%" height="100%">
              <PieChart>
                <Pie
                  data={stats?.categoryData || []}
                  cx="50%"
                  cy="50%"
                  innerRadius={60}
                  outerRadius={80}
                  fill="#8884d8"
                  paddingAngle={5}
                  dataKey="value"
                >
                  {(stats?.categoryData || []).map((entry, index) => (
                    <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                  ))}
                </Pie>
                <Tooltip
                  contentStyle={{ background: 'var(--panel)', border: '1px solid var(--border)', borderRadius: 8, boxShadow: 'var(--shadow)' }}
                  itemStyle={{ color: 'var(--text)' }}
                />
                <Legend verticalAlign="bottom" height={36} iconType="circle" />
              </PieChart>
            </ResponsiveContainer>
          </div>
        </div>
      </div>

      {/* Recent Orders Table */}
      <div className="card" style={{ marginTop: 24 }}>
        <div className="card-header" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 20 }}>
          <h3>Recent Orders</h3>
        </div>
        <div className="table-container" style={{ overflowX: 'auto' }}>
          <table className="table">
            <thead>
              <tr>
                <th>Order ID</th>
                <th>Customer</th>
                <th>Product</th>
                <th>Amount</th>
                <th>Status</th>
                <th>Date</th>
              </tr>
            </thead>
            <tbody>
              {(stats?.recentOrders || []).map((order) => (
                <tr key={order.id}>
                  <td>#{order.id.slice(-6).toUpperCase()}</td>
                  <td>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                      <div style={{ width: 32, height: 32, borderRadius: '50%', background: '#e2e8f0', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 12, fontWeight: 600 }}>
                        {order.user.name.charAt(0).toUpperCase()}
                      </div>
                      <span>{order.user.name}</span>
                    </div>
                  </td>
                  <td>{order.product}</td>
                  <td style={{ fontWeight: 600 }}>${order.amount.toFixed(2)}</td>
                  <td>
                    <span style={{
                      padding: '4px 12px',
                      borderRadius: 20,
                      fontSize: 12,
                      fontWeight: 600,
                      background: order.status === 'delivered' ? 'var(--success-light)' : order.status === 'placed' ? 'var(--warning-light)' : 'var(--primary-light)',
                      color: order.status === 'delivered' ? 'var(--success)' : order.status === 'placed' ? 'var(--warning)' : 'var(--primary)',
                      textTransform: 'capitalize'
                    }}>
                      {order.status}
                    </span>
                  </td>
                  <td style={{ color: 'var(--text-secondary)' }}>{new Date(order.date).toLocaleDateString()}</td>
                </tr>
              ))}
              {(stats?.recentOrders || []).length === 0 && (
                <tr>
                  <td colSpan={6} style={{ textAlign: 'center', padding: 24, color: 'var(--text-secondary)' }}>
                    No orders found
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>

      <style>{`
        .dashboard {
          animation: fadeIn 0.5s ease-out;
        }
        .dashboard-loading {
          height: 100%;
          display: flex;
          align-items: center;
          justify-content: center;
        }
        .stat-card {
          background: var(--panel);
          border: 1px solid var(--border);
          border-radius: 16px;
          padding: 24px;
          display: flex;
          align-items: flex-start;
          gap: 16px;
          transition: transform 0.2s ease, box-shadow 0.2s ease;
        }
        .stat-card.clickable {
          cursor: pointer;
        }
        .stat-card.clickable:hover {
          transform: translateY(-4px);
          box-shadow: var(--shadow-md);
        }
        .stat-card:not(.clickable):hover {
          transform: translateY(-2px);
          box-shadow: var(--shadow);
        }
        .stat-icon {
          width: 48px;
          height: 48px;
          border-radius: 12px;
          display: flex;
          align-items: center;
          justify-content: center;
          font-size: 24px;
        }
        .stat-content {
          flex: 1;
        }
        .stat-label {
          color: var(--text-secondary);
          font-size: 14px;
          font-weight: 500;
          margin-bottom: 4px;
        }
        .stat-value {
          font-size: 24px;
          font-weight: 700;
          color: var(--text);
          margin-bottom: 4px;
        }
        .stat-trend {
          font-size: 12px;
          font-weight: 500;
          display: flex;
          align-items: center;
          gap: 4px;
        }
        .stat-trend.positive { color: var(--success); }
        .stat-trend.negative { color: var(--danger); }
        
        .charts-grid {
          display: grid;
          grid-template-columns: 2fr 1fr;
          gap: 24px;
          margin-top: 24px;
        }
        
        @media (max-width: 1024px) {
          .charts-grid {
            grid-template-columns: 1fr;
          }
        }
      `}</style>
    </section>
  )
}
