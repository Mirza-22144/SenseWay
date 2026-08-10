import { useState } from "react";
import NavBar from "./components/NavBar";
import HomePage from "./pages/HomePage";
import RefugeFinderPage from "./pages/RefugeFinderPage";

function App() {
  const [view, setView] = useState("home");

  return (
    <div className="min-h-screen bg-subtle pb-10">
      <NavBar currentView={view} onNavigate={setView} />
      <main>
        {view === "refuges" ? <RefugeFinderPage /> : <HomePage onFindQuietSpace={() => setView("refuges")} />}
      </main>
    </div>
  );
}

export default App;
