import { Outlet } from 'react-router-dom';
import Navbar from './Navbar';
import Footer from './Footer';
import AmbientBackground from './AmbientBackground';
import CalificacionObligatoriaModal from '@components/CalificacionObligatoriaModal';
import { useAuth } from '@contexts/AuthContext';

const MainLayout = () => {
  const { user } = useAuth();
  const isCliente = user?.rol === 'cliente';

  return (
    <div style={{ display: 'flex', flexDirection: 'column', minHeight: '100vh' }}>
      <AmbientBackground />
      <Navbar />
      <main style={{ flex: 1 }}>
        {/* El Outlet renderiza la página que corresponda según la ruta */}
        <Outlet />
      </main>
      <Footer />
      {isCliente && <CalificacionObligatoriaModal />}
    </div>
  );
};

export default MainLayout;
