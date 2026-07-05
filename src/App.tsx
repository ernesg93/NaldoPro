import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { AuthProvider } from './contexts/AuthContext';
import { Layout } from './components/Layout';
import { ProtectedRoute } from './components/ProtectedRoute';
import { Login } from './pages/Login';
import { Catalog } from './pages/Catalog';
import { ProductEditor } from './pages/ProductEditor';
import { TemplateEditor } from './pages/TemplateEditor';
import { Campaigns } from './pages/Campaigns';
import { CampaignEditor } from './pages/CampaignEditor';
import { CampaignShare } from './pages/CampaignShare';

export default function App() {
  return (
    <AuthProvider>
      <BrowserRouter>
        <Routes>
          <Route path="/login" element={<Login />} />
          <Route 
            path="/" 
            element={
              <ProtectedRoute>
                <Layout />
              </ProtectedRoute>
            }
          >
            <Route index element={<Catalog />} />
            <Route path="product/:id" element={<ProductEditor />} />
            <Route path="template" element={<TemplateEditor />} />
            <Route path="campaigns" element={<Campaigns />} />
            <Route path="campaigns/:id" element={<CampaignEditor />} />
            <Route path="campaigns/:id/share" element={<CampaignShare />} />
          </Route>
          <Route path="*" element={<Navigate to="/" replace />} />
        </Routes>
      </BrowserRouter>
    </AuthProvider>
  );
}
