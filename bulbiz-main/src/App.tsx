import { Suspense, lazy } from "react";
import { Toaster } from "@/components/ui/toaster";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { ThemeProvider } from "next-themes";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Routes, Route } from "react-router-dom";
import { ProtectedRoute } from "@/components/ProtectedRoute";
import { ComplianceGuard } from "@/components/compliance/ComplianceGuard";
import { MobileBottomNav } from "@/components/MobileBottomNav";
import { AppLayout } from "@/components/AppLayout";
import { ErrorBoundary } from "@/components/ErrorBoundary";
import { PageLoader } from "@/components/PageLoader";

// Eager-loaded lightweight pages
import Auth from "./pages/Auth";
import NotFound from "./pages/NotFound";
import AuthCallback from "./pages/AuthCallback";
import ResetPassword from "./pages/ResetPassword";

// Lazy-loaded heavy pages
const Index = lazy(() => import("./pages/Index"));
const TodoActions = lazy(() => import("./pages/TodoActions"));
const RdvList = lazy(() => import("./pages/RdvList"));
const DossierDetail = lazy(() => import("./pages/DossierDetail"));
const CreateDossier = lazy(() => import("./pages/CreateDossier"));
const Settings = lazy(() => import("./pages/Settings"));
const ClientForm = lazy(() => import("./pages/ClientForm"));
const QuoteEditor = lazy(() => import("./pages/QuoteEditor"));
const QuoteValidation = lazy(() => import("./pages/QuoteValidation"));
const InvoiceEditor = lazy(() => import("./pages/InvoiceEditor"));
const InvoiceView = lazy(() => import("./pages/InvoiceView"));
const PublicClientForm = lazy(() => import("./pages/PublicClientForm"));
const NewQuoteRedirect = lazy(() => import("./pages/NewQuoteRedirect"));
const NewInvoiceRedirect = lazy(() => import("./pages/NewInvoiceRedirect"));
const ComingSoon = lazy(() => import("./pages/ComingSoon"));
const CGU = lazy(() => import("./pages/CGU"));
const MentionsLegales = lazy(() => import("./pages/MentionsLegales"));
const PolitiqueConfidentialite = lazy(() => import("./pages/PolitiqueConfidentialite"));
const DPA = lazy(() => import("./pages/DPA"));
const Cookies = lazy(() => import("./pages/Cookies"));
const AdminErrors = lazy(() => import("./pages/AdminErrors"));
const ComplianceOnboarding = lazy(() => import("./pages/ComplianceOnboarding"));
const ComplianceSettings = lazy(() => import("./pages/ComplianceSettings"));
const MaterialLibrary = lazy(() => import("./pages/MaterialLibrary"));
const AdminCatalogSources = lazy(() => import("./pages/AdminCatalogSources"));

const queryClient = new QueryClient();

