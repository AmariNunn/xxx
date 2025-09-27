import { Switch, Route } from "wouter";
import { TooltipProvider } from "@/components/ui/tooltip";
import SkyIQDashboard from "@/pages/skyiq-dashboard";

function Router() {
  return (
    <Switch>
      {/* SkyIQ Dashboard - Default route */}
      <Route path="/" component={SkyIQDashboard} />
      <Route path="/dashboard" component={SkyIQDashboard} />
      
      {/* Catch all */}
      <Route>
        <SkyIQDashboard />
      </Route>
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