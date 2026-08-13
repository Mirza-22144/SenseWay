import { useState } from "react";
import NavBar from "./components/NavBar";
import LandingPage from "./pages/LandingPage";
import HomePage from "./pages/HomePage";
import RefugeFinderPage from "./pages/RefugeFinderPage";

function App() {
  const [view, setView] = useState("landing");

  return (
    <div className="min-h-screen bg-subtle pb-10">
      <NavBar currentView={view} onNavigate={setView} />
      <main>
        {view === "landing" && <LandingPage onGetStarted={() => setView("planner")} />}
        {view === "refuges" && <RefugeFinderPage />}
        {view === "planner" && <HomePage />}
      </main>
    </div>
  );
}

export default App;