const App = () => (
  <ErrorBoundary>
    <QueryClientProvider client={queryClient}>
      <ThemeProvider attribute="class" defaultTheme="light" enableSystem={false}>
        <TooltipProvider>
          <Toaster />
          <Sonner />
          <BrowserRouter>
            <div className="pb-16 md:pb-0">
              <Suspense fallback={<PageLoader />}>
                <Routes>
                  <Route path="/auth" element={<Auth />} />
                  <Route path="/auth/callback" element={<AuthCallback />} />
                  <Route path="/reset-password" element={<ResetPassword />} />
                  <Route path="/client" element={<ErrorBoundary fallbackMessage="Erreur lors du chargement du formulaire"><ClientForm /></ErrorBoundary>} />
                  <Route path="/devis/validation" element={<ErrorBoundary fallbackMessage="Erreur lors du chargement du devis"><QuoteValidation /></ErrorBoundary>} />
                  <Route path="/facture/view" element={<ErrorBoundary fallbackMessage="Erreur lors du chargement de la facture"><InvoiceView /></ErrorBoundary>} />
                  <Route
                    path="/"
                    element={
                      <ProtectedRoute>
                        <AppLayout>
                          <Index />
                        </AppLayout>
                      </ProtectedRoute>
                    }
                  />
                  <Route
                    path="/a-faire"
                    element={
                      <ProtectedRoute>
                        <AppLayout>
                          <TodoActions />
                        </AppLayout>
                      </ProtectedRoute>
                    }
                  />
                  <Route
                    path="/rdv"
                    element={
                      <ProtectedRoute>
                        <AppLayout>
                          <RdvList />
                        </AppLayout>
                      </ProtectedRoute>
                    }
                  />
                  <Route
                    path="/dossier/:id"
                    element={
                      <ProtectedRoute>
                        <AppLayout>
                          <DossierDetail />
                        </AppLayout>
                      </ProtectedRoute>
                    }
                  />
                  <Route
                    path="/nouveau"
                    element={
                      <ProtectedRoute>
                        <AppLayout>
                          <CreateDossier />
                        </AppLayout>
                      </ProtectedRoute>
                    }
                  />
                  <Route
                    path="/dossier/:dossierId/devis"
                    element={
                      <ProtectedRoute>
                        <AppLayout>
                          <ComplianceGuard>
                            <QuoteEditor />
                          </ComplianceGuard>
                        </AppLayout>
                      </ProtectedRoute>
                    }
                  />
                  <Route
                    path="/dossier/:id/facture/:invoiceId"
                    element={
                      <ProtectedRoute>
                        <AppLayout>
                          <ComplianceGuard>
                            <InvoiceEditor />
                          </ComplianceGuard>
                        </AppLayout>
                      </ProtectedRoute>
                    }
                  />
                  <Route
                    path="/parametres"
                    element={
                      <ProtectedRoute>
                        <AppLayout>
                          <ErrorBoundary fallbackMessage="Erreur dans les paramètres">
                            <Settings />
                          </ErrorBoundary>
                        </AppLayout>
                      </ProtectedRoute>
                    }
                  />
                  <Route
                    path="/devis/new"
                    element={
                      <ProtectedRoute>
                        <AppLayout>
                          <NewQuoteRedirect />
                        </AppLayout>
                      </ProtectedRoute>
                    }
                  />
                  <Route
                    path="/facture/new"
                    element={
                      <ProtectedRoute>
                        <AppLayout>
                          <NewInvoiceRedirect />
                        </AppLayout>
                      </ProtectedRoute>
                    }
                  />
                  <Route
                    path="/admin/errors"
                    element={
                      <ProtectedRoute>
                        <AdminErrors />
                      </ProtectedRoute>
                    }
                  />
                  <Route
                    path="/admin/catalogue/sources"
                    element={
                      <ProtectedRoute>
                        <AppLayout>
                          <AdminCatalogSources />
                        </AppLayout>
                      </ProtectedRoute>
                    }
                  />
                  <Route
                    path="/onboarding/conformite"
                    element={
                      <ProtectedRoute>
                        <AppLayout>
                          <ComplianceOnboarding />
                        </AppLayout>
                      </ProtectedRoute>
                    }
                  />
                  <Route
                    path="/parametres/conformite"
                    element={
                      <ProtectedRoute>
                        <AppLayout>
                          <ComplianceSettings />
                        </AppLayout>
                      </ProtectedRoute>
                    }
                  />
                  <Route
                    path="/bibliotheque-materiel"
                    element={
                      <ProtectedRoute>
                        <AppLayout>
                          <MaterialLibrary />
                        </AppLayout>
                      </ProtectedRoute>
                    }
                  />
                  <Route path="/cgu" element={<CGU />} />
                  <Route path="/mentions-legales" element={<MentionsLegales />} />
                  <Route path="/politique-confidentialite" element={<PolitiqueConfidentialite />} />
                  <Route path="/dpa" element={<DPA />} />
                  <Route path="/cookies" element={<Cookies />} />
                  <Route path="/:slug" element={<ErrorBoundary fallbackMessage="Erreur lors du chargement du formulaire"><PublicClientForm /></ErrorBoundary>} />
                  <Route path="*" element={<NotFound />} />
                </Routes>
              </Suspense>
              <MobileBottomNav />
            </div>
          </BrowserRouter>
        </TooltipProvider>
      </ThemeProvider>
    </QueryClientProvider>
  </ErrorBoundary>
);

export default App;
