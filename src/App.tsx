import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { ThemeProvider } from './context/ThemeContext';
import { ToastProvider } from './context/ToastContext';
import { MainLayout } from './layouts/MainLayout';
import { HomePage } from './pages/HomePage';
import { CactusDetailPage } from './pages/CactusDetailPage';
import { CategoriesPage } from './pages/CategoriesPage';
import { AuctionsPage } from './pages/AuctionsPage';
import { MyBidsPage } from './pages/MyBidsPage';
import { AdminPage } from './pages/AdminPage';

export default function App() {
  return (
    <ThemeProvider>
      <ToastProvider>
        <BrowserRouter>
          <Routes>
            <Route element={<MainLayout />}>
              <Route index element={<Navigate to="/home" replace />} />
              <Route path="/home"           element={<HomePage />} />
              <Route path="/cactus/:id"     element={<CactusDetailPage />} />
              <Route path="/categories"     element={<CategoriesPage />} />
              <Route path="/auctions"       element={<AuctionsPage />} />
              <Route path="/my-bids"        element={<MyBidsPage />} />
              <Route path="/admin"          element={<AdminPage />} />
              <Route path="*"              element={<Navigate to="/home" replace />} />
            </Route>
          </Routes>
        </BrowserRouter>
      </ToastProvider>
    </ThemeProvider>
  );
}
