"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

import {
  authModeLabel,
  roleLabel,
  rolePermissionLabels,
  roleScopeLabel,
} from "@/features/workops/labels";
import type { ApiUser } from "@/features/workops/types";

type DevUser = {
  email: string;
  label: string;
};

type NavItem = {
  href: string;
  label: string;
  shortLabel: string;
};

type LockedNavItem = {
  label: string;
  requiredRole: string;
  shortLabel: string;
};

export function WorkOpsAppFrame({
  authMode,
  canAdmin,
  canApprove,
  children,
  devUsers,
  isLoading,
  me,
  message,
  onSelectedEmailChange,
  onSignIn,
  onSignOut,
  pageDescription,
  pageTitle,
  selectedEmail,
}: {
  authMode: "local" | "cognito";
  canAdmin: boolean;
  canApprove: boolean;
  children: React.ReactNode;
  devUsers: readonly DevUser[];
  isLoading: boolean;
  me: ApiUser | null;
  message: string;
  onSelectedEmailChange: (email: string) => void;
  onSignIn: () => void;
  onSignOut: () => void;
  pageDescription: string;
  pageTitle: string;
  selectedEmail: string;
}) {
  const pathname = usePathname();

  const mainNavItems: NavItem[] = [
    { href: "/dashboard", label: "ダッシュボード", shortLabel: "概要" },
    { href: "/reports", label: "日報", shortLabel: "日報" },
    { href: "/attendance", label: "勤怠", shortLabel: "勤怠" },
    { href: "/expenses", label: "経費申請", shortLabel: "経費" },
  ];

  const workflowNavItems: NavItem[] = canApprove
    ? [{ href: "/approvals", label: "承認", shortLabel: "承認" }]
    : [];

  const adminNavItems: NavItem[] = canAdmin
    ? [
        { href: "/admin/users", label: "ユーザー管理", shortLabel: "ユーザー" },
        { href: "/admin/audit-logs", label: "操作履歴", shortLabel: "履歴" },
      ]
    : [];

  const lockedWorkflowNavItems: LockedNavItem[] = !canApprove && me
    ? [{ label: "承認", requiredRole: "マネージャー以上", shortLabel: "承認" }]
    : [];

  const lockedAdminNavItems: LockedNavItem[] = !canAdmin && me
    ? [
        { label: "ユーザー管理", requiredRole: "管理者", shortLabel: "ユーザー" },
        { label: "操作履歴", requiredRole: "管理者", shortLabel: "履歴" },
      ]
    : [];

  return (
    <main className="app-shell">
      <aside className="app-sidebar">
        <div className="app-brand">
          <p className="app-brand-kicker">AWS Portfolio</p>
          <h1 className="app-brand-title">WorkOps MVP</h1>
          <p className="app-brand-subtitle">勤怠・日報・経費承認デモ</p>
        </div>

        <div className="auth-card">
          {authMode === "local" ? (
            <>
              <label className="block text-sm font-semibold text-slate-700" htmlFor="dev-user">
                ローカルユーザー
              </label>
              <select
                id="dev-user"
                className="mt-2 h-10 w-full rounded-md border border-slate-300 bg-white px-3 text-sm"
                disabled={isLoading}
                value={selectedEmail}
                onChange={(event) => onSelectedEmailChange(event.target.value)}
              >
                {devUsers.map((user) => (
                  <option key={user.email} value={user.email}>
                    {user.label}
                  </option>
                ))}
              </select>
            </>
          ) : (
            <div className="space-y-3">
              <div>
                <p className="text-sm font-semibold text-slate-700">Cognito認証</p>
                <p className="mt-1 text-xs text-slate-500">AWS上のユーザープールでログインします</p>
              </div>
              {me ? (
                <button className="button-secondary w-full" disabled={isLoading} type="button" onClick={onSignOut}>
                  サインアウト
                </button>
              ) : (
                <button className="button-primary w-full" disabled={isLoading} type="button" onClick={onSignIn}>
                  サインイン
                </button>
              )}
            </div>
          )}
        </div>

        <div className="sidebar-role-card">
          <p className="sidebar-role-label">現在のロール</p>
          <div className="mt-2 flex items-center justify-between gap-3">
            <span className="sidebar-role-name">{me ? roleLabel(me.role) : "未認証"}</span>
            <span className="sidebar-auth-mode">{authModeLabel(authMode)}</span>
          </div>
          <p className="mt-2 text-xs leading-5 text-slate-500">{roleScopeLabel(me?.role)}</p>
        </div>

        <div className="permission-card">
          <p className="permission-title">利用可能な権限</p>
          <ul className="permission-list">
            {rolePermissionLabels(me?.role).map((permission) => (
              <li className="permission-item" key={permission}>
                <span className="permission-dot" />
                <span>{permission}</span>
              </li>
            ))}
          </ul>
        </div>

        <nav className="app-nav" aria-label="業務メニュー">
          <NavGroup activePath={pathname} items={mainNavItems} label="メイン" />
          {workflowNavItems.length > 0 && (
            <NavGroup activePath={pathname} items={workflowNavItems} label="ワークフロー" />
          )}
          {lockedWorkflowNavItems.length > 0 && (
            <LockedNavGroup items={lockedWorkflowNavItems} label="ワークフロー" />
          )}
          {adminNavItems.length > 0 && (
            <NavGroup activePath={pathname} items={adminNavItems} label="管理" />
          )}
          {lockedAdminNavItems.length > 0 && (
            <LockedNavGroup items={lockedAdminNavItems} label="管理" />
          )}
        </nav>
      </aside>

      <section className="app-content">
        <header className="app-header">
          <div>
            <p className="app-breadcrumb">WorkOps / {pageTitle}</p>
            <div className="mt-2 flex flex-wrap items-center gap-3">
              <h2 className="text-2xl font-bold tracking-normal text-slate-950">{pageTitle}</h2>
              <span className="status-chip">{message}</span>
            </div>
            <p className="mt-2 max-w-3xl text-sm leading-6 text-slate-600">{pageDescription}</p>
            {me && (
              <div className="mt-3 flex flex-wrap gap-2">
                <span className="access-chip">表示範囲: {roleScopeLabel(me.role)}</span>
                <span className="access-chip">API認可: 有効</span>
              </div>
            )}
          </div>

          {me && (
            <div className="user-card">
              <div className="min-w-0">
                <p className="truncate text-sm font-bold text-slate-950">{me.name}</p>
                <p className="truncate text-xs text-slate-500">{me.email}</p>
              </div>
              <span className="role-badge">{roleLabel(me.role)}</span>
            </div>
          )}
        </header>

        <div aria-busy={isLoading} className="app-page">
          {children}
          {isLoading && (
            <div className="loading-overlay" role="status">
              <div className="loading-card">
                <span className="loading-spinner" />
                <div>
                  <p className="loading-title">データを同期中</p>
                  <p className="loading-text">画面の情報を最新状態に更新しています。</p>
                </div>
              </div>
            </div>
          )}
        </div>
      </section>
    </main>
  );
}

