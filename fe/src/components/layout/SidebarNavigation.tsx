import type { ReactNode } from 'react';
import { NavLink } from 'react-router-dom';

export interface SidebarSection {
  titulo: string;
  links: { to: string; icon: ReactNode; label: string; badge?: number }[];
}

interface SidebarNavigationProps {
  open: boolean;
  ariaLabel: string;
  sections: SidebarSection[];
  onNavigate?: () => void;
}

export default function SidebarNavigation({
  open,
  ariaLabel,
  sections,
  onNavigate,
}: SidebarNavigationProps) {
  return (
    <aside className={`admin-sidebar ${open ? 'open' : ''}`}>
      <nav className="sidebar-nav" aria-label={ariaLabel}>
        {sections.map((section) => (
          <div key={section.titulo}>
            <span className="sidebar-section-title">{section.titulo}</span>
            {section.links.map((link) => (
              <NavLink
                key={link.to}
                to={link.to}
                onClick={onNavigate}
                className={({ isActive }) => `sidebar-link ${isActive ? 'active' : ''}`}
              >
                <span className="sidebar-icon">{link.icon}</span>
                <span className="sidebar-label">{link.label}</span>
                {link.badge ? <span className="sidebar-badge">{link.badge}</span> : null}
              </NavLink>
            ))}
          </div>
        ))}
      </nav>
    </aside>
  );
}