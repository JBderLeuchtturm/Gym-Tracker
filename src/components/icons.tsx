/** Schlanke Inline-Icons (Stroke-Style), damit keine Icon-Bibliothek noetig ist. */
import React from 'react';

type IconProps = React.SVGProps<SVGSVGElement>;

const Base = ({ children, ...props }: IconProps & { children: React.ReactNode }) => (
  <svg
    viewBox="0 0 24 24"
    fill="none"
    stroke="currentColor"
    strokeWidth={1.9}
    strokeLinecap="round"
    strokeLinejoin="round"
    aria-hidden="true"
    width={18}
    height={18}
    {...props}
  >
    {children}
  </svg>
);

export const IconDumbbell = (p: IconProps) => (
  <Base {...p}><path d="M6.5 6.5v11M3.5 9v6M17.5 6.5v11M20.5 9v6M6.5 12h11" /></Base>
);
export const IconCalendar = (p: IconProps) => (
  <Base {...p}><rect x="3" y="5" width="18" height="16" rx="2.5" /><path d="M3 10h18M8 3v4M16 3v4" /></Base>
);
export const IconChart = (p: IconProps) => (
  <Base {...p}><path d="M4 19V5M4 19h16" /><path d="M8 15l3.5-4.5 3 2.5L20 7" /></Base>
);
export const IconFlame = (p: IconProps) => (
  <Base {...p}><path d="M12 3s5 4.2 5 9a5 5 0 0 1-10 0c0-1.6.6-2.8 1.3-3.7.4 1 1 1.7 1.7 2 0-2.6.9-5.4 2-7.3z" /></Base>
);
export const IconUser = (p: IconProps) => (
  <Base {...p}><circle cx="12" cy="8" r="3.6" /><path d="M4.5 20a7.5 7.5 0 0 1 15 0" /></Base>
);
export const IconPlus = (p: IconProps) => (<Base {...p}><path d="M12 5v14M5 12h14" /></Base>);
export const IconCheck = (p: IconProps) => (<Base {...p}><path d="M4.5 12.5l5 5 10-11" /></Base>);
export const IconX = (p: IconProps) => (<Base {...p}><path d="M6 6l12 12M18 6L6 18" /></Base>);
export const IconTrash = (p: IconProps) => (
  <Base {...p}><path d="M4 7h16M9 7V4.5h6V7M6.5 7l1 13h9l1-13M10 11v6M14 11v6" /></Base>
);
export const IconSearch = (p: IconProps) => (
  <Base {...p}><circle cx="11" cy="11" r="6.5" /><path d="M16 16l4.5 4.5" /></Base>
);
export const IconChevronRight = (p: IconProps) => (<Base {...p}><path d="M9 5l7 7-7 7" /></Base>);
export const IconChevronLeft = (p: IconProps) => (<Base {...p}><path d="M15 5l-7 7 7 7" /></Base>);
export const IconChevronDown = (p: IconProps) => (<Base {...p}><path d="M5 9l7 7 7-7" /></Base>);
export const IconEdit = (p: IconProps) => (
  <Base {...p}><path d="M4 20h4l10-10-4-4L4 16v4z" /><path d="M13.5 6.5l4 4" /></Base>
);
export const IconCopy = (p: IconProps) => (
  <Base {...p}><rect x="9" y="9" width="11" height="11" rx="2" /><path d="M5 15V5.5A1.5 1.5 0 0 1 6.5 4H15" /></Base>
);
export const IconClock = (p: IconProps) => (
  <Base {...p}><circle cx="12" cy="12" r="8.5" /><path d="M12 7.5V12l3 2" /></Base>
);
export const IconTrophy = (p: IconProps) => (
  <Base {...p}><path d="M7 4h10v5a5 5 0 0 1-10 0V4z" /><path d="M7 5.5H4.5V7a3 3 0 0 0 3 3M17 5.5h2.5V7a3 3 0 0 1-3 3M9.5 20h5M12 14v6" /></Base>
);
export const IconDownload = (p: IconProps) => (
  <Base {...p}><path d="M12 4v11M7.5 11L12 15.5 16.5 11M5 20h14" /></Base>
);
export const IconUpload = (p: IconProps) => (
  <Base {...p}><path d="M12 16V4.5M7.5 9L12 4.5 16.5 9M5 20h14" /></Base>
);
export const IconRefresh = (p: IconProps) => (
  <Base {...p}><path d="M20 11a8 8 0 1 0-.7 4.5" /><path d="M20 5v6h-6" /></Base>
);
export const IconInfo = (p: IconProps) => (
  <Base {...p}><circle cx="12" cy="12" r="8.5" /><path d="M12 11v5.5M12 7.8v.2" /></Base>
);
export const IconDrag = (p: IconProps) => (
  <Base {...p}><path d="M9 6h.01M15 6h.01M9 12h.01M15 12h.01M9 18h.01M15 18h.01" strokeWidth={2.6} /></Base>
);
export const IconPlay = (p: IconProps) => (<Base {...p}><path d="M7 4.5l12 7.5-12 7.5z" /></Base>);
export const IconPause = (p: IconProps) => (<Base {...p}><path d="M9 5v14M15 5v14" /></Base>);
export const IconScale = (p: IconProps) => (
  <Base {...p}><rect x="3.5" y="4.5" width="17" height="15" rx="3" /><path d="M8 12a4 4 0 0 1 8 0" /><path d="M12 12l2.5-3" /></Base>
);
export const IconUsers = (p: IconProps) => (
  <Base {...p}>
    <circle cx="9" cy="8" r="3.2" />
    <path d="M3 19a6 6 0 0 1 12 0" />
    <path d="M16.5 5.4a3.2 3.2 0 0 1 0 5.2M18 14.2a6 6 0 0 1 3 4.8" />
  </Base>
);
export const IconTarget = (p: IconProps) => (
  <Base {...p}>
    <circle cx="12" cy="12" r="8.5" />
    <circle cx="12" cy="12" r="4.5" />
    <circle cx="12" cy="12" r="1" />
  </Base>
);
export const IconCamera = (p: IconProps) => (
  <Base {...p}>
    <path d="M4 8h3l1.5-2h7L17 8h3v11H4z" />
    <circle cx="12" cy="13" r="3.4" />
  </Base>
);
export const IconRuler = (p: IconProps) => (
  <Base {...p}>
    <path d="M3.5 14.5l11-11 5 5-11 11z" />
    <path d="M7 11l2 2M10 8l2 2M13 5l2 2" />
  </Base>
);
export const IconSwap = (p: IconProps) => (
  <Base {...p}>
    <path d="M4 8h13l-3.5-3.5M20 16H7l3.5 3.5" />
  </Base>
);
export const IconBell = (p: IconProps) => (
  <Base {...p}>
    <path d="M6 9a6 6 0 0 1 12 0c0 5 2 6 2 6H4s2-1 2-6z" />
    <path d="M10 19a2 2 0 0 0 4 0" />
  </Base>
);
export const IconShare = (p: IconProps) => (
  <Base {...p}>
    <circle cx="18" cy="6" r="2.6" />
    <circle cx="6" cy="12" r="2.6" />
    <circle cx="18" cy="18" r="2.6" />
    <path d="M8.4 10.8l7.2-3.6M8.4 13.2l7.2 3.6" />
  </Base>
);
export const IconPrinter = (p: IconProps) => (
  <Base {...p}>
    <path d="M7 9V4h10v5" />
    <path d="M5 9h14v7h-3v4H8v-4H5z" />
  </Base>
);
export const IconMessage = (p: IconProps) => (
  <Base {...p}>
    <path d="M20.5 12.5c0 3.6-3.8 6.5-8.5 6.5-.9 0-1.8-.1-2.6-.3L4 20.5l1.4-3.6C4 15.7 3.5 14.2 3.5 12.5c0-3.6 3.8-6.5 8.5-6.5s8.5 2.9 8.5 6.5z" />
  </Base>
);
