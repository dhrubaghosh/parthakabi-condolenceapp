import React from "react";
import { BrowserRouter as Router, Routes, Route } from "react-router-dom";
import HomePage from "./pages/HomePage";


function App() {
  return (
    <div className="font-montserrat">
      <Router>
        <Routes>
          <Route path="/" element={<HomePage />} />
       
        </Routes>
      </Router>
    </div>
  );
}

export default App;
