import NavBar from "./components/NavBar";
import HomePage from "./pages/HomePage";

function App() {
  return (
    <div className="min-h-screen bg-subtle pb-10">
      <NavBar />
      <main>
        <HomePage />
      </main>
    </div>
  );
}

export default App;
