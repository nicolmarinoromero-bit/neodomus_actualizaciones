// Componente de navegación y estructura visual: TechnicianSidebar. Se reutiliza en las pantallas de su área.
import SidebarNavigation, { type SidebarSection } from './SidebarNavigation';
import { useIdioma } from "@i18n/IdiomaContext";
import {
  FaBoxOpen,
  FaHouse,
  FaCalendarCheck,
  FaClockRotateLeft,
  FaTruckFast,
  FaUsers,
  FaStar,
  FaShieldHalved,
} from "react-icons/fa6";
import "@styles/admin-sidebar.css";

interface TechnicianSidebarProps {
  open: boolean;
  onNavigate?: () => void;
}

const TechnicianSidebar = ({ open, onNavigate }: TechnicianSidebarProps) => {
  const { t } = useIdioma();

  const secciones: SidebarSection[] = [
    {
      titulo: t('tec.panel'),
      links: [
        { to: "/dashboard/tecnico", icon: <FaHouse />, label: t('tec.inicio') },
      ],
    },
    {
      titulo: t('tec.servicios'),
      links: [
        { to: "/tecnico/citas", icon: <FaCalendarCheck />, label: t('tec.misCitas') },
        { to: "/tecnico/entregas", icon: <FaTruckFast />, label: t('nav.entregas') },
        { to: "/tecnico/devoluciones", icon: <FaBoxOpen />, label: t('tec.devoluciones') },
        { to: "/tecnico/novedades", icon: <FaShieldHalved />, label: t('novedades.admin.titulo') },
        { to: "/tecnico/historial", icon: <FaClockRotateLeft />, label: t('tec.historial') },
      ],
    },
    {
      titulo: t('tec.clientes'),
      links: [
        { to: "/tecnico/clientes", icon: <FaUsers />, label: t('tec.clientes') },
      ],
    },
    {
      titulo: t('tec.calificaciones'),
      links: [
        { to: "/tecnico/calificaciones", icon: <FaStar />, label: t('tec.misCalificaciones') },
      ],
    },
  ];

  return (
    <SidebarNavigation
      open={open}
      ariaLabel={t('tec.menuTecnico')}
      sections={secciones}
      onNavigate={onNavigate}
    />
  );
};

export default TechnicianSidebar;
