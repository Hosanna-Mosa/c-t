import { NavLink, Outlet } from 'react-router-dom'
import { useAuth } from '../auth/AuthContext'

export function AdminLayout() {
  const { logout } = useAuth()
  return (
    <div className="layout">
      <aside className="sidebar">
        <div className="brand">CustomTees Admin</div>
        <nav>
          <NavLink to="/" end>Dashboard</NavLink>
          <NavLink to="/products">Custom Products</NavLink>
          <NavLink to="/casual-products">Casual Products</NavLink>
          <NavLink to="/dtf-products">DTF Products</NavLink>
          <NavLink to="/orders">Orders</NavLink>
          <NavLink to="/users">Users</NavLink>
          <NavLink to="/designs">Designs</NavLink>
          <NavLink to="/coupons">Coupons</NavLink>
          <NavLink to="/templates">Templates</NavLink>
          <NavLink to="/home">Home</NavLink>
          <NavLink to="/settings">Settings</NavLink>
        </nav>
        <button className="logout" onClick={logout}>Logout</button>
      </aside>
      <main className="content">
        <Outlet />
      </main>
    </div>
  )
}


