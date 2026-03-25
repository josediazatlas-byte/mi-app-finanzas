import { BrowserRouter, Routes, Route } from 'react-router-dom';
import Layout from './components/Layout';
import Inicio from './pages/Inicio';
import Finanzas from './pages/Finanzas';
import Inversiones from './pages/Inversiones';
import Analisis from './pages/Analisis';
import Herramientas from './pages/Herramientas';
import Documentos from './pages/Documentos';

export default function App() {
  return (
    <BrowserRouter>
      <Routes>
        <Route element={<Layout />}>
          <Route path="/" element={<Inicio />} />
          <Route path="/finanzas" element={<Finanzas />} />
          <Route path="/inversiones" element={<Inversiones />} />
          <Route path="/analisis" element={<Analisis />} />
          <Route path="/herramientas" element={<Herramientas />} />
          <Route path="/documentos" element={<Documentos />} />
        </Route>
      </Routes>
    </BrowserRouter>
  );
}
