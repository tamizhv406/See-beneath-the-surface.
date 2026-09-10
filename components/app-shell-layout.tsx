"use client";

import React from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { useOceanData } from "@/lib/ocean-context";
import { ProvenanceModal } from "@/components/provenance-modal";
import { SectionLabel } from "@/components/metric-card";
import {
  Activity,
  ArrowLeft,
  BarChart3,
  Bot,
  Calendar,
  ChevronRight,
  Database,
  Gauge,
  Layers3,
  Map as MapIcon,
  Menu,
  Play,
  Satellite,
  ShieldCheck,
  TrendingUp,
  Waves,
  X,
} from "lucide-react";

export const navItems = [
  { label: "Overview", icon: Gauge, href: "/" },
  { label: "Ocean Map (2D)", icon: MapIcon, href: "/map-2d" },
  { label: "3D Ocean Volume", icon: Layers3, href: "/ocean-3d" },
  { label: "AI Reconstruction", icon: Bot, href: "/reconstruction" },
  { label: "Subsurface Analysis", icon: Activity, href: "/subsurface" },
  { label: "Historical Data", icon: Calendar, href: "/historical" },
  { label: "Prediction", icon: TrendingUp, href: "/prediction" },
  { label: "Data Quality", icon: ShieldCheck, href: "/data-quality" },
  { label: "Data Sources & Lineage", icon: Database, href: "/provenance" },
];

export function AppShellLayout({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const {
    mobileOpen,
    setMobileOpen,
    switchMarineStation,
    runPipelineDemo,
    demoRunning,
    provenanceModalOpen,
    setProvenanceModalOpen,
    provenanceSourceKey,
    provenanceContextPoint,
    setMode,
  } = useOceanData();

  // Find active nav title
  const currentNav =
    navItems.find((item) => item.href === pathname) ||
    navItems.find((item) => item.href !== "/" && pathname.startsWith(item.href)) ||
    navItems[0];

  return (
    <main className="app-shell">
      {/* Sidebar Navigation */}
      <aside className={`sidebar ${mobileOpen ? "open" : ""}`}>
        <div className="brand">
          <Link
            href="/"
            onClick={() => setMobileOpen(false)}
            style={{
              display: "flex",
              alignItems: "center",
              gap: "10px",
              textDecoration: "none",
              color: "inherit",
              flex: 1,
            }}
            title="OceanEmbed Home / Overview"
          >
            <div className="brand-mark">
              <Waves size={18} />
            </div>
            <div>
              <strong>
                OCEAN<span>EMBED</span>
              </strong>
              <small>Project 26066 · Real Ocean Data</small>
            </div>
          </Link>
          <button
            className="mobile-close"
            onClick={() => setMobileOpen(false)}
            aria-label="Close navigation"
          >
            <X size={18} />
          </button>
        </div>

        <div className="sidebar-section">
          <SectionLabel>Scientific Workspaces</SectionLabel>
          {navItems.map(({ label, icon: Icon, href }) => {
            const isActive =
              href === "/" ? pathname === "/" : pathname === href || pathname.startsWith(href + "/");

            return (
              <Link
                key={label}
                href={href}
                className={`nav-item ${isActive ? "active" : ""}`}
                onClick={() => {
                  if (href === "/ocean-3d") setMode("3D");
                  if (href === "/map-2d" || href === "/") setMode("2D");
                  setMobileOpen(false);
                }}
                style={{ textDecoration: "none" }}
              >
                <Icon size={16} />
                <span>{label}</span>
                {isActive && <ChevronRight size={14} />}
              </Link>
            );
          })}
        </div>

        <div className="sidebar-bottom">
          <SectionLabel>Scientific Data Provenance</SectionLabel>
          <div className="system-card">
            <span className="status-dot" />
            <div>
              <strong>100% Real Ocean Data</strong>
              <small>Copernicus GLORYS + INCOIS Argo</small>
            </div>
          </div>
          <div
            style={{
              padding: "0 10px",
              marginTop: "8px",
              fontSize: "10px",
              color: "var(--muted-foreground)",
            }}
          >
            Zero synthetic measurements. Missing values reported honestly.
          </div>
        </div>
      </aside>

      {/* Main Content Shell */}
      <section className="content-shell">
        <header className="topbar">
          <button
            className="menu-button"
            onClick={() => setMobileOpen(true)}
            aria-label="Open navigation"
          >
            <Menu size={20} />
          </button>

          <div className="breadcrumb">
            <Link
              href="/"
              style={{ color: "inherit", textDecoration: "none" }}
              className="breadcrumb-home"
              title="Return to Overview"
            >
              OceanEmbed
            </Link>
            <ChevronRight size={14} />
            <strong>{currentNav.label}</strong>
          </div>

          {pathname !== "/" && (
            <Link
              href="/"
              className="secondary-button"
              style={{
                textDecoration: "none",
                marginLeft: "8px",
                display: "inline-flex",
                alignItems: "center",
                gap: "5px",
                fontSize: "11px",
                padding: "0 10px",
                height: "30px",
              }}
              title="Return to Main Overview Page"
            >
              <ArrowLeft size={13} /> Overview
            </Link>
          )}

          <div className="top-actions">
            <button
              className="secondary-button"
              onClick={switchMarineStation}
              title="Switch to next canonical Indian Ocean marine station"
            >
              <Satellite size={15} /> Switch Marine Station
            </button>
            <button
              className="primary-button"
              onClick={runPipelineDemo}
              disabled={demoRunning}
              title="Run end-to-end OceanEmbed reconstruction pipeline"
            >
              <Play size={14} fill="currentColor" />
              {demoRunning ? "Running Pipeline…" : "Run OceanEmbed"}
            </button>
          </div>
        </header>

        {children}

        {/* Global Footer */}
        <div style={{ maxWidth: "1440px", margin: "auto", padding: "0 34px 24px" }}>
          <footer>
            <span>OceanEmbed / SIH 26066 Scientific Research Interface</span>
            <span>
              All measurements trace to authoritative ocean observation and physical model services. Absolute Rule #1 Compliant: Zero synthetic data.
            </span>
          </footer>
        </div>
      </section>

      {/* Scientific Provenance Modal */}
      <ProvenanceModal
        isOpen={provenanceModalOpen}
        onClose={() => setProvenanceModalOpen(false)}
        initialKey={provenanceSourceKey}
        contextPoint={provenanceContextPoint}
      />
    </main>
  );
}
