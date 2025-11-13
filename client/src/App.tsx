import { Switch, Route } from "wouter";
import { useEffect } from "react";
import { TooltipProvider } from "@/components/ui/tooltip";
import NotFound from "@/pages/not-found";
import Login from "@/pages/login";
import Signup from "@/pages/signup";
import ForgotPassword from "@/pages/forgot-password";
import RegistrationSuccess from "@/pages/registration-success";
import Dashboard from "@/pages/dashboard";
import CallDashboard from "@/pages/call-dashboard";
import CallReview from "@/pages/call-review";
import BusinessProfile from "@/pages/business-profile";
import SkyIQAgent from "@/pages/skyiq-agent";
import BulkCallerPage from "@/pages/bulk-caller";
// import SmsConversationsPage from "@/pages/sms-conversations"; // Hidden for now
import AccountsPage from "@/pages/accounts";
import AdminUsage from "@/pages/admin-usage";
import AdminPanel from "@/pages/AdminPanel";
import ProtectedRoute from "@/components/protected-route";

function Router() {
  return (
    <Switch>
      {/* Public routes */}
      <Route path="/" component={Login} />
      <Route path="/login" component={Login} />
      <Route path="/signup" component={Signup} />
      <Route path="/forgot-password" component={ForgotPassword} />
      <Route path="/registration-success" component={RegistrationSuccess} />
      
      {/* Protected routes - require authentication */}
      <Route path="/dashboard">
        <ProtectedRoute>
          <Dashboard />
        </ProtectedRoute>
      </Route>
      
      <Route path="/call-dashboard">
        <ProtectedRoute>
          <CallDashboard />
        </ProtectedRoute>
      </Route>
      
      <Route path="/call-review">
        <ProtectedRoute>
          <CallReview />
        </ProtectedRoute>
      </Route>
      
      <Route path="/business-profile">
        <ProtectedRoute>
          <BusinessProfile />
        </ProtectedRoute>
      </Route>
      
      <Route path="/skyiq-agent">
        <ProtectedRoute>
          <SkyIQAgent />
        </ProtectedRoute>
      </Route>
      
      <Route path="/bulk-caller">
        <ProtectedRoute>
          <BulkCallerPage />
        </ProtectedRoute>
      </Route>
      
      <Route path="/accounts">
        <ProtectedRoute>
          <AccountsPage />
        </ProtectedRoute>
      </Route>
      
      {/* SMS Conversations - Hidden for now */}
      {/* <Route path="/sms-conversations">
        <ProtectedRoute>
          <SmsConversationsPage />
        </ProtectedRoute>
      </Route> */}
      
      <Route path="/admin/usage">
        <ProtectedRoute>
          <AdminUsage />
        </ProtectedRoute>
      </Route>
      
      <Route path="/admin">
        <ProtectedRoute>
          <AdminPanel />
        </ProtectedRoute>
      </Route>
      
      <Route component={NotFound} />
    </Switch>
  );
}

function App() {
  return (
    <TooltipProvider>
      <Router />
    </TooltipProvider>
  );
}

export default App;