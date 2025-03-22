"use client";

import "../globals.css";
import React, { useState, useEffect } from "react";
import {
    Card,
    CardContent,
    CardFooter,
    CardHeader,
    CardTitle,
} from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import Link from "next/link";
import { supabase } from "@/lib/supabaseClient";
import { useRouter } from "next/navigation";

export default function SignUpPage() {
    const [email, setEmail] = useState("");
    const [password, setPassword] = useState("");
    const [error, setError] = useState<string | null>(null);
    const [success, setSuccess] = useState<string | null>(null);
    const [loading, setLoading] = useState(false);
    const router = useRouter();

    // ✅ Redirect to dashboard if already logged in
    useEffect(() => {
        const checkSession = async () => {
            const { data } = await supabase.auth.getSession();
            if (data.session) {
                router.push("/dashboard");
            }
        };

        checkSession();
    }, [router]);

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        setLoading(true);
        setError(null);
        setSuccess(null);

        try {
            const { error: authError } = await supabase.auth.signUp({
                email,
                password,
                options: { emailRedirectTo: `${location.origin}/auth/callback` },
            });

            if (authError) {
                setError(authError.message || "Error creating account.");
                throw authError;
            }

            setSuccess("Account created! Check your email for confirmation.");
        } catch (error: unknown) {
            if (error instanceof Error) {
                setError(error.message || "Error processing request.");
            } else {
                setError("Error processing request.");
            }
            console.error("Signup error:", error);
        } finally {
            setLoading(false);
        }
    };

    return (
        <div className="flex flex-row min-h-screen">
            {/* Left Side - Signup Form */}
            <div className="flex w-full md:w-1/2 justify-center items-center bg-white p-10">
                <Card className="w-full max-w-md shadow-lg rounded-lg">
                    <CardHeader className="text-center">
                        <CardTitle className="text-2xl font-semibold">Sign Up</CardTitle>
                    </CardHeader>
                    <CardContent>
                        {error && <p className="text-red-600 text-sm mb-2">{error}</p>}
                        {success && <p className="text-green-600 text-sm mb-2">{success}</p>}
                        <form onSubmit={handleSubmit}>
                            <div className="grid gap-4">
                                <div>
                                    <Label htmlFor="email" className="pb-1">
                                        Email Address
                                    </Label>
                                    <Input
                                        id="email"
                                        type="email"
                                        placeholder="example@email.com"
                                        value={email}
                                        onChange={(e) => setEmail(e.target.value)}
                                        required
                                    />
                                </div>
                                <div>
                                    <Label htmlFor="password" className="pb-1">
                                        Password
                                    </Label>
                                    <Input
                                        id="password"
                                        type="password"
                                        placeholder="Your password"
                                        value={password}
                                        onChange={(e) => setPassword(e.target.value)}
                                        required
                                    />
                                </div>
                                <Button
                                    className="w-full bg-blue-600 hover:bg-blue-700"
                                    type="submit"
                                    disabled={loading}
                                >
                                    {loading ? "Creating Account..." : "Sign Up"}
                                </Button>
                            </div>
                        </form>
                    </CardContent>
                    <CardFooter className="text-center">
                        <p className="text-sm">
                            Already have an account?{" "}
                            <Link href="/login" className="text-blue-600 hover:underline">
                                Log In
                            </Link>
                        </p>
                    </CardFooter>
                </Card>
            </div>
            {/* Right Side - Background Image */}
            <div
                className="hidden md:block w-1/2 bg-cover bg-center"
                style={{ backgroundImage: "url('/images/sign_up_bg.jpg')" }}
            ></div>
        </div>
    );
}