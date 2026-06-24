export default function DashboardLoading() {
  return (
    <main className="content dashboard-loading-page" aria-busy="true">
      <div className="dashboard-loading-bar" />
      <section className="metric-grid" aria-label="Loading dashboard">
        <div className="metric-card dashboard-loading-card" />
        <div className="metric-card dashboard-loading-card" />
        <div className="metric-card dashboard-loading-card" />
        <div className="metric-card dashboard-loading-card" />
      </section>
      <section className="panel dashboard-loading-panel" />
    </main>
  );
}
