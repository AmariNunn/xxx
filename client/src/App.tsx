import { Switch, Route } from "wouter";
import { TooltipProvider } from "@/components/ui/tooltip";
import NotFound from "@/pages/not-found";
import Login from "@/pages/login";
import Signup from "@/pages/signup";
import ForgotPassword from "@/pages/forgot-password";
import RegistrationSuccess from "@/pages/registration-success";
import Dashboard from "@/pages/dashboard";
import CallDashboard from "@/pages/call-dashboard";
import BusinessProfile from "@/pages/business-profile";

function Router() {
  return (
    <Switch>
      <Route path="/" component={Login} />
      <Route path="/login" component={Login} />
      <Route path="/signup" component={Signup} />
      <Route path="/forgot-password" component={ForgotPassword} />
      <Route path="/registration-success" component={RegistrationSuccess} />
      <Route path="/dashboard" component={Dashboard} />
      <Route path="/call-dashboard" component={CallDashboard} />
      <Route path="/business-profile" component={BusinessProfile} />
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
