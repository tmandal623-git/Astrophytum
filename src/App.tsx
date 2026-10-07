// src/App.tsx
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { ThemeProvider }       from './context/ThemeContext';
import { ToastProvider }       from './context/ToastContext';
import { CartProvider }        from './context/CartContext';
import { AuthProvider }        from './context/AuthContext';
import { AuthModalProvider }   from './context/AuthModalContext';
import { MainLayout }          from './layouts/MainLayout';
import { HomePage }            from './pages/HomePage';
import { CactusDetailPage }    from './pages/CactusDetailPage';
import { AuctionsPage }        from './pages/AuctionsPage';
import { MyBidsPage }          from './pages/MyBidsPage';
import { MyCartPage }          from './pages/MyCartPage';
import { CheckoutPage }        from './pages/CheckoutPage';
import { OrderConfirmationPage } from './pages/OrderConfirmationPage';
import { OrderDetailsPage }    from './pages/OrderDetailsPage';
import { AdminPage }           from './pages/AdminPage';
import { ProfilePage }         from './pages/ProfilePage';
import { AdminRoute }          from './components/auth/AdminRoute';
import { ResetPasswordPage }   from './pages/ResetPasswordPage';
import { AboutPage }           from './pages/AboutPage';
import { FaqPage }             from './pages/FaqPage';
import { ShippingPage }        from './pages/ShippingPage';
import { ContactPage }         from './pages/ContactPage';
import { PrivacyPage }         from './pages/PrivacyPage';

export default function App() {
  return (
    // Provider order matters:
    // AuthProvider must wrap AuthModalProvider (modal uses useAuth)
    // AuthModalProvider must wrap MainLayout (header uses useAuthModal)
    <ThemeProvider>
      <ToastProvider>
        <AuthProvider>
          <AuthModalProvider>
            <CartProvider>
              <BrowserRouter>
                <Routes>
                  <Route element={<MainLayout />}>
                    <Route index                    element={<Navigate to="/home" replace />} />
                    <Route path="/home"             element={<HomePage />} />
                    <Route path="/cactus/:id"       element={<CactusDetailPage />} />
                    <Route path="/auctions"         element={<AuctionsPage />} />
                    <Route path="/my-orders"        element={<Navigate to="/profile?tab=orders" />} />
                    <Route path="/my-bids"          element={<Navigate to="/profile?tab=bids" />} />
                    <Route path="/my-cart"          element={<MyCartPage />} />
                    <Route path="/checkout"         element={<CheckoutPage />} />
                    <Route path="/order-confirmed"  element={<OrderConfirmationPage />} />
                    <Route path="/admin"            element={<AdminRoute><AdminPage /></AdminRoute>} />
                    <Route path="/profile"          element={<ProfilePage />} />
                    <Route path="/profile/orders/:id" element={<OrderDetailsPage />} />
                    <Route path="/reset-password"   element={<ResetPasswordPage />} />
                    <Route path="/about"            element={<AboutPage />} />
                    <Route path="/faq"              element={<FaqPage />} />
                    <Route path="/shipping"         element={<ShippingPage />} />
                    <Route path="/contact"          element={<ContactPage />} />
                    <Route path="/privacy"          element={<PrivacyPage />} />
                    <Route path="/categories"       element={<Navigate to="/home" replace />} />
                    <Route path="*"                element={<Navigate to="/home" replace />} />
                  </Route>
                </Routes>
              </BrowserRouter>
            </CartProvider>
          </AuthModalProvider>
        </AuthProvider>
      </ToastProvider>
    </ThemeProvider>
  );
}