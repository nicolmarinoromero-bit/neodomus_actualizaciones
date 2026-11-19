// Componente de navegación y estructura visual: AdminSidebar. Se reutiliza en las pantallas de su área.
import SidebarNavigation, { type SidebarSection } from './SidebarNavigation';
import { useIdioma } from "@i18n/IdiomaContext";
import {
  FaHouse,
  FaBell,
  FaTags,
  FaUserGear,
  FaCalendarCheck,
  FaEnvelopeOpenText,
  FaUsers,
  FaChartColumn,
  FaTruckField,
  FaRotateLeft,
  FaBoxOpen,
  FaShieldHalved,
} from "react-icons/fa6";
import "../../styles/admin-sidebar.css";

interface AdminSidebarProps {
  open: boolean;
  pendientes: number;
  onNavigate?: () => void;
}

const AdminSidebar = ({ open, pendientes, onNavigate }: AdminSidebarProps) => {
  const { t } = useIdioma();

  const secciones: SidebarSection[] = [
    {
      titulo: t('adm.sidebar.panel'),
      links: [
        { to: "/dashboard/admin", icon: <FaHouse />, label: t('adm.sidebar.inicio') },
        {
          to: "/admin/notificaciones",
          icon: <FaBell />,
          label: t('adm.sidebar.notificaciones'),
          badge: pendientes,
        },
      ],
    },
    {
      titulo: t('adm.sidebar.gestion'),
      links: [
        { to: "/admin/catalogo", icon: <FaTags />, label: t('adm.sidebar.catalogo') },
        { to: "/admin/tecnicos", icon: <FaUserGear />, label: t('adm.sidebar.tecnicos') },
        { to: "/admin/instalaciones", icon: <FaCalendarCheck />, label: t('adm.sidebar.citas') },
        { to: "/admin/pedidos", icon: <FaBoxOpen />, label: t('adm.sidebar.pedidos') },
        { to: "/admin/clientes", icon: <FaUsers />, label: t('adm.sidebar.clientes') },
        { to: "/admin/proveedores", icon: <FaTruckField />, label: t('adm.sidebar.proveedores') },
      ],
    },
    {
      titulo: t('adm.sidebar.sistema'),
      links: [
        { to: "/admin/consultas", icon: <FaEnvelopeOpenText />, label: t('adm.sidebar.solicitudes') },
        { to: "/admin/devoluciones", icon: <FaRotateLeft />, label: t('adm.sidebar.devoluciones') },
        { to: "/admin/novedades", icon: <FaShieldHalved />, label: t('novedades.admin.titulo') },
        { to: "/admin/reportes", icon: <FaChartColumn />, label: t('adm.sidebar.reportes') },
      ],
    },
  ];

  return (
    <SidebarNavigation
      open={open}
      ariaLabel={t('adm.sidebar.menuAria')}
      sections={secciones}
      onNavigate={onNavigate}
    />
  );
};

export default AdminSidebar;
