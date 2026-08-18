export const isLocalDemoEnabled = Boolean(
  import.meta.env.DEV && import.meta.env.VITE_ENABLE_LOCAL_DEMO === 'true'
);
