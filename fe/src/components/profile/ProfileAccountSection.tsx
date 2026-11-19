import type { ReactNode } from 'react';
import SectionHeader from './SectionHeader';
import { AvatarZone, type AvatarZoneProps } from './AvatarZone';

interface ProfileAccountSectionProps {
  icon: ReactNode;
  title: string;
  subtitle: string;
  avatar: AvatarZoneProps;
  children: ReactNode;
}

/** Comparte el encabezado y el avatar de la sección de cuenta entre perfiles. */
const ProfileAccountSection = ({
  icon,
  title,
  subtitle,
  avatar,
  children,
}: ProfileAccountSectionProps) => (
  <div className="pf-tab">
    <SectionHeader icon={icon} title={title} subtitle={subtitle} />
    <AvatarZone {...avatar} />
    {children}
  </div>
);

export default ProfileAccountSection;
