import { Routes, Route, Navigate } from 'react-router-dom'
import { AuthProvider } from './auth/AuthContext'
import { RequireAuth } from './auth/RequireAuth'
import { Login } from './pages/Login'
import { ForgotPassword } from './pages/ForgotPassword'
import { Dashboard } from './pages/Dashboard'
import { Products } from './pages/Products'
import { CasualProducts } from './pages/CasualProducts'
import { Orders } from './pages/Orders'
import { Users } from './pages/Users'
import { Settings } from './pages/Settings'
import { Designs } from './pages/Designs'
import { HomeSettings } from './pages/HomeSettings'
import { Coupons } from './pages/Coupons'
import { Templates } from './pages/Templates'
import { DTFProducts } from './pages/DTFProducts'
import { AdminLayout } from './components/AdminLayout'

export default function App() {
  return (
    <AuthProvider>
      <Routes>
        <Route path="/login" element={<Login />} />
        <Route path="/forgot-password" element={<ForgotPassword />} />
        <Route
          path="/"
          element={
            <RequireAuth>
              <AdminLayout />
            </RequireAuth>
          }
        >
          <Route index element={<Dashboard />} />
          <Route path="products" element={<Products />} />
          <Route path="casual-products" element={<CasualProducts />} />
          <Route path="dtf-products" element={<DTFProducts />} />
          <Route path="orders" element={<Orders />} />
          <Route path="users" element={<Users />} />
          <Route path="designs" element={<Designs />} />
          <Route path="coupons" element={<Coupons />} />
          <Route path="templates" element={<Templates />} />
          <Route path="home" element={<HomeSettings />} />
          <Route path="settings" element={<Settings />} />
        </Route>
        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
    </AuthProvider>
  )
}


