import { BrowserRouter, Routes, Route } from "react-router-dom";
import { Dashboard } from "./PAGES/dashboard";
import {Login} from "./PAGES/login";


function Signup() {
  return <h1 className="text-white text-2xl">Signup Page</h1>;
}

export default function App() {
  return (
    <div className="min-h-screen bg-gray-900">
      <BrowserRouter>
        <Routes>
          <Route path="/" element={<Dashboard />} />
          <Route path="/login" element={<Login />} />
          <Route path="/signup" element={<Signup />} />
        </Routes>
      </BrowserRouter>
    </div>
  );
}