function LockedNavGroup({
  items,
  label,
}: {
  items: LockedNavItem[];
  label: string;
}) {
  return (
    <div className="space-y-1">
      <p className="nav-group-label">{label}</p>
      {items.map((item) => (
        <div className="nav-item nav-item-locked" key={item.label}>
          <span className="nav-item-main">
            <span className="nav-item-dot" />
            <span>{item.label}</span>
          </span>
          <span className="nav-item-short">{item.requiredRole}</span>
        </div>
      ))}
    </div>
  );
}

function NavGroup({
  activePath,
  items,
  label,
}: {
  activePath: string;
  items: NavItem[];
  label: string;
}) {
  return (
    <div className="space-y-1">
      <p className="nav-group-label">{label}</p>
      {items.map((item) => (
        <NavLink activePath={activePath} item={item} key={item.href} />
      ))}
    </div>
  );
}

function NavLink({
  activePath,
  item,
}: {
  activePath: string;
  item: NavItem;
}) {
  const isActive = activePath === item.href || activePath.startsWith(`${item.href}/`);

  return (
    <Link
      aria-current={isActive ? "page" : undefined}
      className={`nav-item ${isActive ? "nav-item-active" : ""}`}
      href={item.href}
    >
      <span className="nav-item-main">
        <span className="nav-item-dot" />
        <span>{item.label}</span>
      </span>
      <span className="nav-item-short">{item.shortLabel}</span>
    </Link>
  );
}
