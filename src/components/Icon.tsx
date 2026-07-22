export type IconName =
  | 'home'
  | 'about'
  | 'programs'
  | 'opportunities'
  | 'bridge'
  | 'vision'
  | 'mission'
  | 'seminar'
  | 'placement'
  | 'mentor'
  | 'teachers'
  | 'ratio'
  | 'region'
  | 'partner'
  | 'contact'
  | 'admin'
  | 'globe'
  | 'back'
  | 'forward'
  | 'add'
  | 'edit'
  | 'close'
  | 'login'
  | 'logout'
  | 'impact';

export function Icon({ name }: { name: IconName }) {
  return (
    <svg className="icon" viewBox="0 0 24 24" aria-hidden="true">
      {name === 'home' && <path d="M3 11.5 12 4l9 7.5V20a1 1 0 0 1-1 1h-5v-6H9v6H4a1 1 0 0 1-1-1v-8.5Z" />}
      {name === 'about' && <path d="M12 3a9 9 0 1 0 0 18 9 9 0 0 0 0-18Zm0 8v6m0-10h.01" />}
      {name === 'programs' && <path d="M4 5.5A2.5 2.5 0 0 1 6.5 3H20v15H6.5A2.5 2.5 0 0 0 4 20.5v-15Zm4 2h8m-8 4h7" />}
      {name === 'opportunities' && <path d="M9 6V5a3 3 0 0 1 6 0v1h4a1 1 0 0 1 1 1v11a2 2 0 0 1-2 2H6a2 2 0 0 1-2-2V7a1 1 0 0 1 1-1h4Zm0 0h6m-9 5h12" />}
      {name === 'bridge' && <path d="M4 17h16M6 17c0-5 2.5-9 6-9s6 4 6 9M8 13h8M12 8v9" />}
      {name === 'vision' && <path d="M2.5 12s3.5-6 9.5-6 9.5 6 9.5 6-3.5 6-9.5 6-9.5-6-9.5-6Zm9.5 3a3 3 0 1 0 0-6 3 3 0 0 0 0 6Z" />}
      {name === 'mission' && <path d="M12 21a9 9 0 1 1 9-9h-4a5 5 0 1 0-5 5v4Zm6-6 3-3-3-3m3 3h-9" />}
      {name === 'seminar' && <path d="M4 6h16v10H4V6Zm3 13h10M9 16v3m6-3v3M8 10h8" />}
      {name === 'placement' && <path d="M4 20V9l8-5 8 5v11H4Zm4 0v-6h8v6M9 10h.01M15 10h.01" />}
      {name === 'mentor' && <path d="M8 11a3 3 0 1 0 0-6 3 3 0 0 0 0 6Zm8 0a3 3 0 1 0 0-6 3 3 0 0 0 0 6ZM3 20a5 5 0 0 1 10 0m-2 0a5 5 0 0 1 10 0" />}
      {name === 'teachers' && <path d="M8 11a3 3 0 1 0 0-6 3 3 0 0 0 0 6Zm8 1a3 3 0 1 0 0-6m-13 14a5 5 0 0 1 10 0m1-1a5 5 0 0 1 7 1" />}
      {name === 'ratio' && <path d="M4 7h9m-9 5h16M11 17h9M17 4l3 3-3 3M7 14l-3 3 3 3" />}
      {name === 'region' && <path d="M12 21s7-5.5 7-12a7 7 0 1 0-14 0c0 6.5 7 12 7 12Zm0-9a3 3 0 1 0 0-6 3 3 0 0 0 0 6Z" />}
      {name === 'partner' && <path d="M8 12 4 8a3 3 0 0 1 4-4l4 4 4-4a3 3 0 0 1 4 4l-4 4m-8 0 4 4 4-4m-8 0 4-4m4 4-4-4" />}
      {name === 'contact' && <path d="M4 5h16v14H4V5Zm0 2 8 6 8-6" />}
      {name === 'admin' && <path d="M12 3 5 6v5c0 4.5 3 8 7 10 4-2 7-5.5 7-10V6l-7-3Zm0 8a2 2 0 1 0 0-4 2 2 0 0 0 0 4Zm-4 5a4 4 0 0 1 8 0" />}
      {name === 'globe' && <path d="M12 3a9 9 0 1 0 0 18 9 9 0 0 0 0-18Zm0 0c2.2 2.3 3.2 5.3 3.2 9S14.2 18.7 12 21m0-18C9.8 5.3 8.8 8.3 8.8 12s1 6.7 3.2 9M3.8 9h16.4M3.8 15h16.4" />}
      {name === 'back' && <path d="M15 6 9 12l6 6" />}
      {name === 'forward' && <path d="m9 6 6 6-6 6" />}
      {name === 'add' && <path d="M12 5v14M5 12h14" />}
      {name === 'edit' && <path d="m4 20 4.2-1 10.6-10.6a2.1 2.1 0 0 0-3-3L5.2 16 4 20Zm10.4-13.2 3 3" />}
      {name === 'close' && <path d="M6 6l12 12M18 6 6 18" />}
      {name === 'login' && <path d="M14 4h5a1 1 0 0 1 1 1v14a1 1 0 0 1-1 1h-5M10 8l4 4-4 4m4-4H4" />}
      {name === 'logout' && <path d="M10 4H5a1 1 0 0 0-1 1v14a1 1 0 0 0 1 1h5m4-12 4 4-4 4m4-4H8" />}
      {name === 'impact' && <path d="M12 20V10m0 10-4-4m4 4 4-4M5 10a7 7 0 0 1 14 0M7 10a5 5 0 0 1 10 0" />}
    </svg>
  );
}
