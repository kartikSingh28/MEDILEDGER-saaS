import { useNavigate } from "react-router-dom";
import { Shield, Lock, Activity, CheckCircle, FileText, Users, ArrowRight, Zap } from "lucide-react";

export function Dashboard() {
  const navigate = useNavigate();

  return (
    <div className="min-h-screen bg-gradient-to-br from-gray-900 via-blue-900 to-gray-900">
      {/* Background Pattern */}
      <div className="absolute inset-0 overflow-hidden pointer-events-none">
        <div className="absolute top-1/4 left-1/4 w-96 h-96 bg-blue-500/10 rounded-full blur-3xl"></div>
        <div className="absolute bottom-1/4 right-1/4 w-96 h-96 bg-purple-500/10 rounded-full blur-3xl"></div>
      </div>

      {/* Header */}
      <header className="relative z-10 bg-gray-800/30 backdrop-blur-md border-b border-gray-700">
        <div className="max-w-7xl mx-auto px-6 py-4 flex justify-between items-center">
          <div className="flex items-center space-x-3">
            <Shield className="text-blue-400" size={32} />
            <div>
              <h1 className="text-2xl font-bold text-white">MediLedger</h1>
              <p className="text-xs text-gray-400">Blockchain Healthcare</p>
            </div>
          </div>
          
          <div className="flex items-center space-x-4">
            <button
              onClick={() => navigate("/login")}
              className="text-gray-300 hover:text-white px-4 py-2 rounded-lg transition-colors"
            >
              Sign In
            </button>
            <button
              onClick={() => navigate("/signup")}
              className="bg-blue-600 hover:bg-blue-700 text-white px-6 py-2 rounded-lg transition-colors flex items-center space-x-2"
            >
              <span>Get Started</span>
              <ArrowRight size={16} />
            </button>
          </div>
        </div>
      </header>

      {/* Hero Section */}
      <main className="relative z-10 max-w-7xl mx-auto px-6 py-20">
        <div className="text-center mb-16">
          <div className="inline-flex items-center justify-center w-24 h-24 bg-blue-500/20 rounded-full mb-6 border border-blue-500/30">
            <Shield className="text-blue-400" size={48} />
          </div>
          
          <h1 className="text-5xl md:text-6xl font-bold text-white mb-6">
            Secure Medical Records
            <br />
            <span className="text-blue-400">On The Blockchain</span>
          </h1>
          
          <p className="text-xl text-gray-300 max-w-3xl mx-auto mb-10">
            End-to-end encrypted healthcare data storage powered by IPFS and blockchain technology. 
            Take control of your medical records with military-grade security.
          </p>

          <div className="flex items-center justify-center space-x-4">
            <button
              onClick={() => navigate("/signup")}
              className="bg-blue-600 hover:bg-blue-700 text-white px-8 py-4 rounded-xl font-medium transition-all transform hover:scale-[1.05] flex items-center space-x-2 text-lg"
            >
              <span>Start Free Trial</span>
              <ArrowRight size={20} />
            </button>
            
            <button
              onClick={() => navigate("/login")}
              className="bg-gray-700/50 hover:bg-gray-700 text-white px-8 py-4 rounded-xl font-medium transition-all border border-gray-600 text-lg"
            >
              Sign In
            </button>
          </div>
        </div>

        {/* Features Grid */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 mb-20">
          <FeatureCard
            icon={<Lock size={28} />}
            title="AES-256 Encryption"
            description="Military-grade encryption for all medical records"
            color="blue"
          />
          <FeatureCard
            icon={<Activity size={28} />}
            title="IPFS Storage"
            description="Decentralized storage with no single point of failure"
            color="green"
          />
          <FeatureCard
            icon={<CheckCircle size={28} />}
            title="Blockchain Verified"
            description="Immutable audit trail for all access logs"
            color="purple"
          />
          <FeatureCard
            icon={<Zap size={28} />}
            title="Instant Access"
            description="Retrieve your records anytime, anywhere securely"
            color="yellow"
          />
        </div>

        {/* Stats Section */}
        <div className="bg-gray-800/30 backdrop-blur-md rounded-2xl border border-gray-700 p-12 mb-20">
          <div className="grid grid-cols-1 md:grid-cols-3 gap-8 text-center">
            <div>
              <div className="text-4xl font-bold text-blue-400 mb-2">100%</div>
              <div className="text-gray-300">HIPAA Compliant</div>
            </div>
            <div>
              <div className="text-4xl font-bold text-green-400 mb-2">256-bit</div>
              <div className="text-gray-300">AES Encryption</div>
            </div>
            <div>
              <div className="text-4xl font-bold text-purple-400 mb-2">24/7</div>
              <div className="text-gray-300">Secure Access</div>
            </div>
          </div>
        </div>

        {/* How It Works */}
        <div className="mb-20">
          <h2 className="text-3xl font-bold text-white text-center mb-12">How It Works</h2>
          
          <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
            <StepCard
              number="1"
              title="Upload Records"
              description="Securely upload your medical documents with automatic encryption"
              icon={<FileText size={32} />}
            />
            <StepCard
              number="2"
              title="Blockchain Storage"
              description="Files are encrypted and stored on IPFS with blockchain verification"
              icon={<Shield size={32} />}
            />
            <StepCard
              number="3"
              title="Share Securely"
              description="Grant controlled access to healthcare providers when needed"
              icon={<Users size={32} />}
            />
          </div>
        </div>

        {/* CTA Section */}
        <div className="bg-gradient-to-br from-blue-600/20 to-purple-600/20 backdrop-blur-md rounded-2xl border border-blue-500/30 p-12 text-center">
          <h2 className="text-3xl font-bold text-white mb-4">
            Ready to secure your medical records?
          </h2>
          <p className="text-gray-300 mb-8 max-w-2xl mx-auto">
            Join thousands of patients and healthcare providers using MediLedger 
            to protect sensitive medical information.
          </p>
          <button
            onClick={() => navigate("/signup")}
            className="bg-blue-600 hover:bg-blue-700 text-white px-10 py-4 rounded-xl font-medium transition-all transform hover:scale-[1.05] flex items-center space-x-2 mx-auto text-lg"
          >
            <span>Create Your Account</span>
            <ArrowRight size={20} />
          </button>
        </div>
      </main>

      {/* Footer */}
      <footer className="relative z-10 border-t border-gray-800 bg-gray-900/50 backdrop-blur-md mt-20">
        <div className="max-w-7xl mx-auto px-6 py-8">
          <div className="flex items-center justify-between">
            <div className="flex items-center space-x-2">
              <Shield className="text-blue-400" size={24} />
              <span className="text-white font-medium">MediLedger</span>
            </div>
            <p className="text-gray-500 text-sm">
              © 2024 MediLedger. HIPAA & GDPR Compliant.
            </p>
          </div>
        </div>
      </footer>
    </div>
  );
}

// Helper Components
function FeatureCard({ icon, title, description, color }: {
  icon: React.ReactNode;
  title: string;
  description: string;
  color: "blue" | "green" | "purple" | "yellow";
}) {
  const colorClasses = {
    blue: "from-blue-500/20 to-blue-600/20 border-blue-500/50 text-blue-400",
    green: "from-green-500/20 to-green-600/20 border-green-500/50 text-green-400",
    purple: "from-purple-500/20 to-purple-600/20 border-purple-500/50 text-purple-400",
    yellow: "from-yellow-500/20 to-yellow-600/20 border-yellow-500/50 text-yellow-400"
  };

  return (
    <div className={`bg-gradient-to-br ${colorClasses[color]} backdrop-blur-md border rounded-xl p-6 hover:scale-[1.05] transition-transform`}>
      <div className="mb-4">{icon}</div>
      <h3 className="text-white font-bold text-lg mb-2">{title}</h3>
      <p className="text-gray-400 text-sm">{description}</p>
    </div>
  );
}

function StepCard({ number, title, description, icon }: {
  number: string;
  title: string;
  description: string;
  icon: React.ReactNode;
}) {
  return (
    <div className="bg-gray-800/30 backdrop-blur-md rounded-xl border border-gray-700 p-8 text-center hover:border-blue-500/50 transition-colors">
      <div className="inline-flex items-center justify-center w-16 h-16 bg-blue-500/20 rounded-full mb-4 border border-blue-500/30">
        {icon}
      </div>
      <div className="text-blue-400 text-sm font-bold mb-2">STEP {number}</div>
      <h3 className="text-white font-bold text-xl mb-3">{title}</h3>
      <p className="text-gray-400 text-sm">{description}</p>
    </div>
  );
}
