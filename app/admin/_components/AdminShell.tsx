"use client";

import * as React from "react";
import Link from "next/link";
import Image from "next/image";
import { usePathname, useRouter } from "next/navigation";
import {
	Archive,
	Calendar as CalendarIcon,
	Camera,
	ChevronLeft,
	ChevronRight,
	Euro,
	LayoutGrid,
	LogOut,
	Menu,
	Plus,
	Shield,
	UserCircle,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import {
	Dialog,
	DialogContent,
	DialogDescription,
	DialogHeader,
	DialogTitle,
	DialogTrigger,
} from "@/components/ui/dialog";
import {
	DropdownMenu,
	DropdownMenuContent,
	DropdownMenuItem,
	DropdownMenuLabel,
	DropdownMenuSeparator,
	DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { AdminMain } from "./AdminMain";

type NavItem = {
	href: string;
	label: string;
	icon: React.ComponentType<{ className?: string }>;
};

const NAV_ITEMS: NavItem[] = [
	{ href: "/admin/planning", label: "Calendrier", icon: LayoutGrid },
	{ href: "/admin/costs", label: "Récap coûts", icon: Euro },
	{ href: "/admin/archives", label: "Archives", icon: Archive },
	{ href: "/admin/photographers", label: "Photographes", icon: Camera },
	{ href: "/admin/admins", label: "Admins", icon: Shield },
	{ href: "/admin/account", label: "Mon compte", icon: UserCircle },
];

type Crumb = { label: string; href?: string };

function getAdminMeta(pathname: string): { title: string; crumbs: Crumb[]; primaryAction?: { href: string; label: string } } {
	const parts = pathname.split("/").filter(Boolean);
	const crumbs: Crumb[] = [{ label: "Admin", href: "/admin/planning" }];

	if (parts.length < 2) return { title: "Admin", crumbs };

	const section = parts[1];

	if (section === "photographers") {
		crumbs.push({ label: "Photographes", href: "/admin/photographers" });
		if (parts.length === 2) {
			return { title: "Photographes", crumbs };
		}
		crumbs.push({ label: `Photographe` });
		return { title: "Détails du photographe", crumbs };
	}

	if (section === "admins") {
		crumbs.push({ label: "Admins", href: "/admin/admins" });
		if (parts.length === 2) {
			return { title: "Admins", crumbs };
		}
		// /admin/admins/new
		if (parts[2] === "new") {
			crumbs.push({ label: "Nouveau" });
			return { title: "Nouvel admin", crumbs };
		}
		crumbs.push({ label: `Admin` });
		return { title: "Détails de l'admin", crumbs };
	}

	if (section === "calendrier") {
		crumbs.push({ label: "Calendrier", href: "/admin/planning" });

		// /admin/planning
		if (parts.length === 2) {
			return { title: "Calendrier", crumbs };
		}

		// /admin/planning/new
		if (parts[2] === "new") {
			crumbs.push({ label: "Nouveau" });
			return { title: "Nouvelle course", crumbs };
		}

		// /admin/planning/stats
		if (parts[2] === "stats") {
			crumbs.push({ label: "Statistiques" });
			return { title: "Statistiques calendrier", crumbs };
		}

		// /admin/planning/[id]
		crumbs.push({ label: `Course` });
		return { title: "Détail de la course", crumbs };
	}

	if (section === "archives") {
		crumbs.push({ label: "Archives", href: "/admin/archives" });
		return { title: "Archives", crumbs };
	}

	if (section === "account") {
		crumbs.push({ label: "Mon compte" });
		return { title: "Mon compte", crumbs };
	}

	crumbs.push({ label: section });
	return { title: section, crumbs };
}

function NavLink({
	item,
	pathname,
	collapsed,
	onNavigate,
}: {
	item: NavItem;
	pathname: string;
	collapsed: boolean;
	onNavigate?: () => void;
}) {
	const Icon = item.icon;
	const active = pathname === item.href || pathname.startsWith(item.href + "/");
	return (
		<Link
			href={item.href}
			onClick={onNavigate}
			title={collapsed ? item.label : undefined}
			aria-current={active ? "page" : undefined}
			className={cn(
				"group flex items-center gap-3 rounded-lg px-3 py-2 text-sm font-medium transition-all duration-200 focus-visible:outline-hidden focus-visible:ring-2 focus-visible:ring-gray-500/30",
				active
					? "bg-gray-600 text-white shadow-lg dark:bg-gray-700"
					: "text-muted-foreground hover:text-foreground hover:bg-gray-100 dark:hover:bg-gray-900/20"
			)}
		>
			<Icon className={cn("size-4 shrink-0 transition-colors", active ? "text-white" : "text-muted-foreground group-hover:text-foreground")} />
			<span className={cn("truncate", collapsed && "sr-only")}>{item.label}</span>
		</Link>
	);
}

function SidebarContent({
	pathname,
	collapsed,
	onNavigate,
}: {
	pathname: string;
	collapsed: boolean;
	onNavigate?: () => void;
}) {
	return (
		<nav className="flex flex-col gap-1 p-2">
			{NAV_ITEMS.map((item) => (
				<NavLink
					key={item.href}
					item={item}
					pathname={pathname}
					collapsed={collapsed}
					onNavigate={onNavigate}
				/>
			))}
		</nav>
	);
}

function AdminUserMenu({ user }: { user: { email: string; prenom: string; nom?: string } | null }) {
	const router = useRouter();
	const [mounted, setMounted] = React.useState(false);

	React.useEffect(() => {
		setMounted(true);
	}, []);

	const handleLogout = async () => {
		await fetch('/api/auth/logout', { method: 'POST' });
		router.push('/login');
		router.refresh();
	};

	const email = user?.email ?? "Compte";
	const name = user?.prenom ?? "";

	// Prevent hydration mismatch by not rendering DropdownMenu until mounted
	if (!mounted) {
		return (
			<Button variant="ghost" className="gap-2 rounded-xl px-2">
				<UserCircle className="size-5 text-muted-foreground" />
				<span className="hidden md:inline text-sm">{name || email}</span>
			</Button>
		);
	}

	return (
		<DropdownMenu>
			<DropdownMenuTrigger asChild>
				<Button variant="ghost" className="gap-2 rounded-xl px-2">
					<UserCircle className="size-5 text-muted-foreground" />
					<span className="hidden md:inline text-sm">{name || email}</span>
				</Button>
			</DropdownMenuTrigger>
			<DropdownMenuContent align="end" className="min-w-64">
				<DropdownMenuLabel className="flex flex-col gap-0.5">
					<span className="text-sm font-medium">{name}</span>
					<span className="text-xs text-muted-foreground">{email}</span>
				</DropdownMenuLabel>
				<DropdownMenuSeparator />
				<DropdownMenuItem onSelect={() => router.push("/admin/account")}>
					<UserCircle className="size-4" />
					Mon compte
				</DropdownMenuItem>
				<DropdownMenuItem onSelect={() => router.push("/admin/planning")}>
					<LayoutGrid className="size-4" />
					Calendrier
				</DropdownMenuItem>
				<DropdownMenuSeparator />
				<DropdownMenuItem
					className="text-gray-600 focus:text-gray-600"
					onSelect={handleLogout}
				>
					<LogOut className="size-4" />
					Se déconnecter
				</DropdownMenuItem>
			</DropdownMenuContent>
		</DropdownMenu>
	);
}

export function AdminShell({ children, user }: { children: React.ReactNode; user: { email: string; prenom: string; nom?: string } | null }) {
	const pathname = usePathname();
	const [collapsed, setCollapsed] = React.useState(false);
	const [mounted, setMounted] = React.useState(false);
	const [mobileMenuOpen, setMobileMenuOpen] = React.useState(false);
	const meta = React.useMemo(() => getAdminMeta(pathname), [pathname]);

	// Prevent hydration mismatch with Radix UI components
	React.useEffect(() => {
		setMounted(true);
	}, []);

	// Close mobile menu when pathname changes
	React.useEffect(() => {
		setMobileMenuOpen(false);
	}, [pathname]);

	return (
		<div className="fixed inset-0 overflow-hidden bg-background">
			<div className="flex h-full">
				{/* Desktop floating sidebar */}
				<aside
					className={cn(
						"hidden md:flex shrink-0 p-3",
						collapsed ? "w-[80px]" : "w-[268px]"
					)}
				>
					<div className={cn(
						"flex h-full flex-col rounded-2xl border shadow-xl transition-all duration-300 bg-gray-50 dark:bg-gray-950/20",
						collapsed ? "w-[56px]" : "w-full"
					)}>
						<div className={cn("flex items-center justify-between gap-2 px-3 py-4 border-b", collapsed && "justify-center px-2")}>
							<Link href="/admin/planning" className={cn("flex items-center gap-3 rounded-lg px-2 py-1.5 transition-colors hover:bg-gray-100 dark:hover:bg-gray-900/20", collapsed && "px-1")}>
								<div className="relative h-8 w-8 flex-shrink-0 overflow-hidden rounded-lg bg-gray-600 flex items-center justify-center">
									<span className="text-white font-bold text-sm">PR</span>
								</div>
								<div className={cn("leading-tight", collapsed && "sr-only")}>
									<div className="text-sm font-semibold text-foreground">PhotoRunning</div>
									<div className="text-xs text-muted-foreground">Admin</div>
								</div>
							</Link>
						</div>

						<div className="flex-1 overflow-auto">
							<SidebarContent pathname={pathname} collapsed={collapsed} />
						</div>

						<div className="p-2 border-t">
							<Button
								type="button"
								variant="ghost"
								size="sm"
								className={cn("w-full justify-between rounded-lg text-muted-foreground hover:text-foreground hover:bg-gray-100 dark:hover:bg-gray-900/20", collapsed && "justify-center px-0")}
								onClick={() => setCollapsed((v) => !v)}
							>
								<span className={cn("text-xs", collapsed && "sr-only")}>Réduire</span>
								{collapsed ? <ChevronRight className="size-4" /> : <ChevronLeft className="size-4" />}
							</Button>
						</div>
					</div>
				</aside>

				{/* Main column */}
				<div className="flex min-w-0 flex-1 flex-col pr-3 py-3 pl-0 md:pr-3 md:py-3 md:pl-0 p-2">
					<header className="z-40 shrink-0 mb-3 rounded-2xl border bg-card shadow-md md:mb-3 mb-2">
						<div className="mx-auto flex w-full max-w-[1440px] items-center justify-between gap-2 px-3 py-3 md:px-6 md:gap-3">
							<div className="flex min-w-0 items-center gap-3">
								{/* Mobile menu - only render Dialog after mount to prevent hydration mismatch */}
								<div className="md:hidden">
									{mounted ? (
										<Dialog open={mobileMenuOpen} onOpenChange={setMobileMenuOpen}>
											<DialogTrigger asChild>
												<Button variant="ghost" size="lg" className="rounded-xl h-12 w-12" aria-label="Ouvrir la navigation">
													<Menu className="size-6" />
												</Button>
											</DialogTrigger>
											<DialogContent
												showCloseButton
												className="left-0 top-0 h-dvh w-full max-w-[90vw] translate-x-0 translate-y-0 rounded-r-2xl p-0 data-[state=open]:slide-in-from-left-2 data-[state=closed]:slide-out-to-left-2 bg-gradient-to-br from-gray-50 to-gray-50 dark:from-gray-950/20 dark:to-gray-950/20"
											>
												<DialogHeader className="px-4 pt-6 pb-4 border-b">
													<div className="flex items-center gap-3">
														<div className="relative h-10 w-10 flex-shrink-0 overflow-hidden rounded-lg bg-gray-600 flex items-center justify-center">
															<span className="text-white font-bold text-lg">PR</span>
														</div>
														<div>
															<DialogTitle className="text-lg">PhotoRunning</DialogTitle>
															<DialogDescription>Navigation Admin</DialogDescription>
														</div>
													</div>
												</DialogHeader>
												<div className="px-3 py-4 overflow-y-auto" style={{ maxHeight: "calc(100dvh - 100px)" }}>
													<SidebarContent pathname={pathname} collapsed={false} onNavigate={() => setMobileMenuOpen(false)} />
												</div>
											</DialogContent>
										</Dialog>
									) : (
										<Button variant="ghost" size="lg" className="rounded-xl h-12 w-12" aria-label="Ouvrir la navigation">
											<Menu className="size-6" />
										</Button>
									)}
								</div>

								{/* Breadcrumbs + title */}
								<div className="min-w-0">
									<div className="flex items-center gap-2 text-xs text-muted-foreground">
										{meta.crumbs.map((c, idx) => (
											<React.Fragment key={`${c.label}-${idx}`}>
												{idx > 0 && <span aria-hidden> / </span>}
												{c.href ? (
													<Link href={c.href} className="truncate hover:text-foreground">
														{c.label}
													</Link>
												) : (
													<span className="truncate">{c.label}</span>
												)}
											</React.Fragment>
										))}
									</div>
									<div className="truncate text-base font-semibold tracking-tight md:text-lg">{meta.title}</div>
								</div>
							</div>

							<div className="flex items-center gap-1.5">
								{meta.primaryAction && (
									<Button asChild className="hidden sm:inline-flex gap-2 rounded-xl">
										<Link href={meta.primaryAction.href}>
											<Plus className="size-4" />
											{meta.primaryAction.label}
										</Link>
									</Button>
								)}
								<AdminUserMenu user={user} />
							</div>
						</div>
					</header>

					<AdminMain className="min-w-0 flex-1 overflow-y-auto rounded-2xl border bg-card shadow-md">
						<div className="mx-auto w-full max-w-[1440px] px-3 py-4 md:px-6 md:py-8">{children}</div>
					</AdminMain>
				</div>
			</div>
		</div>
	);
}
