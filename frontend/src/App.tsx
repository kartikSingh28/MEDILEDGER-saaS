import { BrowserRouter, Routes, Route } from "react-router-dom";
import { Dashboard } from "./PAGES/dashboard";
import { Login } from "./PAGES/login";
import { Signup } from "./PAGES/signup";
import { PatientDashboard } from "./PAGES/PatientDashboard";
import { DoctorDashboard } from "./PAGES/DoctorDashboard";
import { ProtectedRoute } from "./components/ProtectedRoute";

export default function App() {
  return (
    <div className="min-h-screen bg-gray-900">
      <BrowserRouter>
        <Routes>
          <Route path="/" element={<Dashboard />} />
          
          <Route path="/login" element={<Login />} />
          
          <Route path="/signup" element={<Signup />} />

          <Route
            path="/patient"
            element={
              <ProtectedRoute>
                <PatientDashboard />
              </ProtectedRoute>
            }
          />

          <Route
            path="/doctor"
            element={
              <ProtectedRoute>
                <DoctorDashboard />
              </ProtectedRoute>
            }
          />
          
        </Routes>
      </BrowserRouter>
    </div>
  );
}