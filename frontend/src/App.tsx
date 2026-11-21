import { BrowserRouter, Navigate, Route, Routes } from "react-router-dom";
import { Landing } from "./PAGES/Landing";
import { Login } from "./PAGES/login";
import { Signup } from "./PAGES/signup";
import { PatientDashboard } from "./PAGES/PatientDashboard";
import { DoctorDashboard } from "./PAGES/DoctorDashboard";
import { ProtectedRoute, PublicOnlyRoute } from "./components/ProtectedRoute";

export default function App() {
  return (
    <BrowserRouter>
      <Routes>
        <Route path="/" element={<Landing />} />
        <Route path="/login" element={<PublicOnlyRoute><Login /></PublicOnlyRoute>} />
        <Route path="/signup" element={<PublicOnlyRoute><Signup /></PublicOnlyRoute>} />
        <Route path="/patient" element={<ProtectedRoute role="PATIENT"><PatientDashboard /></ProtectedRoute>} />
        <Route path="/doctor" element={<ProtectedRoute role="DOCTOR"><DoctorDashboard /></ProtectedRoute>} />
        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
    </BrowserRouter>
  );
}
