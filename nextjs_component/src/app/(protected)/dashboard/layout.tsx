"use client";

import React from "react";
import Link from "next/link";
import { useRouter, usePathname } from "next/navigation";
import { LayoutDashboard, LogOut, User, BarChart2, LineChart, PieChart, TrendingUp } from "lucide-react";
import { supabase } from "@/lib/supabaseClient";
import {
    Avatar,
    AvatarFallback,
    AvatarImage,
} from "@/components/ui/avatar";
import {
    DropdownMenu,
    DropdownMenuTrigger,
    DropdownMenuContent,
    DropdownMenuItem,
} from "@/components/ui/dropdown-menu";
import { Button } from "@/components/ui/button";

export default function DashboardLayout({
    children,
}: {
    children: React.ReactNode;
}) {
    const router = useRouter();
    const pathname = usePathname();

    const handleLogout = async () => {
        await supabase.auth.signOut();
        router.push("/login");
    };

    const navItems = [
        { href: "/dashboard", label: "Home", icon: LayoutDashboard },
        { href: "/dashboard/low-emissions", label: "Low Emissions", icon: LineChart },
        { href: "/dashboard/category-wide", label: "Category Wide", icon: PieChart },
        { href: "/dashboard/best-sellers", label: "Best Sellers", icon: TrendingUp },
        { href: "/dashboard/supplier-analysis", label: "Supplier Analysis", icon: BarChart2 },
    ];

    return (
        <div className="min-h-screen flex flex-col bg-gray-50">
            {/* Fixed Navbar */}
            <nav className="fixed top-0 left-0 w-full z-50 bg-white border-b">
                <div className="max-w-6xl mx-auto px-6 h-16 flex items-center justify-between">
                    {/* Left - Logo and Navigation */}
                    <div className="flex items-center gap-6">
                        <Link href="/dashboard" className="flex items-center gap-2">
                            <LayoutDashboard className="text-teal-600" size={20} />
                            <span className="text-xl font-semibold text-gray-800">Team Leopard</span>
                        </Link>
                        
                        {/* Navigation Buttons */}
                        <div className="flex items-center gap-2">
                            {navItems.map((item) => {
                                const Icon = item.icon;
                                const isActive = pathname === item.href;
                                return (
                                    <Link key={item.href} href={item.href}>
                                        <Button
                                            variant={isActive ? "default" : "ghost"}
                                            size="sm"
                                            className="flex items-center gap-2"
                                        >
                                            <Icon size={16} />
                                            {item.label}
                                        </Button>
                                    </Link>
                                );
                            })}
                        </div>
                    </div>

                    {/* Right - User dropdown */}
                    <DropdownMenu>
                        <DropdownMenuTrigger asChild>
                            <Avatar className="cursor-pointer text-gray-600 hover:text-black bg-transparent rounded-none !overflow-visible">
                                <AvatarImage
                                    src="/images/user.png"
                                    alt="user"
                                    className="bg-transparent rounded-none"
                                />
                                <AvatarFallback className="bg-transparent rounded-none">
                                    <User size={22} />
                                </AvatarFallback>
                            </Avatar>
                        </DropdownMenuTrigger>
                        <DropdownMenuContent align="end" className="w-40 mt-2">
                            <DropdownMenuItem
                                onClick={handleLogout}
                                className="flex items-center gap-2 text-gray-800 cursor-pointer"
                            >
                                <LogOut size={16} /> Log out
                            </DropdownMenuItem>
                        </DropdownMenuContent>
                    </DropdownMenu>
                </div>
            </nav>

            {/* Main content */}
            <main className="pt-20 px-6 w-full max-w-6xl mx-auto flex-1">
                {children}
            </main>
        </div>
    );
}
