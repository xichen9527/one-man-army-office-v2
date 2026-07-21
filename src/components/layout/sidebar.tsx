"use client";

import { useState } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  LayoutDashboard,
  FolderKanban,
  CheckSquare,
  FileText,
  Users,
  MessageSquare,
  Sparkles,
  Share2,
  Video,
  Settings,
  Shield,
  ChevronLeft,
  ChevronRight,
  Menu,
  X,
  Zap,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import { Badge } from "@/components/ui/badge";

interface NavItem {
  label: string;
  href: string;
  icon: React.ElementType;
  badge?: string | number;
}

const navItems: NavItem[] = [
  { label: "首页", href: "/", icon: LayoutDashboard },
  { label: "项目", href: "/projects", icon: FolderKanban },
  { label: "任务", href: "/tasks", icon: CheckSquare, badge: 5 },
  { label: "文档", href: "/documents", icon: FileText },
  { label: "客户管理", href: "/crm", icon: Users },
  { label: "协作", href: "/collaboration", icon: MessageSquare },
  { label: "AI 助手", href: "/ai", icon: Sparkles, badge: "NEW" },
  { label: "社交媒体", href: "/social", icon: Share2 },
  { label: "视频会议", href: "/video", icon: Video },
];

const bottomNavItems: NavItem[] = [
  { label: "系统设置", href: "/settings", icon: Settings },
  { label: "管理后台", href: "/admin", icon: Shield },
];

