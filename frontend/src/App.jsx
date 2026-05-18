import { BrowserRouter as Router, Routes, Route, Navigate } from 'react-router-dom';
import Layout from './components/Layout';
import ElectorLogin from './pages/ElectorLogin';
import Voting from './pages/Voting';
import PublicResults from './pages/PublicResults';
import AdminLogin from './pages/AdminLogin';
import AdminDashboard from './pages/AdminDashboard';

function App() {
  return (
    <Router>
      <Layout>
        <Routes>
          <Route path="/" element={<ElectorLogin />} />
          <Route path="/v/:urlToken" element={<ElectorLogin />} />
          <Route path="/vote" element={<Voting />} />
          <Route path="/results" element={<PublicResults />} />
          <Route path="/admin" element={<AdminLogin />} />
          <Route path="/admin/dashboard" element={<AdminDashboard />} />
          <Route path="*" element={<Navigate to="/" replace />} />
        </Routes>
      </Layout>
    </Router>
  );
}

export default App;
