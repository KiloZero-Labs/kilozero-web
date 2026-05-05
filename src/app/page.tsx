export default function Home() {
  return (
    <div className="hero">
      <h1 className="hero-title">Welcome to KiloZero</h1>
      <p className="hero-subtitle">
        The impending release of the world&apos;s most seamless hardware tracking application. 
        KiloZero effortlessly synchronizes your environment, offering a frictionless user experience unlike anything else.
      </p>

      <div className="hero-features">
        <div className="feature-card">
          <h3>Universal Compatibility</h3>
          <p>Seamlessly pair with any supported hardware device instantly. Zero configuration, absolute simplicity.</p>
        </div>
        <div className="feature-card">
          <h3>Real-Time Synchronization</h3>
          <p>Watch your data securely sync to your personal cloud instantly without lifting a finger.</p>
        </div>
        <div className="feature-card">
          <h3>Premium Aesthetics</h3>
          <p>A beautifully crafted dark-mode interface built for modern power users who demand excellence.</p>
        </div>
      </div>
    </div>
  );
}