export function Sidebar() {
  const [collapsed, setCollapsed] = useState(false);
  const [mobileOpen, setMobileOpen] = useState(false);
  const pathname = usePathname();

  const NavLink = ({ item }: { item: NavItem }) => {
    const isActive =
      item.href === "/"
        ? pathname === "/"
        : pathname.startsWith(item.href);
    const Icon = item.icon;

    const linkContent = (
      <Link
        href={item.href}
        onClick={() => setMobileOpen(false)}
        className={cn(
          "flex items-center gap-3 rounded-lg px-3 py-2.5 text-sm font-medium transition-all duration-200",
          "hover:bg-sidebar-accent hover:text-sidebar-accent-foreground",
          isActive
            ? "bg-sidebar-primary/15 text-sidebar-primary shadow-sm"
            : "text-sidebar-foreground/70",
          collapsed && "justify-center px-2",
        )}
      >
        <Icon className={cn("h-5 w-5 shrink-0", isActive && "text-sidebar-primary")} />
        {!collapsed && (
          <>
            <span className="flex-1">{item.label}</span>
            {item.badge && (
              <Badge
                variant="secondary"
                className={cn(
                  "h-5 px-1.5 text-[10px] font-semibold leading-none",
                  item.badge === "NEW"
                    ? "bg-emerald-500/20 text-emerald-400"
                    : "bg-sidebar-accent text-sidebar-accent-foreground",
                )}
              >
                {item.badge}
              </Badge>
            )}
          </>
        )}
      </Link>
    );

    if (collapsed) {
      return (
        <Tooltip>
          <TooltipTrigger
            render={
              <Link
                href={item.href}
                onClick={() => setMobileOpen(false)}
                className={cn(
                  "flex items-center justify-center rounded-lg p-2 transition-all duration-200",
                  "hover:bg-sidebar-accent hover:text-sidebar-accent-foreground",
                  isActive
                    ? "bg-sidebar-primary/15 text-sidebar-primary shadow-sm"
                    : "text-sidebar-foreground/70"
                )}
              >
                <Icon className={cn("h-5 w-5", isActive && "text-sidebar-primary")} />
              </Link>
            }
          />
          <TooltipContent side="right" className="flex items-center gap-2">
            {item.label}
            {item.badge && (
              <span className="text-xs text-muted-foreground">{item.badge}</span>
            )}
          </TooltipContent>
        </Tooltip>
      );
    }

    return linkContent;
  };

  const SidebarContent = () => (
    <div className="flex h-full flex-col">
      {/* Header */}
      <div
        className={cn(
          "flex h-16 items-center border-b border-sidebar-border px-4",
          collapsed && "justify-center px-2",
        )}
      >
        <Link href="/" className="flex items-center gap-2.5">
          <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-sidebar-primary shadow-md">
            <Zap className="h-4 w-4 text-white" />
          </div>
          {!collapsed && (
            <div className="flex flex-col">
              <span className="text-sm font-semibold text-sidebar-foreground">
                One Man Army
              </span>
              <span className="text-[10px] text-sidebar-foreground/50">
                AI 协作平台
              </span>
            </div>
          )}
        </Link>
      </div>

      {/* Main Nav */}
      <nav className="flex-1 space-y-1 overflow-y-auto px-2 py-3">
        <div className={cn("mb-1 px-3", collapsed && "hidden")}>
          <span className="text-[10px] font-semibold uppercase tracking-wider text-sidebar-foreground/40">
            导航
          </span>
        </div>
        {navItems.map((item) => (
          <NavLink key={item.href} item={item} />
        ))}
      </nav>

      {/* Bottom Nav */}
      <div className="border-t border-sidebar-border px-2 py-3">
        {bottomNavItems.map((item) => (
          <NavLink key={item.href} item={item} />
        ))}
      </div>

      {/* User Section */}
      <div
        className={cn(
          "flex items-center gap-3 border-t border-sidebar-border p-3",
          collapsed && "justify-center",
        )}
      >
        <Avatar className="h-8 w-8">
          <AvatarImage src="/avatars/user.png" alt="User" />
          <AvatarFallback className="bg-sidebar-primary/20 text-sidebar-primary text-xs font-semibold">
            U
          </AvatarFallback>
        </Avatar>
        {!collapsed && (
          <div className="flex-1 overflow-hidden">
            <p className="truncate text-sm font-medium text-sidebar-foreground">
              用户
            </p>
            <p className="truncate text-xs text-sidebar-foreground/50">
              user@example.com
            </p>
          </div>
        )}
        {!collapsed && (
          <Link href="/settings">
            <Button
              variant="ghost"
              size="icon"
              className="h-7 w-7 text-sidebar-foreground/50 hover:text-sidebar-foreground"
            >
              <Settings className="h-3.5 w-3.5" />
            </Button>
          </Link>
        )}
      </div>
    </div>
  );

  return (
    <>
      {/* Mobile toggle */}
      <Button
        variant="outline"
        size="icon"
        className="fixed left-3 top-3 z-50 h-8 w-8 md:hidden"
        onClick={() => setMobileOpen(true)}
      >
        <Menu className="h-4 w-4" />
      </Button>

      {/* Mobile overlay */}
      {mobileOpen && (
        <div
          className="fixed inset-0 z-40 bg-black/50 md:hidden"
          onClick={() => setMobileOpen(false)}
        />
      )}

      {/* Mobile sidebar */}
      <div
        className={cn(
          "fixed inset-y-0 left-0 z-50 w-64 bg-sidebar shadow-xl transition-transform duration-300 md:hidden",
          mobileOpen ? "translate-x-0" : "-translate-x-full",
        )}
      >
        <Button
          variant="ghost"
          size="icon"
          className="absolute right-2 top-2 h-7 w-7 text-sidebar-foreground/70 hover:text-sidebar-foreground"
          onClick={() => setMobileOpen(false)}
        >
          <X className="h-4 w-4" />
        </Button>
        <SidebarContent />
      </div>

      {/* Desktop sidebar */}
      <aside
        className={cn(
          "hidden md:flex h-screen flex-col bg-sidebar transition-all duration-300",
          collapsed ? "w-[68px]" : "w-[240px]",
        )}
      >
        <div className="flex items-center justify-end px-2 pt-2">
          <Button
            variant="ghost"
            size="icon"
            className="h-7 w-7 text-sidebar-foreground/50 hover:text-sidebar-foreground hover:bg-sidebar-accent"
            onClick={() => setCollapsed(!collapsed)}
          >
            {collapsed ? (
              <ChevronRight className="h-3.5 w-3.5" />
            ) : (
              <ChevronLeft className="h-3.5 w-3.5" />
            )}
          </Button>
        </div>
        <SidebarContent />
      </aside>
    </>
  );
}
