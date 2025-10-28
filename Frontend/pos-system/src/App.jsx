/*
  App root and router configuration.

  Responsibilities:
  - Compose application pages and register routes.
  - Wrap protected pages with `ProtectedRoute` which checks authentication.

  Routes:
  - `/`         -> Login page (public)
  - Role-based landing after login (no RoleSelect screen)
  - `/warehouse`-> Warehouse/settings page (protected)
  - `/sales`    -> Sales dashboard (protected)
  - `/admin`    -> Admin dashboard (protected)

  Note:
  - Admin role editor is mounted at `/admin/roles` (see AdminRoles page) so admin configuration
    doesn't collide with the Admin dashboard route.
*/
import "./App.css";
import { BrowserRouter as Router, Routes, Route, Navigate } from "react-router-dom";
import Login from "./pages/Login";
import ProtectedRoute from "./components/ProtectedRoute";
// previous: import Home from "./pages/Home";
import Warehouse from "./pages/Warehouse";
import Sales from "./pages/Sales";
// previous: import Users from "./pages/Users";
import Admin from "./pages/Admin";
import AdminLayout from "./pages/admin/AdminLayout";
import AdminDashboard from "./pages/admin/Dashboard";
import AdminPermissions from "./pages/admin/Permissions";
import UserPermission from "./pages/admin/UserPermission";
import CreateUser from "./pages/admin/CreateUser";
import AdminLogs from "./pages/admin/Logs";
import ProductManagement from "./pages/admin/ProductManagement";

export default function App() {
  return (
    <Router>
      <main>
        <Routes>
          <Route path="/" element={<Login />} />
          {/* RoleSelect removed: users go directly to their role's home */}
          <Route path="/warehouse" element={<ProtectedRoute><Warehouse /></ProtectedRoute>} />
          <Route path="/sales" element={<ProtectedRoute><Sales /></ProtectedRoute>} />
          <Route path="/admin" element={<ProtectedRoute><AdminLayout /></ProtectedRoute>}>
            <Route index element={<Navigate to="dashboard" replace />} />
            <Route path="dashboard" element={<AdminDashboard />} />
            <Route path="permissions" element={<AdminPermissions />} />
            <Route path="permissions/create" element={<CreateUser />} />
            <Route path="permissions/:username" element={<UserPermission />} />
            <Route path="products" element={<ProductManagement />} />
            <Route path="logs" element={<AdminLogs />} />
          </Route>
        </Routes>
      </main>
    </Router>
  );
}
