import HomePage from "./pages/HomePage";

function App() {
  return (
    <div className="min-h-screen bg-slate-50 pb-10">
      <header className="border-b border-slate-200 bg-white px-4 py-4">
        <h1 className="text-xl font-semibold text-slate-900">SenseWay</h1>
        <p className="text-sm text-slate-500">Calmer walking routes for sensory-sensitive commuters.</p>
      </header>
      <main className="pt-6">
        <HomePage />
      </main>
    </div>
  );
}

export default App;
